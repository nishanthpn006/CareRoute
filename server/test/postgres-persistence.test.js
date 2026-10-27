import test from 'node:test';
import assert from 'node:assert/strict';
import pg from 'pg';
import 'dotenv/config';
import { PostgresStorageAdapter } from '../src/lib/storage/PostgresAdapter.js';
import { runMigrations } from '../src/lib/storage/migrate.js';
import { SEED_USERS } from '../src/data/trichySeedData.js';

const { Pool } = pg;
const databaseUrl = process.env.DATABASE_URL;

test('PostgreSQL Persistence Integration Suite (careroute_dev)', { skip: !databaseUrl }, async (t) => {
  const pool = new Pool({ connectionString: databaseUrl });
  const adapter = new PostgresStorageAdapter(pool);

  t.after(async () => {
    if (!pool.ending) {
      await pool.end();
    }
  });

  await t.test('1. Connection and schema initialization', async () => {
    const applied = await runMigrations(pool);
    assert.ok(Array.isArray(applied), 'runMigrations should return array of applied migrations');

    const { rows: tables } = await pool.query(`
      SELECT table_name FROM information_schema.tables
      WHERE table_schema = 'public'
      ORDER BY table_name
    `);
    const tableNames = tables.map((r) => r.table_name);
    const requiredTables = [
      'audit_events',
      'availability_current',
      'availability_reports',
      'facilities',
      'facility_capabilities',
      'organizations',
      'schema_migrations',
      'specialist_coverage',
      'users',
    ];

    for (const req of requiredTables) {
      assert.ok(tableNames.includes(req), `Expected table ${req} to exist in schema`);
    }
  });

  await t.test('2. Seed idempotency and boundary data preservation', async () => {
    await adapter.seedIfEmpty();
    // Run second time to verify idempotency
    await adapter.seedIfEmpty();

    const mgmgh = await adapter.getFacility('fac-trichy-mgmgh');
    assert.ok(mgmgh, 'Pilot facility fac-trichy-mgmgh must exist');
    assert.equal(mgmgh.district, 'Tiruchirappalli');
    assert.equal(mgmgh.verificationStatus, 'verified');
    assert.equal(mgmgh.publicationStatus, 'published');

    const apollo = await adapter.getFacility('fac-trichy-apollo');
    assert.ok(apollo, 'Pilot facility fac-trichy-apollo must exist');

    const srirangam = await adapter.getFacility('fac-trichy-srirangam');
    assert.ok(srirangam, 'Pilot facility fac-trichy-srirangam must exist');

    const manapparai = await adapter.getFacility('fac-trichy-manapparai');
    assert.ok(manapparai, 'Pilot facility fac-trichy-manapparai must exist');

    const unverified = await adapter.getFacility('fac-trichy-unverified');
    assert.ok(unverified, 'fac-trichy-unverified must exist');
    assert.equal(unverified.publicationStatus, 'draft');
  });

  await t.test('3. Report submission and read-back', async () => {
    const reporter = SEED_USERS.find((u) => u.id === 'user-mgmgh-reporter');
    assert.ok(reporter, 'MGMGH reporter user must exist');

    const result = await adapter.submitAvailabilityReport({
      facilityId: 'fac-trichy-mgmgh',
      category: 'icu',
      availableBeds: 18,
      totalBeds: 25,
      user: reporter,
      source: 'test_suite',
    });

    assert.equal(result.report.availableBeds, 18);
    assert.equal(result.report.totalBeds, 25);
    assert.equal(result.snapshot.availableBeds, 18);
    assert.equal(result.snapshot.totalBeds, 25);
    assert.ok(result.snapshot.version >= 1);

    // Read back snapshot
    const current = await adapter.getAvailabilityCurrent('fac-trichy-mgmgh', 'icu');
    assert.ok(current, 'Current snapshot must exist');
    assert.equal(current.availableBeds, 18);
    assert.equal(current.totalBeds, 25);
    assert.equal(current.latestReportId, result.report.reportId);

    // Read back reports history
    const reports = await adapter.listAvailabilityReports('fac-trichy-mgmgh', { category: 'icu' });
    assert.ok(reports.length >= 1);
    assert.equal(reports[0].reportId, result.report.reportId);
  });

  await t.test('4. Consistency between report history and current snapshots', async () => {
    const reporter = SEED_USERS.find((u) => u.id === 'user-mgmgh-reporter');
    const prevSnapshot = await adapter.getAvailabilityCurrent('fac-trichy-mgmgh', 'icu');
    const prevVersion = prevSnapshot.version;

    // Submit a successive update
    const update = await adapter.submitAvailabilityReport({
      facilityId: 'fac-trichy-mgmgh',
      category: 'icu',
      availableBeds: 14,
      totalBeds: 25,
      user: reporter,
      source: 'test_suite_update',
    });

    assert.equal(update.snapshot.version, prevVersion + 1);
    assert.equal(update.snapshot.availableBeds, 14);

    const history = await adapter.listAvailabilityReports('fac-trichy-mgmgh', { category: 'icu' });
    assert.ok(history.length >= 2, 'History must contain at least 2 reports');
    assert.equal(history[0].reportId, update.report.reportId);
    assert.equal(history[0].availableBeds, 14);
    assert.equal(history[1].availableBeds, 18);
  });

  await t.test('5. Transaction rollback when a required write fails', async () => {
    const reporter = SEED_USERS.find((u) => u.id === 'user-mgmgh-reporter');
    const snapshotBefore = await adapter.getAvailabilityCurrent('fac-trichy-mgmgh', 'icu');

    // Attempt invalid report: availableBeds > totalBeds
    await assert.rejects(
      async () => {
        await adapter.submitAvailabilityReport({
          facilityId: 'fac-trichy-mgmgh',
          category: 'icu',
          availableBeds: 999,
          totalBeds: 25,
          user: reporter,
          source: 'invalid_submission',
        });
      },
      (err) => {
        assert.equal(err.statusCode, 400);
        assert.match(err.message, /cannot exceed/i);
        return true;
      }
    );

    // Verify snapshot was NOT mutated and version is identical
    const snapshotAfter = await adapter.getAvailabilityCurrent('fac-trichy-mgmgh', 'icu');
    assert.equal(snapshotAfter.availableBeds, snapshotBefore.availableBeds);
    assert.equal(snapshotAfter.version, snapshotBefore.version);

    // Verify rejected audit event was logged
    const audits = await adapter.listAuditEvents({ facilityId: 'fac-trichy-mgmgh' });
    const rejectedEvent = audits.find(
      (e) => e.action === 'availability_report.rejected' && e.outcome === 'rejected'
    );
    assert.ok(rejectedEvent, 'Rejected audit event must be recorded outside transaction');
  });

  await t.test('6. Zero availability versus unknown availability', async () => {
    const reporter = SEED_USERS.find((u) => u.id === 'user-mgmgh-reporter');

    // Submit 0 available beds (all full) for pediatric ward
    await adapter.submitAvailabilityReport({
      facilityId: 'fac-trichy-mgmgh',
      category: 'pediatric',
      availableBeds: 0,
      totalBeds: 30,
      user: reporter,
    });

    const pediatricSnapshot = await adapter.getAvailabilityCurrent('fac-trichy-mgmgh', 'pediatric');
    assert.ok(pediatricSnapshot, 'Pediatric snapshot must exist');
    assert.equal(pediatricSnapshot.availableBeds, 0);
    assert.equal(pediatricSnapshot.totalBeds, 30);

    // Check an un-reported category for Srirangam (e.g. icu)
    const srirangamIcu = await adapter.getAvailabilityCurrent('fac-trichy-srirangam', 'icu');
    assert.equal(srirangamIcu, null, 'Unreported ward must have null snapshot (unknown)');
  });

  await t.test('7. Facility authorization and tenant isolation', async () => {
    const apolloAdmin = SEED_USERS.find((u) => u.id === 'user-apollo-admin');
    assert.ok(apolloAdmin);

    // Apollo admin attempts IDOR to report for government hospital MGMGH
    await assert.rejects(
      async () => {
        await adapter.submitAvailabilityReport({
          facilityId: 'fac-trichy-mgmgh',
          category: 'icu',
          availableBeds: 5,
          totalBeds: 25,
          user: apolloAdmin,
        });
      },
      (err) => {
        assert.equal(err.statusCode, 403);
        assert.match(err.message, /Forbidden/i);
        return true;
      }
    );
  });

  await t.test('8. Persistence after an actual backend restart', async () => {
    const reporter = SEED_USERS.find((u) => u.id === 'user-mgmgh-reporter');

    // 1. Submit report with current adapter
    const submitted = await adapter.submitAvailabilityReport({
      facilityId: 'fac-trichy-mgmgh',
      category: 'general',
      availableBeds: 42,
      totalBeds: 50,
      user: reporter,
      source: 'pre_restart_probe',
    });

    // 2. Simulate complete server shutdown by destroying the pool
    await pool.end();

    // 3. Simulate new backend process starting up with a fresh pool
    const restartPool = new Pool({ connectionString: databaseUrl });
    const restartedAdapter = new PostgresStorageAdapter(restartPool);

    try {
      // 4. Verify data persisted exactly
      const snapshot = await restartedAdapter.getAvailabilityCurrent('fac-trichy-mgmgh', 'general');
      assert.ok(snapshot, 'Snapshot must persist after restart');
      assert.equal(snapshot.availableBeds, 42);
      assert.equal(snapshot.totalBeds, 50);
      assert.equal(snapshot.latestReportId, submitted.report.reportId);

      const reports = await restartedAdapter.listAvailabilityReports('fac-trichy-mgmgh', { category: 'general' });
      assert.ok(reports.some((r) => r.reportId === submitted.report.reportId), 'Report history must persist after restart');
    } finally {
      await restartPool.end();
    }
  });

  await t.test('9. Consistent data across portals and projections', async () => {
    const freshPool = new Pool({ connectionString: databaseUrl });
    const freshAdapter = new PostgresStorageAdapter(freshPool);

    try {
      // Find Hospitals directory projection
      const directory = await freshAdapter.getPublicDirectory();
      assert.ok(directory.length >= 4, 'Must project verified published facilities');

      const mgmghProj = directory.find((f) => f.id === 'fac-trichy-mgmgh');
      assert.ok(mgmghProj, 'MGMGH must be in public directory');
      assert.equal(mgmghProj.availability.general.availableBeds, 42);
      assert.equal(mgmghProj.availability.icu.availableBeds, 14);
      assert.equal(mgmghProj.availability.pediatric.availableBeds, 0);

      // Staff Portal authorized facilities
      const reporter = SEED_USERS.find((u) => u.id === 'user-mgmgh-reporter');
      const authorized = await freshAdapter.listAuthorizedFacilities(reporter);
      assert.ok(authorized.some((f) => f.id === 'fac-trichy-mgmgh'));
      const mgmghStaff = authorized.find((f) => f.id === 'fac-trichy-mgmgh');
      assert.equal(mgmghStaff.beds.general, 42);
      assert.equal(mgmghStaff.beds.icu, 14);
    } finally {
      await freshPool.end();
    }
  });
});

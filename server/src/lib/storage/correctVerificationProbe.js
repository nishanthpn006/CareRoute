import { randomUUID } from 'node:crypto';
import pg from 'pg';
import 'dotenv/config';

const { Pool } = pg;

export const TARGET_REPORT_ID = 'f67d657c-b049-4112-9929-a127225b0047';
export const TARGET_FACILITY_ID = 'fac-trichy-srirangam';
export const TARGET_CATEGORY = 'pediatric';
export const TARGET_SOURCE = 'final_verification_probe';

/**
 * Narrow, idempotent correction script to restore pre-test UNKNOWN state
 * for Srirangam pediatric ward without destroying the historical audit trail.
 *
 * @param {import('pg').Pool} pool
 */
export async function correctVerificationProbe(pool) {
  const client = await pool.connect();
  try {
    // 1. Verify target report in availability_reports
    const { rows: reportRows } = await client.query(
      'SELECT * FROM availability_reports WHERE report_id = $1',
      [TARGET_REPORT_ID]
    );

    if (reportRows.length === 0) {
      return {
        status: 'skipped',
        message: `Report ${TARGET_REPORT_ID} not found. Nothing to correct.`,
      };
    }

    const report = reportRows[0];
    if (
      report.facility_id !== TARGET_FACILITY_ID ||
      report.category !== TARGET_CATEGORY ||
      report.source !== TARGET_SOURCE
    ) {
      throw new Error(
        `Safety guard triggered: Report ${TARGET_REPORT_ID} does not match expected verification probe metadata.`
      );
    }

    // 2. Check current snapshot in availability_current
    const { rows: currentRows } = await client.query(
      'SELECT * FROM availability_current WHERE facility_id = $1 AND category = $2',
      [TARGET_FACILITY_ID, TARGET_CATEGORY]
    );

    if (currentRows.length === 0) {
      return {
        status: 'already_corrected',
        message: `Facility ${TARGET_FACILITY_ID} ward ${TARGET_CATEGORY} has no current snapshot (already UNKNOWN).`,
      };
    }

    const current = currentRows[0];
    if (current.latest_report_id !== TARGET_REPORT_ID) {
      return {
        status: 'superseded',
        message: `Current snapshot is governed by newer report ${current.latest_report_id}. Will not overwrite.`,
      };
    }

    // 3. Atomically retract snapshot and append correction audit event
    await client.query('BEGIN');
    try {
      await client.query(
        'DELETE FROM availability_current WHERE facility_id = $1 AND category = $2 AND latest_report_id = $3',
        [TARGET_FACILITY_ID, TARGET_CATEGORY, TARGET_REPORT_ID]
      );

      const eventId = randomUUID();
      const auditChanges = {
        category: TARGET_CATEGORY,
        retractedSnapshotReportId: TARGET_REPORT_ID,
        restoredAvailabilityState: 'UNKNOWN',
        reason: 'Restoring pre-test UNKNOWN state; immutable report preserved in audit history.',
      };

      await client.query(
        `INSERT INTO audit_events (
          event_id, actor_uid, actor_email, actor_role, facility_id, organization_id, action, outcome, timestamp, changes, reason
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), $9, $10)`,
        [
          eventId,
          'system-maintenance',
          'maintenance@careroute.local',
          'security_admin',
          TARGET_FACILITY_ID,
          'org-tn-hfw',
          'availability_snapshot.corrected_test_probe',
          'accepted',
          JSON.stringify(auditChanges),
          'Restored pre-test UNKNOWN state after cold-restart verification probe',
        ]
      );

      await client.query('COMMIT');
      return {
        status: 'corrected',
        message: `Successfully retracted snapshot for ${TARGET_FACILITY_ID} ${TARGET_CATEGORY}. Report ${TARGET_REPORT_ID} preserved in history.`,
        eventId,
      };
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    }
  } finally {
    client.release();
  }
}

// CLI entrypoint
if (process.argv[1] && process.argv[1].endsWith('correctVerificationProbe.js')) {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error('[CareRoute Correction] DATABASE_URL is not set.');
    process.exit(1);
  }

  const pool = new Pool({ connectionString: databaseUrl });
  correctVerificationProbe(pool)
    .then(async (result) => {
      console.log('[CareRoute Correction]', result);
      await pool.end();
      process.exit(0);
    })
    .catch(async (err) => {
      console.error('[CareRoute Correction] Failed:', err);
      await pool.end();
      process.exit(1);
    });
}

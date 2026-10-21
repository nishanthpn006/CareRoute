import test from 'node:test';
import assert from 'node:assert/strict';
import { FirestoreStorageAdapter } from '../src/lib/storage/FirestoreAdapter.js';
import { InMemoryStorageAdapter } from '../src/lib/storage/InMemoryAdapter.js';
import { createStorageAdapter } from '../src/lib/domainStore.js';

/**
 * Mock Firestore database implementation with transaction and batch semantics.
 */
class MockFirestore {
  constructor() {
    this.data = new Map();
  }

  _getCollection(name) {
    if (!this.data.has(name)) {
      this.data.set(name, new Map());
    }
    return this.data.get(name);
  }

  collection(name) {
    const self = this;
    return {
      doc(id) {
        return {
          id,
          collectionName: name,
          async get() {
            const col = self._getCollection(name);
            const exists = col.has(id);
            return {
              id,
              exists,
              data: () => (exists ? structuredClone(col.get(id)) : undefined),
            };
          },
          async set(data, options = {}) {
            const col = self._getCollection(name);
            if (options.merge && col.has(id)) {
              col.set(id, { ...col.get(id), ...structuredClone(data) });
            } else {
              col.set(id, structuredClone(data));
            }
          },
          async delete() {
            self._getCollection(name).delete(id);
          },
        };
      },
      where(field, op, val) {
        return self._createQuery(name, [{ field, op, val }]);
      },
      limit(n) {
        return self._createQuery(name, []).limit(n);
      },
      async get() {
        return self._createQuery(name, []).get();
      },
    };
  }

  _createQuery(name, filters = []) {
    const self = this;
    let limitCount = null;
    const query = {
      where(field, op, val) {
        filters.push({ field, op, val });
        return query;
      },
      limit(n) {
        limitCount = n;
        return query;
      },
      async get() {
        const col = self._getCollection(name);
        let docs = Array.from(col.entries()).map(([id, data]) => ({
          id,
          data: () => structuredClone(data),
        }));

        for (const { field, op, val } of filters) {
          docs = docs.filter((d) => {
            const valInDoc = d.data()[field];
            if (op === '==') return valInDoc === val;
            return true;
          });
        }

        if (limitCount !== null) {
          docs = docs.slice(0, limitCount);
        }

        return {
          empty: docs.length === 0,
          size: docs.length,
          docs,
        };
      },
    };
    return query;
  }

  batch() {
    const operations = [];
    return {
      set(docRef, data, options) {
        operations.push({ type: 'set', docRef, data, options });
      },
      delete(docRef) {
        operations.push({ type: 'delete', docRef });
      },
      async commit() {
        for (const op of operations) {
          if (op.type === 'set') {
            await op.docRef.set(op.data, op.options);
          } else if (op.type === 'delete') {
            await op.docRef.delete();
          }
        }
      },
    };
  }

  async runTransaction(updateFunction) {
    const stagedWrites = [];
    const transaction = {
      async get(docRef) {
        return await docRef.get();
      },
      set(docRef, data, options) {
        stagedWrites.push({ docRef, data, options });
      },
      delete(docRef) {
        stagedWrites.push({ docRef, delete: true });
      },
    };

    const result = await updateFunction(transaction);

    // Apply staged writes atomically only if updateFunction does not throw
    for (const write of stagedWrites) {
      if (write.delete) {
        await write.docRef.delete();
      } else {
        await write.docRef.set(write.data, write.options);
      }
    }

    return result;
  }
}

test('Firestore persistence adapter - initialization and idempotent seeding', async () => {
  const db = new MockFirestore();
  const adapter = new FirestoreStorageAdapter(db);

  // 1. Initial seed populates collections
  await adapter.seedIfEmpty();

  const facilities = await adapter.listFacilities();
  assert.ok(facilities.length >= 3, 'Must seed Tiruchirappalli facilities');

  const orgs = await adapter.listOrganizations();
  assert.ok(orgs.length >= 2, 'Must seed organizations');

  // Verify bed capacity is UNKNOWN and unseeded
  const snap = await adapter.getAvailabilityCurrent('fac-trichy-mgmgh', 'general');
  assert.equal(snap, null, 'Initial capacity must remain UNKNOWN until explicit reports are submitted');

  // 2. Calling seedIfEmpty a second time is idempotent
  await adapter.seedIfEmpty();
  const facilitiesAfter = await adapter.listFacilities();
  assert.equal(facilitiesAfter.length, facilities.length, 'Subsequent seeding must not duplicate records');
});

test('Firestore persistence adapter - atomic report transaction and snapshot versioning', async () => {
  const db = new MockFirestore();
  const adapter = new FirestoreStorageAdapter(db);
  await adapter.seedIfEmpty();

  const reporter = await adapter.getUserByEmail('reporter@mgmgh.local');
  assert.ok(reporter, 'Reporter user must exist');

  // 1. Submit first valid report
  const res1 = await adapter.submitAvailabilityReport({
    facilityId: 'fac-trichy-mgmgh',
    category: 'general',
    availableBeds: 15,
    totalBeds: 30,
    user: reporter,
    source: 'staff_portal',
  });

  assert.equal(res1.report.status, 'accepted');
  assert.equal(res1.snapshot.version, 1);
  assert.equal(res1.snapshot.availableBeds, 15);
  assert.equal(res1.snapshot.totalBeds, 30);
  assert.equal(res1.auditEvent.outcome, 'accepted');

  // 2. Submit second valid report - verify version increment
  const res2 = await adapter.submitAvailabilityReport({
    facilityId: 'fac-trichy-mgmgh',
    category: 'general',
    availableBeds: 10,
    totalBeds: 30,
    user: reporter,
    source: 'staff_portal',
  });

  assert.equal(res2.snapshot.version, 2);
  assert.equal(res2.snapshot.availableBeds, 10);

  // Verify persistence in database
  const reports = await adapter.listAvailabilityReports('fac-trichy-mgmgh', { category: 'general' });
  assert.equal(reports.length, 2, 'Both reports must be appended to report history');

  const currentSnapshot = await adapter.getAvailabilityCurrent('fac-trichy-mgmgh', 'general');
  assert.equal(currentSnapshot.version, 2);
  assert.equal(currentSnapshot.availableBeds, 10);
});

test('Firestore persistence adapter - transaction rollback on invalid capacity invariants', async () => {
  const db = new MockFirestore();
  const adapter = new FirestoreStorageAdapter(db);
  await adapter.seedIfEmpty();

  const reporter = await adapter.getUserByEmail('reporter@mgmgh.local');

  // Seed baseline
  await adapter.submitAvailabilityReport({
    facilityId: 'fac-trichy-mgmgh',
    category: 'general',
    availableBeds: 12,
    totalBeds: 25,
    user: reporter,
  });

  const reportsBefore = await adapter.listAvailabilityReports('fac-trichy-mgmgh');
  const snapshotBefore = await adapter.getAvailabilityCurrent('fac-trichy-mgmgh', 'general');

  // Submit invalid report: availableBeds (40) > totalBeds (25)
  await assert.rejects(
    async () => {
      await adapter.submitAvailabilityReport({
        facilityId: 'fac-trichy-mgmgh',
        category: 'general',
        availableBeds: 40,
        totalBeds: 25,
        user: reporter,
      });
    },
    (err) => {
      assert.equal(err.statusCode, 400);
      assert.ok(err.message.includes('cannot exceed totalBeds'));
      return true;
    },
  );

  // Verify snapshot was NOT modified
  const snapshotAfter = await adapter.getAvailabilityCurrent('fac-trichy-mgmgh', 'general');
  assert.equal(snapshotAfter.version, snapshotBefore.version);
  assert.equal(snapshotAfter.availableBeds, 12);

  // Verify report was NOT added to history
  const reportsAfter = await adapter.listAvailabilityReports('fac-trichy-mgmgh');
  assert.equal(reportsAfter.length, reportsBefore.length);

  // Verify rejection audit event was logged
  const auditEvents = await adapter.listAuditEvents({ facilityId: 'fac-trichy-mgmgh' });
  const rejectionEvent = auditEvents.find((e) => e.outcome === 'rejected');
  assert.ok(rejectionEvent, 'Rejected audit event must be recorded');
  assert.equal(rejectionEvent.action, 'availability_report.rejected');
});

test('Firestore persistence adapter - authorization enforcement and tenant isolation', async () => {
  const db = new MockFirestore();
  const adapter = new FirestoreStorageAdapter(db);
  await adapter.seedIfEmpty();

  const mgmghReporter = await adapter.getUserByEmail('reporter@mgmgh.local');
  const apolloAdmin = await adapter.getUserByEmail('admin@apollo-trichy.local');

  // 1. Reporter attempting to report for unassigned Apollo hospital -> 403 Forbidden
  await assert.rejects(
    async () => {
      await adapter.submitAvailabilityReport({
        facilityId: 'fac-trichy-apollo',
        category: 'general',
        availableBeds: 5,
        totalBeds: 20,
        user: mgmghReporter,
      });
    },
    (err) => {
      assert.equal(err.statusCode, 403);
      return true;
    },
  );

  // 2. Org admin attempting cross-organization update -> 403 Forbidden
  await assert.rejects(
    async () => {
      await adapter.submitAvailabilityReport({
        facilityId: 'fac-trichy-mgmgh',
        category: 'icu',
        availableBeds: 2,
        totalBeds: 10,
        user: apolloAdmin,
      });
    },
    (err) => {
      assert.equal(err.statusCode, 403);
      return true;
    },
  );

  // 3. Platform verifier cannot submit clinical capacity reports
  const verifier = await adapter.getUserByEmail('verifier@careroute.local');
  await assert.rejects(
    async () => {
      await adapter.submitAvailabilityReport({
        facilityId: 'fac-trichy-mgmgh',
        category: 'general',
        availableBeds: 10,
        totalBeds: 20,
        user: verifier,
      });
    },
    (err) => {
      assert.equal(err.statusCode, 403);
      return true;
    },
  );
});

test('Firestore persistence adapter - restart persistence', async () => {
  const db = new MockFirestore();

  // First session: write data
  const adapterSession1 = new FirestoreStorageAdapter(db);
  await adapterSession1.seedIfEmpty();
  const reporter = await adapterSession1.getUserByEmail('reporter@mgmgh.local');

  await adapterSession1.submitAvailabilityReport({
    facilityId: 'fac-trichy-mgmgh',
    category: 'general',
    availableBeds: 14,
    totalBeds: 30,
    user: reporter,
  });

  // Second session: simulate server restart connecting to same database
  const adapterSession2 = new FirestoreStorageAdapter(db);

  const facility = await adapterSession2.getFacility('fac-trichy-mgmgh');
  assert.ok(facility, 'Facility must persist across restarts');

  const snapshot = await adapterSession2.getAvailabilityCurrent('fac-trichy-mgmgh', 'general');
  assert.ok(snapshot, 'Snapshot must persist across restarts');
  assert.equal(snapshot.availableBeds, 14);
  assert.equal(snapshot.version, 1);

  const reports = await adapterSession2.listAvailabilityReports('fac-trichy-mgmgh');
  assert.equal(reports.length, 1, 'Report history must persist across restarts');
});

test('Firestore persistence adapter - public directory projection and privacy', async () => {
  const db = new MockFirestore();
  const adapter = new FirestoreStorageAdapter(db);
  await adapter.seedIfEmpty();

  const publicList = await adapter.getPublicDirectory();
  assert.ok(publicList.length > 0, 'Public directory must return facilities');

  for (const fac of publicList) {
    // 1. Private fields must be omitted
    assert.equal(fac.privateVerificationData, undefined, 'privateVerificationData must be omitted');
    assert.equal(fac.reviewerNotes, undefined, 'reviewerNotes must be omitted');
    assert.equal(fac.staffUsers, undefined, 'staff identities must be omitted');

    // 2. Draft or suspended facilities must not be present
    assert.notEqual(fac.publicationStatus, 'draft');
    assert.notEqual(fac.operatingStatus, 'suspended');
    assert.equal(fac.verificationStatus, 'verified');

    // 3. Availability status must be one of standard freshness states
    for (const [cat, data] of Object.entries(fac.availability)) {
      assert.ok(['FRESH', 'OVERDUE', 'STALE', 'UNKNOWN'].includes(data.freshnessState));
      assert.equal(data.isVerifiedAvailability, false, 'isVerifiedAvailability must explicitly be false');
      if (data.freshnessState === 'UNKNOWN') {
        assert.equal(data.reportedAt, null, 'Unknown beds must have null reportedAt');
      }
    }
  }
});

test('Configuration validation and adapter factory strictness', () => {
  // 1. Missing db throws clear error in firebase mode
  assert.throws(
    () => {
      createStorageAdapter('firebase', null);
    },
    (err) => {
      assert.ok(err.message.includes('Firebase mode is enabled (DATA_MODE=firebase)'));
      return true;
    },
  );

  // 2. Invalid db passed to FirestoreStorageAdapter throws
  assert.throws(
    () => {
      new FirestoreStorageAdapter(null);
    },
    (err) => {
      assert.ok(err.message.includes('valid Firestore instance'));
      return true;
    },
  );

  // 3. Demo mode creates InMemoryStorageAdapter
  const demoAdapter = createStorageAdapter('demo');
  assert.ok(demoAdapter instanceof InMemoryStorageAdapter);
});

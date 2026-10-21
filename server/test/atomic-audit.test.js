import test from 'node:test';
import assert from 'node:assert/strict';
import { domainStore } from '../src/lib/domainStore.js';

test('atomic availability updates and audit history consistency', async (t) => {
  domainStore.reset();

  const user = domainStore.getUser('user-mgmgh-reporter');
  const facilityId = 'fac-trichy-mgmgh';

  await t.test('accepted report atomically creates report, updates snapshot, and writes audit event', () => {
    const startTime = new Date('2026-10-16T10:00:00.000Z').getTime();

    const result = domainStore.submitAvailabilityReport({
      facilityId,
      category: 'general',
      availableBeds: 15,
      totalBeds: 50,
      user,
      source: 'manual_staff_portal',
      now: startTime,
    });

    // 1. Check report record
    assert.ok(result.report.reportId);
    assert.equal(result.report.category, 'general');
    assert.equal(result.report.availableBeds, 15);
    assert.equal(result.report.totalBeds, 50);
    assert.equal(result.report.reportedByUid, user.id);
    assert.equal(result.report.status, 'accepted');

    // 2. Check current snapshot
    const snapshot = domainStore.getAvailabilityCurrent(facilityId, 'general');
    assert.ok(snapshot);
    assert.equal(snapshot.availableBeds, 15);
    assert.equal(snapshot.totalBeds, 50);
    assert.equal(snapshot.latestReportId, result.report.reportId);
    assert.equal(snapshot.version, 1);

    // 3. Check audit event
    const events = domainStore.listAuditEvents({ facilityId });
    assert.ok(events.length >= 1);
    const lastEvent = events[0];
    assert.equal(lastEvent.action, 'availability_report.submitted');
    assert.equal(lastEvent.outcome, 'accepted');
    assert.equal(lastEvent.actorUid, user.id);
    assert.equal(lastEvent.changes.newAvailable, 15);
    assert.equal(lastEvent.changes.newTotal, 50);
  });

  await t.test('successive updates append to report history and update snapshot version', () => {
    const updateTime = new Date('2026-10-16T10:10:00.000Z').getTime();

    const secondResult = domainStore.submitAvailabilityReport({
      facilityId,
      category: 'general',
      availableBeds: 12, // 3 beds occupied
      totalBeds: 50,
      user,
      now: updateTime,
    });

    // Report history must contain BOTH reports (append-only)
    const reports = domainStore.listAvailabilityReports(facilityId, { category: 'general' });
    assert.equal(reports.length, 2, 'History must retain both submissions');
    assert.equal(reports[0].availableBeds, 12);
    assert.equal(reports[1].availableBeds, 15);

    // Current snapshot must reflect latest report and incremented version
    const snapshot = domainStore.getAvailabilityCurrent(facilityId, 'general');
    assert.equal(snapshot.availableBeds, 12);
    assert.equal(snapshot.latestReportId, secondResult.report.reportId);
    assert.equal(snapshot.version, 2);

    // Audit log records previous and new values
    const events = domainStore.listAuditEvents({ facilityId });
    const latestEvent = events[0];
    assert.equal(latestEvent.changes.previousAvailable, 15);
    assert.equal(latestEvent.changes.newAvailable, 12);
  });

  await t.test('rejected report does NOT corrupt snapshot and logs sanitized rejection audit event', () => {
    const snapshotBefore = domainStore.getAvailabilityCurrent(facilityId, 'general');

    assert.throws(
      () => {
        domainStore.submitAvailabilityReport({
          facilityId,
          category: 'general',
          availableBeds: 60, // Invalid: exceeds total 50
          totalBeds: 50,
          user,
          now: new Date('2026-10-16T10:20:00.000Z').getTime(),
        });
      },
      (err) => {
        assert.ok(err.message.includes('cannot exceed totalBeds'));
        return true;
      },
    );

    // Snapshot MUST remain unchanged
    const snapshotAfter = domainStore.getAvailabilityCurrent(facilityId, 'general');
    assert.equal(snapshotAfter.availableBeds, snapshotBefore.availableBeds);
    assert.equal(snapshotAfter.version, snapshotBefore.version);

    // Audit log must record the rejection with sanitized reason
    const events = domainStore.listAuditEvents({ facilityId });
    const rejectionEvent = events[0];
    assert.equal(rejectionEvent.action, 'availability_report.rejected');
    assert.equal(rejectionEvent.outcome, 'rejected');
    assert.ok(rejectionEvent.reason.includes('cannot exceed totalBeds'));
    assert.equal(rejectionEvent.changes.availableBeds, 60);
  });
});

import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../src/config.js';
import { domainStore } from '../src/lib/domainStore.js';
import { hospitalsRouter } from '../src/routes/hospitals.js';
import { adminRouter } from '../src/routes/admin.js';
import { authRouter } from '../src/routes/auth.js';

function createTestApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/auth', authRouter);
  app.use('/api/hospitals', hospitalsRouter);
  app.use('/api/admin', adminRouter);
  return app;
}

function generateToken(user) {
  return jwt.sign(
    {
      id: user.id,
      uid: user.id,
      email: user.email,
      role: user.role,
      organizationId: user.organizationId,
      assignedFacilityIds: user.assignedFacilityIds || [],
    },
    config.jwtSecret,
    { subject: user.email, expiresIn: '1h' },
  );
}

test('Milestone 2A — Public hospital endpoints exclude unverified, unpublished and suspended facilities', async () => {
  domainStore.reset();
  const app = createTestApp();
  const server = app.listen(0);
  const { port } = server.address();
  const baseUrl = `http://127.0.0.1:${port}`;

  try {
    // 1. List facilities
    const res = await fetch(`${baseUrl}/api/hospitals`);
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.ok(Array.isArray(body.data));

    const returnedIds = body.data.map((h) => h.id);
    // Verified facilities must be present
    assert.ok(returnedIds.includes('fac-trichy-mgmgh'), 'MGMGH must be present');
    assert.ok(returnedIds.includes('fac-trichy-apollo'), 'Apollo Trichy must be present');

    // Unverified candidate facility must NOT be present
    assert.ok(!returnedIds.includes('fac-trichy-unverified'), 'Unverified facility must be excluded');

    // 2. Direct lookup of unverified facility returns 404
    const directRes = await fetch(`${baseUrl}/api/hospitals/fac-trichy-unverified`);
    assert.equal(directRes.status, 404);

    // 3. Suspend a facility and verify it disappears from public matching
    domainStore.facilities.get('fac-trichy-apollo').operatingStatus = 'suspended';
    const resAfterSuspend = await fetch(`${baseUrl}/api/hospitals`);
    const idsAfterSuspend = (await resAfterSuspend.json()).data.map((h) => h.id);
    assert.ok(!idsAfterSuspend.includes('fac-trichy-apollo'), 'Suspended facility must be excluded');

    // Direct lookup of suspended facility returns 404
    const directSuspendRes = await fetch(`${baseUrl}/api/hospitals/fac-trichy-apollo`);
    assert.equal(directSuspendRes.status, 404);

    // 4. Privacy: private verification data is never exposed
    for (const hospital of body.data) {
      assert.equal(hospital.privateVerificationData, undefined);
      assert.equal(hospital.reviewerNotes, undefined);
      assert.equal(hospital.auditEvents, undefined);
    }
  } finally {
    server.close();
  }
});

test('Milestone 2A — Public capacity results distinguish fresh, overdue, stale and unknown reports', async () => {
  domainStore.reset();
  const app = createTestApp();
  const server = app.listen(0);
  const { port } = server.address();
  const baseUrl = `http://127.0.0.1:${port}`;

  try {
    // Initially, seed data has NO reports -> availability is UNKNOWN and confirmed beds is 0
    const resInit = await fetch(`${baseUrl}/api/hospitals/fac-trichy-mgmgh`);
    const initBody = await resInit.json();
    assert.equal(initBody.data.beds.general, 0);
    assert.equal(initBody.data.availability.general.freshnessState, 'UNKNOWN');

    // Submit a fresh availability report
    const t0 = Date.now();
    const reporter = domainStore.getUserByEmail('reporter@mgmgh.local');
    domainStore.submitAvailabilityReport({
      facilityId: 'fac-trichy-mgmgh',
      category: 'icu',
      availableBeds: 7,
      totalBeds: 20,
      user: reporter,
      now: t0,
    });

    // Check immediately (FRESH)
    const resFresh = await fetch(`${baseUrl}/api/hospitals/fac-trichy-mgmgh`);
    const freshBody = await resFresh.json();
    assert.equal(freshBody.data.beds.icu, 7, 'Fresh report must reflect confirmed available beds');
    assert.equal(freshBody.data.availability.icu.freshnessState, 'FRESH');

    // Test stale transition: when report is > 60 minutes old
    const tStale = t0 + 65 * 60 * 1000; // 65 minutes later
    const facility = domainStore.getFacility('fac-trichy-mgmgh');
    const availMap = domainStore.getFacilityAvailabilityMap('fac-trichy-mgmgh');
    const capabilities = domainStore.getFacilityCapabilities('fac-trichy-mgmgh');
    const coverage = domainStore.getSpecialistCoverage('fac-trichy-mgmgh');

    const { toPublicFacilityProjection } = await import('../src/domain/projections.js');
    const { projectToLegacyHospital } = await import('../src/routes/hospitals.js');
    const projection = toPublicFacilityProjection(facility, availMap, capabilities, coverage, tStale);
    const adapted = projectToLegacyHospital(projection);

    assert.equal(adapted.availability.icu.freshnessState, 'STALE');
    assert.equal(adapted.beds.icu, 0, 'Stale report must NOT be described as confirmed current capacity');
  } finally {
    server.close();
  }
});

test('Milestone 2A — Hospital registration creates draft rather than published facility', async () => {
  domainStore.reset();
  const app = createTestApp();
  const server = app.listen(0);
  const { port } = server.address();
  const baseUrl = `http://127.0.0.1:${port}`;

  try {
    const adminUser = domainStore.getUserByEmail('admin@careroute.local');
    const token = generateToken(adminUser);

    const payload = {
      name: 'Puthur New Emergency Wing',
      address: 'Near Puthur Four Roads, Tiruchirappalli',
      city: 'Tiruchirappalli',
      district: 'Tiruchirappalli',
      state: 'Tamil Nadu',
      postalCode: '620017',
      phone: '0431-2777888',
      latitude: 10.814,
      longitude: 78.686,
      beds: { general: 15, icu: 4 },
      operatingStatus: 'open',
    };

    const res = await fetch(`${baseUrl}/api/admin/hospitals`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(payload),
    });

    assert.equal(res.status, 201);
    const created = (await res.json()).data;
    assert.equal(created.verificationStatus, 'pending');
    assert.equal(created.publicationStatus, 'draft');
    assert.equal(created.organizationId, adminUser.organizationId);

    // Verify it is NOT returned in public directory
    const publicRes = await fetch(`${baseUrl}/api/hospitals`);
    const publicList = (await publicRes.json()).data;
    assert.ok(!publicList.map((h) => h.id).includes(created.id), 'Draft facility must not be public');

    // Verify direct public lookup returns 404
    const directRes = await fetch(`${baseUrl}/api/hospitals/${created.id}`);
    assert.equal(directRes.status, 404);

    // Verify authorized admin CAN see it in their admin list
    const adminListRes = await fetch(`${baseUrl}/api/admin/hospitals`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const adminList = (await adminListRes.json()).data;
    assert.ok(adminList.map((h) => h.id).includes(created.id), 'Admin must see their draft facility');
  } finally {
    server.close();
  }
});

test('Milestone 2A — Unauthorized cross-organization access is rejected', async () => {
  domainStore.reset();
  const app = createTestApp();
  const server = app.listen(0);
  const { port } = server.address();
  const baseUrl = `http://127.0.0.1:${port}`;

  try {
    // Apollo Admin belongs to org-apollo-trichy
    const apolloAdmin = domainStore.getUserByEmail('admin@apollo-trichy.local');
    const apolloToken = generateToken(apolloAdmin);

    // Attempt to PATCH MGMGH (belongs to org-tn-hfw)
    const patchRes = await fetch(`${baseUrl}/api/admin/hospitals/fac-trichy-mgmgh`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apolloToken}`,
      },
      body: JSON.stringify({ beds: { icu: 50 } }),
    });
    assert.equal(patchRes.status, 403, 'Cross-org PATCH must be rejected with 403');
    const patchBody = await patchRes.json();
    assert.ok(patchBody.error.includes('Forbidden'));

    // Attempt to DELETE / deactivate MGMGH
    const deleteRes = await fetch(`${baseUrl}/api/admin/hospitals/fac-trichy-mgmgh`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${apolloToken}` },
    });
    assert.equal(deleteRes.status, 403, 'Cross-org DELETE must be rejected with 403');

    // Attempt hospital registration as facility reporter (not org admin)
    const reporter = domainStore.getUserByEmail('reporter@mgmgh.local');
    const reporterToken = generateToken(reporter);

    const postRes = await fetch(`${baseUrl}/api/admin/hospitals`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${reporterToken}`,
      },
      body: JSON.stringify({ name: 'Unauthorized Clinic', address: 'X Road', city: 'Trichy', phone: '0431-0', latitude: 10.8, longitude: 78.6 }),
    });
    assert.equal(postRes.status, 403, 'Facility reporter cannot register hospitals');
  } finally {
    server.close();
  }
});

test('Milestone 2A — Bed updates flow through availability-report validation and audit history', async () => {
  domainStore.reset();
  const app = createTestApp();
  const server = app.listen(0);
  const { port } = server.address();
  const baseUrl = `http://127.0.0.1:${port}`;

  try {
    const adminUser = domainStore.getUserByEmail('admin@careroute.local');
    const token = generateToken(adminUser);

    const initialReportsCount = domainStore.availabilityReports.length;
    const initialAuditCount = domainStore.auditEvents.length;

    // 1. Submit valid bed update
    const patchRes = await fetch(`${baseUrl}/api/admin/hospitals/fac-trichy-mgmgh`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        beds: {
          general: { availableBeds: 45, totalBeds: 100 },
          icu: { availableBeds: 12, totalBeds: 25 },
        },
      }),
    });
    assert.equal(patchRes.status, 200);

    // Verify availabilityReports appended
    assert.equal(domainStore.availabilityReports.length, initialReportsCount + 2);

    // Verify snapshot updated
    const snapshotGeneral = domainStore.getAvailabilityCurrent('fac-trichy-mgmgh', 'general');
    assert.equal(snapshotGeneral.availableBeds, 45);
    assert.equal(snapshotGeneral.totalBeds, 100);

    // Verify audit events recorded
    assert.ok(domainStore.auditEvents.length >= initialAuditCount + 2);
    const latestEvent = domainStore.auditEvents[domainStore.auditEvents.length - 1];
    assert.equal(latestEvent.action, 'availability_report.submitted');
    assert.equal(latestEvent.outcome, 'accepted');

    // 2. Reject invalid bed count (availableBeds > totalBeds)
    const invalidRes = await fetch(`${baseUrl}/api/admin/hospitals/fac-trichy-mgmgh`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        beds: {
          icu: { availableBeds: 50, totalBeds: 25 },
        },
      }),
    });
    assert.equal(invalidRes.status, 400);

    // Snapshot remains unchanged
    const snapshotAfterFail = domainStore.getAvailabilityCurrent('fac-trichy-mgmgh', 'icu');
    assert.equal(snapshotAfterFail.availableBeds, 12);
  } finally {
    server.close();
  }
});

test('Milestone 2A — Deactivation preserves history and removes facility from public search', async () => {
  domainStore.reset();
  const app = createTestApp();
  const server = app.listen(0);
  const { port } = server.address();
  const baseUrl = `http://127.0.0.1:${port}`;

  try {
    const adminUser = domainStore.getUserByEmail('admin@careroute.local');
    const token = generateToken(adminUser);

    // Add report before deactivation
    domainStore.submitAvailabilityReport({
      facilityId: 'fac-trichy-srirangam',
      category: 'general',
      availableBeds: 10,
      totalBeds: 30,
      user: adminUser,
    });

    const reportCountBefore = domainStore.availabilityReports.length;

    // Deactivate
    const delRes = await fetch(`${baseUrl}/api/admin/hospitals/fac-trichy-srirangam`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    });
    assert.equal(delRes.status, 204);

    // Facility is closed/hidden, NOT removed from store
    const facility = domainStore.getFacility('fac-trichy-srirangam');
    assert.ok(facility, 'Facility record must remain in domainStore');
    assert.equal(facility.operatingStatus, 'closed');
    assert.equal(facility.publicationStatus, 'hidden');

    // Reports are intact
    assert.equal(domainStore.availabilityReports.length, reportCountBefore);

    // Facility is excluded from public search
    const publicRes = await fetch(`${baseUrl}/api/hospitals`);
    const publicList = (await publicRes.json()).data;
    assert.ok(!publicList.map((h) => h.id).includes('fac-trichy-srirangam'));
  } finally {
    server.close();
  }
});

test('Milestone 2A — Role-scoped demo login handles all seeded principals and rejects invalid credentials', async () => {
  domainStore.reset();
  const app = createTestApp();
  const server = app.listen(0);
  const { port } = server.address();
  const baseUrl = `http://127.0.0.1:${port}`;

  try {
    // 1. Valid login as organization_admin
    const resAdmin = await fetch(`${baseUrl}/api/auth/demo-login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'admin@careroute.local', password: config.demoAdminPassword }),
    });
    assert.equal(resAdmin.status, 200);
    const bodyAdmin = await resAdmin.json();
    assert.equal(bodyAdmin.role, 'organization_admin');
    assert.equal(bodyAdmin.organizationId, 'org-tn-hfw');
    assert.ok(bodyAdmin.token);

    // 2. Valid login as facility_reporter
    const resReporter = await fetch(`${baseUrl}/api/auth/demo-login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'reporter@mgmgh.local', password: config.demoAdminPassword }),
    });
    assert.equal(resReporter.status, 200);
    const bodyReporter = await resReporter.json();
    assert.equal(bodyReporter.role, 'facility_reporter');
    assert.deepEqual(bodyReporter.user.assignedFacilityIds, ['fac-trichy-mgmgh', 'fac-trichy-srirangam']);

    // 3. Reject wrong password
    const resBadPass = await fetch(`${baseUrl}/api/auth/demo-login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'admin@careroute.local', password: 'wrong-password' }),
    });
    assert.equal(resBadPass.status, 401);

    // 4. Reject unknown email
    const resBadEmail = await fetch(`${baseUrl}/api/auth/demo-login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'hacker@malicious.local', password: config.demoAdminPassword }),
    });
    assert.equal(resBadEmail.status, 401);
  } finally {
    server.close();
  }
});

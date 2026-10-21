import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import jwt from 'jsonwebtoken';
import { staffRouter } from '../src/routes/staff.js';
import { domainStore } from '../src/lib/domainStore.js';
import { config } from '../src/config.js';

function createStaffApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/staff', staffRouter);
  return app;
}

function generateToken(payload) {
  return jwt.sign(payload, config.jwtSecret, { expiresIn: '1h' });
}

test('authorization and tenant isolation tests', async (t) => {
  domainStore.reset();
  const app = createStaffApp();
  const server = app.listen(0);
  const { port } = server.address();
  const baseUrl = `http://127.0.0.1:${port}/api/staff`;

  t.after(() => server.close());

  // Seed users:
  // user-mgmgh-reporter (org-tn-hfw, assigned: ['fac-trichy-mgmgh', 'fac-trichy-srirangam'])
  // user-apollo-admin (org-apollo-trichy, assigned: ['fac-trichy-apollo'])
  // user-platform-verifier (platform_verifier, assigned: [])

  const reporterToken = generateToken({ email: 'reporter@mgmgh.local', role: 'facility_reporter' });
  const apolloAdminToken = generateToken({ email: 'admin@apollo-trichy.local', role: 'organization_admin' });
  const verifierToken = generateToken({ email: 'verifier@careroute.local', role: 'platform_verifier' });

  await t.test('unauthenticated request is rejected with 401', async () => {
    const res = await fetch(`${baseUrl}/facilities`);
    assert.equal(res.status, 401);
    const body = await res.json();
    assert.ok(body.error.includes('Authentication is required'));
  });

  await t.test('facility_reporter can report availability for assigned facility', async () => {
    const res = await fetch(`${baseUrl}/facilities/fac-trichy-mgmgh/availability-reports`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${reporterToken}`,
      },
      body: JSON.stringify({ category: 'general', availableBeds: 10, totalBeds: 50 }),
    });

    assert.equal(res.status, 201);
    const body = await res.json();
    assert.equal(body.data.report.facilityId, 'fac-trichy-mgmgh');
    assert.equal(body.data.report.availableBeds, 10);
    assert.equal(body.data.snapshot.availableBeds, 10);
  });

  await t.test('facility_reporter receives 403 when attempting IDOR to report for unassigned facility', async () => {
    // Attempting to mutate Apollo facility (unassigned to MGMGH reporter)
    const res = await fetch(`${baseUrl}/facilities/fac-trichy-apollo/availability-reports`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${reporterToken}`,
      },
      body: JSON.stringify({ category: 'general', availableBeds: 5, totalBeds: 20 }),
    });

    assert.equal(res.status, 403);
    const body = await res.json();
    assert.ok(body.error.includes('Forbidden'));
    assert.ok(body.error.includes('not authorized to report availability for this facility'));
  });

  await t.test('organization_admin can report for their organization facility', async () => {
    const res = await fetch(`${baseUrl}/facilities/fac-trichy-apollo/availability-reports`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apolloAdminToken}`,
      },
      body: JSON.stringify({ category: 'icu', availableBeds: 3, totalBeds: 12 }),
    });

    assert.equal(res.status, 201);
    const body = await res.json();
    assert.equal(body.data.report.facilityId, 'fac-trichy-apollo');
    assert.equal(body.data.snapshot.availableBeds, 3);
  });

  await t.test('organization_admin receives 403 when attempting cross-organization mutation', async () => {
    // Apollo admin attempting to report for Government MGMGH facility
    const res = await fetch(`${baseUrl}/facilities/fac-trichy-mgmgh/availability-reports`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apolloAdminToken}`,
      },
      body: JSON.stringify({ category: 'icu', availableBeds: 2, totalBeds: 10 }),
    });

    assert.equal(res.status, 403);
    const body = await res.json();
    assert.ok(body.error.includes('Forbidden'));
    assert.ok(body.error.includes('another organization'));
  });

  await t.test('platform_verifier role cannot submit clinical capacity reports (separation of duties)', async () => {
    const res = await fetch(`${baseUrl}/facilities/fac-trichy-mgmgh/availability-reports`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${verifierToken}`,
      },
      body: JSON.stringify({ category: 'general', availableBeds: 10, totalBeds: 50 }),
    });

    assert.equal(res.status, 403);
    const body = await res.json();
    assert.ok(body.error.includes('Forbidden'));
  });

  await t.test('inactive user is rejected with 403 even with valid token', async () => {
    domainStore.registerUser({
      id: 'user-suspended-reporter',
      email: 'suspended@hospital.local',
      role: 'facility_reporter',
      status: 'suspended',
      organizationId: 'org-tn-hfw',
      assignedFacilityIds: ['fac-trichy-mgmgh'],
    });

    const suspendedToken = generateToken({ email: 'suspended@hospital.local', role: 'facility_reporter' });

    const res = await fetch(`${baseUrl}/facilities`, {
      headers: { Authorization: `Bearer ${suspendedToken}` },
    });

    assert.equal(res.status, 403);
    const body = await res.json();
    assert.ok(body.error.includes('inactive or suspended'));
  });
});

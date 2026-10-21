import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import { publicRouter } from '../src/routes/public.js';
import { domainStore } from '../src/lib/domainStore.js';

function createPublicApp() {
  const app = express();
  app.use('/api/public', publicRouter);
  return app;
}

test('public directory projection and privacy guarantees', async (t) => {
  domainStore.reset();
  const app = createPublicApp();
  const server = app.listen(0);
  const { port } = server.address();
  const baseUrl = `http://127.0.0.1:${port}/api/public`;

  t.after(() => server.close());

  await t.test('GET /facilities returns only verified and published facilities', async () => {
    const res = await fetch(`${baseUrl}/facilities`);
    assert.equal(res.status, 200);
    const body = await res.json();
    const facilityIds = body.data.map((f) => f.id);

    // Verified facilities must be present
    assert.ok(facilityIds.includes('fac-trichy-mgmgh'));
    assert.ok(facilityIds.includes('fac-trichy-srirangam'));
    assert.ok(facilityIds.includes('fac-trichy-apollo'));

    // Unverified facility (fac-trichy-unverified) must be strictly EXCLUDED
    assert.ok(!facilityIds.includes('fac-trichy-unverified'));
  });

  await t.test('GET /facilities excludes suspended facilities', async () => {
    // Suspend Srirangam facility
    domainStore.updateFacility('fac-trichy-srirangam', { verificationStatus: 'suspended' });

    const res = await fetch(`${baseUrl}/facilities`);
    const body = await res.json();
    const facilityIds = body.data.map((f) => f.id);

    assert.ok(!facilityIds.includes('fac-trichy-srirangam'), 'Suspended facility must be excluded from public results');

    // Restore for other tests
    domainStore.updateFacility('fac-trichy-srirangam', { verificationStatus: 'verified' });
  });

  await t.test('public facility projection strictly omits private fields', async () => {
    const res = await fetch(`${baseUrl}/facilities/fac-trichy-mgmgh`);
    assert.equal(res.status, 200);
    const body = await res.json();
    const facility = body.data;

    // Approved public fields must be present
    assert.equal(facility.id, 'fac-trichy-mgmgh');
    assert.ok(facility.name);
    assert.ok(facility.phone);
    assert.ok(facility.locality);
    assert.equal(facility.verificationStatus, 'verified');
    assert.ok(Array.isArray(facility.capabilities));
    assert.ok(facility.availability);

    // PRIVATE DATA MUST NEVER BE EXPOSED
    assert.equal(facility.privateVerificationData, undefined, 'privateVerificationData must be omitted');
    assert.equal(facility.documentReference, undefined);
    assert.equal(facility.inspectedBy, undefined);
    assert.equal(facility.notes, undefined);
    assert.equal(facility.auditEvents, undefined);
    assert.equal(facility.staffAccounts, undefined);
  });

  await t.test('GET /facilities/:id returns 404 for unverified or unpublished facility', async () => {
    const res = await fetch(`${baseUrl}/facilities/fac-trichy-unverified`);
    assert.equal(res.status, 404);
    const body = await res.json();
    assert.ok(body.error.includes('not found or not published'));
  });

  await t.test('GET /care-categories returns versioned public emergency care categories', async () => {
    const res = await fetch(`${baseUrl}/care-categories`);
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.ok(Array.isArray(body.data));
    assert.ok(body.data.length >= 6);

    const trauma = body.data.find((c) => c.id === 'trauma');
    assert.ok(trauma);
    assert.ok(trauma.requiredCapabilities.includes('trauma_care'));

    assert.ok(body.meta.disclaimer.includes('not clinical diagnoses'));
  });
});

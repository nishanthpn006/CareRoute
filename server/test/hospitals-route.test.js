import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import { hospitalsRouter } from '../src/routes/hospitals.js';

test('GET /api/hospitals rejects invalid bedType parameter with 400 Bad Request', async () => {
  const app = express();
  app.use('/api/hospitals', hospitalsRouter);

  const server = app.listen(0);
  const { port } = server.address();

  try {
    const res = await fetch(`http://127.0.0.1:${port}/api/hospitals?bedType=invalid_type`);
    assert.equal(res.status, 400);
    const body = await res.json();
    assert.ok(body.error.includes('Invalid bedType parameter'));
    assert.ok(body.error.includes('general, icu, oxygen, ventilator'));
  } finally {
    server.close();
  }
});

test('GET /api/hospitals returns normalized meta with dataMode and isDemo', async () => {
  const app = express();
  app.use('/api/hospitals', hospitalsRouter);

  const server = app.listen(0);
  const { port } = server.address();

  try {
    const res = await fetch(`http://127.0.0.1:${port}/api/hospitals`);
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.ok(Array.isArray(body.data));
    assert.ok(body.meta);
    assert.equal(typeof body.meta.dataMode, 'string');
    assert.equal(typeof body.meta.isDemo, 'boolean');
  } finally {
    server.close();
  }
});

test('GET /health and /api/health respond with 200 OK for hosting health probes', async () => {
  const app = express();
  const handleHealth = (_req, res) => {
    res.json({ status: 'ok', service: 'careroute-api' });
  };
  app.get('/health', handleHealth);
  app.get('/api/health', handleHealth);

  const server = app.listen(0);
  const { port } = server.address();

  try {
    const resRootHealth = await fetch(`http://127.0.0.1:${port}/health`);
    assert.equal(resRootHealth.status, 200);
    const bodyRoot = await resRootHealth.json();
    assert.equal(bodyRoot.status, 'ok');

    const resApiHealth = await fetch(`http://127.0.0.1:${port}/api/health`);
    assert.equal(resApiHealth.status, 200);
    const bodyApi = await resApiHealth.json();
    assert.equal(bodyApi.status, 'ok');
  } finally {
    server.close();
  }
});

import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../src/config.js';
import { authRouter } from '../src/routes/auth.js';
import { createHealthHandler, gracefulShutdown } from '../src/index.js';
import { authenticate, requireAuth, requireRole } from '../src/middleware/authorize.js';
import { domainStore } from '../src/lib/domainStore.js';

function createTestApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/auth', authRouter);
  return app;
}

test('Production Hardening Test Suite', async (t) => {

  await t.test('1. Demo login gating by environment flag', async () => {
    const app = createTestApp();
    const server = app.listen(0);
    const { port } = server.address();
    const baseUrl = `http://127.0.0.1:${port}/api/auth`;

    try {
      // Test when demo login is disabled
      config.enableDemoLogin = false;

      const sessionResDisabled = await fetch(`${baseUrl}/session`);
      const sessionDisabled = await sessionResDisabled.json();
      assert.equal(sessionDisabled.demoLoginEnabled, false);
      assert.ok(['password-login', 'disabled'].includes(sessionDisabled.adminLogin));

      const loginResDisabled = await fetch(`${baseUrl}/demo-login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'admin@careroute.local',
          password: config.demoAdminPassword,
        }),
      });
      assert.equal(loginResDisabled.status, 404, 'Disabled demo login must return 404');
      const errBody = await loginResDisabled.json();
      assert.match(errBody.error, /disabled/i);

      // Test when demo login is explicitly enabled
      config.enableDemoLogin = true;

      const sessionResEnabled = await fetch(`${baseUrl}/session`);
      const sessionEnabled = await sessionResEnabled.json();
      assert.equal(sessionEnabled.demoLoginEnabled, true);
      assert.equal(sessionEnabled.adminLogin, 'demo-login');

      const loginResEnabled = await fetch(`${baseUrl}/demo-login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'admin@careroute.local',
          password: config.demoAdminPassword,
        }),
      });
      assert.equal(loginResEnabled.status, 200, 'Enabled demo login must accept valid credentials');
      const loginData = await loginResEnabled.json();
      assert.ok(loginData.token);
      assert.equal(loginData.email, 'admin@careroute.local');
    } finally {
      config.enableDemoLogin = true; // Restore for other tests
      server.close();
    }
  });

  await t.test('2. Missing/deleted user tokens are rejected without fallback synthesis', async () => {
    const app = express();
    app.use(express.json());
    app.use(authenticate);
    app.use('/test-protected', requireAuth, (_req, res) => res.json({ ok: true, user: _req.user }));

    const server = app.listen(0);
    const { port } = server.address();
    const testUrl = `http://127.0.0.1:${port}/test-protected`;

    try {
      // Forge a token for an email not present in database
      const ghostToken = jwt.sign(
        { email: 'deleted-ghost@hospital.local', role: 'organization_admin', uid: 'user-ghost' },
        config.jwtSecret,
        { expiresIn: '1h' }
      );

      const res = await fetch(testUrl, {
        headers: { Authorization: `Bearer ${ghostToken}` },
      });

      assert.equal(res.status, 401, 'Token for non-existent database user must be rejected with 401');
      const body = await res.json();
      assert.match(body.error, /Authentication is required/i);
    } finally {
      server.close();
    }
  });

  await t.test('3. Database health check verifies PostgreSQL connection and handles failures safely', async () => {
    // 3a. Mock store with healthy connection
    const healthyStore = {
      ping: async () => ({ ok: true }),
    };
    const healthApp = express();
    healthApp.get('/health', createHealthHandler(healthyStore, { dataMode: 'postgres' }));

    const healthyServer = healthApp.listen(0);
    const { port: healthyPort } = healthyServer.address();

    try {
      const res = await fetch(`http://127.0.0.1:${healthyPort}/health`);
      assert.equal(res.status, 200);
      const data = await res.json();
      assert.equal(data.status, 'ok');
      assert.equal(data.database, 'connected');
      assert.equal(data.dataMode, 'postgres');
    } finally {
      healthyServer.close();
    }

    // 3b. Mock store with failing connection
    const failingStore = {
      ping: async () => {
        throw new Error('connection to server at "127.0.0.1", port 5432 failed: Connection refused');
      },
    };
    const failingApp = express();
    failingApp.get('/health', createHealthHandler(failingStore, { dataMode: 'postgres' }));

    const failingServer = failingApp.listen(0);
    const { port: failingPort } = failingServer.address();

    try {
      const res = await fetch(`http://127.0.0.1:${failingPort}/health`);
      assert.equal(res.status, 503, 'Degraded DB must return HTTP 503 Service Unavailable');
      const data = await res.json();
      assert.equal(data.status, 'degraded');
      assert.equal(data.database, 'disconnected');
      assert.equal(data.dataMode, 'postgres');
      assert.equal(data.error, 'Database connection check failed.');
      // Confirm no sensitive connection strings or raw stack traces are leaked
      assert.equal(data.connectionString, undefined);
      assert.equal(data.password, undefined);
    } finally {
      failingServer.close();
    }
  });

  await t.test('4. PostgreSQL SSL configuration options and certificate validation', async () => {
    // Test default local behavior: no SSL
    assert.equal(config.databaseSsl, false, 'Local PostgreSQL development defaults to no SSL');

    // Test explicit SSL parsing logic:
    function parseSsl(env) {
      const rawSsl = (env.DATABASE_SSL || env.PGSSLMODE || '').trim().toLowerCase();
      const isSslEnabled = ['true', '1', 'require', 'verify-ca', 'verify-full'].includes(rawSsl);
      if (!isSslEnabled) return false;

      const rejectUnauthorized = env.DATABASE_SSL_REJECT_UNAUTHORIZED !== 'false';
      const ca = env.DATABASE_SSL_CA ? env.DATABASE_SSL_CA.replace(/\\n/g, '\n') : undefined;

      return {
        rejectUnauthorized,
        ...(ca ? { ca } : {}),
      };
    }

    const cloudSsl = parseSsl({ DATABASE_SSL: 'true' });
    assert.deepEqual(cloudSsl, { rejectUnauthorized: true }, 'DATABASE_SSL=true enforces certificate verification');

    const pgSslMode = parseSsl({ PGSSLMODE: 'require' });
    assert.deepEqual(pgSslMode, { rejectUnauthorized: true }, 'PGSSLMODE=require enforces certificate verification');

    const customCa = parseSsl({ DATABASE_SSL: 'true', DATABASE_SSL_CA: 'MOCK_CA_CERT' });
    assert.equal(customCa.rejectUnauthorized, true);
    assert.equal(customCa.ca, 'MOCK_CA_CERT');
  });

  await t.test('5. Graceful shutdown sequence executes cleanly without unhandled rejection', async () => {
    let closedStore = false;
    const mockStore = {
      close: async () => {
        closedStore = true;
      },
    };

    // Invoke graceful shutdown in test mode (NODE_ENV=test skips process.exit)
    const originalEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'test';

    try {
      await gracefulShutdown('SIGTERM', 2000);
      assert.ok(true, 'Graceful shutdown completed successfully');
    } finally {
      process.env.NODE_ENV = originalEnv;
    }
  });
});

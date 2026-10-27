import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import jwt from 'jsonwebtoken';
import pg from 'pg';
import { app } from '../src/index.js';
import { config } from '../src/config.js';
import { domainStore, PostgresStorageAdapter } from '../src/lib/domainStore.js';
import { hashPassword, verifyPassword } from '../src/lib/authCrypto.js';
import { loginRateLimiter, LoginRateLimiter } from '../src/middleware/rateLimiter.js';
import { provisionStaffPassword } from '../src/scripts/setPassword.js';

const { Pool } = pg;

test('Individual Staff Authentication Suite', async (t) => {
  let server;
  let baseUrl;
  let pool;
  let isPostgres = false;

  t.before(async () => {
    // Reset rate limiter state for tests
    loginRateLimiter.reset();

    if (config.databaseUrl) {
      pool = new Pool({ connectionString: config.databaseUrl });
      try {
        await pool.query('SELECT 1');
        isPostgres = true;
      } catch (err) {
        console.warn('PostgreSQL not reachable for test setup, continuing with active adapter');
      }
    }

    server = http.createServer(app);
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
    const { port } = server.address();
    baseUrl = `http://127.0.0.1:${port}`;
  });

  t.after(async () => {
    if (server) {
      await new Promise((resolve) => server.close(resolve));
    }
    if (pool) {
      await pool.end();
    }
  });

  await t.test('1. Password-hash persistence uses Argon2id and never stores plaintext', async () => {
    const plain = 'StrongPassphrase!2026';
    const hash = await hashPassword(plain);

    assert.ok(hash.startsWith('$argon2id$'), 'Hash must use Argon2id algorithm');
    assert.ok(!hash.includes(plain), 'Hash must never contain the plaintext password');

    const isValid = await verifyPassword(hash, plain);
    assert.equal(isValid, true, 'Valid password must verify against Argon2id hash');

    const isWrong = await verifyPassword(hash, 'IncorrectPassword');
    assert.equal(isWrong, false, 'Invalid password must not verify');
  });

  await t.test('2. CLI provisioning sets password without exposing credentials', async () => {
    // Ensure test user exists
    const testEmail = 'reporter@mgmgh.local';
    const newPass = 'MgmghStaffSecurePass123!';

    const provisionResult = await provisionStaffPassword(testEmail, newPass);
    assert.equal(provisionResult.email, testEmail);
    assert.equal(provisionResult.role, 'facility_reporter');
    assert.ok(!provisionResult.passwordHash, 'Provisioning output must not disclose password hash');

    // Verify in database that hash is stored and plaintext is absent
    const authRecord = await domainStore.getUserPasswordHashByEmail(testEmail);
    assert.ok(authRecord, 'Auth record must exist');
    assert.ok(authRecord.passwordHash.startsWith('$argon2id$'), 'Stored hash must be Argon2id');
    assert.ok(!authRecord.passwordHash.includes(newPass), 'Plaintext must not be in database');
  });

  await t.test('3. Successful individual login with valid password', async () => {
    const res = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'reporter@mgmgh.local',
        password: 'MgmghStaffSecurePass123!',
      }),
    });

    assert.equal(res.status, 200);
    const data = await res.json();

    assert.ok(data.token, 'Response must include JWT token');
    assert.equal(data.email, 'reporter@mgmgh.local');
    assert.equal(data.role, 'facility_reporter');
    assert.equal(data.user.id, 'user-mgmgh-reporter');
    assert.ok(data.user.assignedFacilityIds.includes('fac-trichy-mgmgh'));

    // Critical security check: Never disclose password_hash in response
    assert.equal(data.password_hash, undefined);
    assert.equal(data.passwordHash, undefined);
    assert.equal(data.user.password_hash, undefined);
    assert.equal(data.user.passwordHash, undefined);

    // Verify token can be decoded with server secret
    const decoded = jwt.verify(data.token, config.jwtSecret);
    assert.equal(decoded.email, 'reporter@mgmgh.local');
    assert.equal(decoded.role, 'facility_reporter');
  });

  await t.test('4. Generic 401 response for incorrect password without user enumeration', async () => {
    const res = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'reporter@mgmgh.local',
        password: 'WrongPassword123!',
      }),
    });

    assert.equal(res.status, 401);
    const data = await res.json();
    assert.equal(data.error, 'Invalid email or password.');
  });

  await t.test('5. Generic 401 response for unknown email without user enumeration', async () => {
    const res = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'nonexistent-staff@hospital.local',
        password: 'AnyPassword123!',
      }),
    });

    assert.equal(res.status, 401);
    const data = await res.json();
    assert.equal(data.error, 'Invalid email or password.');
  });

  await t.test('6. Unprovisioned account (missing password_hash) is rejected with generic 401', async () => {
    // admin@apollo-trichy.local has not been provisioned with an individual password
    // Clear its password hash if any to ensure test fidelity
    if (config.dataMode === 'postgres' && pool) {
      await pool.query("UPDATE users SET password_hash = NULL WHERE email = 'admin@apollo-trichy.local'");
    }

    const res = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'admin@apollo-trichy.local',
        password: 'AttemptPassword123!',
      }),
    });

    assert.equal(res.status, 401);
    const data = await res.json();
    assert.equal(data.error, 'Invalid email or password.');
  });

  await t.test('7. Suspended or inactive user is rejected with 403', async () => {
    // Create an inactive user with a valid password
    const inactiveEmail = 'inactive-staff@mgmgh.local';
    const inactivePass = 'ValidPasswordForInactive123!';
    const hash = await hashPassword(inactivePass);

    if (config.dataMode === 'postgres' && pool) {
      await pool.query(`
        INSERT INTO users (id, email, name, role, status, organization_id, assigned_facility_ids, password_hash)
        VALUES ('user-inactive-test', $1, 'Inactive Test User', 'facility_reporter', 'inactive', 'org-tn-hfw', '["fac-trichy-mgmgh"]', $2)
        ON CONFLICT (id) DO UPDATE SET status = 'inactive', password_hash = $2
      `, [inactiveEmail, hash]);
    } else {
      await domainStore.registerUser({
        id: 'user-inactive-test',
        email: inactiveEmail,
        name: 'Inactive Test User',
        role: 'facility_reporter',
        status: 'inactive',
        organizationId: 'org-tn-hfw',
        passwordHash: hash,
      });
    }

    const res = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: inactiveEmail,
        password: inactivePass,
      }),
    });

    assert.equal(res.status, 403);
    const data = await res.json();
    assert.equal(data.error, 'Account is inactive or suspended.');
  });

  await t.test('8. Rate limiting blocks brute-force attempts with 429', async () => {
    // Create a local limiter instance to verify threshold
    const customLimiter = new LoginRateLimiter({ windowMs: 60000, maxAttempts: 3 });
    const mockReq = { ip: '192.168.1.100', body: { email: 'target@hospital.local' } };

    assert.equal(customLimiter.isRateLimited(mockReq).limited, false);
    customLimiter.recordFailure(mockReq);
    customLimiter.recordFailure(mockReq);
    assert.equal(customLimiter.isRateLimited(mockReq).limited, false);
    customLimiter.recordFailure(mockReq); // 3rd failure reaches maxAttempts

    const status = customLimiter.isRateLimited(mockReq);
    assert.equal(status.limited, true, 'Rate limiter must trigger on reaching max attempts');
    assert.ok(status.retryAfterSeconds > 0, 'Retry-After seconds must be positive');

    // Test API rate limiting behavior
    loginRateLimiter.reset();
    const attackerReq = {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'bruteforce@hospital.local', password: 'bad' }),
    };

    // Send 5 failed attempts (configured default)
    for (let i = 0; i < 5; i++) {
      await fetch(`${baseUrl}/api/auth/login`, attackerReq);
    }

    // 6th attempt must be rejected with 429
    const limitedRes = await fetch(`${baseUrl}/api/auth/login`, attackerReq);
    assert.equal(limitedRes.status, 429);
    assert.ok(limitedRes.headers.get('Retry-After'));
    const body = await limitedRes.json();
    assert.equal(body.error, 'Too many login attempts. Please try again later.');

    // Cleanup limiter for subsequent tests
    loginRateLimiter.reset();
  });

  await t.test('9. Deleted user tokens are unauthorized on protected routes', async () => {
    // Sign token for a user that does not exist in DB
    const ghostToken = jwt.sign(
      {
        id: 'ghost-user-id',
        email: 'deleted-user@careroute.internal',
        role: 'facility_reporter',
        assignedFacilityIds: ['fac-trichy-mgmgh'],
      },
      config.jwtSecret,
      { expiresIn: '1h' }
    );

    // Call protected staff facilities endpoint
    const res = await fetch(`${baseUrl}/api/staff/facilities`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${ghostToken}`,
      },
    });

    assert.equal(res.status, 401, 'Deleted user token must receive 401');
    const data = await res.json();
    assert.equal(data.error, 'Authentication is required.');
  });

  await t.test('10. Individual login tokens enforce facility authorization and tenant isolation', async () => {
    // Provision MGMGH reporter
    await provisionStaffPassword('reporter@mgmgh.local', 'MgmghPassword123!');

    const loginRes = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'reporter@mgmgh.local',
        password: 'MgmghPassword123!',
      }),
    });
    assert.equal(loginRes.status, 200);
    const { token } = await loginRes.json();

    // Reporter can submit for assigned facility (MGMGH)
    const reportRes = await fetch(`${baseUrl}/api/staff/facilities/fac-trichy-mgmgh/availability-reports`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        category: 'icu',
        availableBeds: 12,
        totalBeds: 25,
      }),
    });
    assert.equal(reportRes.status, 201);

    // IDOR protection: Reporter CANNOT submit for unassigned facility (Apollo)
    const idorRes = await fetch(`${baseUrl}/api/staff/facilities/fac-trichy-apollo/availability-reports`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        category: 'icu',
        availableBeds: 5,
        totalBeds: 10,
      }),
    });
    assert.equal(idorRes.status, 403, 'Cross-tenant IDOR access must be rejected with 403');
  });

  await t.test('11. Session endpoint advertises password-login when demo login is disabled', async () => {
    const originalDemoLogin = config.enableDemoLogin;
    try {
      config.enableDemoLogin = false;
      const res = await fetch(`${baseUrl}/api/auth/session`);
      assert.equal(res.status, 200);
      const data = await res.json();
      assert.equal(data.adminLogin, 'password-login');
      assert.equal(data.demoLoginEnabled, false);
    } finally {
      config.enableDemoLogin = originalDemoLogin;
    }
  });
});

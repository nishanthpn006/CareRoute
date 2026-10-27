import { Router } from 'express';
import jwt from 'jsonwebtoken';
import { timingSafeEqual } from 'node:crypto';
import { config } from '../config.js';
import { domainStore } from '../lib/domainStore.js';
import { verifyPassword, dummyVerify } from '../lib/authCrypto.js';
import { loginRateLimiter } from '../middleware/rateLimiter.js';

export const authRouter = Router();

function safeEqual(left, right) {
  const a = Buffer.from(String(left));
  const b = Buffer.from(String(right));
  return a.length === b.length && a.length > 0 && timingSafeEqual(a, b);
}

/**
 * POST /api/auth/login
 * Individual staff password authentication backed by persistent storage.
 */
authRouter.post('/login', loginRateLimiter.middleware(), async (req, res) => {
  const email = String(req.body?.email || '').trim().toLowerCase();
  const password = String(req.body?.password || '');

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required.' });
  }

  const authRecord = await domainStore.getUserPasswordHashByEmail(email);

  // If user does not exist or has no provisioned password hash, execute dummy verify to mitigate timing enumeration
  if (!authRecord || !authRecord.passwordHash) {
    await dummyVerify(password);
    loginRateLimiter.recordFailure(req);
    return res.status(401).json({ error: 'Invalid email or password.' });
  }

  const isValid = await verifyPassword(authRecord.passwordHash, password);
  if (!isValid) {
    loginRateLimiter.recordFailure(req);
    return res.status(401).json({ error: 'Invalid email or password.' });
  }

  if (authRecord.status !== 'active') {
    loginRateLimiter.recordFailure(req);
    return res.status(403).json({ error: 'Account is inactive or suspended.' });
  }

  const user = await domainStore.getUser(authRecord.id);
  if (!user || user.status !== 'active') {
    loginRateLimiter.recordFailure(req);
    return res.status(403).json({ error: 'Account is inactive or suspended.' });
  }

  // Clear failed attempt tracking on successful authentication
  loginRateLimiter.recordSuccess(req);

  const tokenPayload = {
    id: user.id,
    uid: user.id,
    email: user.email,
    role: user.role,
    organizationId: user.organizationId,
    assignedFacilityIds: user.assignedFacilityIds || [],
  };
  const token = jwt.sign(tokenPayload, config.jwtSecret, { subject: user.email, expiresIn: '8h' });

  res.json({
    token,
    email: user.email,
    role: user.role,
    organizationId: user.organizationId,
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      organizationId: user.organizationId,
      assignedFacilityIds: user.assignedFacilityIds || [],
    },
    expiresInSeconds: 8 * 60 * 60,
    mode: config.dataMode,
  });
});

/**
 * POST /api/auth/demo-login
 * Gated demo login for local development evaluation only.
 */
authRouter.post('/demo-login', async (req, res) => {
  if (!config.enableDemoLogin) {
    return res.status(404).json({ error: 'Demo login is disabled in this environment.' });
  }
  const email = String(req.body?.email || '').trim().toLowerCase();
  const password = String(req.body?.password || '');

  if (!safeEqual(password, config.demoAdminPassword)) {
    return res.status(401).json({ error: 'Invalid demo credentials.' });
  }

  const user = await domainStore.getUserByEmail(email);
  if (!user) {
    return res.status(401).json({ error: 'User account not found in demo environment.' });
  }
  if (user.status !== 'active') {
    return res.status(403).json({ error: 'Account is inactive or suspended.' });
  }

  const tokenPayload = {
    id: user.id,
    uid: user.id,
    email: user.email,
    role: user.role,
    organizationId: user.organizationId,
    assignedFacilityIds: user.assignedFacilityIds || [],
  };
  const token = jwt.sign(tokenPayload, config.jwtSecret, { subject: user.email, expiresIn: '8h' });

  res.json({
    token,
    email: user.email,
    role: user.role,
    organizationId: user.organizationId,
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      organizationId: user.organizationId,
      assignedFacilityIds: user.assignedFacilityIds || [],
    },
    expiresInSeconds: 8 * 60 * 60,
    mode: config.dataMode,
  });
});

/**
 * GET /api/auth/session
 * Session capabilities endpoint.
 */
authRouter.get('/session', (req, res) => {
  res.json({
    mode: config.dataMode,
    adminLogin: config.dataMode === 'firebase'
      ? 'firebase-auth'
      : (config.enableDemoLogin ? 'demo-login' : 'password-login'),
    demoLoginEnabled: Boolean(config.enableDemoLogin),
  });
});

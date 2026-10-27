import { Router } from 'express';
import jwt from 'jsonwebtoken';
import { timingSafeEqual } from 'node:crypto';
import { config } from '../config.js';
import { domainStore } from '../lib/domainStore.js';

export const authRouter = Router();

function safeEqual(left, right) {
  const a = Buffer.from(String(left));
  const b = Buffer.from(String(right));
  return a.length === b.length && a.length > 0 && timingSafeEqual(a, b);
}

authRouter.post('/demo-login', async (req, res) => {
  if (config.dataMode === 'firebase') {
    return res.status(404).json({ error: 'Demo login is disabled in Firebase mode.' });
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

authRouter.get('/session', (req, res) => {
  res.json({ mode: config.dataMode, adminLogin: config.dataMode === 'firebase' ? 'firebase-auth' : 'demo-login' });
});

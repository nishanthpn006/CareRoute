import jwt from 'jsonwebtoken';
import { config } from '../config.js';
import { firebaseAuth } from '../lib/firebaseAdmin.js';

export async function requireAdmin(req, res, next) {
  const raw = req.headers.authorization || '';
  const token = raw.startsWith('Bearer ') ? raw.slice(7) : '';
  if (!token) return res.status(401).json({ error: 'Authentication is required.' });

  try {
    if (config.dataMode === 'demo') {
      const decoded = jwt.verify(token, config.jwtSecret);
      if (decoded.role !== 'admin' || decoded.email !== config.demoAdminEmail) {
        return res.status(403).json({ error: 'Administrator access is required.' });
      }
      req.admin = { email: decoded.email, mode: 'demo' };
      return next();
    }

    const decoded = await firebaseAuth.verifyIdToken(token);
    const email = String(decoded.email || '').toLowerCase();
    if (!email || !config.adminEmails.includes(email)) {
      return res.status(403).json({ error: 'This account is not on the administrator allowlist.' });
    }
    req.admin = { email, mode: 'firebase' };
    return next();
  } catch {
    return res.status(401).json({ error: 'The session is invalid or expired. Sign in again.' });
  }
}

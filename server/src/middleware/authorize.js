import jwt from 'jsonwebtoken';
import { config } from '../config.js';
import { domainStore } from '../lib/domainStore.js';
import { canReportAvailability, canManageFacility, canVerifyFacility, canManageSecurity } from '../domain/roles.js';
import { firebaseAuth } from '../lib/firebaseAdmin.js';

/**
 * Extracts and verifies the bearer token from the Authorization header.
 * Attaches resolved domain user to `req.user` if valid.
 */
export async function authenticate(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7).trim() : '';

  if (!token) {
    req.user = null;
    return next();
  }

  try {
    if (config.dataMode === 'demo') {
      const decoded = jwt.verify(token, config.jwtSecret);
      const email = String(decoded.email || decoded.sub || '').toLowerCase();
      let user = await domainStore.getUserByEmail(email);

      // If legacy demo login or test token with email not in seed users, generate mapped principal
      if (!user && decoded.role) {
        user = {
          id: decoded.uid || `user-${decoded.role}`,
          email,
          role: decoded.role,
          status: 'active',
          organizationId: decoded.organizationId || null,
          assignedFacilityIds: Array.isArray(decoded.assignedFacilityIds) ? decoded.assignedFacilityIds : [],
        };
      }

      req.user = user || null;
      return next();
    }

    // Firebase mode
    const decoded = await firebaseAuth.verifyIdToken(token);
    const email = String(decoded.email || '').toLowerCase();
    let user = (await domainStore.getUser(decoded.uid)) || (await domainStore.getUserByEmail(email));

    if (!user) {
      user = {
        id: decoded.uid,
        email,
        role: decoded.role || 'facility_reporter',
        status: 'active',
        organizationId: decoded.organizationId || null,
        assignedFacilityIds: Array.isArray(decoded.assignedFacilityIds) ? decoded.assignedFacilityIds : [],
      };
    }

    req.user = user;
    return next();
  } catch (err) {
    req.user = null;
    return next();
  }
}

/**
 * Rejects requests if authentication is missing or user is inactive.
 */
export function requireAuth(req, res, next) {
  if (!req.user) {
    return res.status(401).json({ error: 'Authentication is required.' });
  }
  if (req.user.status !== 'active') {
    return res.status(403).json({ error: 'Account is inactive or suspended.' });
  }
  next();
}

/**
 * Restricts access to users holding one of the specified roles.
 */
export function requireRole(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication is required.' });
    }
    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        error: `Forbidden: Action requires one of roles: [${allowedRoles.join(', ')}]. Current role: "${req.user.role}".`,
      });
    }
    next();
  };
}

/**
 * Enforces facility-scoped access and prevents IDOR / cross-tenant mutation.
 * 
 * @param {'report'|'manage'} action - Action to authorize
 */
export function requireFacilityScope(action = 'report') {
  return async (req, res, next) => {
    const facilityId = req.params.facilityId || req.body?.facilityId;
    if (!facilityId) {
      return res.status(400).json({ error: 'facilityId parameter is required.' });
    }

    const facility = await domainStore.getFacility(facilityId);
    if (!facility) {
      return res.status(404).json({ error: `Facility not found: "${facilityId}".` });
    }

    req.facility = facility;

    if (action === 'report') {
      if (!canReportAvailability(req.user, facility)) {
        if (req.user.role === 'facility_reporter') {
          return res.status(403).json({
            error: 'Forbidden: You are not authorized to report availability for this facility.',
          });
        }
        if (req.user.role === 'organization_admin') {
          return res.status(403).json({
            error: 'Forbidden: You cannot report availability for a facility belonging to another organization.',
          });
        }
        return res.status(403).json({
          error: 'Forbidden: Your role does not permit clinical availability reporting.',
        });
      }
    } else if (action === 'manage') {
      if (!canManageFacility(req.user, facility)) {
        return res.status(403).json({
          error: 'Forbidden: You cannot manage a facility outside your organization.',
        });
      }
    }

    next();
  };
}

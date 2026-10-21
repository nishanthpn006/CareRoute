import { Router } from 'express';
import { domainStore } from '../lib/domainStore.js';
import { authenticate, requireAuth, requireRole } from '../middleware/authorize.js';
import { ROLES } from '../domain/roles.js';

export const verifierRouter = Router();

verifierRouter.use(authenticate);
verifierRouter.use(requireAuth);
verifierRouter.use(requireRole(ROLES.PLATFORM_VERIFIER, ROLES.SECURITY_ADMIN));

/**
 * POST /api/verifier/facilities/:facilityId/verification
 * Platform verifier decides verification and publication status.
 */
verifierRouter.post('/facilities/:facilityId/verification', async (req, res, next) => {
  try {
    const { verificationStatus, publicationStatus, notes } = req.body || {};
    const result = await domainStore.updateFacilityVerification({
      facilityId: req.params.facilityId,
      verificationStatus,
      publicationStatus,
      user: req.user,
      notes: notes || '',
      now: Date.now(),
    });

    res.json({
      message: 'Facility verification updated.',
      data: result,
    });
  } catch (error) {
    if (error.statusCode) {
      return res.status(error.statusCode).json({ error: error.message });
    }
    next(error);
  }
});

/**
 * GET /api/verifier/audit-events
 * Returns system audit logs for platform review.
 */
verifierRouter.get('/audit-events', async (req, res, next) => {
  try {
    const facilityId = req.query.facilityId || null;
    const actorUid = req.query.actorUid || null;
    const limit = Math.min(Number(req.query.limit || 50), 200);

    const events = await domainStore.listAuditEvents({ facilityId, actorUid, limit });
    res.json({
      data: events,
      meta: {
        count: events.length,
      },
    });
  } catch (error) {
    next(error);
  }
});

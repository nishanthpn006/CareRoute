import { Router } from 'express';
import { domainStore } from '../lib/domainStore.js';
import { authenticate, requireAuth, requireRole, requireFacilityScope } from '../middleware/authorize.js';
import { ROLES } from '../domain/roles.js';
import { evaluateAvailabilityFreshness } from '../domain/freshness.js';

export const staffRouter = Router();

staffRouter.use(authenticate);
staffRouter.use(requireAuth);
staffRouter.use(requireRole(ROLES.FACILITY_REPORTER, ROLES.ORGANIZATION_ADMIN));

/**
 * GET /api/staff/facilities
 * Returns facilities assigned to the authenticated staff user.
 */
staffRouter.get('/facilities', async (req, res, next) => {
  try {
    const user = req.user;
    let facilities = [];

    if (user.role === ROLES.FACILITY_REPORTER) {
      const assignedIds = Array.isArray(user.assignedFacilityIds) ? user.assignedFacilityIds : [];
      facilities = await domainStore.listFacilities((f) => assignedIds.includes(f.id));
    } else if (user.role === ROLES.ORGANIZATION_ADMIN) {
      facilities = await domainStore.listFacilities((f) => f.organizationId === user.organizationId);
    }

    res.json({
      data: facilities,
      meta: {
        userId: user.id,
        role: user.role,
        count: facilities.length,
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/staff/facilities/:facilityId/current
 * Returns current bed availability snapshots for an assigned facility with freshness evaluated.
 */
staffRouter.get('/facilities/:facilityId/current', requireFacilityScope('report'), async (req, res, next) => {
  try {
    const rawAvailabilityMap = await domainStore.getFacilityAvailabilityMap(req.facility.id);
    const availabilityMap = evaluateAvailabilityFreshness(rawAvailabilityMap, Date.now());
    res.json({
      data: availabilityMap,
      facility: {
        id: req.facility.id,
        name: req.facility.name,
        supportedBedCategories: req.facility.supportedBedCategories,
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/staff/facilities/:facilityId/availability-reports
 * Returns report history for an assigned facility.
 */
staffRouter.get('/facilities/:facilityId/availability-reports', requireFacilityScope('report'), async (req, res, next) => {
  try {
    const limit = Math.min(Number(req.query.limit || 50), 100);
    const category = req.query.category || null;
    const reports = await domainStore.listAvailabilityReports(req.facility.id, { limit, category });

    res.json({
      data: reports,
      meta: {
        facilityId: req.facility.id,
        count: reports.length,
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/staff/facilities/:facilityId/availability-reports
 * Atomically submits a new capacity report for an assigned facility.
 */
staffRouter.post('/facilities/:facilityId/availability-reports', requireFacilityScope('report'), async (req, res, next) => {
  try {
    const { category, availableBeds, totalBeds, source } = req.body || {};
    const now = Date.now();

    const result = await domainStore.submitAvailabilityReport({
      facilityId: req.facility.id,
      category,
      availableBeds,
      totalBeds,
      user: req.user,
      source: source || 'manual_staff_portal',
      now,
    });

    const evaluatedSnapshot = result.snapshot
      ? {
          ...result.snapshot,
          freshnessState: 'FRESH',
          isVerifiedAvailability: false,
        }
      : result.snapshot;

    res.status(201).json({
      message: 'Availability report accepted and published.',
      data: {
        ...result,
        snapshot: evaluatedSnapshot,
      },
    });
  } catch (error) {
    if (error.statusCode) {
      return res.status(error.statusCode).json({ error: error.message });
    }
    next(error);
  }
});


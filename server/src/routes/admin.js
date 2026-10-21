import { Router } from 'express';
import { domainStore } from '../lib/domainStore.js';
import { authenticate, requireAuth } from '../middleware/authorize.js';

export const adminRouter = Router();
adminRouter.use(authenticate, requireAuth);

adminRouter.get('/hospitals', async (req, res, next) => {
  try {
    const facilities = await domainStore.listAuthorizedFacilities(req.user);
    res.json({ data: facilities });
  } catch (error) {
    next(error);
  }
});

adminRouter.post('/hospitals', async (req, res, next) => {
  try {
    if (req.user.role !== 'organization_admin') {
      return res.status(403).json({
        error: 'Forbidden: Only organization administrators can register facilities.',
      });
    }

    const draft = await domainStore.registerFacilityDraft(req.body, req.user);
    res.status(201).json({ data: draft });
  } catch (error) {
    if (error.statusCode) {
      return res.status(error.statusCode).json({ error: error.message, details: error.details });
    }
    next(error);
  }
});

adminRouter.patch('/hospitals/:id', async (req, res, next) => {
  try {
    const facility = await domainStore.getFacility(req.params.id);
    if (!facility) {
      return res.status(404).json({ error: 'Hospital not found.' });
    }

    // Role and tenancy authorization checks
    if (req.user.role === 'organization_admin') {
      if (req.user.organizationId !== facility.organizationId) {
        return res.status(403).json({
          error: 'Forbidden: You cannot modify a facility belonging to another organization.',
        });
      }
    } else if (req.user.role === 'facility_reporter') {
      const assigned = Array.isArray(req.user.assignedFacilityIds) ? req.user.assignedFacilityIds : [];
      if (!assigned.includes(facility.id)) {
        return res.status(403).json({
          error: 'Forbidden: You are not authorized to report for this facility.',
        });
      }
      if (req.body.name || req.body.address || req.body.operatingStatus) {
        return res.status(403).json({
          error: 'Forbidden: Facility reporters may only update availability.',
        });
      }
    } else {
      return res.status(403).json({
        error: `Forbidden: Role "${req.user.role}" cannot mutate facility data.`,
      });
    }

    // Update bed availability if beds are passed
    if (req.body.beds && typeof req.body.beds === 'object') {
      await domainStore.updateFacilityBeds(facility.id, req.body.beds, req.user);
    }

    // Update profile attributes if user is organization_admin
    if (req.user.role === 'organization_admin') {
      const { beds: ignoredBeds, ...profileFields } = req.body;
      if (Object.keys(profileFields).length > 0) {
        await domainStore.updateFacilityProfile(facility.id, profileFields, req.user);
      }
    }

    const updated = await domainStore.getFacility(facility.id);
    const availMap = await domainStore.getFacilityAvailabilityMap(facility.id);
    const beds = {};
    for (const cat of updated.supportedBedCategories || ['general', 'icu', 'hdu', 'pediatric']) {
      beds[cat] = availMap[cat]?.availableBeds || 0;
    }

    res.json({ data: { ...updated, beds } });
  } catch (error) {
    if (error.statusCode) {
      return res.status(error.statusCode).json({ error: error.message, details: error.details });
    }
    next(error);
  }
});

adminRouter.delete('/hospitals/:id', async (req, res, next) => {
  try {
    const facility = await domainStore.getFacility(req.params.id);
    if (!facility) {
      return res.status(404).json({ error: 'Hospital not found.' });
    }

    if (req.user.role !== 'organization_admin' || req.user.organizationId !== facility.organizationId) {
      return res.status(403).json({
        error: 'Forbidden: You cannot deactivate a facility outside your organization.',
      });
    }

    await domainStore.deactivateFacility(facility.id, req.user);
    res.status(204).end();
  } catch (error) {
    if (error.statusCode) {
      return res.status(error.statusCode).json({ error: error.message });
    }
    next(error);
  }
});

import { Router } from 'express';
import { domainStore } from '../lib/domainStore.js';
import { toPublicFacilityProjection } from '../domain/projections.js';
import { config } from '../config.js';

export const publicRouter = Router();

export const CARE_CATEGORIES = Object.freeze([
  {
    id: 'trauma',
    name: 'Major accident / trauma',
    description: 'Severe physical injury, vehicular accident, deep wounds, or fractures.',
    requiredCapabilities: ['trauma_care', 'emergency_surgery', 'blood_bank'],
    recommendedBedTypes: ['icu', 'general'],
  },
  {
    id: 'cardiac',
    name: 'Cardiac emergency',
    description: 'Acute chest pain, suspected heart attack, collapse, or severe palpitations.',
    requiredCapabilities: ['cardiac_intervention', 'emergency_surgery', 'oxygen_support'],
    recommendedBedTypes: ['icu', 'hdu'],
  },
  {
    id: 'stroke',
    name: 'Possible stroke',
    description: 'Sudden face drooping, arm weakness, speech difficulty, or acute confusion.',
    requiredCapabilities: ['ct_scan', 'emergency_surgery'],
    recommendedBedTypes: ['icu', 'hdu'],
  },
  {
    id: 'respiratory',
    name: 'Severe breathing difficulty',
    description: 'Acute shortness of breath, asthma exacerbation, or low oxygen levels.',
    requiredCapabilities: ['oxygen_support', 'ventilator_support'],
    recommendedBedTypes: ['icu', 'hdu', 'general'],
  },
  {
    id: 'pediatric',
    name: 'Paediatric emergency',
    description: 'Severe illness, seizure, or critical condition in an infant or child.',
    requiredCapabilities: ['oxygen_support'],
    recommendedBedTypes: ['pediatric', 'icu'],
  },
  {
    id: 'pregnancy',
    name: 'Pregnancy-related emergency',
    description: 'Active labor complications, acute bleeding, or high-risk maternal emergency.',
    requiredCapabilities: ['emergency_surgery', 'blood_bank'],
    recommendedBedTypes: ['general', 'icu'],
  },
  {
    id: 'other',
    name: 'Other urgent medical condition',
    description: 'General acute symptoms requiring emergency assessment.',
    requiredCapabilities: [],
    recommendedBedTypes: ['general'],
  },
]);

/**
 * GET /api/public/facilities
 * Searchable public hospital directory.
 */
publicRouter.get('/facilities', async (req, res, next) => {
  try {
    const filters = {
      q: req.query.q,
      locality: req.query.locality,
      city: req.query.city,
      district: req.query.district,
      bedCategory: req.query.bedCategory || req.query.bedType,
      availableOnly: req.query.availableOnly,
    };

    const results = await domainStore.getPublicDirectory(filters);

    res.json({
      data: results,
      meta: {
        count: results.length,
        dataMode: config.dataMode,
        refreshedAt: new Date().toISOString(),
        notice: 'Availability counts reflect latest hospital-reported submissions, not independent clinical verification.',
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/public/facilities/:facilityId
 * Retrieves a single published, verified facility profile.
 */
publicRouter.get('/facilities/:facilityId', async (req, res, next) => {
  try {
    const facility = await domainStore.getFacility(req.params.facilityId);
    if (!facility || facility.verificationStatus !== 'verified' || facility.publicationStatus !== 'published') {
      return res.status(404).json({ error: 'Facility not found or not published.' });
    }

    const availMap = await domainStore.getFacilityAvailabilityMap(facility.id);
    const capabilities = await domainStore.getFacilityCapabilities(facility.id);
    const coverage = await domainStore.getSpecialistCoverage(facility.id);

    const projection = toPublicFacilityProjection(facility, availMap, capabilities, coverage);

    res.json({ data: projection });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/public/care-categories
 * Returns allowed user-facing emergency care categories and mapping baseline.
 */
publicRouter.get('/care-categories', (_req, res) => {
  res.json({
    data: CARE_CATEGORIES,
    meta: {
      version: '1.1',
      disclaimer: 'User-reported care categories are for discovery and capability matching only; they are not clinical diagnoses or triage advice.',
    },
  });
});

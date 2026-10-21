import { Router } from 'express';
import { config } from '../config.js';
import { domainStore } from '../lib/domainStore.js';
import { toPublicFacilityProjection } from '../domain/projections.js';
import { SUPPORTED_BED_TYPES } from '../utils/validation.js';

export const hospitalsRouter = Router();

/**
 * Projects a domain public facility projection into the legacy hospital response contract.
 * Enforces that stale or unknown availability is never described as confirmed current capacity.
 */
export function projectToLegacyHospital(projection) {
  const avail = projection.availability || {};
  const isConfirmed = (cat) => {
    const state = avail[cat]?.freshnessState;
    return state === 'FRESH' || state === 'OVERDUE';
  };

  const beds = {
    general: isConfirmed('general') ? Number(avail.general?.availableBeds || 0) : 0,
    icu: isConfirmed('icu') ? Number(avail.icu?.availableBeds || 0) : 0,
    hdu: isConfirmed('hdu') ? Number(avail.hdu?.availableBeds || 0) : 0,
    pediatric: isConfirmed('pediatric') ? Number(avail.pediatric?.availableBeds || 0) : 0,
    oxygen: 0,
    ventilator: 0,
  };

  let latestReportedAt = projection.verifiedAt || null;
  for (const item of Object.values(avail)) {
    if (item?.reportedAt) {
      if (!latestReportedAt || new Date(item.reportedAt) > new Date(latestReportedAt)) {
        latestReportedAt = item.reportedAt;
      }
    }
  }

  return {
    id: projection.id,
    organizationId: projection.organizationId,
    name: projection.displayName || projection.name,
    address: projection.address,
    city: projection.city || projection.district || 'Tiruchirappalli',
    state: projection.state,
    postalCode: projection.postalCode,
    phone: projection.phone,
    latitude: projection.latitude,
    longitude: projection.longitude,
    services: (projection.capabilities || []).map((c) => c.name),
    beds,
    availability: projection.availability,
    capabilities: projection.capabilities,
    specialistCoverage: projection.specialistCoverage,
    operatingStatus: projection.operatingStatus || 'open',
    verificationStatus: projection.verificationStatus,
    isDemo: Boolean(projection.isDemo),
    updatedAt: latestReportedAt || new Date().toISOString(),
  };
}

export function filterHospitals(hospitals, filters = {}) {
  const q = String(filters.q || '').trim().toLowerCase();
  const city = String(filters.city || '').trim().toLowerCase();
  const service = String(filters.service || '').trim().toLowerCase();
  const rawBedType = filters.bedType ? String(filters.bedType).trim().toLowerCase() : '';
  const availableOnly = filters.availableOnly === true || String(filters.availableOnly || '') === 'true';

  const targetBedType = rawBedType && rawBedType !== 'all' ? rawBedType : null;

  return hospitals.filter((hospital) => {
    const text = [
      hospital.name,
      hospital.address,
      hospital.city,
      hospital.state,
      ...(hospital.services || []),
    ].join(' ').toLowerCase();

    if (q && !text.includes(q)) return false;
    if (city && !String(hospital.city || '').toLowerCase().includes(city)) return false;
    if (service && !(hospital.services || []).some((entry) => entry.toLowerCase().includes(service))) return false;
    if (hospital.operatingStatus !== 'open') return false;

    if (availableOnly) {
      if (targetBedType) {
        if (Number(hospital.beds?.[targetBedType] || 0) < 1) return false;
      } else {
        const bedValues = Object.values(hospital.beds || {});
        const hasAnyAvailableBed = bedValues.some((count) => Number(count || 0) > 0);
        if (!hasAnyAvailableBed) return false;
      }
    }

    return true;
  });
}

hospitalsRouter.get('/', async (req, res, next) => {
  try {
    const rawBedType = req.query.bedType ? String(req.query.bedType).trim().toLowerCase() : '';
    const validBedTypes = [...SUPPORTED_BED_TYPES, 'hdu', 'pediatric'];
    if (rawBedType && rawBedType !== 'all' && !validBedTypes.includes(rawBedType)) {
      return res.status(400).json({
        error: `Invalid bedType parameter: "${req.query.bedType}". Supported bed types are: ${SUPPORTED_BED_TYPES.join(', ')}.`,
      });
    }

    const projections = await domainStore.getPublicDirectory();
    const adaptedHospitals = projections.map(projectToLegacyHospital);

    const filtered = filterHospitals(adaptedHospitals, {
      q: req.query.q,
      city: req.query.city,
      service: req.query.service,
      bedType: rawBedType,
      availableOnly: req.query.availableOnly,
    });

    res.json({
      data: filtered,
      meta: {
        dataMode: config.dataMode,
        isDemo: config.dataMode === 'demo',
        refreshedAt: new Date().toISOString(),
      },
    });
  } catch (error) {
    next(error);
  }
});

hospitalsRouter.get('/:id', async (req, res, next) => {
  try {
    const facility = await domainStore.getFacility(req.params.id);
    if (!facility) return res.status(404).json({ error: 'Hospital not found.' });
    if (
      facility.verificationStatus !== 'verified' ||
      facility.publicationStatus !== 'published' ||
      facility.operatingStatus === 'suspended'
    ) {
      return res.status(404).json({ error: 'Hospital not found.' });
    }

    const availMap = await domainStore.getFacilityAvailabilityMap(facility.id);
    const capabilities = await domainStore.getFacilityCapabilities(facility.id);
    const coverage = await domainStore.getSpecialistCoverage(facility.id);
    const projection = toPublicFacilityProjection(facility, availMap, capabilities, coverage);
    if (!projection) return res.status(404).json({ error: 'Hospital not found.' });

    res.json({ data: projectToLegacyHospital(projection) });
  } catch (error) {
    next(error);
  }
});

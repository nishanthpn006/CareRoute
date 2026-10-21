import { evaluateAvailabilityFreshness } from './freshness.js';

/**
 * Transforms an internal facility entity and its associated snapshots into
 * the sanitized, whitelisted public directory projection.
 * 
 * Strict Privacy Guarantees:
 * - Only verified and published facilities are projected.
 * - Private verification evidence, reviewer notes, staff accounts, internal comments,
 *   and audit events are strictly excluded.
 * - Availability includes freshness state with explicit disclosure that freshness
 *   describes report age, not clinical verification.
 * 
 * @param {Object} facility - Internal facility entity
 * @param {Object} [availabilityMap={}] - Dictionary of category -> current snapshot
 * @param {Array} [capabilities=[]] - Facility capabilities
 * @param {Array} [coverage=[]] - Specialist coverage
 * @param {string|Date|number} [now=Date.now()] - Reference time for freshness evaluation
 * @returns {Object|null} Sanitized public projection or null if not eligible
 */
export function toPublicFacilityProjection(
  facility,
  availabilityMap = {},
  capabilities = [],
  coverage = [],
  now = Date.now(),
) {
  if (!facility) return null;

  // Gate: Unverified, rejected, suspended, or unpublished facilities are NOT eligible for public match
  if (
    facility.verificationStatus !== 'verified' ||
    facility.publicationStatus !== 'published' ||
    facility.operatingStatus === 'suspended'
  ) {
    return null;
  }

  // Sanitize capabilities: public view only needs id, name, status, verifiedAt
  const publicCapabilities = (capabilities || [])
    .filter((c) => c && c.status === 'available')
    .map((c) => ({
      id: c.id || c.capabilityId,
      name: c.name || c.id || c.capabilityId,
      category: c.category || 'general',
      verifiedAt: c.verifiedAt || null,
    }));

  // Sanitize specialist coverage: no personal doctor contact details or private rotas
  const publicCoverage = (coverage || []).map((cov) => ({
    specialty: cov.specialty,
    coverageState: cov.coverageState || 'unknown',
    coverageStartAt: cov.coverageStartAt || null,
    coverageEndAt: cov.coverageEndAt || null,
    reportedAt: cov.reportedAt || null,
  }));

  // Evaluate freshness for all supported bed categories
  const evaluatedAvailability = evaluateAvailabilityFreshness(availabilityMap, now);

  return {
    id: facility.id,
    organizationId: facility.organizationId,
    name: facility.name,
    displayName: facility.displayName || facility.name,
    facilityType: facility.facilityType || 'hospital',
    address: facility.address,
    locality: facility.locality || '',
    city: facility.city || facility.district || '',
    district: facility.district,
    state: facility.state,
    postalCode: facility.postalCode || '',
    latitude: Number(facility.latitude),
    longitude: Number(facility.longitude),
    phone: facility.phone,
    publicWebsite: facility.publicWebsite || null,
    operatingStatus: facility.operatingStatus || 'open',
    verificationStatus: 'verified',
    verifiedAt: facility.verifiedAt || null,
    sourceReference: facility.sourceReference || 'Verified Directory',
    isDemo: Boolean(facility.isDemo),
    supportedBedCategories: facility.supportedBedCategories || ['general', 'icu', 'hdu'],
    capabilities: publicCapabilities,
    specialistCoverage: publicCoverage,
    availability: evaluatedAvailability,
  };
}

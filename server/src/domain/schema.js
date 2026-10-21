/**
 * CareRoute — Domain Schemas and Validations
 * 
 * Defines and validates:
 * - Bed categories (ward types: general, icu, hdu, pediatric)
 * - Clinical capabilities (oxygen, ventilators, surgery, imaging — modeled separately from bed counts)
 * - Availability reports
 * - Facilities and Organizations
 * - Specialist coverage
 */

export const SUPPORTED_BED_CATEGORIES = Object.freeze([
  'general',
  'icu',
  'hdu',
  'pediatric',
]);

export const CANONICAL_CAPABILITIES = Object.freeze([
  { id: 'oxygen_support', name: 'Oxygen Support', category: 'critical_care' },
  { id: 'ventilator_support', name: 'Ventilator Support', category: 'critical_care' },
  { id: 'trauma_care', name: 'Emergency Trauma Care', category: 'emergency' },
  { id: 'emergency_surgery', name: 'Emergency Surgical Suite', category: 'surgical' },
  { id: 'cardiac_intervention', name: 'Cardiac Catheterization / Intervention', category: 'cardiac' },
  { id: 'ct_scan', name: 'CT Scan (Computed Tomography)', category: 'diagnostics' },
  { id: 'mri_scan', name: 'MRI Scan', category: 'diagnostics' },
  { id: 'blood_bank', name: 'Blood Bank / Transfusion Services', category: 'support' },
  { id: 'dialysis', name: 'Emergency Hemodialysis', category: 'support' },
]);

export const CANONICAL_CAPABILITY_IDS = Object.freeze(
  CANONICAL_CAPABILITIES.map((c) => c.id)
);

export const COVERAGE_STATES = Object.freeze(['onsite', 'on_call', 'unavailable', 'unknown']);
export const VERIFICATION_STATUSES = Object.freeze(['pending', 'verified', 'rejected', 'suspended', 'reverification-due']);
export const PUBLICATION_STATUSES = Object.freeze(['draft', 'published', 'hidden']);
export const FACILITY_OPERATING_STATUSES = Object.freeze(['open', 'closed']);

/**
 * Validates an incoming availability report payload.
 * 
 * Rules:
 * - Category must be in SUPPORTED_BED_CATEGORIES.
 * - Category must be supported and enabled for this specific facility.
 * - totalBeds must be a non-negative integer.
 * - availableBeds must be a non-negative integer.
 * - availableBeds <= totalBeds.
 */
export function validateAvailabilityReport(payload, facility) {
  const errors = [];

  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return ['Report payload must be a JSON object.'];
  }

  const { category, availableBeds, totalBeds } = payload;

  if (typeof category !== 'string' || !category.trim()) {
    errors.push('Bed category is required.');
  } else {
    const normalizedCategory = category.trim().toLowerCase();
    if (!SUPPORTED_BED_CATEGORIES.includes(normalizedCategory)) {
      errors.push(`Unsupported bed category: "${category}". Allowed categories are: ${SUPPORTED_BED_CATEGORIES.join(', ')}.`);
    } else if (facility) {
      const facilityCategories = (facility.supportedBedCategories || []).map((c) => c.toLowerCase());
      if (facilityCategories.length > 0 && !facilityCategories.includes(normalizedCategory)) {
        errors.push(`Bed category "${normalizedCategory}" is not enabled for facility "${facility.name || facility.id}".`);
      }
    }
  }

  if (totalBeds === undefined || totalBeds === null) {
    errors.push('totalBeds is required.');
  } else if (!Number.isInteger(Number(totalBeds)) || Number(totalBeds) < 0) {
    errors.push('totalBeds must be a non-negative integer.');
  }

  if (availableBeds === undefined || availableBeds === null) {
    errors.push('availableBeds is required.');
  } else if (!Number.isInteger(Number(availableBeds)) || Number(availableBeds) < 0) {
    errors.push('availableBeds must be a non-negative integer.');
  }

  if (
    Number.isInteger(Number(totalBeds)) &&
    Number.isInteger(Number(availableBeds)) &&
    Number(availableBeds) > Number(totalBeds)
  ) {
    errors.push(`availableBeds (${availableBeds}) cannot exceed totalBeds (${totalBeds}).`);
  }

  return errors;
}

/**
 * Validates a facility entity payload.
 */
export function validateFacilityPayload(input, partial = false) {
  const errors = [];
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return ['Facility payload must be a JSON object.'];
  }

  const requiredFields = ['organizationId', 'name', 'address', 'district', 'state', 'phone'];
  if (!partial) {
    for (const field of requiredFields) {
      if (typeof input[field] !== 'string' || !input[field].trim()) {
        errors.push(`${field} is required.`);
      }
    }
    for (const field of ['latitude', 'longitude']) {
      if (!Number.isFinite(Number(input[field]))) {
        errors.push(`${field} must be a valid number.`);
      }
    }
  }

  for (const [field, min, max] of [['latitude', -90, 90], ['longitude', -180, 180]]) {
    if (input[field] !== undefined) {
      const val = Number(input[field]);
      if (!Number.isFinite(val) || val < min || val > max) {
        errors.push(`${field} must be between ${min} and ${max}.`);
      }
    }
  }

  if (input.verificationStatus !== undefined && !VERIFICATION_STATUSES.includes(input.verificationStatus)) {
    errors.push(`verificationStatus must be one of: ${VERIFICATION_STATUSES.join(', ')}.`);
  }

  if (input.publicationStatus !== undefined && !PUBLICATION_STATUSES.includes(input.publicationStatus)) {
    errors.push(`publicationStatus must be one of: ${PUBLICATION_STATUSES.join(', ')}.`);
  }

  if (input.operatingStatus !== undefined && !FACILITY_OPERATING_STATUSES.includes(input.operatingStatus)) {
    errors.push(`operatingStatus must be one of: ${FACILITY_OPERATING_STATUSES.join(', ')}.`);
  }

  if (input.supportedBedCategories !== undefined) {
    if (!Array.isArray(input.supportedBedCategories) || input.supportedBedCategories.some((c) => typeof c !== 'string')) {
      errors.push('supportedBedCategories must be an array of strings.');
    } else {
      const invalid = input.supportedBedCategories.filter((c) => !SUPPORTED_BED_CATEGORIES.includes(c.toLowerCase()));
      if (invalid.length) {
        errors.push(`Invalid bed categories: ${invalid.join(', ')}. Supported: ${SUPPORTED_BED_CATEGORIES.join(', ')}.`);
      }
    }
  }

  return errors;
}

/**
 * Validates a specialist coverage update payload.
 */
export function validateSpecialistCoverage(input) {
  const errors = [];
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return ['Coverage payload must be a JSON object.'];
  }

  if (typeof input.specialty !== 'string' || !input.specialty.trim()) {
    errors.push('specialty is required.');
  }

  if (!COVERAGE_STATES.includes(input.coverageState)) {
    errors.push(`coverageState must be one of: ${COVERAGE_STATES.join(', ')}.`);
  }

  return errors;
}

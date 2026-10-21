export const SUPPORTED_BED_TYPES = Object.freeze(['general', 'icu', 'oxygen', 'ventilator']);

export function validateHospitalPayload(input, partial = false) {
  const errors = [];
  const requiredTextFields = ['name', 'address', 'city', 'state', 'phone'];
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return ['Request body must be a JSON object.'];
  }
  if (!partial) {
    for (const field of requiredTextFields) {
      if (typeof input[field] !== 'string' || !input[field].trim()) errors.push(`${field} is required.`);
    }
    for (const field of ['latitude', 'longitude']) {
      if (!Number.isFinite(Number(input[field]))) errors.push(`${field} must be a valid number.`);
    }
    if (!input.beds || typeof input.beds !== 'object') errors.push('beds must contain bed availability counts.');
  }
  for (const field of [...requiredTextFields, 'postalCode']) {
    if (input[field] !== undefined && (typeof input[field] !== 'string' || (requiredTextFields.includes(field) && !input[field].trim()))) {
      errors.push(`${field} must be a non-empty string.`);
    }
  }
  for (const [field, min, max] of [['latitude', -90, 90], ['longitude', -180, 180]]) {
    if (input[field] !== undefined && (!Number.isFinite(Number(input[field])) || Number(input[field]) < min || Number(input[field]) > max)) {
      errors.push(`${field} must be between ${min} and ${max}.`);
    }
  }
  if (input.beds !== undefined) {
    if (!input.beds || typeof input.beds !== 'object' || Array.isArray(input.beds)) {
      errors.push('beds must be an object.');
    } else {
      for (const field of SUPPORTED_BED_TYPES) {
        if (input.beds[field] !== undefined && (!Number.isInteger(Number(input.beds[field])) || Number(input.beds[field]) < 0)) {
          errors.push(`beds.${field} must be a non-negative integer.`);
        }
      }
    }
  }
  if (input.services !== undefined && (!Array.isArray(input.services) || input.services.some((s) => typeof s !== 'string'))) {
    errors.push('services must be an array of strings.');
  }
  if (input.operatingStatus !== undefined && !['open', 'closed'].includes(input.operatingStatus)) {
    errors.push('operatingStatus must be "open" or "closed".');
  }
  return errors;
}

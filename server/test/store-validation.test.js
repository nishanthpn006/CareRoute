import test from 'node:test';
import assert from 'node:assert/strict';
import { validateHospitalPayload } from '../src/utils/validation.js';

test('rejects a hospital with missing required fields', () => {
  const errors = validateHospitalPayload({ name: 'Demo Hospital' });
  assert.ok(errors.some((message) => message.includes('address is required')));
  assert.ok(errors.some((message) => message.includes('beds must contain')));
});

test('rejects negative bed counts', () => {
  const errors = validateHospitalPayload({ beds: { general: -1 } }, true);
  assert.ok(errors.some((message) => message.includes('non-negative integer')));
});

test('accepts non-negative integer bed counts', () => {
  const errors = validateHospitalPayload({ beds: { general: 0, icu: 2 } }, true);
  assert.equal(errors.length, 0);
});

test('rejects coordinates outside valid geographic ranges', () => {
  const errors = validateHospitalPayload({ latitude: 100, longitude: 80 }, true);
  assert.ok(errors.some((message) => message.includes('latitude must be between -90 and 90')));
});

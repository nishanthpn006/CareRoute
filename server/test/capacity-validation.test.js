import test from 'node:test';
import assert from 'node:assert/strict';
import { validateAvailabilityReport, SUPPORTED_BED_CATEGORIES } from '../src/domain/schema.js';

const mockFacility = {
  id: 'fac-test-1',
  name: 'Test Hospital',
  supportedBedCategories: ['general', 'icu', 'hdu'],
};

test('accepts valid capacity report where availableBeds <= totalBeds', () => {
  const errors = validateAvailabilityReport(
    { category: 'general', availableBeds: 5, totalBeds: 20 },
    mockFacility,
  );
  assert.equal(errors.length, 0);
});

test('accepts capacity report when all beds are full (availableBeds = 0)', () => {
  const errors = validateAvailabilityReport(
    { category: 'icu', availableBeds: 0, totalBeds: 10 },
    mockFacility,
  );
  assert.equal(errors.length, 0);
});

test('accepts capacity report when available equals total (availableBeds = totalBeds)', () => {
  const errors = validateAvailabilityReport(
    { category: 'hdu', availableBeds: 8, totalBeds: 8 },
    mockFacility,
  );
  assert.equal(errors.length, 0);
});

test('rejects report when availableBeds exceeds totalBeds', () => {
  const errors = validateAvailabilityReport(
    { category: 'general', availableBeds: 25, totalBeds: 20 },
    mockFacility,
  );
  assert.ok(errors.some((msg) => msg.includes('cannot exceed totalBeds')));
});

test('rejects negative bed counts', () => {
  const errorsAvailable = validateAvailabilityReport(
    { category: 'general', availableBeds: -1, totalBeds: 10 },
    mockFacility,
  );
  assert.ok(errorsAvailable.some((msg) => msg.includes('availableBeds must be a non-negative integer')));

  const errorsTotal = validateAvailabilityReport(
    { category: 'general', availableBeds: 0, totalBeds: -5 },
    mockFacility,
  );
  assert.ok(errorsTotal.some((msg) => msg.includes('totalBeds must be a non-negative integer')));
});

test('rejects non-integer bed counts', () => {
  const errors = validateAvailabilityReport(
    { category: 'general', availableBeds: 4.5, totalBeds: 10 },
    mockFacility,
  );
  assert.ok(errors.some((msg) => msg.includes('availableBeds must be a non-negative integer')));
});

test('rejects unsupported bed category across the platform', () => {
  const errors = validateAvailabilityReport(
    { category: 'luxury_suite', availableBeds: 1, totalBeds: 2 },
    mockFacility,
  );
  assert.ok(errors.some((msg) => msg.includes('Unsupported bed category')));
});

test('rejects bed category not enabled for this specific facility', () => {
  // Facility only supports ['general', 'icu', 'hdu'], pediatric is supported by platform but not this facility
  const errors = validateAvailabilityReport(
    { category: 'pediatric', availableBeds: 2, totalBeds: 5 },
    mockFacility,
  );
  assert.ok(errors.some((msg) => msg.includes('not enabled for facility')));
});

test('SUPPORTED_BED_CATEGORIES contains only valid ward categories, excluding separate equipment capabilities', () => {
  assert.deepEqual([...SUPPORTED_BED_CATEGORIES], ['general', 'icu', 'hdu', 'pediatric']);
  assert.ok(!SUPPORTED_BED_CATEGORIES.includes('oxygen'), 'Oxygen must be modeled as capability, not bed ward');
  assert.ok(!SUPPORTED_BED_CATEGORIES.includes('ventilator'), 'Ventilator must be modeled as capability, not bed ward');
});

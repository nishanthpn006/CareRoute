import test from 'node:test';
import assert from 'node:assert/strict';
import { filterHospitals } from '../src/routes/hospitals.js';
import { SUPPORTED_BED_TYPES } from '../src/utils/validation.js';

const sampleHospitals = [
  {
    id: 'hosp-all-zero',
    name: 'Hospital Zero',
    address: '10 Main Road',
    city: 'Chennai',
    state: 'Tamil Nadu',
    services: ['Emergency', 'General Medicine'],
    beds: { general: 0, icu: 0, oxygen: 0, ventilator: 0 },
    operatingStatus: 'open',
  },
  {
    id: 'hosp-icu-only',
    name: 'ICU Specialty Center',
    address: '20 North St',
    city: 'Chennai',
    state: 'Tamil Nadu',
    services: ['Emergency', 'ICU'],
    beds: { general: 0, icu: 3, oxygen: 0, ventilator: 0 },
    operatingStatus: 'open',
  },
  {
    id: 'hosp-multi-bed',
    name: 'City Care Hospital',
    address: '30 South Ave',
    city: 'Coimbatore',
    state: 'Tamil Nadu',
    services: ['Emergency', 'General Medicine', 'Oxygen Support', 'Ventilator Support'],
    beds: { general: 15, icu: 0, oxygen: 4, ventilator: 2 },
    operatingStatus: 'open',
  },
  {
    id: 'hosp-closed',
    name: 'Closed Facility',
    address: '40 West Blvd',
    city: 'Chennai',
    state: 'Tamil Nadu',
    services: ['Emergency'],
    beds: { general: 50, icu: 10, oxygen: 10, ventilator: 5 },
    operatingStatus: 'closed',
  },
];

test('availableOnly=true without bedType returns only hospitals with at least one available bed', () => {
  const result = filterHospitals(sampleHospitals, { availableOnly: true });
  const ids = result.map((h) => h.id);
  assert.ok(ids.includes('hosp-icu-only'), 'Should include hospital with ICU beds');
  assert.ok(ids.includes('hosp-multi-bed'), 'Should include hospital with multiple available beds');
  assert.ok(!ids.includes('hosp-all-zero'), 'Must exclude hospital with all zero beds');
  assert.ok(!ids.includes('hosp-closed'), 'Must exclude closed hospital');
});

test('availableOnly=true with specific bedType returns only hospitals with available beds in that category', () => {
  const icuOnlyResult = filterHospitals(sampleHospitals, { availableOnly: true, bedType: 'icu' });
  const icuIds = icuOnlyResult.map((h) => h.id);
  assert.deepEqual(icuIds, ['hosp-icu-only']);

  const oxygenResult = filterHospitals(sampleHospitals, { availableOnly: true, bedType: 'oxygen' });
  const oxygenIds = oxygenResult.map((h) => h.id);
  assert.deepEqual(oxygenIds, ['hosp-multi-bed']);

  const ventilatorResult = filterHospitals(sampleHospitals, { availableOnly: true, bedType: 'ventilator' });
  const ventIds = ventilatorResult.map((h) => h.id);
  assert.deepEqual(ventIds, ['hosp-multi-bed']);
});

test('availableOnly=false or omitted does not exclude hospitals solely because beds are zero', () => {
  const withoutFilter = filterHospitals(sampleHospitals);
  const ids = withoutFilter.map((h) => h.id);
  assert.ok(ids.includes('hosp-all-zero'), 'Zero-bed open hospital should be included when availableOnly is omitted');
  assert.ok(ids.includes('hosp-icu-only'));
  assert.ok(ids.includes('hosp-multi-bed'));
  assert.ok(!ids.includes('hosp-closed'), 'Closed hospital must still be excluded');

  const withFalse = filterHospitals(sampleHospitals, { availableOnly: false });
  assert.ok(withFalse.map((h) => h.id).includes('hosp-all-zero'));
});

test('bedType=all is treated as any bed type', () => {
  const result = filterHospitals(sampleHospitals, { availableOnly: true, bedType: 'all' });
  const ids = result.map((h) => h.id);
  assert.ok(ids.includes('hosp-icu-only'));
  assert.ok(ids.includes('hosp-multi-bed'));
  assert.ok(!ids.includes('hosp-all-zero'));
});

test('preserves search, city, and service filtering', () => {
  const cityFiltered = filterHospitals(sampleHospitals, { city: 'Coimbatore' });
  assert.equal(cityFiltered.length, 1);
  assert.equal(cityFiltered[0].id, 'hosp-multi-bed');

  const searchFiltered = filterHospitals(sampleHospitals, { q: 'specialty' });
  assert.equal(searchFiltered.length, 1);
  assert.equal(searchFiltered[0].id, 'hosp-icu-only');

  const serviceFiltered = filterHospitals(sampleHospitals, { service: 'Ventilator Support' });
  assert.equal(serviceFiltered.length, 1);
  assert.equal(serviceFiltered[0].id, 'hosp-multi-bed');
});

test('SUPPORTED_BED_TYPES contains all four standard bed categories', () => {
  assert.deepEqual([...SUPPORTED_BED_TYPES], ['general', 'icu', 'oxygen', 'ventilator']);
});

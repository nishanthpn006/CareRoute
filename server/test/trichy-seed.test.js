import test from 'node:test';
import assert from 'node:assert/strict';
import { SEED_FACILITIES, SEED_ORGANIZATIONS } from '../src/data/trichySeedData.js';
import { domainStore } from '../src/lib/domainStore.js';
import { FRESHNESS_STATES } from '../src/domain/freshness.js';

test('Tiruchirappalli pilot seed data policy and provenance', () => {
  domainStore.reset();

  assert.ok(SEED_FACILITIES.length >= 4, 'Should include core government and private facilities for pilot');
  assert.ok(SEED_ORGANIZATIONS.length >= 2, 'Should include government health department and private organization');

  for (const facility of SEED_FACILITIES) {
    // Provenance check
    assert.ok(facility.sourceReference, `Facility ${facility.name} must have documented source provenance`);
    assert.ok(facility.phone, `Facility ${facility.name} must have a telephone contact`);

    // Geographic bounding check: Tiruchirappalli District bounds
    assert.ok(
      facility.latitude >= 10.4 && facility.latitude <= 11.2,
      `Facility ${facility.name} latitude (${facility.latitude}) must be within Tiruchirappalli District bounds`,
    );
    assert.ok(
      facility.longitude >= 78.2 && facility.longitude <= 79.1,
      `Facility ${facility.name} longitude (${facility.longitude}) must be within Tiruchirappalli District bounds`,
    );

    // Initial capacity policy: NO INVENTED LIVE DATA
    const availMap = domainStore.getFacilityAvailabilityMap(facility.id);
    for (const [category, snapshot] of Object.entries(availMap)) {
      assert.equal(snapshot, null, `Initial snapshot for ${facility.name}:${category} must be null until reported`);
    }
  }

  // When projected to public directory before any report, freshness must be UNKNOWN
  const publicFacilities = domainStore.getPublicDirectory();
  for (const pub of publicFacilities) {
    for (const [category, catData] of Object.entries(pub.availability)) {
      assert.equal(
        catData.freshnessState,
        FRESHNESS_STATES.UNKNOWN,
        `Public availability for ${pub.name} (${category}) must be UNKNOWN until an authorized report is submitted`,
      );
      assert.equal(catData.isVerifiedAvailability, false);
    }
  }
});

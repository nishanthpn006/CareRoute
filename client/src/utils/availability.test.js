import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  getBedAvailabilityStatus,
  getOverallFreshnessBadge,
  calculateTotalConfirmedBeds,
  formatConfirmedBedsSummary,
} from './availability.js';

test('availability display - UNKNOWN report state', () => {
  const hospitalWithoutAvail = { id: 'h1', name: 'General Hospital' };
  const res1 = getBedAvailabilityStatus(hospitalWithoutAvail, 'icu');

  assert.equal(res1.freshnessState, 'UNKNOWN');
  assert.equal(res1.isNumeric, false);
  assert.equal(res1.displayPrimary, 'Not reported');
  assert.equal(res1.availableCount, null);
  assert.equal(res1.isConfirmed, false);

  const hospitalWithUnknownState = {
    id: 'h2',
    name: 'Apollo Hospital',
    availability: {
      icu: { availableBeds: 0, totalBeds: 10, freshnessState: 'UNKNOWN' },
    },
  };
  const res2 = getBedAvailabilityStatus(hospitalWithUnknownState, 'icu');
  assert.equal(res2.freshnessState, 'UNKNOWN');
  assert.equal(res2.isNumeric, false);
  // UNKNOWN must NEVER display numeric "0" or "unreported / 0"
  assert.equal(res2.displayPrimary, 'Not reported');
});

test('availability display - STALE report state (>60m)', () => {
  const hospital = {
    id: 'h3',
    name: 'District Care',
    availability: {
      general: {
        availableBeds: 12,
        totalBeds: 40,
        freshnessState: 'STALE',
      },
    },
  };
  const res = getBedAvailabilityStatus(hospital, 'general');
  assert.equal(res.freshnessState, 'STALE');
  assert.equal(res.isNumeric, false);
  assert.equal(res.isConfirmed, false);
  assert.match(res.displaySecondary, /unconfirmed/i);
  assert.equal(res.displayPrimary, '12');
});

test('availability display - OVERDUE report state (15-60m)', () => {
  const hospital = {
    id: 'h4',
    name: 'City Clinic',
    availability: {
      hdu: {
        availableBeds: 4,
        totalBeds: 8,
        freshnessState: 'OVERDUE',
      },
    },
  };
  const res = getBedAvailabilityStatus(hospital, 'hdu');
  assert.equal(res.freshnessState, 'OVERDUE');
  assert.equal(res.isNumeric, true);
  assert.equal(res.isConfirmed, true);
  assert.equal(res.displayPrimary, '4 / 8');
  assert.match(res.displaySecondary, /overdue/i);
});

test('availability display - FRESH report state (<=15m)', () => {
  const hospital = {
    id: 'h5',
    name: 'Metro Hospital',
    availability: {
      icu: {
        availableBeds: 6,
        totalBeds: 10,
        freshnessState: 'FRESH',
      },
    },
  };
  const res = getBedAvailabilityStatus(hospital, 'icu');
  assert.equal(res.freshnessState, 'FRESH');
  assert.equal(res.isNumeric, true);
  assert.equal(res.isConfirmed, true);
  assert.equal(res.displayPrimary, '6 / 10');
  assert.match(res.displaySecondary, /confirmed/i);
});

test('availability display - verified report of zero available beds', () => {
  const hospital = {
    id: 'h6',
    name: 'Full Care Facility',
    availability: {
      icu: {
        availableBeds: 0,
        totalBeds: 12,
        freshnessState: 'FRESH',
      },
    },
  };
  const res = getBedAvailabilityStatus(hospital, 'icu');
  assert.equal(res.freshnessState, 'FRESH');
  assert.equal(res.isNumeric, true);
  assert.equal(res.isFull, true);
  assert.equal(res.availableCount, 0);
  assert.equal(res.displayPrimary, '0 / 12');
  assert.match(res.displaySecondary, /full/i);
});

test('overall freshness badge reflects selected bed or aggregate states', () => {
  const hospital = {
    availability: {
      general: { freshnessState: 'STALE' },
      icu: { freshnessState: 'FRESH' },
    },
  };

  const badgeAll = getOverallFreshnessBadge(hospital, 'all');
  assert.equal(badgeAll.state, 'FRESH');

  const badgeGeneral = getOverallFreshnessBadge(hospital, 'general');
  assert.equal(badgeGeneral.state, 'STALE');

  const badgeUnknown = getOverallFreshnessBadge(hospital, 'pediatric');
  assert.equal(badgeUnknown.state, 'UNKNOWN');
});

test('calculateTotalConfirmedBeds excludes UNKNOWN and STALE counts', () => {
  const hospitals = [
    {
      id: '1',
      availability: {
        general: { availableBeds: 10, freshnessState: 'FRESH' },
        icu: { availableBeds: 5, freshnessState: 'OVERDUE' },
        hdu: { availableBeds: 8, freshnessState: 'STALE' }, // excluded
        pediatric: { availableBeds: 4, freshnessState: 'UNKNOWN' }, // excluded
      },
    },
    {
      id: '2',
      availability: {
        general: { availableBeds: 2, freshnessState: 'FRESH' },
      },
    },
  ];

  const totalAll = calculateTotalConfirmedBeds(hospitals, 'all');
  assert.equal(totalAll, 10 + 5 + 2); // 17

  const totalGeneral = calculateTotalConfirmedBeds(hospitals, 'general');
  assert.equal(totalGeneral, 12);
});

test('formatConfirmedBedsSummary does not display "0 confirmed available beds" for missing reports', () => {
  const emptyHospitals = [
    { id: '1', availability: {} },
    { id: '2', availability: { icu: { freshnessState: 'UNKNOWN' } } },
  ];

  const summary = formatConfirmedBedsSummary(0, emptyHospitals, 'all');
  assert.equal(summary.countDisplay, '—');
  assert.equal(summary.labelDisplay, 'No current availability reports');
  assert.equal(summary.hasActiveReports, false);

  const fullHospitals = [
    { id: '1', availability: { general: { availableBeds: 0, freshnessState: 'FRESH' } } },
  ];
  const summaryFull = formatConfirmedBedsSummary(0, fullHospitals, 'general');
  assert.equal(summaryFull.countDisplay, '0');
  assert.match(summaryFull.labelDisplay, /full/i);

  const activeSummary = formatConfirmedBedsSummary(15, fullHospitals, 'all');
  assert.equal(activeSummary.countDisplay, '15');
  assert.match(activeSummary.labelDisplay, /confirmed available beds/i);
});

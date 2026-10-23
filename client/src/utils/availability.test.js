import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  getBedAvailabilityStatus,
  getOverallFreshnessBadge,
  calculateTotalConfirmedBeds,
  formatConfirmedBedsSummary,
  getHospitalBedSummary,
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

test('availability display - fallback freshness calculation when freshnessState property is omitted', () => {
  const justNow = new Date(Date.now() - 2 * 60 * 1000).toISOString(); // 2 minutes ago
  const hospitalFresh = {
    id: 'h-mgmgh',
    availability: {
      general: {
        availableBeds: 22,
        totalBeds: 50,
        reportedAt: justNow,
      },
    },
  };

  const res = getBedAvailabilityStatus(hospitalFresh, 'general');
  assert.equal(res.freshnessState, 'FRESH');
  assert.equal(res.isNumeric, true);
  assert.equal(res.isConfirmed, true);
  assert.equal(res.availableCount, 22);
  assert.equal(res.totalCount, 50);
  assert.equal(res.displayPrimary, '22 / 50');
  assert.match(res.displaySecondary, /confirmed/i);

  // Test 30 minutes ago -> OVERDUE
  const thirtyMinAgo = new Date(Date.now() - 30 * 60 * 1000).toISOString();
  const hospitalOverdue = {
    id: 'h-mgmgh',
    availability: {
      general: {
        availableBeds: 22,
        totalBeds: 50,
        reportedAt: thirtyMinAgo,
      },
    },
  };
  const resOverdue = getBedAvailabilityStatus(hospitalOverdue, 'general');
  assert.equal(resOverdue.freshnessState, 'OVERDUE');
  assert.equal(resOverdue.isNumeric, true);

  // Test 90 minutes ago -> STALE
  const ninetyMinAgo = new Date(Date.now() - 90 * 60 * 1000).toISOString();
  const hospitalStale = {
    id: 'h-mgmgh',
    availability: {
      general: {
        availableBeds: 22,
        totalBeds: 50,
        reportedAt: ninetyMinAgo,
      },
    },
  };
  const resStale = getBedAvailabilityStatus(hospitalStale, 'general');
  assert.equal(resStale.freshnessState, 'STALE');
  assert.equal(resStale.isNumeric, false);
});

test('getHospitalBedSummary - calculates 72 available out of 140 total beds (General 22/50, ICU 14/25, HDU 13/35, Pediatric 23/30)', () => {
  const justNow = new Date().toISOString();
  const hospital = {
    id: 'fac-test-complete',
    name: 'District Medical Center',
    supportedBedCategories: ['general', 'icu', 'hdu', 'pediatric'],
    availability: {
      general: { availableBeds: 22, totalBeds: 50, freshnessState: 'FRESH', reportedAt: justNow },
      icu: { availableBeds: 14, totalBeds: 25, freshnessState: 'FRESH', reportedAt: justNow },
      hdu: { availableBeds: 13, totalBeds: 35, freshnessState: 'FRESH', reportedAt: justNow },
      pediatric: { availableBeds: 23, totalBeds: 30, freshnessState: 'FRESH', reportedAt: justNow },
    },
  };

  const summary = getHospitalBedSummary(hospital, 'all');

  assert.equal(summary.hasReport, true);
  assert.equal(summary.headlineCount, 72, 'Sum of available beds must equal 22+14+13+23=72');
  assert.equal(summary.totalCapacity, 140, 'Sum of total beds must equal 50+25+35+30=140');
  assert.equal(summary.percentage, 51, 'Available percentage: 72/140 * 100 = 51%');
  assert.equal(summary.isFull, false);
  assert.equal(summary.isPartial, false);
  assert.equal(summary.subtext, '72 beds available out of 140 total beds');
  assert.equal(summary.reportedWardCount, 4);

  // Check individual wards
  const general = summary.wardStatuses.find((w) => w.key === 'general');
  assert.equal(general.availableCount, 22);
  assert.equal(general.totalCount, 50);
  assert.equal(general.percentage, 44);

  const icu = summary.wardStatuses.find((w) => w.key === 'icu');
  assert.equal(icu.availableCount, 14);
  assert.equal(icu.totalCount, 25);
  assert.equal(icu.percentage, 56);

  const hdu = summary.wardStatuses.find((w) => w.key === 'hdu');
  assert.equal(hdu.availableCount, 13);
  assert.equal(hdu.totalCount, 35);
  assert.equal(hdu.percentage, 37);

  const ped = summary.wardStatuses.find((w) => w.key === 'pediatric');
  assert.equal(ped.availableCount, 23);
  assert.equal(ped.totalCount, 30);
  assert.equal(ped.percentage, 77);
});

test('getHospitalBedSummary - unreported hospital does not display false zero', () => {
  const hospital = {
    id: 'fac-test-unreported',
    name: 'Unverified Candidate Clinic',
    supportedBedCategories: ['general', 'icu'],
    availability: {},
  };

  const summary = getHospitalBedSummary(hospital, 'all');

  assert.equal(summary.hasReport, false);
  assert.equal(summary.headlineCount, null, 'Must NOT be 0');
  assert.equal(summary.totalCapacity, null, 'Must NOT be 0');
  assert.equal(summary.percentage, null);
  assert.equal(summary.subtext, 'Bed availability not yet reported');
  assert.equal(summary.reportedWardCount, 0);

  for (const ward of summary.wardStatuses) {
    assert.equal(ward.isNumeric, false);
    assert.equal(ward.availableCount, null);
    assert.equal(ward.freshnessState, 'UNKNOWN');
  }
});

test('getHospitalBedSummary - handles confirmed zero availability (wards full)', () => {
  const justNow = new Date().toISOString();
  const hospital = {
    id: 'fac-test-full',
    name: 'Full Capacity Hospital',
    supportedBedCategories: ['general', 'icu'],
    availability: {
      general: { availableBeds: 0, totalBeds: 50, freshnessState: 'FRESH', reportedAt: justNow },
      icu: { availableBeds: 0, totalBeds: 20, freshnessState: 'FRESH', reportedAt: justNow },
    },
  };

  const summary = getHospitalBedSummary(hospital, 'all');

  assert.equal(summary.hasReport, true);
  assert.equal(summary.headlineCount, 0);
  assert.equal(summary.totalCapacity, 70);
  assert.equal(summary.percentage, 0);
  assert.equal(summary.isFull, true);
  assert.match(summary.subtext, /wards full/i);
});

test('getHospitalBedSummary - partial reports aggregate only reported wards and explain limitation', () => {
  const justNow = new Date().toISOString();
  const hospital = {
    id: 'fac-test-partial',
    name: 'Partial Reporting Hospital',
    supportedBedCategories: ['general', 'icu', 'hdu', 'pediatric'],
    availability: {
      general: { availableBeds: 22, totalBeds: 50, freshnessState: 'FRESH', reportedAt: justNow },
      // icu, hdu, pediatric are missing (unreported)
    },
  };

  const summary = getHospitalBedSummary(hospital, 'all');

  assert.equal(summary.hasReport, true);
  assert.equal(summary.headlineCount, 22);
  assert.equal(summary.totalCapacity, 50, 'Only counts capacity from reported wards, never assumes missing is zero');
  assert.equal(summary.percentage, 44);
  assert.equal(summary.isPartial, true);
  assert.equal(summary.reportedWardCount, 1);
  assert.equal(summary.totalSupportedWards, 4);
  assert.match(summary.subtext, /1 of 4 wards reporting/i);
});

test('getHospitalBedSummary - selected bed category filter scopes summary to that ward', () => {
  const justNow = new Date().toISOString();
  const hospital = {
    id: 'fac-test-scoped',
    name: 'Multi-ward Hospital',
    supportedBedCategories: ['general', 'icu'],
    availability: {
      general: { availableBeds: 20, totalBeds: 40, freshnessState: 'FRESH', reportedAt: justNow },
      icu: { availableBeds: 5, totalBeds: 10, freshnessState: 'FRESH', reportedAt: justNow },
    },
  };

  const summary = getHospitalBedSummary(hospital, 'icu');

  assert.equal(summary.hasReport, true);
  assert.equal(summary.headlineCount, 5);
  assert.equal(summary.totalCapacity, 10);
  assert.equal(summary.percentage, 50);
  assert.equal(summary.wardStatuses.length, 1);
  assert.equal(summary.wardStatuses[0].key, 'icu');
});



import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateFreshness, evaluateAvailabilityFreshness, FRESHNESS_STATES } from '../src/domain/freshness.js';

test('freshness calculation with clock injection', async (t) => {
  const referenceNow = new Date('2026-10-16T12:00:00.000Z').getTime();

  await t.test('returns FRESH when report is just submitted (0 min old)', () => {
    const reportedAt = new Date('2026-10-16T12:00:00.000Z').toISOString();
    assert.equal(calculateFreshness(reportedAt, referenceNow), FRESHNESS_STATES.FRESH);
  });

  await t.test('returns FRESH at exactly 15 minutes boundary', () => {
    // 15 minutes = 900,000 ms
    const reportedAt = new Date(referenceNow - 15 * 60 * 1000).toISOString();
    assert.equal(calculateFreshness(reportedAt, referenceNow), FRESHNESS_STATES.FRESH);
  });

  await t.test('transitions to OVERDUE at 15 minutes + 1 ms', () => {
    const reportedAt = new Date(referenceNow - (15 * 60 * 1000 + 1)).toISOString();
    assert.equal(calculateFreshness(reportedAt, referenceNow), FRESHNESS_STATES.OVERDUE);
  });

  await t.test('returns OVERDUE at exactly 60 minutes boundary', () => {
    // 60 minutes = 3,600,000 ms
    const reportedAt = new Date(referenceNow - 60 * 60 * 1000).toISOString();
    assert.equal(calculateFreshness(reportedAt, referenceNow), FRESHNESS_STATES.OVERDUE);
  });

  await t.test('transitions to STALE at 60 minutes + 1 ms', () => {
    const reportedAt = new Date(referenceNow - (60 * 60 * 1000 + 1)).toISOString();
    assert.equal(calculateFreshness(reportedAt, referenceNow), FRESHNESS_STATES.STALE);
  });

  await t.test('returns UNKNOWN for missing, null, or invalid timestamps', () => {
    assert.equal(calculateFreshness(null, referenceNow), FRESHNESS_STATES.UNKNOWN);
    assert.equal(calculateFreshness(undefined, referenceNow), FRESHNESS_STATES.UNKNOWN);
    assert.equal(calculateFreshness('not-a-valid-date', referenceNow), FRESHNESS_STATES.UNKNOWN);
  });

  await t.test('returns UNKNOWN for unreasonable future timestamps (clock skew > 1 min)', () => {
    const futureTime = new Date(referenceNow + 5 * 60 * 1000).toISOString();
    assert.equal(calculateFreshness(futureTime, referenceNow), FRESHNESS_STATES.UNKNOWN);
  });
});

test('evaluateAvailabilityFreshness augments snapshots and explicitly marks isVerifiedAvailability false', () => {
  const referenceNow = new Date('2026-10-16T12:00:00.000Z').getTime();
  const input = {
    general: {
      availableBeds: 12,
      totalBeds: 20,
      reportedAt: new Date(referenceNow - 5 * 60 * 1000).toISOString(), // 5 min old
    },
    icu: {
      availableBeds: 1,
      totalBeds: 4,
      reportedAt: new Date(referenceNow - 30 * 60 * 1000).toISOString(), // 30 min old
    },
    hdu: {
      availableBeds: 0,
      totalBeds: 6,
      reportedAt: new Date(referenceNow - 90 * 60 * 1000).toISOString(), // 90 min old
    },
    pediatric: null, // No report exists
  };

  const evaluated = evaluateAvailabilityFreshness(input, referenceNow);

  assert.equal(evaluated.general.freshnessState, FRESHNESS_STATES.FRESH);
  assert.equal(evaluated.icu.freshnessState, FRESHNESS_STATES.OVERDUE);
  assert.equal(evaluated.hdu.freshnessState, FRESHNESS_STATES.STALE);
  assert.equal(evaluated.pediatric.freshnessState, FRESHNESS_STATES.UNKNOWN);

  // Requirement: Freshness reflects report age, not clinical guarantee
  assert.equal(evaluated.general.isVerifiedAvailability, false);
  assert.equal(evaluated.icu.isVerifiedAvailability, false);
  assert.equal(evaluated.hdu.isVerifiedAvailability, false);
});

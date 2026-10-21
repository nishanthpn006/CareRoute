/**
 * CareRoute — Availability Freshness Lifecycle
 * 
 * Rules:
 * - FRESH: report age <= 15 minutes.
 * - OVERDUE: report age > 15 minutes and <= 60 minutes.
 * - STALE: report age > 60 minutes.
 * - UNKNOWN: no accepted report exists or timestamp is invalid.
 * 
 * Freshness describes report age, NOT clinical certainty or independent verification.
 */

export const FRESHNESS_STATES = Object.freeze({
  FRESH: 'FRESH',
  OVERDUE: 'OVERDUE',
  STALE: 'STALE',
  UNKNOWN: 'UNKNOWN',
});

export const FRESHNESS_THRESHOLDS_MS = Object.freeze({
  FRESH: 15 * 60 * 1000,   // 15 minutes
  OVERDUE: 60 * 60 * 1000, // 60 minutes
});

/**
 * Calculates the freshness state of an availability report.
 * Supports clock injection via `now` for deterministic unit testing.
 * 
 * @param {string|Date|number|null} reportedAt - Timestamp of the report
 * @param {string|Date|number} [now=Date.now()] - Current reference time
 * @returns {string} One of FRESH, OVERDUE, STALE, UNKNOWN
 */
export function calculateFreshness(reportedAt, now = Date.now()) {
  if (!reportedAt) {
    return FRESHNESS_STATES.UNKNOWN;
  }

  const reportedTime = new Date(reportedAt).getTime();
  const currentTime = new Date(now).getTime();

  if (Number.isNaN(reportedTime) || Number.isNaN(currentTime)) {
    return FRESHNESS_STATES.UNKNOWN;
  }

  const ageMs = currentTime - reportedTime;

  // If timestamp is in the future by more than 1 minute (clock skew tolerance), treat as UNKNOWN
  if (ageMs < -60000) {
    return FRESHNESS_STATES.UNKNOWN;
  }

  // Age is at most 15 minutes
  if (ageMs <= FRESHNESS_THRESHOLDS_MS.FRESH) {
    return FRESHNESS_STATES.FRESH;
  }

  // Age is greater than 15 minutes and at most 60 minutes
  if (ageMs <= FRESHNESS_THRESHOLDS_MS.OVERDUE) {
    return FRESHNESS_STATES.OVERDUE;
  }

  // Age is greater than 60 minutes
  return FRESHNESS_STATES.STALE;
}

/**
 * Attaches calculated freshness states to an availability snapshot dictionary.
 * 
 * @param {Object} availabilityMap - Object mapping category -> { availableBeds, totalBeds, reportedAt, ... }
 * @param {string|Date|number} [now=Date.now()] - Clock injection
 * @returns {Object} Augmented availability object
 */
export function evaluateAvailabilityFreshness(availabilityMap = {}, now = Date.now()) {
  const result = {};
  for (const [category, snapshot] of Object.entries(availabilityMap)) {
    if (!snapshot) {
      result[category] = {
        availableBeds: 0,
        totalBeds: 0,
        reportedAt: null,
        freshnessState: FRESHNESS_STATES.UNKNOWN,
        isVerifiedAvailability: false,
      };
      continue;
    }

    result[category] = {
      ...snapshot,
      freshnessState: calculateFreshness(snapshot.reportedAt, now),
      isVerifiedAvailability: false, // Explicit disclaimer: freshness is report age, not clinical guarantee
    };
  }
  return result;
}

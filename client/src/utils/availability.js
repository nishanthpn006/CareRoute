/**
 * CareRoute — Availability Presentation & Projection Helpers
 * 
 * Enforces strict semantic accuracy:
 * - UNKNOWN: Display "Not reported" or "Unknown" — NEVER display numeric "0" or "unreported / 0".
 * - STALE: Display out of date notice (>60m) and mark any historical count as unconfirmed.
 * - OVERDUE: Display overdue notice (15–60m) without implying capacity is guaranteed.
 * - FRESH: Display reported available and total counts.
 * - Confirmed 0: A valid report of 0 available beds must be distinguishable from absence of a report.
 */

export const BED_DEFINITIONS = [
  { key: 'general', label: 'General' },
  { key: 'icu', label: 'ICU' },
  { key: 'hdu', label: 'HDU' },
  { key: 'pediatric', label: 'Pediatric' },
];

/**
 * Evaluates the display state of a specific bed category for a hospital.
 * 
 * @param {Object} hospital - Public facility record
 * @param {string} bedKey - Bed category ('general' | 'icu' | 'hdu' | 'pediatric')
 * @returns {Object} Formatted display metadata
 */
export function getBedAvailabilityStatus(hospital, bedKey) {
  const availMap = hospital?.availability || {};
  const snapshot = availMap[bedKey];
  const freshnessState = snapshot?.freshnessState || 'UNKNOWN';

  // If no snapshot exists or state is UNKNOWN
  if (!snapshot || freshnessState === 'UNKNOWN') {
    return {
      category: bedKey,
      freshnessState: 'UNKNOWN',
      isNumeric: false,
      displayPrimary: 'Not reported',
      displaySecondary: 'No recent report',
      availableCount: null,
      totalCount: null,
      isConfirmed: false,
      isFull: false,
      cssClass: 'bed-stat-unknown',
    };
  }

  const availableBeds = typeof snapshot.availableBeds === 'number' ? snapshot.availableBeds : null;
  const totalBeds = typeof snapshot.totalBeds === 'number' ? snapshot.totalBeds : null;

  // STALE: Report is older than 60 minutes
  if (freshnessState === 'STALE') {
    const historicalText = availableBeds !== null ? `${availableBeds}` : '—';
    return {
      category: bedKey,
      freshnessState: 'STALE',
      isNumeric: false,
      displayPrimary: historicalText,
      displaySecondary: 'Unconfirmed (>60m)',
      availableCount: availableBeds,
      totalCount: totalBeds,
      isConfirmed: false,
      isFull: availableBeds === 0,
      cssClass: 'bed-stat-stale',
    };
  }

  // OVERDUE: Report is between 15 and 60 minutes old
  if (freshnessState === 'OVERDUE') {
    const hasTotal = totalBeds !== null && totalBeds > 0;
    const countDisplay = hasTotal ? `${availableBeds} / ${totalBeds}` : `${availableBeds ?? 0}`;
    return {
      category: bedKey,
      freshnessState: 'OVERDUE',
      isNumeric: true,
      displayPrimary: countDisplay,
      displaySecondary: availableBeds === 0 ? 'Full (Overdue)' : 'Overdue (15–60m)',
      availableCount: availableBeds,
      totalCount: totalBeds,
      isConfirmed: true,
      isFull: availableBeds === 0,
      cssClass: availableBeds === 0 ? 'bed-stat-full' : 'bed-stat-overdue',
    };
  }

  // FRESH: Report is <= 15 minutes old
  if (freshnessState === 'FRESH') {
    const hasTotal = totalBeds !== null && totalBeds > 0;
    const countDisplay = hasTotal ? `${availableBeds} / ${totalBeds}` : `${availableBeds ?? 0}`;
    return {
      category: bedKey,
      freshnessState: 'FRESH',
      isNumeric: true,
      displayPrimary: countDisplay,
      displaySecondary: availableBeds === 0 ? 'Full (0 avail)' : 'Confirmed (≤15m)',
      availableCount: availableBeds,
      totalCount: totalBeds,
      isConfirmed: true,
      isFull: availableBeds === 0,
      cssClass: availableBeds === 0 ? 'bed-stat-full' : 'bed-stat-fresh',
    };
  }

  return {
    category: bedKey,
    freshnessState: 'UNKNOWN',
    isNumeric: false,
    displayPrimary: 'Not reported',
    displaySecondary: 'Unknown',
    availableCount: null,
    totalCount: null,
    isConfirmed: false,
    isFull: false,
    cssClass: 'bed-stat-unknown',
  };
}

/**
 * Calculates overall freshness badge for a hospital card based on selected bed category
 */
export function getOverallFreshnessBadge(hospital, selectedBed = 'all') {
  const avail = hospital?.availability || {};
  let state = 'UNKNOWN';

  if (selectedBed !== 'all') {
    state = avail[selectedBed]?.freshnessState || 'UNKNOWN';
  } else {
    const states = Object.values(avail).map((a) => a?.freshnessState);
    if (states.includes('FRESH')) state = 'FRESH';
    else if (states.includes('OVERDUE')) state = 'OVERDUE';
    else if (states.includes('STALE')) state = 'STALE';
    else state = 'UNKNOWN';
  }

  switch (state) {
    case 'FRESH':
      return {
        state: 'FRESH',
        label: 'Fresh report (≤15m)',
        icon: '●',
        className: 'freshness-pill freshness-fresh',
      };
    case 'OVERDUE':
      return {
        state: 'OVERDUE',
        label: 'Report overdue (15–60m)',
        icon: '▲',
        className: 'freshness-pill freshness-overdue',
      };
    case 'STALE':
      return {
        state: 'STALE',
        label: 'Stale (>60m) · Unconfirmed',
        icon: '!',
        className: 'freshness-pill freshness-stale',
      };
    default:
      return {
        state: 'UNKNOWN',
        label: 'Availability not reported',
        icon: '○',
        className: 'freshness-pill freshness-unknown',
      };
  }
}

/**
 * Calculates total confirmed available beds across a list of hospitals.
 * Stale or Unknown reports are strictly excluded from confirmed available bed tallies.
 * 
 * @param {Array} hospitals - List of filtered hospitals
 * @param {string} selectedBed - 'all' or bed category key
 * @returns {number} Sum of confirmed available beds
 */
export function calculateTotalConfirmedBeds(hospitals = [], selectedBed = 'all') {
  let total = 0;
  for (const hospital of hospitals) {
    const avail = hospital.availability || {};
    const categories = selectedBed === 'all' ? BED_DEFINITIONS.map((b) => b.key) : [selectedBed];

    for (const cat of categories) {
      const snap = avail[cat];
      if (snap && (snap.freshnessState === 'FRESH' || snap.freshnessState === 'OVERDUE')) {
        const count = Number(snap.availableBeds || 0);
        if (count > 0) {
          total += count;
        }
      }
    }
  }
  return total;
}

/**
 * Formats the aggregate beds summary text, avoiding "0 confirmed available beds"
 * when data is simply unconfirmed or missing.
 * 
 * @param {number} confirmedCount - Sum of confirmed available beds
 * @param {Array} hospitals - List of hospitals currently displayed
 * @param {string} selectedBed - Selected bed filter
 * @returns {Object} { countDisplay: string, labelDisplay: string }
 */
export function formatConfirmedBedsSummary(confirmedCount, hospitals = [], selectedBed = 'all') {
  if (confirmedCount > 0) {
    return {
      countDisplay: String(confirmedCount),
      labelDisplay: selectedBed === 'all' ? 'confirmed available beds' : `confirmed ${selectedBed.toUpperCase()} beds`,
      hasActiveReports: true,
    };
  }

  // Check if any hospital in the list had fresh/overdue reports that reported 0 beds
  let hasEvaluatedReports = false;
  for (const hospital of hospitals) {
    const avail = hospital.availability || {};
    const categories = selectedBed === 'all' ? BED_DEFINITIONS.map((b) => b.key) : [selectedBed];
    for (const cat of categories) {
      const snap = avail[cat];
      if (snap && (snap.freshnessState === 'FRESH' || snap.freshnessState === 'OVERDUE')) {
        hasEvaluatedReports = true;
        break;
      }
    }
    if (hasEvaluatedReports) break;
  }

  if (hasEvaluatedReports) {
    return {
      countDisplay: '0',
      labelDisplay: 'confirmed beds (wards full)',
      hasActiveReports: true,
    };
  }

  return {
    countDisplay: '—',
    labelDisplay: 'No current availability reports',
    hasActiveReports: false,
  };
}

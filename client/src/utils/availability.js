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

  let freshnessState = snapshot?.freshnessState;
  if (!freshnessState && snapshot?.reportedAt) {
    const d = new Date(snapshot.reportedAt);
    if (!Number.isNaN(d.getTime())) {
      const ageMs = Date.now() - d.getTime();
      if (ageMs < -60000) {
        freshnessState = 'UNKNOWN';
      } else if (ageMs <= 15 * 60 * 1000) {
        freshnessState = 'FRESH';
      } else if (ageMs <= 60 * 60 * 1000) {
        freshnessState = 'OVERDUE';
      } else {
        freshnessState = 'STALE';
      }
    }
  }
  freshnessState = freshnessState || 'UNKNOWN';

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

export const WARD_NAMES = Object.freeze({
  general: 'General Inpatient Ward',
  icu: 'Intensive Care Unit (ICU)',
  hdu: 'High Dependency Unit (HDU)',
  pediatric: 'Pediatric Emergency Ward',
});

/**
 * Calculates detailed aggregate and per-ward availability summary for a single hospital card.
 * Respects strict semantic accuracy: never converts unreported wards to zero.
 * 
 * @param {Object} hospital - Public facility record
 * @param {string} selectedBed - 'all' or bed category key
 * @returns {Object} Comprehensive hospital availability summary
 */
export function getHospitalBedSummary(hospital, selectedBed = 'all') {
  const supported = hospital?.supportedBedCategories || ['general', 'icu', 'hdu', 'pediatric'];
  const categories = selectedBed === 'all'
    ? BED_DEFINITIONS.filter((b) => supported.includes(b.key))
    : BED_DEFINITIONS.filter((b) => b.key === selectedBed && supported.includes(b.key));

  const wardStatuses = categories.map((def) => {
    const stat = getBedAvailabilityStatus(hospital, def.key);
    const snap = hospital?.availability?.[def.key];
    const availBeds = typeof stat.availableCount === 'number' ? stat.availableCount : null;
    const totBeds = typeof stat.totalCount === 'number' ? stat.totalCount : null;
    const pct = availBeds !== null && totBeds !== null && totBeds > 0
      ? Math.round((availBeds / totBeds) * 100)
      : null;

    return {
      key: def.key,
      label: def.label,
      fullName: WARD_NAMES[def.key] || `${def.label} Ward`,
      ...stat,
      availableCount: availBeds,
      totalCount: totBeds,
      percentage: pct,
      reportedAt: snap?.reportedAt || null,
    };
  });

  // Calculate aggregate metrics across valid reports
  let validReportCount = 0;
  let totalAvailable = 0;
  let totalCapacity = 0;
  let hasConfirmed = false;
  let hasStale = false;
  let latestReportedAt = null;

  for (const ward of wardStatuses) {
    if (ward.isNumeric && ward.availableCount !== null && ward.totalCount !== null) {
      validReportCount += 1;
      totalAvailable += ward.availableCount;
      totalCapacity += ward.totalCount;
      if (ward.isConfirmed) {
        hasConfirmed = true;
      }
      if (ward.reportedAt) {
        if (!latestReportedAt || new Date(ward.reportedAt) > new Date(latestReportedAt)) {
          latestReportedAt = ward.reportedAt;
        }
      }
    } else if (ward.freshnessState === 'STALE' && ward.availableCount !== null && ward.totalCount !== null) {
      validReportCount += 1;
      hasStale = true;
      totalAvailable += ward.availableCount;
      totalCapacity += ward.totalCount;
      if (ward.reportedAt) {
        if (!latestReportedAt || new Date(ward.reportedAt) > new Date(latestReportedAt)) {
          latestReportedAt = ward.reportedAt;
        }
      }
    }
  }

  // If no ward has been reported
  if (validReportCount === 0) {
    return {
      hasReport: false,
      headlineCount: null,
      totalCapacity: null,
      percentage: null,
      isFull: false,
      isStale: false,
      isPartial: false,
      subtext: 'Bed availability not yet reported',
      reportedWardCount: 0,
      totalSupportedWards: categories.length,
      latestReportedAt: null,
      wardStatuses,
    };
  }

  const isFull = totalAvailable === 0;
  const percentage = totalCapacity > 0 ? Math.round((totalAvailable / totalCapacity) * 100) : 0;
  const isPartial = selectedBed === 'all' && validReportCount < categories.length;
  const isStale = !hasConfirmed && hasStale;

  let subtext = '';
  if (isFull) {
    subtext = `0 beds available out of ${totalCapacity} total beds (Wards full)`;
  } else if (isPartial) {
    subtext = `${totalAvailable} beds available out of ${totalCapacity} total beds (${validReportCount} of ${categories.length} wards reporting)`;
  } else {
    subtext = `${totalAvailable} beds available out of ${totalCapacity} total beds`;
  }

  if (isStale) {
    subtext = `${totalAvailable} unconfirmed beds (>60m ago) out of ${totalCapacity} total capacity`;
  }

  return {
    hasReport: true,
    headlineCount: totalAvailable,
    totalCapacity,
    percentage,
    isFull,
    isStale,
    isPartial,
    subtext,
    reportedWardCount: validReportCount,
    totalSupportedWards: categories.length,
    latestReportedAt,
    wardStatuses,
  };
}


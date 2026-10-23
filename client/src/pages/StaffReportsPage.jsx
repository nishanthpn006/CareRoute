import { useEffect, useState, useCallback, useMemo } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { apiRequest } from '../api.js';
import { BED_DEFINITIONS, getBedAvailabilityStatus } from '../utils/availability.js';

function formatTime(value) {
  if (!value) return 'Unknown';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return 'Unknown';
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(d);
}

function formatRelativeTime(value) {
  if (!value) return 'Not reported';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return 'Not reported';
  const diffSec = Math.floor((Date.now() - d.getTime()) / 1000);
  if (diffSec < 60) return 'Just now';
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  return `${Math.floor(diffHours / 24)}d ago`;
}

// Clean clinical hospital bed SVG illustration matching reference's soft medical aesthetic
function HospitalBedIllustration({ category }) {
  const isICU = category === 'icu';
  return (
    <svg
      viewBox="0 0 240 160"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className="hospital-bed-svg"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="mattressGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#e2e8f0" />
          <stop offset="100%" stopColor="#cbd5e1" />
        </linearGradient>
        <linearGradient id="headrestGrad" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#f1f5f9" />
          <stop offset="100%" stopColor="#e2e8f0" />
        </linearGradient>
        <linearGradient id="metalGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#94a3b8" />
          <stop offset="100%" stopColor="#64748b" />
        </linearGradient>
        <linearGradient id="screenGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#0f172a" />
          <stop offset="100%" stopColor="#1e293b" />
        </linearGradient>
      </defs>

      {/* Background Soft Shadow */}
      <ellipse cx="120" cy="142" rx="85" ry="10" fill="#0f766e" fillOpacity="0.08" />

      {/* Bed Base & Legs */}
      <rect x="42" y="112" width="156" height="8" rx="4" fill="url(#metalGrad)" />
      {/* Wheels */}
      <circle cx="50" cy="134" r="7" fill="#475569" />
      <circle cx="50" cy="134" r="3" fill="#cbd5e1" />
      <circle cx="188" cy="134" r="7" fill="#475569" />
      <circle cx="188" cy="134" r="3" fill="#cbd5e1" />
      {/* Vertical Support Struts */}
      <rect x="48" y="118" width="4" height="12" rx="2" fill="url(#metalGrad)" />
      <rect x="186" y="118" width="4" height="12" rx="2" fill="url(#metalGrad)" />
      <rect x="118" y="118" width="4" height="12" rx="2" fill="url(#metalGrad)" />

      {/* Articulated Lower Bed Frame */}
      <rect x="44" y="96" width="152" height="12" rx="3" fill="#cbd5e1" stroke="#94a3b8" strokeWidth="1.5" />

      {/* Elevated Headrest & Main Mattress */}
      <path
        d="M48 94 L82 72 L120 72 L120 94 Z"
        fill="url(#headrestGrad)"
        stroke="#94a3b8"
        strokeWidth="1.5"
      />
      {/* Flat Body Mattress */}
      <rect x="118" y="84" width="76" height="12" rx="3" fill="url(#mattressGrad)" stroke="#94a3b8" strokeWidth="1.5" />
      {/* Clean Hospital Pillow */}
      <rect x="52" y="74" width="26" height="14" rx="4" transform="rotate(-18 52 74)" fill="#ffffff" stroke="#cbd5e1" strokeWidth="1" />

      {/* Safety Siderail */}
      <rect x="96" y="78" width="48" height="6" rx="3" fill="#0f766e" fillOpacity="0.85" />
      <rect x="104" y="84" width="3" height="10" fill="#0f766e" />
      <rect x="120" y="84" width="3" height="10" fill="#0f766e" />
      <rect x="136" y="84" width="3" height="10" fill="#0f766e" />

      {/* Headboard and Footboard */}
      <rect x="36" y="68" width="7" height="42" rx="3.5" fill="url(#metalGrad)" />
      <rect x="196" y="80" width="7" height="30" rx="3.5" fill="url(#metalGrad)" />

      {/* Infusion Drip Stand (IV Pole) */}
      <rect x="22" y="24" width="3" height="108" rx="1.5" fill="url(#metalGrad)" />
      <path d="M14 26 Q23 20 32 26" stroke="#64748b" strokeWidth="2.5" fill="none" strokeLinecap="round" />
      {/* Saline IV Bag */}
      <rect x="12" y="32" width="9" height="16" rx="3" fill="#e0f2fe" stroke="#38bdf8" strokeWidth="1" />
      <line x1="16" y1="48" x2="16" y2="76" stroke="#38bdf8" strokeWidth="1" strokeDasharray="2 2" />

      {/* Bedside Vital Monitor (Accent for ICU/HDU) */}
      <rect x="208" y="44" width="24" height="28" rx="4" fill="url(#screenGrad)" stroke="#475569" strokeWidth="1.5" />
      <rect x="210" y="46" width="20" height="18" rx="2" fill="#090d16" />
      {/* ECG Wave on screen */}
      <path
        d="M211 55 L215 55 L217 50 L219 60 L221 53 L223 57 L225 55 L229 55"
        stroke={isICU ? '#10b981' : '#38bdf8'}
        strokeWidth="1.2"
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="225" cy="49" r="1.5" fill={isICU ? '#10b981' : '#38bdf8'} />
      {/* Monitor Pole Stand */}
      <rect x="219" y="72" width="3" height="60" rx="1.5" fill="url(#metalGrad)" />
    </svg>
  );
}

const WARD_METADATA = {
  general: {
    name: 'General Inpatient Ward',
    shortName: 'General',
    description: 'Acute medical-surgical care, routine post-emergency stabilization, and standard vital telemetry.',
    features: ['Monitored beds', 'Nurse telemetry', 'IV infusion care'],
  },
  icu: {
    name: 'Intensive Care Unit (ICU)',
    shortName: 'ICU',
    description: 'Critical care with continuous hemodynamic monitoring, mechanical ventilators, and round-the-clock intensivist coverage.',
    features: ['Mechanical ventilators', 'Multi-parameter monitors', '1:1 clinical nursing'],
  },
  hdu: {
    name: 'High Dependency Unit (HDU)',
    shortName: 'HDU',
    description: 'Intermediate step-down unit providing continuous cardiac telemetry and advanced respiratory intervention.',
    features: ['Continuous ECG', 'Step-down care', 'Supplemental oxygen'],
  },
  pediatric: {
    name: 'Pediatric Emergency Ward',
    shortName: 'Pediatric',
    description: 'Specialized neonatal and pediatric emergency beds equipped with infant warmers and pediatric resuscitation.',
    features: ['Pediatric triage', 'Infant resuscitators', 'Dedicated pediatric nurses'],
  },
};

export function StaffReportsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { user, isAuthenticated, role } = useAuth();

  const [facilities, setFacilities] = useState([]);
  const [selectedFacilityId, setSelectedFacilityId] = useState(() => searchParams.get('facilityId') || '');
  const [selectedFacility, setSelectedFacility] = useState(null);

  // Active ward category tab in overview
  const [activeCategory, setActiveCategory] = useState('general');

  // Real availability snapshot map from server
  const [availabilityMap, setAvailabilityMap] = useState({});

  // Form states - initialized empty unless verified existing report is present
  const [formCategory, setFormCategory] = useState('general');
  const [availableBeds, setAvailableBeds] = useState('');
  const [totalBeds, setTotalBeds] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Report history state
  const [history, setHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyFilter, setHistoryFilter] = useState('all');

  // Format human-friendly role name
  const roleDisplay = useMemo(() => {
    return {
      organization_admin: 'Organization Administrator',
      facility_reporter: 'Facility Reporter',
      platform_verifier: 'Platform Verifier',
      security_admin: 'Security Administrator',
    }[role] || role || 'Authorized Staff';
  }, [role]);

  // Load authorized facilities
  const loadFacilities = useCallback(async () => {
    if (!isAuthenticated) return;
    try {
      let res;
      try {
        res = await apiRequest('/api/staff/facilities');
      } catch {
        res = await apiRequest('/api/admin/hospitals');
      }
      const list = res.data || [];
      setFacilities(list);

      const targetId = searchParams.get('facilityId') || selectedFacilityId;
      if (targetId && list.some((f) => f.id === targetId)) {
        setSelectedFacilityId(targetId);
      } else if (list.length > 0) {
        setSelectedFacilityId(list[0].id);
      }
    } catch (err) {
      setError(err.message || 'Failed to load authorized facilities.');
    }
  }, [isAuthenticated, searchParams, selectedFacilityId]);

  useEffect(() => {
    loadFacilities();
  }, [loadFacilities]);

  // When selectedFacilityId changes, update selectedFacility object and search param
  useEffect(() => {
    const f = facilities.find((item) => item.id === selectedFacilityId) || null;
    setSelectedFacility(f);
    if (selectedFacilityId) {
      setSearchParams({ facilityId: selectedFacilityId }, { replace: true });
    }
  }, [selectedFacilityId, facilities, setSearchParams]);

  // Load current availability map for selected facility
  const loadCurrentAvailability = useCallback(async () => {
    if (!selectedFacilityId) return;
    try {
      const res = await apiRequest(`/api/staff/facilities/${selectedFacilityId}/current`);
      if (res?.data) {
        setAvailabilityMap(res.data);
      }
    } catch {
      // If current endpoint is not supported or restricted, fallback to facility object availability
      if (selectedFacility?.availability) {
        setAvailabilityMap(selectedFacility.availability);
      }
    }
  }, [selectedFacilityId, selectedFacility]);

  // Load report history for selected facility
  const loadHistory = useCallback(async () => {
    if (!selectedFacilityId) return;
    setHistoryLoading(true);
    try {
      const url = historyFilter !== 'all'
        ? `/api/staff/facilities/${selectedFacilityId}/availability-reports?category=${historyFilter}`
        : `/api/staff/facilities/${selectedFacilityId}/availability-reports`;
      const res = await apiRequest(url);
      setHistory(res.data || []);
    } catch {
      // Endpoint may be restricted or unsupported for non-admins; fallback
      setHistory([]);
    } finally {
      setHistoryLoading(false);
    }
  }, [selectedFacilityId, historyFilter]);

  useEffect(() => {
    loadCurrentAvailability();
  }, [loadCurrentAvailability]);

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  // Synchronize form initial category with selected category tab
  function handleSelectWardTab(catKey) {
    setActiveCategory(catKey);
    setFormCategory(catKey);
    const snap = availabilityMap[catKey];
    if (snap && typeof snap.availableBeds === 'number' && typeof snap.totalBeds === 'number') {
      setAvailableBeds(String(snap.availableBeds));
      setTotalBeds(String(snap.totalBeds));
    } else {
      setAvailableBeds('');
      setTotalBeds('');
    }
  }

  // Pre-fill inputs whenever availabilityMap loads for the current category
  useEffect(() => {
    const snap = availabilityMap[formCategory];
    if (snap && typeof snap.availableBeds === 'number' && typeof snap.totalBeds === 'number') {
      setAvailableBeds(String(snap.availableBeds));
      setTotalBeds(String(snap.totalBeds));
    }
  }, [availabilityMap, formCategory]);

  // Pre-fill form and smooth-scroll down to form panel
  function scrollToReportForm(catKey) {
    if (catKey) {
      handleSelectWardTab(catKey);
    }
    const el = document.getElementById('submitReportForm');
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      const firstInput = el.querySelector('input[type="number"]');
      if (firstInput) firstInput.focus();
    }
  }

  // Handle report submission
  async function handleReportSubmit(e) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError('');
    setSuccessMsg('');

    const availNum = Number(availableBeds);
    const totalNum = Number(totalBeds);

    if (availableBeds === '' || totalBeds === '' || Number.isNaN(availNum) || Number.isNaN(totalNum)) {
      setError('Validation error: Please enter valid numbers for bed counts.');
      setBusy(false);
      return;
    }

    if (availNum < 0 || totalNum < 0) {
      setError('Validation error: Bed counts cannot be negative.');
      setBusy(false);
      return;
    }

    if (!Number.isInteger(availNum) || !Number.isInteger(totalNum)) {
      setError('Validation error: Bed counts must be whole integers.');
      setBusy(false);
      return;
    }

    if (availNum > totalNum) {
      setError('Validation error: Available beds cannot exceed total capacity.');
      setBusy(false);
      return;
    }

    try {
      const res = await apiRequest(`/api/staff/facilities/${selectedFacilityId}/availability-reports`, {
        method: 'POST',
        body: JSON.stringify({
          category: formCategory,
          availableBeds: availNum,
          totalBeds: totalNum,
          source: 'staff_portal_web',
        }),
      });

      const pct = totalNum > 0 ? Math.round((availNum / totalNum) * 100) : 0;
      setSuccessMsg(`✓ Capacity update published: ${formCategory.toUpperCase()} ward (${availNum} vacant / ${totalNum} total beds · ${pct}% vacant).`);

      // Optimistically update local availabilityMap
      if (res?.data?.snapshot) {
        setAvailabilityMap((prev) => ({
          ...prev,
          [formCategory]: {
            ...res.data.snapshot,
            freshnessState: res.data.snapshot.freshnessState || 'FRESH',
          },
        }));
      }

      // Prepend to history without duplicate entry
      if (res?.data?.report) {
        const newRep = res.data.report;
        const newId = newRep.reportId || newRep.id;
        setHistory((prev) => {
          if (prev.some((r) => (r.reportId || r.id) === newId)) return prev;
          return [newRep, ...prev];
        });
      }

      // Refresh authoritative data from server
      await Promise.all([
        loadCurrentAvailability(),
        loadHistory(),
      ]);
    } catch (err) {
      setError(err.message || 'Failed to submit availability report.');
    } finally {
      setBusy(false);
    }
  }

  // Derive active ward status
  const activeStatus = useMemo(() => {
    return getBedAvailabilityStatus({ availability: availabilityMap }, activeCategory);
  }, [availabilityMap, activeCategory]);

  const activeSnapshot = availabilityMap[activeCategory];
  const activeMeta = WARD_METADATA[activeCategory] || WARD_METADATA.general;

  // Derive metrics for the 2x2 operational summary tiles
  const summaryMetrics = useMemo(() => {
    const supportedCategories = selectedFacility?.supportedBedCategories || ['general', 'icu', 'hdu', 'pediatric'];
    let reportedCount = 0;
    let freshCount = 0;

    for (const cat of supportedCategories) {
      const snap = availabilityMap[cat];
      if (snap && snap.freshnessState && snap.freshnessState !== 'UNKNOWN') {
        reportedCount += 1;
        if (snap.freshnessState === 'FRESH') {
          freshCount += 1;
        }
      }
    }

    // Selected ward availability metric
    const hasAvail = activeStatus.isNumeric && activeStatus.availableCount !== null;
    const availVal = hasAvail ? `${activeStatus.availableCount}` : 'Not reported';
    const totalVal = activeStatus.totalCount !== null ? `${activeStatus.totalCount}` : null;
    const availPercent = hasAvail && activeStatus.totalCount > 0
      ? Math.round((activeStatus.availableCount / activeStatus.totalCount) * 100)
      : null;

    // Ward freshness display
    let freshnessLabel = 'Not reported';
    if (activeStatus.freshnessState === 'FRESH') freshnessLabel = 'Fresh (≤15m)';
    else if (activeStatus.freshnessState === 'OVERDUE') freshnessLabel = 'Overdue (15–60m)';
    else if (activeStatus.freshnessState === 'STALE') freshnessLabel = 'Stale (>60m)';

    return {
      availableDisplay: availVal,
      totalDisplay: totalVal,
      availPercent,
      isNumeric: hasAvail,
      freshnessLabel,
      reportedCount,
      totalSupported: supportedCategories.length,
      historyCount: history.length,
      lastReportedTime: (activeStatus.freshnessState !== 'UNKNOWN' && activeSnapshot?.reportedAt)
        ? formatRelativeTime(activeSnapshot.reportedAt)
        : 'Never',
    };
  }, [selectedFacility, availabilityMap, activeStatus, activeSnapshot, history]);

  // Total confirmed available beds across all categories
  const totalConfirmedBeds = useMemo(() => {
    let count = 0;
    let anyReported = false;
    for (const cat of BED_DEFINITIONS) {
      const snap = availabilityMap[cat.key];
      if (snap && (snap.freshnessState === 'FRESH' || snap.freshnessState === 'OVERDUE')) {
        anyReported = true;
        if (typeof snap.availableBeds === 'number' && snap.availableBeds > 0) {
          count += snap.availableBeds;
        }
      }
    }
    return anyReported ? count : null;
  }, [availabilityMap]);

  if (!isAuthenticated) {
    return (
      <div className="staff-page">
        <div className="empty-state">
          <h3>Authentication Required</h3>
          <p>Please sign in with authorized hospital staff credentials to access bed capacity management.</p>
          <Link to="/staff/login" className="button button-primary">Sign In to Staff Portal</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="bed-workspace-wrapper">
      {/* Outer Application Surface (Clean mint container matching reference) */}
      <div className="bed-workspace-surface">
        {/* Workspace Top Header */}
        <header className="bed-workspace-header">
          <div className="bed-header-title-block">
            <div className="bed-category-pill">
              <span className="pill-dot">●</span>
              <span>Ward Operations & Availability</span>
            </div>
            <div className="bed-title-row">
              <h1>Bed Availability</h1>
              <span className="live-sync-indicator" title="Authorized clinical reporting portal">
                <span className="live-pulse" />
                Staff Reporting
              </span>
            </div>
            <p className="bed-header-subtitle">
              Ward capacity tracking and verified clinical availability reporting.
            </p>
          </div>

          <div className="bed-header-controls">
            {/* Facility Picker */}
            <div className="bed-facility-select-wrapper">
              <label htmlFor="bedFacilityPicker" className="sr-only">Active Facility</label>
              <span className="facility-icon">🏥</span>
              <select
                id="bedFacilityPicker"
                className="bed-facility-select"
                value={selectedFacilityId}
                onChange={(e) => setSelectedFacilityId(e.target.value)}
                disabled={busy || facilities.length === 0}
              >
                {facilities.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.name} ({f.city || 'Tiruchirappalli'})
                  </option>
                ))}
              </select>
            </div>

            {/* Refresh Action */}
            <button
              type="button"
              className="bed-header-btn secondary"
              onClick={() => {
                loadCurrentAvailability();
                loadHistory();
              }}
              title="Refresh facility data"
            >
              ↻ Refresh
            </button>

            {/* Quick Submit CTA */}
            <button
              type="button"
              className="bed-header-btn primary"
              onClick={() => scrollToReportForm(activeCategory)}
            >
              + Update Beds
            </button>
          </div>
        </header>

        {/* Global Alert Messages */}
        {error && (
          <div className="bed-alert-box error" role="alert">
            <span>⚠️ {error}</span>
            <button type="button" className="close-alert" onClick={() => setError('')} aria-label="Dismiss error">✕</button>
          </div>
        )}
        {successMsg && (
          <div className="bed-alert-box success" role="status">
            <span>{successMsg}</span>
            <button type="button" className="close-alert" onClick={() => setSuccessMsg('')} aria-label="Dismiss message">✕</button>
          </div>
        )}

        {/* Main Grid: Top Row (Overview Panel + 2x2 Summary Tiles + Facility Profile) */}
        <section className="bed-top-grid">
          {/* Panel 1: Ward Capacity Overview (Matching reference Bed & Room Overview) */}
          <article className="bed-card overview-card">
            <div className="card-header-row">
              <div className="card-title-group">
                <span className="card-icon-badge">🛏️</span>
                <h2>Ward Capacity Overview</h2>
              </div>

              {/* Ward Category Switcher Tabs */}
              <div className="ward-pill-tabs" role="tablist" aria-label="Ward Categories">
                {BED_DEFINITIONS.map((def) => {
                  const isActive = activeCategory === def.key;
                  const isSupported = selectedFacility?.supportedBedCategories
                    ? selectedFacility.supportedBedCategories.includes(def.key)
                    : true;
                  return (
                    <button
                      key={def.key}
                      type="button"
                      role="tab"
                      aria-selected={isActive}
                      className={`ward-tab-btn ${isActive ? 'active' : ''} ${!isSupported ? 'unsupported' : ''}`}
                      onClick={() => handleSelectWardTab(def.key)}
                      title={isSupported ? `${def.label} Ward` : `${def.label} ward not configured for this facility`}
                    >
                      {def.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Visual + Ward Info Content */}
            <div className="overview-body">
              <div className="overview-visual-col">
                <HospitalBedIllustration category={activeCategory} />
              </div>

              <div className="overview-info-col">
                {/* Availability Badge */}
                <div className="overview-status-wrap">
                  {activeStatus.freshnessState === 'UNKNOWN' ? (
                    <span className="bed-status-pill unknown">
                      <span className="status-dot">○</span> Availability Not Reported
                    </span>
                  ) : activeStatus.isFull ? (
                    <span className="bed-status-pill full">
                      <span className="status-dot">▲</span> 0 Beds Available (Ward Full)
                    </span>
                  ) : (
                    <span className="bed-status-pill ready">
                      <span className="status-dot">●</span> {activeStatus.availableCount} beds ready to use
                    </span>
                  )}
                </div>

                <h3 className="ward-name-heading">{activeMeta.name}</h3>

                <div className="ward-meta-strip">
                  <span className="meta-item">Category: <strong>{activeMeta.shortName}</strong></span>
                  <span className="meta-sep">·</span>
                  <span className="meta-item">
                    Capacity: <strong>{activeStatus.totalCount !== null ? `${activeStatus.totalCount} beds` : 'Not reported'}</strong>
                  </span>
                </div>

                <p className="ward-desc-text">
                  {activeMeta.description}
                </p>

                {/* Primary Ward Action Buttons */}
                <div className="ward-action-row">
                  <button
                    type="button"
                    className="button button-primary button-sm"
                    onClick={() => scrollToReportForm(activeCategory)}
                  >
                    Report {activeMeta.shortName} Beds
                  </button>
                  <button
                    type="button"
                    className="button button-outline button-sm"
                    onClick={() => {
                      setHistoryFilter(activeCategory);
                      const el = document.getElementById('recentReportsSection');
                      if (el) el.scrollIntoView({ behavior: 'smooth' });
                    }}
                  >
                    View History
                  </button>
                </div>

                {/* Last Report Status Footer */}
                <div className="overview-footer-meta">
                  <span className="footer-meta-icon">⏱</span>
                  <span>
                    Status: <strong>{activeStatus.displaySecondary}</strong>
                    {activeSnapshot?.reportedAt && activeStatus.freshnessState !== 'UNKNOWN'
                      ? ` · Last updated: ${formatRelativeTime(activeSnapshot.reportedAt)}`
                      : ' · No report logged'}
                  </span>
                </div>
              </div>
            </div>
          </article>

          {/* Panel 2: Central 2x2 Operational Summary Tiles */}
          <div className="bed-summary-grid">
            {/* Tile 1: Selected Ward Available Beds */}
            <div className="bed-summary-tile">
              <div className="tile-top-row">
                <span className="tile-label">{activeMeta.shortName} Available</span>
                <span className="tile-arrow-icon" aria-hidden="true">↗</span>
              </div>
              <div className="tile-metric-value">
                {summaryMetrics.availableDisplay}
              </div>
              <div className="tile-subtext">
                {summaryMetrics.totalDisplay
                  ? `${summaryMetrics.totalDisplay} total capacity (${summaryMetrics.availPercent}% available)`
                  : 'No valid report'}
              </div>
              <div className="tile-progress-bar">
                {summaryMetrics.isNumeric && summaryMetrics.totalDisplay ? (
                  <div
                    className="tile-progress-fill"
                    style={{
                      width: `${Math.min(100, summaryMetrics.availPercent || 0)}%`,
                    }}
                  />
                ) : (
                  <div className="tile-progress-unreported" />
                )}
              </div>
            </div>

            {/* Tile 2: Ward Freshness State */}
            <div className="bed-summary-tile">
              <div className="tile-top-row">
                <span className="tile-label">Report Freshness</span>
                <span className="tile-arrow-icon" aria-hidden="true">↗</span>
              </div>
              <div className="tile-metric-value freshness">
                {summaryMetrics.freshnessLabel}
              </div>
              <div className="tile-subtext">
                {summaryMetrics.lastReportedTime !== 'Never'
                  ? `Updated ${summaryMetrics.lastReportedTime}`
                  : 'No report logged'}
              </div>
              <div className="tile-freshness-dots">
                <span className={`dot ${activeStatus.freshnessState === 'FRESH' ? 'active-green' : ''}`} title="Fresh (<=15m)" />
                <span className={`dot ${activeStatus.freshnessState === 'OVERDUE' ? 'active-amber' : ''}`} title="Overdue (15-60m)" />
                <span className={`dot ${activeStatus.freshnessState === 'STALE' ? 'active-red' : ''}`} title="Stale (>60m)" />
                <span className={`dot ${activeStatus.freshnessState === 'UNKNOWN' ? 'active-gray' : ''}`} title="Unknown" />
              </div>
            </div>

            {/* Tile 3: Verified Active Wards Count */}
            <div className="bed-summary-tile">
              <div className="tile-top-row">
                <span className="tile-label">Active Wards</span>
                <span className="tile-arrow-icon" aria-hidden="true">↗</span>
              </div>
              <div className="tile-metric-value">
                {summaryMetrics.reportedCount} / {summaryMetrics.totalSupported}
              </div>
              <div className="tile-subtext">
                Wards currently reporting
              </div>
              <div className="tile-ward-chips">
                {['general', 'icu', 'hdu', 'pediatric'].map((cat) => {
                  const snap = availabilityMap[cat];
                  const hasData = snap && snap.freshnessState && snap.freshnessState !== 'UNKNOWN';
                  return (
                    <span
                      key={cat}
                      className={`mini-ward-pill ${hasData ? 'reported' : 'missing'}`}
                      title={`${cat.toUpperCase()}: ${hasData ? snap.freshnessState : 'Not reported'}`}
                    >
                      {cat.slice(0, 3).toUpperCase()}
                    </span>
                  );
                })}
              </div>
            </div>

            {/* Tile 4: Audit Trail History */}
            <div className="bed-summary-tile">
              <div className="tile-top-row">
                <span className="tile-label">Audit Log</span>
                <span className="tile-arrow-icon" aria-hidden="true">↗</span>
              </div>
              <div className="tile-metric-value">
                {summaryMetrics.historyCount} Reports
              </div>
              <div className="tile-subtext">
                Logged for this facility
              </div>
              <div className="tile-audit-status">
                <span className="audit-shield">✓</span>
                <span>Audit log trail</span>
              </div>
            </div>
          </div>

          {/* Panel 3: Right Contextual Facility Profile */}
          <article className="bed-card facility-card">
            <div className="card-header-row">
              <div className="card-title-group">
                <span className="card-icon-badge">🏥</span>
                <h2>Facility Scope</h2>
              </div>
              {selectedFacility?.verificationStatus === 'verified' ? (
                <span className="facility-status-badge verified">● Verified</span>
              ) : selectedFacility?.verificationStatus === 'pending' ? (
                <span className="facility-status-badge pending">⏳ Pending Review</span>
              ) : (
                <span className="facility-status-badge unverified">Unverified</span>
              )}
            </div>

            <div className="facility-profile-content">
              <div className="facility-name-block">
                <div className="facility-avatar">
                  {selectedFacility?.name?.slice(0, 2).toUpperCase() || 'HF'}
                </div>
                <div className="facility-meta">
                  <strong className="facility-display-name" title={selectedFacility?.name}>
                    {selectedFacility?.name || 'Selected Facility'}
                  </strong>
                  <span className="facility-locality">
                    {selectedFacility?.address || selectedFacility?.city || 'Tiruchirappalli, Tamil Nadu'}
                  </span>
                </div>
              </div>

              {/* Emergency Hotline */}
              <div className="facility-hotline-box">
                <span className="hotline-label">Emergency Desk</span>
                <strong className="hotline-number">
                  {selectedFacility?.emergencyPhone || selectedFacility?.phone || '108 / 112 Desk'}
                </strong>
              </div>

              {/* Verified Capabilities */}
              <div className="facility-capabilities-list">
                <span className="caps-title">Emergency Readiness</span>
                <div className="caps-tags-wrap">
                  <span className="caps-pill">24/7 Emergency</span>
                  <span className="caps-pill">Oxygen Backup</span>
                  <span className="caps-pill">Trauma Care</span>
                  <span className="caps-pill">Ambulance Bay</span>
                </div>
              </div>

              {/* Active Reporter Tenancy Context */}
              <div className="reporter-tenancy-strip">
                <div className="reporter-avatar">{user.email?.[0]?.toUpperCase() || 'U'}</div>
                <div className="reporter-details">
                  <span className="reporter-email" title={user.email}>{user.email}</span>
                  <span className="reporter-role">{roleDisplay}</span>
                </div>
              </div>
            </div>
          </article>
        </section>

        {/* Lower Grid: Ward Breakdown + Recent Availability Reports + Submit Form */}
        <section className="bed-bottom-grid">
          {/* Column 1: Ward Breakdown (Equipments Insight style) */}
          <article className="bed-card breakdown-card">
            <div className="card-header-row">
              <div className="card-title-group">
                <span className="card-icon-badge">📊</span>
                <h2>Ward Breakdown</h2>
              </div>
              <span className="breakdown-total-tag">
                {totalConfirmedBeds !== null ? `${totalConfirmedBeds} Total Confirmed` : 'No Active Tallies'}
              </span>
            </div>

            <p className="card-intro-note">
              Capacity distribution across all four authorized emergency ward categories.
            </p>

            <div className="ward-breakdown-list">
              {BED_DEFINITIONS.map((def) => {
                const status = getBedAvailabilityStatus({ availability: availabilityMap }, def.key);
                const isSelected = activeCategory === def.key;
                return (
                  <div
                    key={def.key}
                    className={`ward-breakdown-row ${isSelected ? 'selected' : ''}`}
                    onClick={() => handleSelectWardTab(def.key)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') handleSelectWardTab(def.key);
                    }}
                  >
                    <div className="ward-row-header">
                      <div className="ward-row-title">
                        <strong className="ward-label">{def.label} Ward</strong>
                        <span className={`status-tag ${status.cssClass}`}>
                          {status.displaySecondary}
                        </span>
                      </div>
                      <div className="ward-row-count">
                        {status.isNumeric ? (
                          <span>
                            <strong>{status.availableCount}</strong> / {status.totalCount ?? '—'} beds ({status.totalCount > 0 ? Math.round((status.availableCount / status.totalCount) * 100) : 0}%)
                          </span>
                        ) : (
                          <span className="unreported-text">Not reported</span>
                        )}
                      </div>
                    </div>

                    {/* Progress visual */}
                    <div className="ward-row-bar">
                      {status.isNumeric && status.totalCount ? (
                        <div
                          className={`ward-row-bar-fill ${status.isFull ? 'full' : 'available'}`}
                          style={{
                            width: `${Math.min(100, Math.round((status.availableCount / status.totalCount) * 100))}%`,
                          }}
                        />
                      ) : (
                        <div className="ward-row-bar-empty" />
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </article>

          {/* Column 2: Recent Availability Reports (Staff Schedule style table) */}
          <article className="bed-card history-card" id="recentReportsSection">
            <div className="card-header-row">
              <div className="card-title-group">
                <span className="card-icon-badge">📋</span>
                <h2>Recent Availability Reports</h2>
              </div>

              {/* Filter controls */}
              <div className="history-filter-wrap">
                <select
                  value={historyFilter}
                  onChange={(e) => setHistoryFilter(e.target.value)}
                  className="history-filter-select"
                  aria-label="Filter reports by ward category"
                >
                  <option value="all">All Wards</option>
                  {BED_DEFINITIONS.map((b) => (
                    <option key={b.key} value={b.key}>{b.label}</option>
                  ))}
                </select>
                <button
                  type="button"
                  className="button button-quiet button-sm"
                  onClick={loadHistory}
                  disabled={historyLoading}
                  title="Reload audit history"
                >
                  {historyLoading ? '…' : '↻'}
                </button>
              </div>
            </div>

            {historyLoading ? (
              <div className="loading-state">
                <span className="loader" /> Loading verified reports…
              </div>
            ) : history.length === 0 ? (
              <div className="empty-history-state">
                <p>No verified availability reports logged for this facility.</p>
                <button
                  type="button"
                  className="button button-outline button-sm"
                  onClick={() => scrollToReportForm(activeCategory)}
                >
                  Submit First Capacity Report
                </button>
              </div>
            ) : (
              <div className="history-table-wrapper">
                <table className="history-table">
                  <thead>
                    <tr>
                      <th>Report Time</th>
                      <th>Ward</th>
                      <th>Available / Total</th>
                      <th>Source</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {history.map((rep, idx) => (
                      <tr key={rep.reportId || rep.id || idx}>
                        <td>
                          <span className="report-time-primary">{formatTime(rep.reportedAt || rep.createdAt)}</span>
                          <small className="report-time-rel">{formatRelativeTime(rep.reportedAt || rep.createdAt)}</small>
                        </td>
                        <td>
                          <span className={`table-ward-pill ${rep.category}`}>
                            {String(rep.category).toUpperCase()}
                          </span>
                        </td>
                        <td>
                          <span className="table-count-strong">{rep.availableBeds}</span>
                          <span className="table-count-sep"> / </span>
                          <span className="table-count-total">{rep.totalBeds} beds</span>
                        </td>
                        <td>
                          <span className="table-source-tag">{rep.source || 'staff_portal_web'}</span>
                        </td>
                        <td>
                          <span className="table-status-published">Published</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </article>

          {/* Column 3: Submit Availability Report Form */}
          <article className="bed-card form-card" id="submitReportForm">
            <div className="card-header-row">
              <div className="card-title-group">
                <span className="card-icon-badge">✍️</span>
                <h2>Submit Capacity Update</h2>
              </div>
            </div>

            <p className="card-intro-note">
              Capacity reports immediately update the public hospital finder and record an authorized audit log.
            </p>

            <form onSubmit={handleReportSubmit} className="bed-report-form">
              <div className="bed-form-group">
                <label htmlFor="reportCategorySelect">Ward Category</label>
                <select
                  id="reportCategorySelect"
                  value={formCategory}
                  onChange={(e) => {
                    setFormCategory(e.target.value);
                    setActiveCategory(e.target.value);
                  }}
                  disabled={busy}
                  className="bed-form-input"
                >
                  {BED_DEFINITIONS.map((bed) => (
                    <option key={bed.key} value={bed.key}>
                      {bed.label} Ward
                    </option>
                  ))}
                </select>
              </div>

              <div className="bed-form-row">
                <div className="bed-form-group">
                  <label htmlFor="availBedsInput">Available Beds (vacant now)</label>
                  <input
                    id="availBedsInput"
                    type="number"
                    min="0"
                    required
                    placeholder="e.g. 12"
                    value={availableBeds}
                    onChange={(e) => setAvailableBeds(e.target.value)}
                    disabled={busy}
                    className="bed-form-input"
                  />
                </div>

                <div className="bed-form-group">
                  <label htmlFor="totalBedsInput">Total Ward Beds (capacity)</label>
                  <input
                    id="totalBedsInput"
                    type="number"
                    min={Math.max(0, Number(availableBeds) || 0)}
                    required
                    placeholder="e.g. 50"
                    value={totalBeds}
                    onChange={(e) => setTotalBeds(e.target.value)}
                    disabled={busy}
                    className="bed-form-input"
                  />
                </div>
              </div>

              {/* Validation & Draft Submission Preview */}
              <div className="form-preview-box">
                {availableBeds === '' && totalBeds === '' ? (
                  <span className="preview-prompt" style={{ color: '#64748b' }}>
                    Enter current vacant and total ward beds to prepare a report update.
                  </span>
                ) : Number(availableBeds) < 0 || Number(totalBeds) < 0 ? (
                  <span className="preview-error">
                    ⚠️ Validation error: Bed counts cannot be negative.
                  </span>
                ) : !Number.isInteger(Number(availableBeds)) || !Number.isInteger(Number(totalBeds)) ? (
                  <span className="preview-error">
                    ⚠️ Validation error: Bed counts must be whole integers.
                  </span>
                ) : Number(availableBeds) > Number(totalBeds) ? (
                  <span className="preview-error">
                    ⚠️ Invariant violation: Available beds ({availableBeds}) cannot exceed total capacity ({totalBeds}).
                  </span>
                ) : (
                  (() => {
                    const avail = Number(availableBeds);
                    const tot = Number(totalBeds);
                    const occ = tot - avail;
                    const pct = tot > 0 ? Math.round((avail / tot) * 100) : 0;
                    const snap = availabilityMap[formCategory];
                    const isMatchingSaved =
                      snap &&
                      snap.freshnessState &&
                      snap.freshnessState !== 'UNKNOWN' &&
                      snap.availableBeds === avail &&
                      snap.totalBeds === tot;

                    if (isMatchingSaved) {
                      return (
                        <span className="preview-ok">
                          ✓ Confirmed Current Capacity: {avail} vacant / {tot} total beds ({pct}% vacant · {occ} occupied). Submitting will refresh report freshness.
                        </span>
                      );
                    }

                    return (
                      <span className="preview-ok">
                        Unpublished Draft: Ready to publish {avail} vacant / {tot} total beds ({pct}% vacant · {occ} occupied).
                      </span>
                    );
                  })()
                )}
              </div>

              <button
                type="submit"
                className="button button-primary bed-submit-btn"
                disabled={
                  busy ||
                  !selectedFacilityId ||
                  availableBeds === '' ||
                  totalBeds === '' ||
                  Number(availableBeds) < 0 ||
                  Number(totalBeds) < 0 ||
                  !Number.isInteger(Number(availableBeds)) ||
                  !Number.isInteger(Number(totalBeds)) ||
                  Number(availableBeds) > Number(totalBeds)
                }
              >
                {busy ? 'Publishing Report…' : 'Publish Capacity Report'}
              </button>

              <div className="form-audit-disclaimer">
                <span className="lock-icon">🔒</span>
                <span>Invariants enforced atomically. Capacity updates are recorded to the system audit trail.</span>
              </div>
            </form>
          </article>
        </section>
      </div>
    </div>
  );
}

import { useEffect, useState, useMemo } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { apiRequest } from '../api.js';
import { distanceKm } from '../utils/distance.js';
import { fetchRoadRoute, isValidCoordinate } from '../services/routing.js';
import {
  BED_DEFINITIONS,
  getBedAvailabilityStatus,
  getOverallFreshnessBadge,
  calculateTotalConfirmedBeds,
  getHospitalBedSummary,
} from '../utils/availability.js';

function formatDateTime(value) {
  if (!value) return 'Unknown';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Unknown';
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date);
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

const VALID_TABS = ['overview', 'bed-availability', 'services', 'contact'];

const WARD_INFO = {
  general: {
    icon: '🛏️',
    title: 'General Inpatient Ward',
    short: 'General',
    description: 'Acute medical-surgical care, routine post-emergency stabilization, and standard vital telemetry.',
  },
  icu: {
    icon: '🫀',
    title: 'Intensive Care Unit (ICU)',
    short: 'ICU',
    description: 'Critical care with continuous hemodynamic monitoring, mechanical ventilators, and round-the-clock intensivist coverage.',
  },
  hdu: {
    icon: '🩺',
    title: 'High Dependency Unit (HDU)',
    short: 'HDU',
    description: 'Intermediate step-down unit providing continuous cardiac telemetry and advanced respiratory intervention.',
  },
  pediatric: {
    icon: '👶',
    title: 'Pediatric Emergency Ward',
    short: 'Pediatric',
    description: 'Specialized neonatal and pediatric emergency beds equipped with infant warmers and pediatric resuscitation.',
  },
};

export function HospitalDetailPage() {
  const { facilityId } = useParams();
  const navigate = useNavigate();

  // Active tab state with URL hash synchronization
  const [activeTab, setActiveTab] = useState(() => {
    if (typeof window !== 'undefined' && window.location.hash) {
      const hash = window.location.hash.replace('#', '').toLowerCase();
      if (VALID_TABS.includes(hash)) return hash;
    }
    return 'overview';
  });

  const [hospital, setHospital] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [userLocation, setUserLocation] = useState(null);
  const [drivingInfo, setDrivingInfo] = useState(null);
  const [routingBusy, setRoutingBusy] = useState(false);

  // Sync tab state with browser back/forward and external hash links
  useEffect(() => {
    function handleHashChange() {
      const hash = window.location.hash.replace('#', '').toLowerCase();
      if (VALID_TABS.includes(hash)) {
        setActiveTab(hash);
      }
    }
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  function handleTabSelect(tabId) {
    if (VALID_TABS.includes(tabId)) {
      setActiveTab(tabId);
      if (typeof window !== 'undefined') {
        window.history.replaceState(null, '', `#${tabId}`);
      }
    }
  }

  // Fetch facility details from API
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError('');

    async function loadHospital() {
      try {
        const response = await apiRequest(`/api/hospitals/${facilityId}`);
        if (!cancelled) {
          if (response && response.data) {
            setHospital(response.data);
          } else {
            setError('Hospital not found or currently unpublished.');
          }
        }
      } catch (err) {
        if (!cancelled) {
          setError(err.message || 'Failed to load facility details.');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    if (facilityId) {
      loadHospital();
    } else {
      setError('Invalid facility ID.');
      setLoading(false);
    }

    return () => {
      cancelled = true;
    };
  }, [facilityId]);

  // Request browser location for road travel estimates
  function requestLocation() {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const loc = { latitude: pos.coords.latitude, longitude: pos.coords.longitude };
        setUserLocation(loc);
        if (hospital && isValidCoordinate(hospital)) {
          setRoutingBusy(true);
          const res = await fetchRoadRoute(loc, hospital);
          if (res.success) {
            setDrivingInfo({
              distanceKm: res.distanceKm,
              durationMinutes: res.durationMinutes,
            });
          }
          setRoutingBusy(false);
        }
      },
      () => {},
      { timeout: 10000, enableHighAccuracy: true },
    );
  }

  // Keyboard navigation for accessible tabs
  function handleTabKeyDown(e, currentIndex) {
    if (e.key === 'ArrowRight') {
      e.preventDefault();
      const nextIndex = (currentIndex + 1) % VALID_TABS.length;
      handleTabSelect(VALID_TABS[nextIndex]);
      const nextBtn = document.getElementById(`tab-${VALID_TABS[nextIndex]}`);
      if (nextBtn) nextBtn.focus();
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      const prevIndex = (currentIndex - 1 + VALID_TABS.length) % VALID_TABS.length;
      handleTabSelect(VALID_TABS[prevIndex]);
      const prevBtn = document.getElementById(`tab-${VALID_TABS[prevIndex]}`);
      if (prevBtn) prevBtn.focus();
    }
  }

  // Derive total confirmed available beds across all categories
  const totalConfirmedBeds = useMemo(() => {
    if (!hospital) return null;
    return calculateTotalConfirmedBeds([hospital], 'all');
  }, [hospital]);

  // Derive comprehensive bed availability summary matching public hospital card
  const bedSummary = useMemo(() => {
    if (!hospital) return null;
    return getHospitalBedSummary(hospital, 'all');
  }, [hospital]);

  if (loading) {
    return (
      <main className="page detail-page">
        <div className="loading-state">
          <span className="loader" /> Loading facility profile…
        </div>
      </main>
    );
  }

  if (error || !hospital) {
    return (
      <main className="page detail-page">
        <div className="empty-state">
          <div className="empty-icon">⚠️</div>
          <h3>Facility Unavailable</h3>
          <p>{error || 'The requested facility could not be found or has not yet been verified.'}</p>
          <div className="empty-actions">
            <Link to="/find-hospitals" className="button button-primary">
              ← Return to Hospital Finder
            </Link>
          </div>
        </div>
      </main>
    );
  }

  const overallFreshness = getOverallFreshnessBadge(hospital, 'all');
  const straightDistance = userLocation ? distanceKm(userLocation, hospital) : null;
  const supportedBedCategories = hospital.supportedBedCategories || ['general', 'icu', 'hdu', 'pediatric'];

  return (
    <main className="page detail-page">
      {/* Navigation Breadcrumb */}
      <nav className="detail-breadcrumb" aria-label="Breadcrumb">
        <Link to="/find-hospitals">← Hospital Finder</Link>
        <span className="breadcrumb-sep">/</span>
        <span className="breadcrumb-current">{hospital.name}</span>
      </nav>

      {/* Persistent Facility Header Card */}
      <article className="detail-header-card">
        <div className="detail-header-top">
          <div className="detail-title-col">
            <div className="eyebrow">
              {hospital.locality ? `${hospital.locality}, ` : ''}{hospital.city || 'Tiruchirappalli'}{hospital.state ? `, ${hospital.state}` : ''}
            </div>
            <h1>{hospital.name}</h1>
            <p className="detail-address">📍 {hospital.address}</p>
          </div>

          <div className="status-stack">
            <span className={`status ${hospital.operatingStatus === 'open' ? 'status-open' : 'status-closed'}`}>
              <span className="status-dot" />
              {hospital.operatingStatus === 'open' ? 'Reporting Open' : 'Closed'}
            </span>
            <span className={overallFreshness.className} title={overallFreshness.label}>
              {overallFreshness.icon} {overallFreshness.label}
            </span>
            <span className="verification-pill">
              ✓ Verified Facility
            </span>
          </div>
        </div>

        {/* Quick Contact & Action Ribbon */}
        <div className="detail-contact-bar">
          <div className="detail-contact-items">
            {hospital.phone ? (
              <a href={`tel:${hospital.phone}`} className="detail-contact-link detail-phone">
                📞 {hospital.phone}
              </a>
            ) : (
              <span className="detail-contact-muted">No public phone registered</span>
            )}
            {hospital.publicWebsite && (
              <a
                href={hospital.publicWebsite}
                target="_blank"
                rel="noopener noreferrer"
                className="detail-contact-link"
              >
                🌐 Official Website ↗
              </a>
            )}
            <span className="detail-timestamp">
              Last capacity update: {formatDateTime(hospital.updatedAt)}
            </span>
          </div>

          <div className="detail-action-buttons">
            <button
              type="button"
              className="button button-primary"
              onClick={() => navigate(`/find-hospitals?q=${encodeURIComponent(hospital.name)}`)}
            >
              🗺️ View on Map
            </button>
          </div>
        </div>
      </article>

      {/* Accessible Tab Navigation */}
      <div className="detail-tabs-container">
        <div
          role="tablist"
          aria-label="Hospital Details Sections"
          className="detail-tabs-bar"
        >
          <button
            role="tab"
            id="tab-overview"
            aria-selected={activeTab === 'overview'}
            aria-controls="panel-overview"
            tabIndex={activeTab === 'overview' ? 0 : -1}
            className={`detail-tab-btn ${activeTab === 'overview' ? 'active' : ''}`}
            onClick={() => handleTabSelect('overview')}
            onKeyDown={(e) => handleTabKeyDown(e, 0)}
          >
            📋 Overview
          </button>

          <button
            role="tab"
            id="tab-bed-availability"
            aria-selected={activeTab === 'bed-availability'}
            aria-controls="panel-bed-availability"
            tabIndex={activeTab === 'bed-availability' ? 0 : -1}
            className={`detail-tab-btn ${activeTab === 'bed-availability' ? 'active' : ''}`}
            onClick={() => handleTabSelect('bed-availability')}
            onKeyDown={(e) => handleTabKeyDown(e, 1)}
          >
            🛏️ Bed Availability
            {totalConfirmedBeds > 0 && (
              <span className="tab-pill-badge">{totalConfirmedBeds} avail</span>
            )}
          </button>

          <button
            role="tab"
            id="tab-services"
            aria-selected={activeTab === 'services'}
            aria-controls="panel-services"
            tabIndex={activeTab === 'services' ? 0 : -1}
            className={`detail-tab-btn ${activeTab === 'services' ? 'active' : ''}`}
            onClick={() => handleTabSelect('services')}
            onKeyDown={(e) => handleTabKeyDown(e, 2)}
          >
            🏥 Services & Facilities
            {(hospital.services || []).length > 0 && (
              <span className="tab-count-badge">{(hospital.services || []).length}</span>
            )}
          </button>

          <button
            role="tab"
            id="tab-contact"
            aria-selected={activeTab === 'contact'}
            aria-controls="panel-contact"
            tabIndex={activeTab === 'contact' ? 0 : -1}
            className={`detail-tab-btn ${activeTab === 'contact' ? 'active' : ''}`}
            onClick={() => handleTabSelect('contact')}
            onKeyDown={(e) => handleTabKeyDown(e, 3)}
          >
            📍 Contact & Directions
          </button>
        </div>
      </div>

      {/* ============================================================
          TAB 1: OVERVIEW PANEL
          ============================================================ */}
      {activeTab === 'overview' && (
        <section
          role="tabpanel"
          id="panel-overview"
          aria-labelledby="tab-overview"
          className="detail-tab-panel"
        >
          {/* Quick Summary Cards Grid */}
          <div className="overview-summary-grid">
            {/* Card 1: Bed Capacity Snapshot */}
            <div className="overview-summary-card bed-capacity-summary-card">
              <div className="summary-card-header">
                <span className="summary-card-icon" aria-hidden="true">🛏️</span>
                <h3>Bed Capacity</h3>
              </div>

              {bedSummary?.hasReport ? (
                <div className="detail-bed-summary-block">
                  <div className="summary-metric-row">
                    <span className={`summary-metric-number ${bedSummary.isFull ? 'number-full' : 'number-avail'}`}>
                      {bedSummary.headlineCount}
                    </span>
                    <div className="summary-metric-meta">
                      <strong className="summary-metric-label">
                        {bedSummary.isFull ? 'Beds Available (Wards Full)' : 'Beds Available'}
                      </strong>
                      <span className="summary-metric-subtext">{bedSummary.subtext}</span>
                    </div>
                    {bedSummary.percentage !== null && (
                      <span className="summary-metric-badge">
                        {bedSummary.percentage}% vacant
                      </span>
                    )}
                  </div>

                  {/* Horizontal Availability Progress Bar */}
                  <div className="summary-progress-track" aria-hidden="true">
                    <div
                      className={`summary-progress-fill ${bedSummary.isFull ? 'fill-full' : 'fill-avail'}`}
                      style={{ width: `${Math.min(100, bedSummary.percentage || 0)}%` }}
                    />
                  </div>

                  {bedSummary.latestReportedAt && (
                    <div className="summary-timestamp-note">
                      ⏱ Last reported: <strong>{formatRelativeTime(bedSummary.latestReportedAt)}</strong>
                    </div>
                  )}
                </div>
              ) : (
                <div className="detail-bed-unreported-block">
                  <strong className="unreported-headline">Bed availability not yet reported</strong>
                  <p className="summary-card-desc">
                    Clinical capacity updates have not been submitted for this facility. Contact hospital desk directly before transport.
                  </p>
                </div>
              )}

              <button
                type="button"
                className="button button-outline button-sm summary-card-action"
                onClick={() => handleTabSelect('bed-availability')}
              >
                View Ward Breakdown →
              </button>
            </div>

            {/* Card 2: Emergency Desk & Phone */}
            <div className="overview-summary-card">
              <div className="summary-card-header">
                <span className="summary-card-icon">📞</span>
                <h3>Emergency Desk</h3>
              </div>
              <div className="summary-card-metric">
                {hospital.phone ? (
                  <a href={`tel:${hospital.phone}`} className="metric-phone-link">
                    {hospital.phone}
                  </a>
                ) : (
                  <strong className="metric-muted">No phone registered</strong>
                )}
              </div>
              <p className="summary-card-desc">
                For immediate life-threatening emergencies requiring ambulance dispatch, call 108 or 112 directly.
              </p>
              <button
                type="button"
                className="button button-outline button-sm summary-card-action"
                onClick={() => handleTabSelect('contact')}
              >
                Contact & Directions →
              </button>
            </div>

            {/* Card 3: Road Travel & Proximity */}
            <div className="overview-summary-card">
              <div className="summary-card-header">
                <span className="summary-card-icon">⏱️</span>
                <h3>Road Travel Proximity</h3>
              </div>
              <div className="summary-card-metric">
                {drivingInfo ? (
                  <strong className="metric-teal">~{drivingInfo.durationMinutes} mins ({drivingInfo.distanceKm} km)</strong>
                ) : straightDistance !== null ? (
                  <strong className="metric-teal">~{straightDistance.toFixed(1)} km straight-line</strong>
                ) : (
                  <strong className="metric-muted">Location disabled</strong>
                )}
              </div>
              <p className="summary-card-desc">
                OSRM road routing model estimate. Turn on device location for route distance.
              </p>
              <button
                type="button"
                className="button button-outline button-sm summary-card-action"
                onClick={() => handleTabSelect('contact')}
              >
                Routing Details →
              </button>
            </div>
          </div>

          {/* Clinical Profile & Scope */}
          <article className="detail-panel-card">
            <h2>Facility Clinical Scope</h2>
            <p className="panel-lead-text">
              {hospital.name} is a verified emergency medical facility located in {hospital.city || 'Tiruchirappalli'}, Tamil Nadu.
              Operating round-the-clock emergency casualty care and participating in the CareRoute verified reporting network.
            </p>

            <div className="overview-caps-row">
              <strong className="overview-caps-label">Verified Capabilities:</strong>
              <div className="overview-caps-tags">
                {(hospital.services || []).slice(0, 5).map((service) => (
                  <span key={service} className="caps-pill">
                    ✓ {service}
                  </span>
                ))}
                {(hospital.services || []).length > 5 && (
                  <button
                    type="button"
                    className="caps-pill-more-btn"
                    onClick={() => handleTabSelect('services')}
                  >
                    +{(hospital.services || []).length - 5} more in Services tab
                  </button>
                )}
              </div>
            </div>
          </article>

          {/* District Prototype Notice */}
          <div className="demo-notice" role="note">
            <span className="notice-icon" aria-hidden="true">i</span>
            <div>
              <strong>Tiruchirappalli Pilot Prototype Notice</strong>
              <p>
                Facility data is verified against district health directories. Always contact the hospital directly before traveling to confirm bed admission availability.
              </p>
            </div>
          </div>
        </section>
      )}

      {/* ============================================================
          TAB 2: BED AVAILABILITY PANEL
          ============================================================ */}
      {activeTab === 'bed-availability' && (
        <section
          role="tabpanel"
          id="panel-bed-availability"
          aria-labelledby="tab-bed-availability"
          className="detail-tab-panel"
        >
          {/* Section Header */}
          <div className="panel-header-block">
            <div className="panel-header-title">
              <h2>Ward Bed Availability</h2>
              <p className="panel-subtitle">
                Clinical ward capacity reported by authorized hospital personnel. Figures older than 60 minutes are marked as unconfirmed.
              </p>
            </div>

            <div className="panel-header-badge">
              <span className="total-badge-label">Confirmed Available:</span>
              <strong className="total-badge-number">
                {totalConfirmedBeds > 0 ? `${totalConfirmedBeds} beds` : 'None confirmed'}
              </strong>
            </div>
          </div>

          {/* Aggregate Capacity Banner */}
          {bedSummary?.hasReport && (
            <div className="detail-aggregate-banner">
              <div className="aggregate-banner-top">
                <div className="aggregate-banner-count">
                  <span className={`banner-number ${bedSummary.isFull ? 'number-full' : 'number-avail'}`}>
                    {bedSummary.headlineCount}
                  </span>
                  <div className="banner-labels">
                    <strong className="banner-title">
                      {bedSummary.isFull ? 'Total Confirmed Available Beds (Wards Full)' : 'Total Confirmed Available Beds'}
                    </strong>
                    <span className="banner-subtext">{bedSummary.subtext}</span>
                  </div>
                </div>

                {bedSummary.percentage !== null && (
                  <div className="banner-pct-badge" title="Percentage of total ward capacity currently available">
                    <span className="banner-pct-value">{bedSummary.percentage}%</span>
                    <span className="banner-pct-label">vacant</span>
                  </div>
                )}
              </div>

              <div className="banner-progress-track" aria-hidden="true">
                <div
                  className={`banner-progress-fill ${bedSummary.isFull ? 'fill-full' : 'fill-avail'}`}
                  style={{ width: `${Math.min(100, bedSummary.percentage || 0)}%` }}
                />
              </div>

              {bedSummary.latestReportedAt && (
                <div className="banner-timestamp">
                  ⏱ Last capacity report: <strong>{formatRelativeTime(bedSummary.latestReportedAt)}</strong>
                  <span className="time-sep"> · </span>
                  <span>{formatDateTime(bedSummary.latestReportedAt)}</span>
                </div>
              )}
            </div>
          )}

          {/* Freshness Legend Strip */}
          <div className="bed-freshness-legend">
            <div className="legend-item">
              <span className="legend-dot dot-fresh" />
              <span><strong>Fresh (≤15m):</strong> Active & confirmed</span>
            </div>
            <div className="legend-item">
              <span className="legend-dot dot-overdue" />
              <span><strong>Overdue (15–60m):</strong> May have changed</span>
            </div>
            <div className="legend-item">
              <span className="legend-dot dot-stale" />
              <span><strong>Stale (&gt;60m):</strong> Strictly unconfirmed</span>
            </div>
            <div className="legend-item">
              <span className="legend-dot dot-unknown" />
              <span><strong>Not reported:</strong> No data on file</span>
            </div>
          </div>

          {/* 4-Ward Detailed Capacity Grid */}
          <div className="detail-capacity-grid">
            {BED_DEFINITIONS.map((bed) => {
              const isSupported = supportedBedCategories.includes(bed.key);
              const info = WARD_INFO[bed.key] || WARD_INFO.general;
              const stat = getBedAvailabilityStatus(hospital, bed.key);
              const snapshot = hospital.availability?.[bed.key];

              // If ward category is not configured for this facility
              if (!isSupported) {
                return (
                  <article key={bed.key} className="detail-bed-card bed-unsupported-card">
                    <div className="detail-bed-top">
                      <div className="bed-title-wrap">
                        <span className="bed-icon">{info.icon}</span>
                        <strong className="detail-bed-label">{info.title}</strong>
                      </div>
                      <span className="ward-unsupported-tag">Not Supported</span>
                    </div>

                    <div className="detail-bed-count">
                      <strong className="number-unsupported">Not Supported</strong>
                      <span className="detail-bed-unit">no dedicated ward</span>
                    </div>

                    <p className="detail-bed-desc">{info.description}</p>
                    <div className="detail-bed-footer-note">
                      This facility does not operate a dedicated {info.short} ward.
                    </div>
                  </article>
                );
              }

              // Ward is supported: render genuine capacity state
              return (
                <article key={bed.key} className={`detail-bed-card ${stat.cssClass}`}>
                  <div className="detail-bed-top">
                    <div className="bed-title-wrap">
                      <span className="bed-icon">{info.icon}</span>
                      <strong className="detail-bed-label">{info.title}</strong>
                    </div>
                    <span className={`detail-bed-freshness ${stat.cssClass}`}>
                      {stat.displaySecondary}
                    </span>
                  </div>

                  {/* Bed Counts Display */}
                  <div className="detail-bed-count">
                    {stat.isNumeric ? (
                      <>
                        <strong className={stat.isFull ? 'number-full' : 'number-available'}>
                          {stat.displayPrimary}
                        </strong>
                        <span className="detail-bed-unit">
                          {stat.isFull ? 'ward full' : 'beds available'}
                        </span>
                      </>
                    ) : (
                      <>
                        <strong className={stat.freshnessState === 'STALE' ? 'number-stale' : 'number-unknown'}>
                          {stat.displayPrimary}
                        </strong>
                        <span className="detail-bed-unit">
                          {stat.freshnessState === 'STALE' ? 'historical count (unconfirmed)' : 'unreported telemetry'}
                        </span>
                      </>
                    )}
                  </div>

                  {/* Capacity Bar Visual */}
                  <div className="detail-bed-bar">
                    {stat.isNumeric && stat.totalCount ? (
                      <div
                        className={`detail-bed-bar-fill ${stat.isFull ? 'full' : 'available'}`}
                        style={{
                          width: `${Math.min(100, Math.round((stat.availableCount / stat.totalCount) * 100))}%`,
                        }}
                      />
                    ) : (
                      <div className="detail-bed-bar-empty" />
                    )}
                  </div>

                  <p className="detail-bed-desc">{info.description}</p>

                  {/* Footer Timestamp & Explanation */}
                  <div className="detail-bed-footer-note">
                    <div className="footer-meta-line">
                      <span>Total Capacity: <strong>{stat.totalCount !== null ? `${stat.totalCount} beds` : 'Not reported'}</strong></span>
                      <span className="meta-sep">·</span>
                      <span>
                        Reported: <strong>{snapshot?.reportedAt ? formatRelativeTime(snapshot.reportedAt) : 'Never'}</strong>
                      </span>
                    </div>

                    <div className="footer-status-desc">
                      {stat.freshnessState === 'UNKNOWN' && 'No recent report submitted for this ward. Direct hospital call required.'}
                      {stat.freshnessState === 'STALE' && 'Last report exceeds 60 minutes. Numbers cannot be guaranteed.'}
                      {stat.freshnessState === 'OVERDUE' && 'Report overdue. Available count may have shifted since publication.'}
                      {stat.freshnessState === 'FRESH' && (stat.isFull ? 'Verified report confirming zero available beds in this ward.' : 'Recently reported and confirmed ready for admission.')}
                    </div>
                  </div>
                </article>
              );
            })}
          </div>

          {/* Semantic Accuracy Notice */}
          <div className="semantic-integrity-box">
            <span className="integrity-icon">🛡️</span>
            <div>
              <strong>Strict Semantic Accuracy Invariant</strong>
              <p>
                A report of 0 available beds confirms the ward is full. An unreported status indicates absence of verified telemetry, not zero capacity.
                Stale reports (&gt;60m) are strictly excluded from confirmed available bed tallies.
              </p>
            </div>
          </div>
        </section>
      )}

      {/* ============================================================
          TAB 3: SERVICES & FACILITIES PANEL
          ============================================================ */}
      {activeTab === 'services' && (
        <section
          role="tabpanel"
          id="panel-services"
          aria-labelledby="tab-services"
          className="detail-tab-panel"
        >
          <div className="panel-header-block">
            <div className="panel-header-title">
              <h2>Clinical Capabilities & Emergency Infrastructure</h2>
              <p className="panel-subtitle">
                Emergency equipment, surgical suites, and diagnostic infrastructure verified by Tamil Nadu district health authorities.
              </p>
            </div>
          </div>

          {/* Clinical Capabilities List */}
          {(hospital.capabilities || []).length > 0 ? (
            <div className="capabilities-detailed-grid">
              {hospital.capabilities.map((cap) => (
                <div key={cap.id || cap.name} className="capability-card">
                  <div className="cap-card-top">
                    <span className="cap-icon">✓</span>
                    <strong className="cap-name">{cap.name}</strong>
                  </div>
                  <div className="cap-meta">
                    <span className="cap-category-pill">{cap.category || 'Clinical Support'}</span>
                    <span className="cap-verified-tag">● Verified Infrastructure</span>
                  </div>
                </div>
              ))}
            </div>
          ) : (hospital.services || []).length > 0 ? (
            <div className="capabilities-detailed-grid">
              {hospital.services.map((service) => (
                <div key={service} className="capability-card">
                  <div className="cap-card-top">
                    <span className="cap-icon">✓</span>
                    <strong className="cap-name">{service}</strong>
                  </div>
                  <div className="cap-meta">
                    <span className="cap-category-pill">Emergency Service</span>
                    <span className="cap-verified-tag">● Verified</span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="empty-section-state">
              <p>No specific clinical capabilities registered in the verified directory.</p>
            </div>
          )}

          {/* Specialist On-Duty Coverage Section if available */}
          {(hospital.specialistCoverage || []).length > 0 && (
            <div className="specialist-coverage-block">
              <h3>Specialist Emergency Coverage</h3>
              <div className="coverage-list">
                {hospital.specialistCoverage.map((cov, idx) => (
                  <div key={idx} className="coverage-item">
                    <span className="coverage-icon">👨‍⚕️</span>
                    <div>
                      <strong>{cov.specialty}</strong>
                      <span className="coverage-status">State: {cov.coverageState || 'On-Call'}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="demo-notice" role="note">
            <span className="notice-icon" aria-hidden="true">i</span>
            <div>
              <strong>Infrastructure Scope</strong>
              <p>
                Capabilities represent verified medical infrastructure (e.g. emergency surgical suites, oxygen manifolds, CT scanners). Outpatient clinic appointments are not tracked on this emergency platform.
              </p>
            </div>
          </div>
        </section>
      )}

      {/* ============================================================
          TAB 4: CONTACT & DIRECTIONS PANEL
          ============================================================ */}
      {activeTab === 'contact' && (
        <section
          role="tabpanel"
          id="panel-contact"
          aria-labelledby="tab-contact"
          className="detail-tab-panel"
        >
          <div className="panel-header-block">
            <div className="panel-header-title">
              <h2>Contact Details & Travel Directions</h2>
              <p className="panel-subtitle">
                Verified public contact information and road distance calculations.
              </p>
            </div>
          </div>

          <div className="contact-grid">
            {/* Contact Information Card */}
            <article className="contact-card">
              <h3>Verified Public Contact</h3>

              <div className="contact-info-list">
                <div className="contact-info-row">
                  <span className="contact-label">Physical Address:</span>
                  <p className="contact-val">
                    {hospital.address}
                    {hospital.locality ? `, ${hospital.locality}` : ''}
                    {hospital.city ? `, ${hospital.city}` : ''}
                    {hospital.state ? `, ${hospital.state}` : ''}
                    {hospital.postalCode ? ` - ${hospital.postalCode}` : ''}
                  </p>
                </div>

                <div className="contact-info-row">
                  <span className="contact-label">Emergency Desk:</span>
                  {hospital.phone ? (
                    <a href={`tel:${hospital.phone}`} className="button button-primary contact-call-btn">
                      📞 Call Hospital Desk: {hospital.phone}
                    </a>
                  ) : (
                    <span className="contact-muted">No public telephone registered</span>
                  )}
                </div>

                {hospital.publicWebsite && (
                  <div className="contact-info-row">
                    <span className="contact-label">Official Portal:</span>
                    <a
                      href={hospital.publicWebsite}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="button button-outline contact-web-btn"
                    >
                      🌐 Visit Official Portal ↗
                    </a>
                  </div>
                )}

                <div className="contact-info-row">
                  <span className="contact-label">Geographic Coordinates:</span>
                  <span className="coord-chip">
                    Lat: {hospital.latitude ? hospital.latitude.toFixed(5) : '—'}, Lon: {hospital.longitude ? hospital.longitude.toFixed(5) : '—'}
                  </span>
                </div>
              </div>

              <div className="ambulance-emergency-callout">
                <strong>Emergency Ambulance Service</strong>
                <p>For immediate life-saving assistance or cardiac arrest, dial <strong>108</strong> (Tamil Nadu Ambulance) or <strong>112</strong> immediately.</p>
              </div>
            </article>

            {/* Road Travel & Driving Estimate Card */}
            <article className="contact-card">
              <h3>Road Travel Estimation</h3>

              {drivingInfo ? (
                <div className="travel-metrics-grid">
                  <div className="travel-metric duration-box">
                    <span className="metric-label">Estimated Road Drive</span>
                    <strong className="metric-value">~{drivingInfo.durationMinutes} mins</strong>
                    <small className="metric-disclaimer">* OSRM road routing model estimate (no live traffic)</small>
                  </div>

                  <div className="travel-metric distance-box">
                    <span className="metric-label">Road Distance</span>
                    <strong className="metric-value">{drivingInfo.distanceKm} km</strong>
                    <small className="metric-disclaimer">Via open street road network</small>
                  </div>
                </div>
              ) : straightDistance !== null ? (
                <div className="travel-metrics-grid">
                  <div className="travel-metric">
                    <span className="metric-label">Direct Air Distance</span>
                    <strong className="metric-value">{straightDistance.toFixed(1)} km</strong>
                    <small className="metric-disclaimer">Approximate straight-line distance</small>
                  </div>
                </div>
              ) : (
                <div className="travel-prompt">
                  <p>Enable device location to calculate driving time and distance via the road routing network.</p>
                  <button
                    type="button"
                    className="button button-outline"
                    onClick={requestLocation}
                    disabled={routingBusy}
                  >
                    {routingBusy ? 'Calculating road route…' : '◎ Enable Location & Calculate Road Route'}
                  </button>
                </div>
              )}

              <div className="map-view-jump-box">
                <button
                  type="button"
                  className="button button-primary"
                  onClick={() => navigate(`/find-hospitals?q=${encodeURIComponent(hospital.name)}`)}
                >
                  🗺️ Locate on Interactive Map
                </button>
                <small className="map-hint">
                  Opens the hospital finder with this facility selected and centered on the map.
                </small>
              </div>
            </article>
          </div>
        </section>
      )}
    </main>
  );
}

import { Link } from 'react-router-dom';
import { distanceKm } from '../utils/distance.js';
import {
  getOverallFreshnessBadge,
  getHospitalBedSummary,
} from '../utils/availability.js';

function formatTime(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(date);
}

function formatRelativeTime(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const diffSec = Math.floor((Date.now() - date.getTime()) / 1000);
  if (diffSec < 60) return 'Just now';
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  return `${Math.floor(diffHours / 24)}d ago`;
}

export function HospitalCard({
  hospital,
  userLocation,
  selectedBed = 'all',
  isSelected = false,
  onSelect,
  drivingInfo,
}) {
  const distance = userLocation ? distanceKm(userLocation, hospital) : null;
  const overallFreshness = getOverallFreshnessBadge(hospital, selectedBed);
  const summary = getHospitalBedSummary(hospital, selectedBed);

  const hasConfirmedBeds = summary.hasReport && summary.headlineCount > 0;

  return (
    <article
      id={`hospital-card-${hospital.id}`}
      className={`hospital-card ${isSelected ? 'hospital-card-selected' : ''}`}
      onClick={() => onSelect && onSelect(hospital)}
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onSelect && onSelect(hospital);
        }
      }}
      aria-label={`${hospital.name}, ${hospital.city}`}
    >
      {/* 1. Header: Facility Name, Locality, Status & Distance */}
      <div className="card-top-row">
        <div className="card-identity">
          <h3 className="card-name">
            <Link
              to={`/hospitals/${hospital.id}`}
              className="card-name-link"
              onClick={(e) => e.stopPropagation()}
            >
              {hospital.name}
            </Link>
          </h3>
          <div className="card-location-meta">
            <span className="card-locality-tag">
              📍 {hospital.address || `${hospital.city}, ${hospital.state || 'Tamil Nadu'}`}
            </span>
            {drivingInfo ? (
              <span className="route-pill route-pill-drive" title="Modeled OSRM driving duration">
                🚗 ~{drivingInfo.durationMinutes}m ({drivingInfo.distanceKm} km road)
              </span>
            ) : distance !== null ? (
              <span className="route-pill route-pill-direct" title="Straight-line distance">
                📍 {distance.toFixed(1)} km direct
              </span>
            ) : null}
          </div>
        </div>

        <div className="card-badges">
          <span className={`status-pill ${hospital.operatingStatus === 'open' ? 'status-open' : 'status-closed'}`}>
            <span className="status-dot" />
            {hospital.operatingStatus === 'open' ? 'Open' : 'Closed'}
          </span>
        </div>
      </div>

      {/* 2. Visual Focal Point: Redesigned Bed Availability Section */}
      <section className="card-bed-availability" aria-label={`Bed availability for ${hospital.name}`}>
        {/* Section Header with Title and Freshness Badge */}
        <div className="bed-section-header">
          <div className="bed-section-title-wrap">
            <span className="bed-icon-badge" aria-hidden="true">🛏️</span>
            <h4 className="bed-section-title">
              {selectedBed === 'all' ? 'Bed Availability' : `${selectedBed.toUpperCase()} Availability`}
            </h4>
          </div>
          <div className="bed-section-freshness">
            <span className={`freshness-pill ${overallFreshness.className}`} title={overallFreshness.label}>
              {overallFreshness.icon} {overallFreshness.label}
            </span>
          </div>
        </div>

        {/* Aggregate Headline Display */}
        {summary.hasReport ? (
          <div className="bed-aggregate-card">
            <div className="aggregate-top">
              <div className="aggregate-count-block">
                <span className={`aggregate-number ${summary.isFull ? 'number-full' : 'number-avail'}`}>
                  {summary.headlineCount}
                </span>
                <div className="aggregate-labels">
                  <span className="aggregate-primary-label">
                    {summary.isFull ? 'Beds Available (Wards Full)' : 'Beds Available'}
                  </span>
                  <span className="aggregate-subtext">
                    {summary.subtext}
                  </span>
                </div>
              </div>

              {summary.percentage !== null && (
                <div className="aggregate-pct-badge" title="Percentage of total ward capacity currently available">
                  <span className="pct-value">{summary.percentage}%</span>
                  <span className="pct-label">vacant</span>
                </div>
              )}
            </div>

            {/* Availability Progress Bar */}
            <div className="aggregate-progress-track" aria-hidden="true">
              <div
                className={`aggregate-progress-fill ${summary.isFull ? 'fill-full' : 'fill-avail'}`}
                style={{ width: `${Math.min(100, summary.percentage || 0)}%` }}
              />
            </div>

            {/* Authoritative Timestamp Info */}
            {summary.latestReportedAt && (
              <div className="bed-report-timestamp">
                <span className="time-icon">⏱</span>
                <span>
                  Last reported: <strong>{formatRelativeTime(summary.latestReportedAt)}</strong>
                  <span className="time-sep"> · </span>
                  <span className="time-exact">{formatTime(summary.latestReportedAt)}</span>
                </span>
              </div>
            )}
          </div>
        ) : (
          <div className="bed-unreported-card">
            <div className="unreported-body">
              <span className="unreported-icon" aria-hidden="true">⚠️</span>
              <div className="unreported-text-wrap">
                <strong className="unreported-title">Bed availability not yet reported</strong>
                <p className="unreported-desc">
                  Clinical capacity updates have not been submitted for this facility. Contact hospital desk directly before transport.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* 3. Responsive 2-Column Ward-Level Availability Tiles */}
        <div className="card-ward-grid" role="list" aria-label="Ward capacity breakdown">
          {summary.wardStatuses.map((ward) => {
            // Only show an individual ward freshness badge if the ward's freshness
            // genuinely differs from the facility's overall freshness status,
            // or if it is stale/unconfirmed while other wards are active.
            const hasDifferentFreshness =
              ward.freshnessState !== overallFreshness.state &&
              ward.freshnessState !== 'FRESH' &&
              summary.hasReport;

            return (
              <div
                key={ward.key}
                className={`ward-card-tile ${ward.cssClass} ${selectedBed === ward.key ? 'ward-tile-selected' : ''}`}
                role="listitem"
              >
                <div className="ward-tile-header">
                  <span className="ward-tile-name">{ward.fullName}</span>
                  {hasDifferentFreshness && (
                    <span className={`ward-status-tag ${ward.cssClass}`}>
                      {ward.freshnessState === 'STALE' ? 'Unconfirmed' : ward.displaySecondary}
                    </span>
                  )}
                </div>

                <div className="ward-tile-body">
                  {ward.isNumeric ? (
                    <>
                      <div className="ward-count-row">
                        <span className={`ward-count-large ${ward.isFull ? 'count-full' : 'count-avail'}`}>
                          {ward.availableCount}
                        </span>
                        <span className="ward-count-denom">
                          / {ward.totalCount} <span className="ward-count-label">{ward.isFull ? 'beds available (full)' : 'beds available'}</span>
                        </span>
                      </div>
                      {ward.totalCount > 0 && (
                        <div className="ward-tile-bar" aria-hidden="true">
                          <div
                            className={`ward-tile-fill ${ward.isFull ? 'fill-full' : 'fill-avail'}`}
                            style={{
                              width: `${Math.min(100, Math.round((ward.availableCount / ward.totalCount) * 100))}%`,
                            }}
                          />
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="ward-unreported-row">
                      <span className="ward-unreported-text">
                        {ward.freshnessState === 'STALE' ? `Unconfirmed (${ward.displayPrimary} beds)` : 'Bed availability not reported'}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* 4. Facilities, Services Tags & Actions */}
      <div className="card-bottom-row">
        <div className="card-capabilities">
          {(hospital.services || []).slice(0, 3).map((service) => (
            <span className="service-tag" key={service}>{service}</span>
          ))}
          {(hospital.services || []).length > 3 && (
            <span className="service-tag service-tag-more">
              +{(hospital.services || []).length - 3} more
            </span>
          )}
        </div>

        <div className="card-actions">
          <Link
            to={`/hospitals/${hospital.id}`}
            className="button button-quiet button-sm row-details-btn"
            onClick={(e) => e.stopPropagation()}
          >
            Details →
          </Link>
          <button
            type="button"
            className={`button button-sm ${isSelected ? 'button-outline' : 'button-primary'} row-select-btn ${!hasConfirmedBeds ? 'button-muted' : ''}`}
            onClick={(e) => {
              e.stopPropagation();
              onSelect && onSelect(hospital);
            }}
            aria-label={isSelected ? `Currently selected: ${hospital.name}` : `Select ${hospital.name} on map`}
          >
            {isSelected ? '✓ On Map' : 'Select on map ↗'}
          </button>
        </div>
      </div>
    </article>
  );
}

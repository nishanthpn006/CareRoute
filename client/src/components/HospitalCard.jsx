import { Link } from 'react-router-dom';
import { distanceKm } from '../utils/distance.js';
import {
  BED_DEFINITIONS,
  getBedAvailabilityStatus,
  getOverallFreshnessBadge,
} from '../utils/availability.js';

function formatTime(value) {
  if (!value) return 'Unknown';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Unknown';
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(date);
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

  const selectedBedStat = selectedBed !== 'all' ? getBedAvailabilityStatus(hospital, selectedBed) : null;
  const hasConfirmedBeds = selectedBed === 'all'
    ? BED_DEFINITIONS.some((b) => {
        const s = getBedAvailabilityStatus(hospital, b.key);
        return s.isConfirmed && (s.availableCount || 0) > 0;
      })
    : selectedBedStat?.isConfirmed && (selectedBedStat.availableCount || 0) > 0;

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
      {/* 1. Hospital name and locality */}
      <div className="hospital-card-top">
        <div className="hospital-card-title-group">
          <div className="eyebrow">{hospital.city}{hospital.state ? `, ${hospital.state}` : ''}</div>
          <h3>
            <Link
              to={`/hospitals/${hospital.id}`}
              className="hospital-title-link"
              onClick={(e) => e.stopPropagation()}
            >
              {hospital.name}
            </Link>
          </h3>
          <p className="muted address">{hospital.address}</p>
        </div>
        {/* 3. Availability status & operating status */}
        <div className="status-stack">
          <span className={`status ${hospital.operatingStatus === 'open' ? 'status-open' : 'status-closed'}`}>
            <span className="status-dot" />
            {hospital.operatingStatus === 'open' ? 'Reporting open' : 'Closed'}
          </span>
          <span className={overallFreshness.className} title={overallFreshness.label}>
            {overallFreshness.icon} {overallFreshness.label}
          </span>
        </div>
      </div>

      {/* 2. Relevant care capabilities */}
      <div className="service-row" aria-label="Facility capabilities">
        {(hospital.services || []).slice(0, 5).map((service) => (
          <span className="service-tag" key={service}>{service}</span>
        ))}
        {(hospital.services || []).length > 5 && (
          <span className="service-tag service-tag-more">
            +{(hospital.services || []).length - 5} more
          </span>
        )}
      </div>

      {/* 4. Bed capacity tiles: strictly distinguishes verified 0 from unconfirmed/unknown */}
      <div className="capacity-grid" aria-label="Ward bed capacity">
        {BED_DEFINITIONS.map((bed) => {
          const stat = getBedAvailabilityStatus(hospital, bed.key);
          const isCategorySelected = selectedBed === bed.key;

          return (
            <div
              key={bed.key}
              className={`capacity-tile ${stat.cssClass} ${isCategorySelected ? 'capacity-selected' : ''}`}
            >
              <span className="capacity-label">{bed.label}</span>
              {stat.isNumeric ? (
                <>
                  <strong className={stat.isFull ? 'number-full' : 'number-available'}>
                    {stat.displayPrimary}
                  </strong>
                  <small className="capacity-sub">{stat.displaySecondary}</small>
                </>
              ) : (
                <>
                  <strong className={stat.freshnessState === 'STALE' ? 'number-stale' : 'number-unknown'}>
                    {stat.displayPrimary}
                  </strong>
                  <small className="capacity-sub">{stat.displaySecondary}</small>
                </>
              )}
            </div>
          );
        })}
      </div>

      {/* 5. Estimated road distance/duration & 6. Selection action */}
      <div className="hospital-card-footer">
        <div className="updated-block">
          <span className="muted report-timestamp">
            Last update: {formatTime(hospital.updatedAt)}
          </span>
          {drivingInfo ? (
            <div className="distance-block">
              <span className="road-distance-pill">
                🚗 ~{drivingInfo.durationMinutes} mins ({drivingInfo.distanceKm} km road drive)
              </span>
              <small className="distance-disclaimer-sub">
                * Estimated driving time (OSRM model, no live traffic)
              </small>
            </div>
          ) : distance !== null ? (
            <div className="distance-block">
              <span className="straight-distance-pill">
                📍 {distance.toFixed(1)} km (approx. straight-line distance)
              </span>
              <small className="distance-disclaimer-sub">
                Direct air distance; road route time may differ
              </small>
            </div>
          ) : null}
        </div>

        <div className="hospital-card-actions">
          <Link
            to={`/hospitals/${hospital.id}`}
            className="button button-quiet details-button"
            onClick={(e) => e.stopPropagation()}
          >
            Details →
          </Link>
          <button
            type="button"
            className={`button ${isSelected ? 'button-outline' : 'button-primary'} route-button ${!hasConfirmedBeds ? 'button-muted' : ''}`}
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

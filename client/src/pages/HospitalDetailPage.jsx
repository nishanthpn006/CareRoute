import { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { apiRequest } from '../api.js';
import { distanceKm } from '../utils/distance.js';
import { fetchRoadRoute, isValidCoordinate } from '../services/routing.js';
import {
  BED_DEFINITIONS,
  getBedAvailabilityStatus,
  getOverallFreshnessBadge,
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

export function HospitalDetailPage() {
  const { facilityId } = useParams();
  const navigate = useNavigate();

  const [hospital, setHospital] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [userLocation, setUserLocation] = useState(null);
  const [drivingInfo, setDrivingInfo] = useState(null);
  const [routingBusy, setRoutingBusy] = useState(false);

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

  // Request browser location for travel estimates if requested
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

  return (
    <main className="page detail-page">
      {/* Navigation Breadcrumb */}
      <nav className="detail-breadcrumb" aria-label="Breadcrumb">
        <Link to="/find-hospitals">← Hospital Finder</Link>
        <span>/</span>
        <span className="breadcrumb-current">{hospital.name}</span>
      </nav>

      {/* Facility Header Card */}
      <article className="detail-header-card">
        <div className="detail-header-top">
          <div>
            <div className="eyebrow">{hospital.city}{hospital.state ? `, ${hospital.state}` : ''}</div>
            <h1>{hospital.name}</h1>
            <p className="detail-address">{hospital.address}</p>
          </div>

          <div className="status-stack">
            <span className={`status ${hospital.operatingStatus === 'open' ? 'status-open' : 'status-closed'}`}>
              <span className="status-dot" />
              {hospital.operatingStatus === 'open' ? 'Reporting Open' : 'Closed'}
            </span>
            <span className={overallFreshness.className} title={overallFreshness.label}>
              {overallFreshness.icon} {overallFreshness.label}
            </span>
          </div>
        </div>

        {/* Contact and Actions Row */}
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
              Latest report: {formatDateTime(hospital.updatedAt)}
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

      {/* Travel Information & Road Estimates */}
      <section className="detail-section" aria-label="Travel and road distance">
        <div className="detail-section-heading">
          <h2>Road Travel & Distance</h2>
        </div>
        <div className="detail-travel-card">
          {drivingInfo ? (
            <div className="travel-metrics-grid">
              <div className="travel-metric duration-box">
                <span className="metric-label">Estimated Road Drive</span>
                <strong className="metric-value">~{drivingInfo.durationMinutes} mins</strong>
                <small className="metric-disclaimer">* OSRM model estimate (no live traffic)</small>
              </div>
              <div className="travel-metric distance-box">
                <span className="metric-label">Road Distance</span>
                <strong className="metric-value">{drivingInfo.distanceKm} km</strong>
                <small className="metric-disclaimer">Via road routing network</small>
              </div>
            </div>
          ) : straightDistance !== null ? (
            <div className="travel-metrics-grid">
              <div className="travel-metric">
                <span className="metric-label">Straight-Line Air Distance</span>
                <strong className="metric-value">{straightDistance.toFixed(1)} km</strong>
                <small className="metric-disclaimer">Approximate direct distance</small>
              </div>
            </div>
          ) : (
            <div className="travel-prompt">
              <p>Turn on device location to calculate estimated road driving time to this facility.</p>
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
        </div>
      </section>

      {/* Ward Bed Availability Breakdown */}
      <section className="detail-section" aria-label="Ward bed availability">
        <div className="detail-section-heading">
          <h2>Ward Bed Availability</h2>
          <span className="muted">Reported by authorized hospital personnel</span>
        </div>

        <div className="detail-capacity-grid">
          {BED_DEFINITIONS.map((bed) => {
            const stat = getBedAvailabilityStatus(hospital, bed.key);
            return (
              <div key={bed.key} className={`detail-bed-card ${stat.cssClass}`}>
                <div className="detail-bed-top">
                  <span className="detail-bed-label">{bed.label} Ward</span>
                  <span className="detail-bed-freshness">{stat.displaySecondary}</span>
                </div>

                <div className="detail-bed-count">
                  {stat.isNumeric ? (
                    <>
                      <strong className={stat.isFull ? 'number-full' : 'number-available'}>
                        {stat.displayPrimary}
                      </strong>
                      <span className="detail-bed-unit">beds available</span>
                    </>
                  ) : (
                    <>
                      <strong className={stat.freshnessState === 'STALE' ? 'number-stale' : 'number-unknown'}>
                        {stat.displayPrimary}
                      </strong>
                      <span className="detail-bed-unit">unconfirmed</span>
                    </>
                  )}
                </div>

                <small className="detail-bed-note">
                  {stat.freshnessState === 'UNKNOWN' && 'No recent report submitted for this ward.'}
                  {stat.freshnessState === 'STALE' && 'Last report exceeds 60 minutes. Availability must be verified directly.'}
                  {stat.freshnessState === 'OVERDUE' && 'Report overdue. Available count may have changed.'}
                  {stat.freshnessState === 'FRESH' && 'Recently reported and active.'}
                </small>
              </div>
            );
          })}
        </div>
      </section>

      {/* Clinical Capabilities & Emergency Services */}
      <section className="detail-section" aria-label="Clinical capabilities">
        <div className="detail-section-heading">
          <h2>Clinical Capabilities & Equipment</h2>
        </div>

        <div className="detail-services-grid">
          {(hospital.services || []).length > 0 ? (
            hospital.services.map((service) => (
              <div key={service} className="detail-service-item">
                <span className="service-check">✓</span>
                <span>{service}</span>
              </div>
            ))
          ) : (
            <p className="muted">No specific clinical services registered.</p>
          )}
        </div>
      </section>

      {/* Prototype Verification Notice */}
      <section className="demo-notice" role="note">
        <span className="notice-icon" aria-hidden="true">i</span>
        <div>
          <strong>Tiruchirappalli Pilot Prototype Notice</strong>
          <p>
            Facility data is verified against district health directories. Always contact the hospital directly before traveling to confirm bed admission availability.
          </p>
        </div>
      </section>
    </main>
  );
}

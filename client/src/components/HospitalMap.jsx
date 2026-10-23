import { useEffect, useMemo } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, ZoomControl, useMap } from 'react-leaflet';
import L from 'leaflet';
import { MAP_CONFIG } from '../services/mapConfig.js';
import { isValidCoordinate } from '../services/routing.js';
import { getBedAvailabilityStatus, getOverallFreshnessBadge } from '../utils/availability.js';

// SVG icons for high-DPI rendering without missing asset bundle issues
function createHospitalIcon(isSelected, hasBeds = true) {
  const pinColor = isSelected ? '#b91c1c' : (hasBeds ? '#dc2626' : '#64748b');
  const ringColor = isSelected ? '#fbbf24' : 'transparent';
  const size = isSelected ? 38 : 32;

  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 40" width="${size}" height="${size * 1.25}" style="filter: drop-shadow(0 2px 4px rgba(0,0,0,0.35));">
      ${isSelected ? `<circle cx="16" cy="16" r="15" fill="none" stroke="${ringColor}" stroke-width="3" stroke-dasharray="4 2" />` : ''}
      <path d="M16 0C7.163 0 0 7.163 0 16c0 10.5 16 24 16 24s16-13.5 16-24C32 7.163 24.837 0 16 0z" fill="${pinColor}" />
      <circle cx="16" cy="15" r="9" fill="#ffffff" />
      <path d="M14 9h4v4h4v4h-4v4h-4v-4H10v-4h4V9z" fill="${pinColor}" />
    </svg>
  `;

  return L.divIcon({
    className: 'custom-hospital-marker',
    html: svg,
    iconSize: [size, size * 1.25],
    iconAnchor: [size / 2, size * 1.25],
    popupAnchor: [0, -(size * 1.1)],
  });
}

function createUserIcon() {
  const size = 28;
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" width="${size}" height="${size}" style="filter: drop-shadow(0 2px 4px rgba(0,0,0,0.3));">
      <circle cx="16" cy="16" r="14" fill="#3b82f6" fill-opacity="0.25">
        <animate attributeName="r" values="10;15;10" dur="2s" repeatCount="indefinite" />
        <animate attributeName="fill-opacity" values="0.35;0.1;0.35" dur="2s" repeatCount="indefinite" />
      </circle>
      <circle cx="16" cy="16" r="8" fill="#1d4ed8" stroke="#ffffff" stroke-width="2.5" />
    </svg>
  `;

  return L.divIcon({
    className: 'custom-user-marker',
    html: svg,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
    popupAnchor: [0, -(size / 2)],
  });
}

/**
 * Controller hook component to synchronize map bounds, centers and resize events.
 */
function MapViewController({ hospitals, selectedHospital, userLocation, activeRoute, mapViewMode }) {
  const map = useMap();

  // Invalidate map size on initial render, view-mode change, or container resize to prevent grey missing tiles
  useEffect(() => {
    map.invalidateSize();
    const timer = setTimeout(() => {
      map.invalidateSize();
    }, 150);

    const container = map.getContainer();
    let resizeObserver = null;

    if (typeof ResizeObserver !== 'undefined' && container) {
      resizeObserver = new ResizeObserver(() => {
        map.invalidateSize();
      });
      resizeObserver.observe(container);
    }

    const onResize = () => map.invalidateSize();
    window.addEventListener('resize', onResize);

    return () => {
      clearTimeout(timer);
      if (resizeObserver) {
        resizeObserver.disconnect();
      }
      window.removeEventListener('resize', onResize);
    };
  }, [map, mapViewMode]);

  // Adjust view when route, selection, or hospital list updates
  useEffect(() => {
    if (activeRoute?.coordinates?.length) {
      const bounds = L.latLngBounds(activeRoute.coordinates);
      map.fitBounds(bounds, { padding: [50, 50], maxZoom: 15 });
    } else if (selectedHospital && isValidCoordinate(selectedHospital)) {
      map.flyTo([Number(selectedHospital.latitude), Number(selectedHospital.longitude)], 14, {
        duration: 0.8,
      });
    } else {
      const points = [];
      if (userLocation && isValidCoordinate(userLocation)) {
        points.push([Number(userLocation.latitude), Number(userLocation.longitude)]);
      }
      hospitals.forEach((h) => {
        if (isValidCoordinate(h)) {
          points.push([Number(h.latitude), Number(h.longitude)]);
        }
      });

      if (points.length > 0) {
        const bounds = L.latLngBounds(points);
        map.fitBounds(bounds, { padding: [40, 40], maxZoom: 13 });
      } else {
        map.setView(MAP_CONFIG.defaultCenter, MAP_CONFIG.defaultZoom);
      }
    }
  }, [map, hospitals, selectedHospital, userLocation, activeRoute]);

  return null;
}

export function HospitalMap({
  hospitals = [],
  selectedHospital = null,
  onSelectHospital,
  userLocation = null,
  activeRoute = null,
  routingBusy = false,
  onClearRoute,
  selectedBed = 'all',
  mapViewMode = 'both',
  onLocateMe = null,
  locationMessage = '',
  locationBusy = false,
}) {
  const validHospitals = useMemo(() => {
    return hospitals.filter((h) => isValidCoordinate(h));
  }, [hospitals]);

  const missingCoordinateCount = hospitals.length - validHospitals.length;

  return (
    <div className="map-wrapper" role="region" aria-label="Interactive Hospital Map">
      <MapContainer
        center={MAP_CONFIG.defaultCenter}
        zoom={MAP_CONFIG.defaultZoom}
        zoomControl={false}
        scrollWheelZoom={true}
        className="leaflet-hospital-map"
      >
        <ZoomControl position="topright" />

        <TileLayer
          url={MAP_CONFIG.tileUrl}
          attribution={MAP_CONFIG.tileAttribution}
          maxZoom={19}
        />

        <MapViewController
          hospitals={validHospitals}
          selectedHospital={selectedHospital}
          userLocation={userLocation}
          activeRoute={activeRoute}
          mapViewMode={mapViewMode}
        />

        {/* User location pin */}
        {userLocation && isValidCoordinate(userLocation) && (
          <Marker
            position={[Number(userLocation.latitude), Number(userLocation.longitude)]}
            icon={createUserIcon()}
          >
            <Popup className="custom-map-popup">
              <div className="popup-content">
                <strong>Your Location</strong>
                <p className="popup-subtext">Captured from device geolocation</p>
              </div>
            </Popup>
          </Marker>
        )}

        {/* Hospital markers */}
        {validHospitals.map((hospital) => {
          const isSelected = selectedHospital?.id === hospital.id;
          const generalStat = getBedAvailabilityStatus(hospital, 'general');
          const icuStat = getBedAvailabilityStatus(hospital, 'icu');
          const hduStat = getBedAvailabilityStatus(hospital, 'hdu');
          const pediatricStat = getBedAvailabilityStatus(hospital, 'pediatric');
          const overallBadge = getOverallFreshnessBadge(hospital, selectedBed);

          // Marker has beds if confirmed available count is > 0
          const hasBeds = selectedBed === 'all'
            ? [generalStat, icuStat, hduStat, pediatricStat].some((s) => s.isConfirmed && s.availableCount > 0)
            : getBedAvailabilityStatus(hospital, selectedBed).isConfirmed && (getBedAvailabilityStatus(hospital, selectedBed).availableCount || 0) > 0;
          const icon = createHospitalIcon(isSelected, hasBeds);

          return (
            <Marker
              key={hospital.id}
              position={[Number(hospital.latitude), Number(hospital.longitude)]}
              icon={icon}
              eventHandlers={{
                click: () => onSelectHospital && onSelectHospital(hospital),
              }}
            >
              <Popup className="custom-map-popup">
                <div className="popup-card">
                  <div className="popup-header">
                    <div className="popup-header-top">
                      <span className="popup-city">{hospital.city || 'Tiruchirappalli'}</span>
                      <span className={overallBadge.className}>
                        {overallBadge.icon} {overallBadge.state}
                      </span>
                    </div>
                    <h4 className="popup-name">{hospital.name}</h4>
                    <p className="popup-address">{hospital.address}</p>
                  </div>

                  <div className="popup-status-row">
                    <span className={`popup-status ${hospital.operatingStatus === 'open' ? 'open' : 'closed'}`}>
                      {hospital.operatingStatus === 'open' ? 'Reporting Open' : 'Closed'}
                    </span>
                    {hospital.phone && (
                      <a href={`tel:${hospital.phone}`} className="popup-phone" aria-label={`Call ${hospital.name}`}>
                        📞 {hospital.phone}
                      </a>
                    )}
                  </div>

                  <div className="popup-capacity-summary">
                    <div className="popup-bed-stat">
                      <small>General</small>
                      <strong className={generalStat.isConfirmed && generalStat.availableCount > 0 ? 'text-green' : 'text-muted'}>
                        {generalStat.displayPrimary}
                      </strong>
                      <span className="popup-bed-sub">{generalStat.displaySecondary}</span>
                    </div>
                    <div className="popup-bed-stat">
                      <small>ICU</small>
                      <strong className={icuStat.isConfirmed && icuStat.availableCount > 0 ? 'text-green' : 'text-muted'}>
                        {icuStat.displayPrimary}
                      </strong>
                      <span className="popup-bed-sub">{icuStat.displaySecondary}</span>
                    </div>
                    <div className="popup-bed-stat">
                      <small>HDU</small>
                      <strong className={hduStat.isConfirmed && hduStat.availableCount > 0 ? 'text-green' : 'text-muted'}>
                        {hduStat.displayPrimary}
                      </strong>
                      <span className="popup-bed-sub">{hduStat.displaySecondary}</span>
                    </div>
                    <div className="popup-bed-stat">
                      <small>Pediatric</small>
                      <strong className={pediatricStat.isConfirmed && pediatricStat.availableCount > 0 ? 'text-green' : 'text-muted'}>
                        {pediatricStat.displayPrimary}
                      </strong>
                      <span className="popup-bed-sub">{pediatricStat.displaySecondary}</span>
                    </div>
                  </div>

                  <div className="popup-actions">
                    <button
                      type="button"
                      className="button button-primary popup-action-btn"
                      onClick={() => onSelectHospital && onSelectHospital(hospital)}
                    >
                      {isSelected ? '✓ Selected' : 'Select facility & route'}
                    </button>
                  </div>
                </div>
              </Popup>
            </Marker>
          );
        })}

        {/* Road route line */}
        {activeRoute?.routeFound && activeRoute.coordinates?.length > 0 && (
          <Polyline
            positions={activeRoute.coordinates}
            color="#2563eb"
            weight={5}
            opacity={0.85}
            lineCap="round"
            lineJoin="round"
          />
        )}
      </MapContainer>

      {/* Floating Routing & Route Info Card */}
      {selectedHospital && (
        <div className="route-info-card" role="region" aria-label="Selected destination and route summary">
          <div className="route-card-header">
            <div>
              <span className="route-tag">Selected Destination</span>
              <h4 className="route-hospital-name">{selectedHospital.name}</h4>
              <p className="route-locality">{selectedHospital.locality || selectedHospital.city}</p>
            </div>
            {onClearRoute && (
              <button
                type="button"
                className="route-close-btn"
                onClick={onClearRoute}
                title="Clear selected route"
                aria-label="Clear route"
              >
                ✕
              </button>
            )}
          </div>

          {routingBusy && (
            <div className="route-card-loading">
              <span className="loader" /> Calculating best road route via OSRM…
            </div>
          )}

          {!routingBusy && activeRoute?.routeFound && (
            <div className="route-metrics">
              <div className="metric-box duration-box">
                <span className="metric-label">Estimated Road Travel Time</span>
                <strong className="metric-value">{activeRoute.formattedDuration}</strong>
                <small className="metric-disclaimer">
                  * {activeRoute.estimateDisclaimer || 'Estimated road travel time (OSRM, no live traffic)'}
                </small>
              </div>
              <div className="metric-box distance-box">
                <span className="metric-label">Road Distance</span>
                <strong className="metric-value">{activeRoute.formattedDistance}</strong>
                <small className="metric-sub">{activeRoute.summary || 'via motorable roads'}</small>
              </div>
            </div>
          )}

          {!routingBusy && activeRoute && !activeRoute.routeFound && (
            <div className="route-fallback-notice">
              <span className="notice-icon">⚠️</span>
              <div>
                <strong>Road routing unavailable</strong>
                <p>{activeRoute.error}</p>
                {activeRoute.straightLineDistanceKm !== undefined && (
                  <p className="fallback-haversine">
                    Approx. straight-line distance: <strong>{Number(activeRoute.straightLineDistanceKm).toFixed(1)} km</strong>
                  </p>
                )}
              </div>
            </div>
          )}

          {!userLocation && (
            <div className="route-location-prompt">
              <p className="route-prompt-text">
                📍 Enable device location to view driving directions and road route on the map.
              </p>
              {onLocateMe && (
                <button
                  type="button"
                  className="route-locate-btn"
                  onClick={onLocateMe}
                  disabled={locationBusy}
                >
                  {locationBusy ? 'Locating…' : '📍 Use My Location'}
                </button>
              )}
              {locationMessage && (
                <p className="route-location-msg" role="status">
                  {locationMessage}
                </p>
              )}
            </div>
          )}
        </div>
      )}

      {/* Notice if any facilities had invalid/missing coordinates */}
      {missingCoordinateCount > 0 && (
        <div className="map-warning-bar" role="status">
          ℹ {missingCoordinateCount} {missingCoordinateCount === 1 ? 'facility' : 'facilities'} omitted from map due to missing coordinates.
        </div>
      )}
    </div>
  );
}

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { apiRequest } from '../api.js';
import { distanceKm } from '../utils/distance.js';
import { HospitalMap } from '../components/HospitalMap.jsx';
import { HospitalCard } from '../components/HospitalCard.jsx';
import { fetchRoadRoute, fetchDrivingTable, isValidCoordinate } from '../services/routing.js';
import {
  BED_DEFINITIONS,
  getBedAvailabilityStatus,
  calculateTotalConfirmedBeds,
  formatConfirmedBedsSummary,
} from '../utils/availability.js';

const QUICK_CARE_CATEGORIES = [
  { id: 'all', label: 'All Care' },
  { id: 'trauma', label: 'Trauma & Casualty', serviceMatch: 'Emergency Trauma Care' },
  { id: 'cardiac', label: 'Cardiac Care', serviceMatch: 'Cardiac Catheterization / Intervention' },
  { id: 'icu', label: 'ICU / Critical', bedMatch: 'icu' },
  { id: 'surgery', label: 'Emergency Surgery', serviceMatch: 'Emergency Surgical Suite' },
  { id: 'pediatric', label: 'Pediatric Care', bedMatch: 'pediatric' },
  { id: 'oxygen', label: 'Oxygen Support', serviceMatch: 'Oxygen Support' },
];

const SERVICE_OPTIONS = [
  'Emergency',
  'Emergency Trauma Care',
  'Emergency Surgical Suite',
  'Oxygen Support',
  'Ventilator Support',
  'Cardiac Catheterization / Intervention',
  'CT Scan',
  'Blood Bank',
  'MRI Scan',
];

export function FindHospitalsPage() {
  const [searchParams, setSearchParams] = useSearchParams();

  const [hospitals, setHospitals] = useState([]);
  const [meta, setMeta] = useState({ isDemo: true, refreshedAt: null });
  const [loading, setLoading] = useState(true);
  const [apiError, setApiError] = useState('');

  // Search and filter states initialized from URL params if present
  const [query, setQuery] = useState(() => searchParams.get('q') || '');
  const [city, setCity] = useState(() => searchParams.get('city') || '');
  const [service, setService] = useState(() => searchParams.get('service') || 'all');
  const [bedType, setBedType] = useState(() => searchParams.get('bedType') || 'all');
  const [availableOnly, setAvailableOnly] = useState(() => searchParams.get('availableOnly') === 'true');

  // Location and routing state
  const [userLocation, setUserLocation] = useState(null);
  const [locationMessage, setLocationMessage] = useState('');
  const [selectedHospital, setSelectedHospital] = useState(null);
  const [activeRoute, setActiveRoute] = useState(null);
  const [routingBusy, setRoutingBusy] = useState(false);
  const [drivingTable, setDrivingTable] = useState({});
  const [mapViewMode, setMapViewMode] = useState('both'); // 'both' | 'list' | 'map'

  // Sync URL search params when filters change
  useEffect(() => {
    const params = {};
    if (query) params.q = query;
    if (city) params.city = city;
    if (service && service !== 'all') params.service = service;
    if (bedType && bedType !== 'all') params.bedType = bedType;
    if (availableOnly) params.availableOnly = 'true';
    setSearchParams(params, { replace: true });
  }, [query, city, service, bedType, availableOnly, setSearchParams]);

  const refreshHospitals = useCallback(async () => {
    try {
      const result = await apiRequest('/api/hospitals');
      setHospitals(result.data || []);
      setMeta(result.meta || {});
      setApiError('');
    } catch (error) {
      setApiError(error.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshHospitals();
    const pollId = window.setInterval(refreshHospitals, 15000);
    return () => window.clearInterval(pollId);
  }, [refreshHospitals]);

  function locateMe() {
    setLocationMessage('');
    if (!navigator.geolocation) {
      setLocationMessage('Geolocation is not supported by this browser.');
      return;
    }
    setLocationMessage('Requesting device location…');
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setUserLocation({ latitude: position.coords.latitude, longitude: position.coords.longitude });
        setLocationMessage('Location captured in this browser.');
      },
      (error) => setLocationMessage(error.code === 1 ? 'Location permission was denied. You can still search manually.' : 'Could not determine your location. Try again or search manually.'),
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 },
    );
  }

  // Handle hospital selection and request OSRM route if location is available
  const handleSelectHospital = useCallback(async (hospital) => {
    setSelectedHospital(hospital);
    if (!userLocation || !isValidCoordinate(hospital)) {
      setActiveRoute(null);
      return;
    }

    setRoutingBusy(true);
    const routeRes = await fetchRoadRoute(userLocation, hospital);
    setActiveRoute(routeRes);
    setRoutingBusy(false);

    // Scroll to the corresponding card in the list
    const cardEl = document.getElementById(`hospital-card-${hospital.id}`);
    if (cardEl) {
      cardEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, [userLocation]);

  const handleClearRoute = useCallback(() => {
    setActiveRoute(null);
    setSelectedHospital(null);
  }, []);

  // Update batch driving table when userLocation is set to rank hospitals by road duration
  useEffect(() => {
    if (!userLocation || hospitals.length === 0) {
      setDrivingTable({});
      return;
    }

    let cancelled = false;
    async function loadTable() {
      const validHospitals = hospitals.filter(isValidCoordinate);
      if (validHospitals.length === 0) return;
      const res = await fetchDrivingTable(userLocation, validHospitals);
      if (!cancelled && res.success) {
        setDrivingTable(res.results);
      }
    }

    loadTable();
    return () => {
      cancelled = true;
    };
  }, [userLocation, hospitals]);

  // Recalculate route if userLocation changes while a hospital is selected
  useEffect(() => {
    if (selectedHospital && userLocation && isValidCoordinate(selectedHospital)) {
      let cancelled = false;
      async function updateSelectedRoute() {
        setRoutingBusy(true);
        const res = await fetchRoadRoute(userLocation, selectedHospital);
        if (!cancelled) {
          setActiveRoute(res);
          setRoutingBusy(false);
        }
      }
      updateSelectedRoute();
      return () => {
        cancelled = true;
      };
    }
  }, [userLocation, selectedHospital]);

  const filteredHospitals = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    const normalizedCity = city.trim().toLowerCase();
    const rows = hospitals.filter((hospital) => {
      const searchable = [hospital.name, hospital.address, hospital.city, hospital.state, ...(hospital.services || [])].join(' ').toLowerCase();
      if (normalizedQuery && !searchable.includes(normalizedQuery)) return false;
      if (normalizedCity && !String(hospital.city || '').toLowerCase().includes(normalizedCity)) return false;
      if (service !== 'all' && !(hospital.services || []).some((item) => item.toLowerCase().includes(service.toLowerCase()))) return false;

      // Filter by confirmed available capacity
      if (availableOnly) {
        if (bedType !== 'all') {
          const stat = getBedAvailabilityStatus(hospital, bedType);
          if (!stat.isConfirmed || (stat.availableCount || 0) < 1) return false;
        } else {
          const hasAny = BED_DEFINITIONS.some((bed) => {
            const stat = getBedAvailabilityStatus(hospital, bed.key);
            return stat.isConfirmed && (stat.availableCount || 0) > 0;
          });
          if (!hasAny) return false;
        }
      }

      return hospital.operatingStatus === 'open';
    });

    return rows.sort((a, b) => {
      if (userLocation) {
        const durA = drivingTable[a.id]?.durationMinutes;
        const durB = drivingTable[b.id]?.durationMinutes;
        if (durA !== undefined && durB !== undefined && durA !== durB) {
          return durA - durB;
        }

        const da = distanceKm(userLocation, a) ?? Number.POSITIVE_INFINITY;
        const db = distanceKm(userLocation, b) ?? Number.POSITIVE_INFINITY;
        if (da !== db) return da - db;
      }

      // Sort by confirmed available beds if available
      if (bedType !== 'all') {
        const statA = getBedAvailabilityStatus(a, bedType);
        const statB = getBedAvailabilityStatus(b, bedType);
        const countA = statA.isConfirmed ? (statA.availableCount || 0) : -1;
        const countB = statB.isConfirmed ? (statB.availableCount || 0) : -1;
        return countB - countA;
      }

      const aTotal = BED_DEFINITIONS.reduce((total, bed) => {
        const s = getBedAvailabilityStatus(a, bed.key);
        return total + (s.isConfirmed ? (s.availableCount || 0) : 0);
      }, 0);
      const bTotal = BED_DEFINITIONS.reduce((total, bed) => {
        const s = getBedAvailabilityStatus(b, bed.key);
        return total + (s.isConfirmed ? (s.availableCount || 0) : 0);
      }, 0);
      return bTotal - aTotal;
    });
  }, [hospitals, query, city, service, bedType, availableOnly, userLocation, drivingTable]);

  // Aggregate confirmed beds summary
  const totalConfirmedBeds = useMemo(() => {
    return calculateTotalConfirmedBeds(filteredHospitals, bedType);
  }, [filteredHospitals, bedType]);

  const summaryMeta = useMemo(() => {
    return formatConfirmedBedsSummary(totalConfirmedBeds, filteredHospitals, bedType);
  }, [totalConfirmedBeds, filteredHospitals, bedType]);

  return (
    <main className="page finder-page">
      {/* Pilot Prototype Disclosure */}
      {meta.isDemo ? (
        <div className="demo-notice" role="note">
          <span className="notice-icon" aria-hidden="true">i</span>
          <div>
            <strong>Tiruchirappalli District Pilot Prototype — Not an emergency dispatch service.</strong>
            <p>
              Facility coordinates and profiles are verified from district listings. Bed counts are staff-reported and must be confirmed directly with the facility. In a life-threatening emergency, dial 112 or 108 immediately.
            </p>
          </div>
        </div>
      ) : (
        <div className="info-notice" role="note">
          <span className="notice-icon" aria-hidden="true">i</span>
          <div>
            <strong>Availability is staff-reported.</strong>
            <p>Confirm bed availability directly with the facility before travelling. This tool is not a medical dispatch or triage service.</p>
          </div>
        </div>
      )}

      {apiError && (
        <div className="error-box api-error" role="alert">
          <strong>API connection problem:</strong> {apiError}
          <span> Check that the CareRoute backend server is running on port 4000.</span>
        </div>
      )}

      {/* Patient Search Workflow & Filters */}
      <section className="search-panel" role="search" aria-label="Hospital search and filters">
        {/* Quick care selection category chips */}
        <div className="quick-category-section">
          <span className="quick-category-title">Emergency care requirement:</span>
          <div className="quick-category-chips" role="group" aria-label="Quick care categories">
            {QUICK_CARE_CATEGORIES.map((cat) => {
              const isActive =
                (cat.id === 'all' && service === 'all' && bedType === 'all') ||
                (cat.serviceMatch && service === cat.serviceMatch) ||
                (cat.bedMatch && bedType === cat.bedMatch);
              return (
                <button
                  key={cat.id}
                  type="button"
                  className={`category-chip ${isActive ? 'category-chip-active' : ''}`}
                  onClick={() => {
                    if (cat.id === 'all') {
                      setService('all');
                      setBedType('all');
                    } else if (cat.serviceMatch) {
                      setService(cat.serviceMatch);
                      setBedType('all');
                    } else if (cat.bedMatch) {
                      setBedType(cat.bedMatch);
                      setService('all');
                    }
                  }}
                >
                  {cat.label}
                </button>
              );
            })}
          </div>
        </div>

        <div className="search-controls">
          <label className="search-field">
            <span>Search hospital, locality or capability</span>
            <div className="input-with-icon">
              <span aria-hidden="true">⌕</span>
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="e.g. Apollo, MGM GH, Trauma, ICU"
                aria-label="Search hospital, locality or capability"
              />
            </div>
          </label>
          <label>
            <span>City / Locality</span>
            <input
              value={city}
              onChange={(e) => setCity(e.target.value)}
              placeholder="Tiruchirappalli, Srirangam…"
              aria-label="Filter by locality"
            />
          </label>
          <label>
            <span>Required bed category</span>
            <select
              value={bedType}
              onChange={(e) => setBedType(e.target.value)}
              aria-label="Filter by required bed category"
            >
              <option value="all">Any bed category</option>
              {BED_DEFINITIONS.map((bed) => (
                <option key={bed.key} value={bed.key}>{bed.label}</option>
              ))}
            </select>
          </label>
          <label>
            <span>Clinical capability</span>
            <select
              value={service}
              onChange={(e) => setService(e.target.value)}
              aria-label="Filter by clinical capability"
            >
              <option value="all">Any capability</option>
              {SERVICE_OPTIONS.map((option) => (
                <option key={option} value={option}>{option}</option>
              ))}
            </select>
          </label>
        </div>

        <div className="search-footer">
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={availableOnly}
              onChange={(e) => setAvailableOnly(e.target.checked)}
            />
            <span>Only show facilities with confirmed available beds</span>
          </label>

          <div className="location-actions">
            {locationMessage && <span className="location-message" role="status">{locationMessage}</span>}
            <button
              type="button"
              className="button button-outline"
              onClick={locateMe}
              aria-label="Use browser location to calculate road travel distance"
            >
              {userLocation ? 'Location captured ✓' : '◎ Use my location'}
            </button>
            {(userLocation || query || city || service !== 'all' || bedType !== 'all' || availableOnly) && (
              <button
                type="button"
                className="button button-quiet clear-filters-btn"
                onClick={() => {
                  setQuery('');
                  setCity('');
                  setService('all');
                  setBedType('all');
                  setAvailableOnly(false);
                  setUserLocation(null);
                  setLocationMessage('Filters and location reset.');
                  setActiveRoute(null);
                  setDrivingTable({});
                }}
              >
                Reset filters
              </button>
            )}
          </div>
        </div>
      </section>

      {/* View Mode Switcher */}
      <div className="map-view-switcher" role="tablist" aria-label="Layout view mode">
        <button
          type="button"
          className={`view-switch-btn ${mapViewMode === 'both' ? 'active' : ''}`}
          onClick={() => setMapViewMode('both')}
          role="tab"
          aria-selected={mapViewMode === 'both'}
        >
          🗺️ Map & List
        </button>
        <button
          type="button"
          className={`view-switch-btn ${mapViewMode === 'list' ? 'active' : ''}`}
          onClick={() => setMapViewMode('list')}
          role="tab"
          aria-selected={mapViewMode === 'list'}
        >
          📋 List only
        </button>
        <button
          type="button"
          className={`view-switch-btn ${mapViewMode === 'map' ? 'active' : ''}`}
          onClick={() => setMapViewMode('map')}
          role="tab"
          aria-selected={mapViewMode === 'map'}
        >
          🗺️ Map only
        </button>
      </div>

      {/* Dual Column Layout: Hospital List & Interactive Leaflet Map */}
      <div className="finder-layout">
        {mapViewMode !== 'map' && (
          <div className="finder-list-column">
            <section className="results-section">
              <div className="results-intro">
                <div>
                  <span className="eyebrow">Matching facilities</span>
                  <h2>{userLocation ? 'Ranked by road travel time' : 'Verified facilities'}</h2>
                  <p className="muted">
                    {userLocation
                      ? 'Sorted by estimated OSRM driving duration when available, or straight-line distance. Road travel time is an estimate, not live traffic.'
                      : 'Turn on location to rank results by travel time, or select any facility on the map.'}
                  </p>
                </div>
                {/* Corrected availability aggregate summary */}
                <div className="result-total">
                  <strong className={summaryMeta.countDisplay === '—' ? 'text-muted' : ''}>
                    {summaryMeta.countDisplay}
                  </strong>
                  <span>{summaryMeta.labelDisplay}</span>
                </div>
              </div>

              {loading ? (
                <div className="loading-state"><span className="loader" />Fetching facility records…</div>
              ) : filteredHospitals.length === 0 ? (
                <div className="empty-state">
                  <div className="empty-icon">⌕</div>
                  <h3>No matching facilities</h3>
                  <p>Try another search, remove a filter, or turn off the confirmed available-bed-only option.</p>
                  <button
                    type="button"
                    className="button button-quiet"
                    onClick={() => {
                      setQuery('');
                      setCity('');
                      setService('all');
                      setBedType('all');
                      setAvailableOnly(false);
                    }}
                  >
                    Clear all filters
                  </button>
                </div>
              ) : (
                <div className="hospital-grid">
                  {filteredHospitals.map((hospital) => (
                    <HospitalCard
                      key={hospital.id}
                      hospital={hospital}
                      userLocation={userLocation}
                      selectedBed={bedType}
                      isSelected={selectedHospital?.id === hospital.id}
                      onSelect={handleSelectHospital}
                      drivingInfo={drivingTable[hospital.id]}
                    />
                  ))}
                </div>
              )}
            </section>
          </div>
        )}

        {mapViewMode !== 'list' && (
          <div className="finder-map-column">
            <HospitalMap
              hospitals={filteredHospitals}
              selectedHospital={selectedHospital}
              onSelectHospital={handleSelectHospital}
              userLocation={userLocation}
              activeRoute={activeRoute}
              routingBusy={routingBusy}
              onClearRoute={handleClearRoute}
              selectedBed={bedType}
            />
          </div>
        )}
      </div>

      <section className="method-note">
        <div className="method-symbol">i</div>
        <div>
          <strong>Open-source map and road travel methodology</strong>
          <p>
            CareRoute displays map tiles using OpenStreetMap contributors data and calculates driving route paths, distances, and duration estimates via Project OSRM. Driving travel times are modeled estimates based on road networks and speed limits, not live traffic dispatch. Where road routing is unavailable, approximate straight-line distance is computed using the Haversine formula and explicitly labeled.
          </p>
        </div>
      </section>
    </main>
  );
}

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

  const [locationBusy, setLocationBusy] = useState(false);

  function locateMe() {
    setLocationMessage('');
    if (!navigator.geolocation) {
      setLocationMessage('Geolocation is not supported by this browser.');
      return;
    }
    setLocationBusy(true);
    setLocationMessage('Requesting device location…');
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setUserLocation({ latitude: position.coords.latitude, longitude: position.coords.longitude });
        setLocationMessage('Location captured in this browser.');
        setLocationBusy(false);
      },
      (error) => {
        setLocationBusy(false);
        if (error.code === 1) {
          setLocationMessage('Location permission was denied. You can still search manually.');
        } else if (error.code === 2) {
          setLocationMessage('Device location is unavailable. Check your device settings.');
        } else if (error.code === 3) {
          setLocationMessage('Location request timed out. Please try again.');
        } else {
          setLocationMessage('Could not determine your location. Try again or search manually.');
        }
      },
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
      {/* 1. Header & Compact Safety Notice */}
      <header className="finder-page-header">
        <div className="finder-title-area">
          <span className="finder-kicker">District Hospital Directory & Live Route Guidance</span>
          <h1 className="finder-heading">Find Emergency Hospitals</h1>
          <p className="finder-subtext">
            Search verified acute care facilities, emergency trauma centers, and clinical bed availability across Tiruchirappalli district.
          </p>
        </div>

        <div className="finder-safety-banner" role="note">
          <span className="safety-icon" aria-hidden="true">⚠️</span>
          <div className="safety-text">
            <strong>Staff-reported capacity:</strong> Availability is updated by hospital staff and requires direct confirmation before travel. In an acute life threat, dial <strong>112</strong> or <strong>108</strong> immediately.
          </div>
        </div>
      </header>

      {apiError && (
        <div className="error-box api-error" role="alert">
          <strong>API connection problem:</strong> {apiError}
          <span> Check that the CareRoute backend server is running on port 4000.</span>
        </div>
      )}

      {/* 2. Deliberate Search & Filter Toolbar */}
      <section className="finder-toolbar" role="search" aria-label="Hospital search and filters">
        {/* Toolbar Row 1: Wide Hospital / Locality / Capability Search */}
        <div className="finder-search-row">
          <div className="finder-search-input-wrap">
            <span className="finder-search-icon" aria-hidden="true">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="8" />
                <path d="m21 21-4.3-4.3" />
              </svg>
            </span>
            <input
              type="search"
              className="finder-main-search-input"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search hospital by name, locality or medical capability (e.g. MGM GH, Apollo, ICU, Trauma)..."
              aria-label="Search hospital by name, locality or capability"
            />
            {query && (
              <button
                type="button"
                className="finder-clear-btn"
                onClick={() => setQuery('')}
                aria-label="Clear search input"
              >
                ✕
              </button>
            )}
          </div>

          <div className="finder-toolbar-actions">
            <button
              type="button"
              className={`button ${userLocation ? 'button-primary' : 'button-outline'} finder-locate-btn`}
              onClick={locateMe}
              disabled={locationBusy}
              aria-label="Use browser location to calculate road travel distance"
            >
              {locationBusy ? 'Locating…' : userLocation ? '✓ Location Active' : '📍 Use My Location'}
            </button>
            {(userLocation || query || city || service !== 'all' || bedType !== 'all' || availableOnly) && (
              <button
                type="button"
                className="button button-quiet finder-reset-btn"
                onClick={() => {
                  setQuery('');
                  setCity('');
                  setService('all');
                  setBedType('all');
                  setAvailableOnly(false);
                  setUserLocation(null);
                  setLocationMessage('');
                  setActiveRoute(null);
                  setDrivingTable({});
                }}
              >
                Reset filters
              </button>
            )}
          </div>
        </div>

        {locationMessage && (
          <div className="finder-location-feedback" role="status">
            {locationMessage}
          </div>
        )}

        {/* Toolbar Row 2: Aligned Filter Controls Grid */}
        <div className="finder-filter-grid">
          <div className="finder-filter-field">
            <label htmlFor="finder-filter-city">City / Locality</label>
            <input
              id="finder-filter-city"
              value={city}
              onChange={(e) => setCity(e.target.value)}
              placeholder="All localities (e.g. Srirangam, Thillai Nagar)..."
              aria-label="Filter by locality"
            />
          </div>

          <div className="finder-filter-field">
            <label htmlFor="finder-filter-bed">Required Bed Category</label>
            <select
              id="finder-filter-bed"
              value={bedType}
              onChange={(e) => setBedType(e.target.value)}
              aria-label="Filter by required bed category"
            >
              <option value="all">Any bed category</option>
              {BED_DEFINITIONS.map((bed) => (
                <option key={bed.key} value={bed.key}>{bed.label}</option>
              ))}
            </select>
          </div>

          <div className="finder-filter-field">
            <label htmlFor="finder-filter-service">Clinical Capability</label>
            <select
              id="finder-filter-service"
              value={service}
              onChange={(e) => setService(e.target.value)}
              aria-label="Filter by clinical capability"
            >
              <option value="all">Any clinical capability</option>
              {SERVICE_OPTIONS.map((option) => (
                <option key={option} value={option}>{option}</option>
              ))}
            </select>
          </div>

          <div className="finder-filter-field finder-filter-toggle">
            <label className="checkbox-label" htmlFor="finder-available-only">
              <input
                id="finder-available-only"
                type="checkbox"
                checked={availableOnly}
                onChange={(e) => setAvailableOnly(e.target.checked)}
              />
              <span>Only confirmed available beds</span>
            </label>
          </div>
        </div>

        {/* Toolbar Row 3: Emergency Care Quick Filters */}
        <div className="finder-quick-filters">
          <span className="quick-filter-heading">Emergency need:</span>
          <div className="quick-filter-chips" role="group" aria-label="Quick care category filters">
            {QUICK_CARE_CATEGORIES.map((cat) => {
              const isActive =
                (cat.id === 'all' && service === 'all' && bedType === 'all') ||
                (cat.serviceMatch && service === cat.serviceMatch) ||
                (cat.bedMatch && bedType === cat.bedMatch);
              return (
                <button
                  key={cat.id}
                  type="button"
                  className={`quick-chip ${isActive ? 'quick-chip-active' : ''}`}
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
      </section>

      {/* 3. View Mode Switcher (Map & List, List only, Map only) */}
      <div className="finder-view-mode-bar" role="tablist" aria-label="Layout view mode">
        <button
          type="button"
          className={`view-mode-btn ${mapViewMode === 'both' ? 'active' : ''}`}
          onClick={() => setMapViewMode('both')}
          role="tab"
          aria-selected={mapViewMode === 'both'}
        >
          🗺️ Map & List
        </button>
        <button
          type="button"
          className={`view-mode-btn ${mapViewMode === 'list' ? 'active' : ''}`}
          onClick={() => setMapViewMode('list')}
          role="tab"
          aria-selected={mapViewMode === 'list'}
        >
          📋 List only
        </button>
        <button
          type="button"
          className={`view-mode-btn ${mapViewMode === 'map' ? 'active' : ''}`}
          onClick={() => setMapViewMode('map')}
          role="tab"
          aria-selected={mapViewMode === 'map'}
        >
          🗺️ Map only
        </button>
      </div>

      {/* 4. Results-and-Map Workspace (44% Results / 56% Map on Desktop) */}
      <div className={`finder-workspace view-mode-${mapViewMode}`}>
        {mapViewMode !== 'map' && (
          <div className="finder-results-pane">
            <div className="results-pane-header">
              <div className="results-header-left">
                <span className="results-count-pill">
                  {filteredHospitals.length} {filteredHospitals.length === 1 ? 'facility' : 'facilities'} found
                </span>
                <span className="results-sorting-label">
                  {userLocation ? '• Sorted by road travel duration' : '• Sorted by availability'}
                </span>
              </div>
              <div className="results-header-right">
                <span className={`results-summary-badge ${summaryMeta.countDisplay === '—' ? 'muted' : ''}`}>
                  <strong>{summaryMeta.countDisplay}</strong> {summaryMeta.labelDisplay}
                </span>
              </div>
            </div>

            <div className="results-scroll-container">
              {loading ? (
                <div className="finder-loading-state">
                  <span className="loader" /> Fetching hospital records…
                </div>
              ) : filteredHospitals.length === 0 ? (
                <div className="finder-empty-state">
                  <div className="empty-state-icon">⌕</div>
                  <h3>No matching facilities found</h3>
                  <p>Try clearing filters or search terms to see all district hospitals.</p>
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
                <div className="results-card-list">
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
            </div>
          </div>
        )}

        {mapViewMode !== 'list' && (
          <div className="finder-map-pane">
            <HospitalMap
              hospitals={filteredHospitals}
              selectedHospital={selectedHospital}
              onSelectHospital={handleSelectHospital}
              userLocation={userLocation}
              activeRoute={activeRoute}
              routingBusy={routingBusy}
              onClearRoute={handleClearRoute}
              selectedBed={bedType}
              mapViewMode={mapViewMode}
              onLocateMe={locateMe}
              locationMessage={locationMessage}
              locationBusy={locationBusy}
            />
          </div>
        )}
      </div>

      {/* 5. Methodology Note */}
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

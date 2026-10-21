import { distanceKm } from '../utils/distance.js';
import { MAP_CONFIG } from './mapConfig.js';

export function isValidCoordinate(point) {
  if (!point || typeof point !== 'object') return false;
  const lat = Number(point.latitude);
  const lng = Number(point.longitude);
  return (
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    lat >= -90 &&
    lat <= 90 &&
    lng >= -180 &&
    lng <= 180
  );
}

export function formatDuration(seconds) {
  if (!Number.isFinite(seconds) || seconds < 0) return null;
  if (seconds < 60) return '< 1 min';
  const mins = Math.round(seconds / 60);
  if (mins === 1) return '1 min';
  if (mins < 60) return `${mins} mins`;
  const hrs = Math.floor(mins / 60);
  const remainingMins = mins % 60;
  if (remainingMins === 0) return `${hrs} hr`;
  if (remainingMins === 1) return `${hrs} hr 1 min`;
  return `${hrs} hr ${remainingMins} mins`;
}

export function formatDistanceKm(km) {
  if (!Number.isFinite(km) || km < 0) return null;
  return `${Number(km).toFixed(1)} km`;
}

/**
 * Fetches an OSRM road route between origin and destination.
 * 
 * @param {{ latitude: number, longitude: number }} origin
 * @param {{ latitude: number, longitude: number }} destination
 * @param {{ timeoutMs?: number, fetchFn?: Function, baseUrl?: string }} [options]
 * @returns {Promise<Object>}
 */
export async function fetchRoadRoute(origin, destination, options = {}) {
  const {
    timeoutMs = 8000,
    fetchFn = fetch,
    baseUrl = MAP_CONFIG.osrmBaseUrl,
  } = options;

  if (!isValidCoordinate(origin) || !isValidCoordinate(destination)) {
    return {
      routeFound: false,
      error: 'Cannot calculate route: Invalid or missing coordinates.',
      isFallback: true,
      straightLineDistanceKm: distanceKm(origin, destination),
    };
  }

  const originLng = Number(origin.longitude).toFixed(6);
  const originLat = Number(origin.latitude).toFixed(6);
  const destLng = Number(destination.longitude).toFixed(6);
  const destLat = Number(destination.latitude).toFixed(6);

  const url = `${baseUrl}/route/v1/driving/${originLng},${originLat};${destLng},${destLat}?overview=full&geometries=geojson`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetchFn(url, { signal: controller.signal });
    clearTimeout(timer);

    if (!res.ok) {
      return {
        routeFound: false,
        error: `Road routing service responded with status ${res.status}. Displaying approximate straight-line distance.`,
        isFallback: true,
        straightLineDistanceKm: distanceKm(origin, destination),
      };
    }

    const data = await res.json();
    if (data.code !== 'Ok' || !Array.isArray(data.routes) || data.routes.length === 0) {
      return {
        routeFound: false,
        error: 'No road route found between these locations. Displaying approximate straight-line distance.',
        isFallback: true,
        straightLineDistanceKm: distanceKm(origin, destination),
      };
    }

    const primaryRoute = data.routes[0];
    const rawCoords = primaryRoute.geometry?.coordinates || [];

    // OSRM GeoJSON gives [longitude, latitude]. Leaflet requires [latitude, longitude].
    const coordinates = rawCoords.map(([lng, lat]) => [lat, lng]);

    const distanceMeters = primaryRoute.distance;
    const distanceKilometers = Number((distanceMeters / 1000).toFixed(1));
    const durationSeconds = Math.round(primaryRoute.duration);
    const durationMinutes = Math.max(1, Math.round(durationSeconds / 60));

    return {
      routeFound: true,
      coordinates,
      distanceMeters,
      distanceKm: distanceKilometers,
      durationSeconds,
      durationMinutes,
      formattedDuration: formatDuration(durationSeconds),
      formattedDistance: formatDistanceKm(distanceKilometers),
      summary: primaryRoute.legs?.[0]?.summary || '',
      isEstimated: true,
      estimateDisclaimer: 'Estimated road driving time (OSRM model, no live traffic)',
    };
  } catch (err) {
    clearTimeout(timer);
    const isTimeout = err.name === 'AbortError';
    return {
      routeFound: false,
      error: isTimeout
        ? 'Road routing request timed out. Displaying approximate straight-line distance.'
        : `Road routing unavailable: ${err.message}. Displaying approximate straight-line distance.`,
      isFallback: true,
      straightLineDistanceKm: distanceKm(origin, destination),
    };
  }
}

/**
 * Fetches driving duration table from origin to multiple destinations.
 * Used to rank hospitals by road driving time where available.
 * 
 * @param {{ latitude: number, longitude: number }} origin
 * @param {Array<{ id: string, latitude: number, longitude: number }>} destinations
 * @param {{ timeoutMs?: number, fetchFn?: Function, baseUrl?: string }} [options]
 * @returns {Promise<{ success: boolean, results: Record<string, { durationSeconds: number, durationMinutes: number, distanceMeters?: number }> }>}
 */
export async function fetchDrivingTable(origin, destinations = [], options = {}) {
  const {
    timeoutMs = 6000,
    fetchFn = fetch,
    baseUrl = MAP_CONFIG.osrmBaseUrl,
  } = options;

  if (!isValidCoordinate(origin) || !Array.isArray(destinations) || destinations.length === 0) {
    return { success: false, results: {} };
  }

  const validDests = destinations.filter((d) => isValidCoordinate(d));
  if (validDests.length === 0) {
    return { success: false, results: {} };
  }

  // Construct coordinates query: origin;dest1;dest2;...
  const allPoints = [origin, ...validDests];
  const coordsStr = allPoints
    .map((p) => `${Number(p.longitude).toFixed(6)},${Number(p.latitude).toFixed(6)}`)
    .join(';');

  // source index: 0, destination indices: 1, 2, ..., N
  const destIndices = validDests.map((_, idx) => idx + 1).join(';');
  const url = `${baseUrl}/table/v1/driving/${coordsStr}?sources=0&destinations=${destIndices}&annotations=duration,distance`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetchFn(url, { signal: controller.signal });
    clearTimeout(timer);

    if (!res.ok) {
      return { success: false, results: {} };
    }

    const data = await res.json();
    if (data.code !== 'Ok' || !Array.isArray(data.durations) || !data.durations[0]) {
      return { success: false, results: {} };
    }

    const durationsRow = data.durations[0];
    const distancesRow = data.distances ? data.distances[0] : [];
    const results = {};

    validDests.forEach((dest, idx) => {
      const durationSec = durationsRow[idx];
      const distanceMet = distancesRow[idx];
      if (Number.isFinite(durationSec)) {
        results[dest.id] = {
          durationSeconds: Math.round(durationSec),
          durationMinutes: Math.max(1, Math.round(durationSec / 60)),
          distanceMeters: Number.isFinite(distanceMet) ? Math.round(distanceMet) : null,
          distanceKm: Number.isFinite(distanceMet) ? Number((distanceMet / 1000).toFixed(1)) : null,
          formattedDuration: formatDuration(durationSec),
          isEstimated: true,
        };
      }
    });

    return { success: true, results };
  } catch (_err) {
    clearTimeout(timer);
    return { success: false, results: {} };
  }
}

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  isValidCoordinate,
  formatDuration,
  formatDistanceKm,
  fetchRoadRoute,
  fetchDrivingTable,
} from './routing.js';

test('isValidCoordinate validation rules', () => {
  assert.equal(isValidCoordinate(null), false);
  assert.equal(isValidCoordinate({}), false);
  assert.equal(isValidCoordinate({ latitude: 'abc', longitude: 78.6 }), false);
  assert.equal(isValidCoordinate({ latitude: 91, longitude: 78.6 }), false);
  assert.equal(isValidCoordinate({ latitude: 10.8, longitude: 181 }), false);
  assert.equal(isValidCoordinate({ latitude: 10.8125, longitude: 78.6856 }), true);
  assert.equal(isValidCoordinate({ latitude: '10.8125', longitude: '78.6856' }), true);
});

test('formatDuration and formatDistanceKm helpers', () => {
  assert.equal(formatDuration(30), '< 1 min');
  assert.equal(formatDuration(75), '1 min');
  assert.equal(formatDuration(120), '2 mins');
  assert.equal(formatDuration(1800), '30 mins');
  assert.equal(formatDuration(3600), '1 hr');
  assert.equal(formatDuration(3660), '1 hr 1 min');
  assert.equal(formatDuration(3900), '1 hr 5 mins');
  assert.equal(formatDuration(null), null);

  assert.equal(formatDistanceKm(0.4), '0.4 km');
  assert.equal(formatDistanceKm(12.34), '12.3 km');
  assert.equal(formatDistanceKm(null), null);
});

test('fetchRoadRoute handles missing or invalid coordinates', async () => {
  const result = await fetchRoadRoute(null, { latitude: 10.8, longitude: 78.6 });
  assert.equal(result.routeFound, false);
  assert.ok(result.error.includes('Invalid or missing coordinates'));
  assert.equal(result.coordinates, undefined);
  assert.equal(result.distanceMeters, undefined);
});

test('fetchRoadRoute parses valid OSRM response correctly', async () => {
  const mockGeoJsonCoords = [
    [78.6856, 10.8125], // [lng, lat]
    [78.6890, 10.8150],
    [78.6942, 10.8625],
  ];

  const mockResponse = {
    code: 'Ok',
    routes: [
      {
        geometry: {
          coordinates: mockGeoJsonCoords,
        },
        distance: 6420.5,
        duration: 840,
        legs: [{ summary: 'Gandhi Road' }],
      },
    ],
  };

  const mockFetch = async () => ({
    ok: true,
    status: 200,
    json: async () => mockResponse,
  });

  const origin = { latitude: 10.8125, longitude: 78.6856 };
  const destination = { latitude: 10.8625, longitude: 78.6942 };

  const result = await fetchRoadRoute(origin, destination, { fetchFn: mockFetch });

  assert.equal(result.routeFound, true);
  assert.equal(result.distanceMeters, 6420.5);
  assert.equal(result.distanceKm, 6.4);
  assert.equal(result.durationSeconds, 840);
  assert.equal(result.durationMinutes, 14);
  assert.equal(result.isEstimated, true);
  assert.ok(result.estimateDisclaimer.includes('no live traffic'));

  // Leaflet requires [latitude, longitude]
  assert.deepEqual(result.coordinates, [
    [10.8125, 78.6856],
    [10.8150, 78.6890],
    [10.8625, 78.6942],
  ]);
});

test('fetchRoadRoute handles OSRM no-route code gracefully', async () => {
  const mockResponse = {
    code: 'NoRoute',
    message: 'Impossible route between coordinates',
    routes: [],
  };

  const mockFetch = async () => ({
    ok: true,
    status: 200,
    json: async () => mockResponse,
  });

  const origin = { latitude: 10.8125, longitude: 78.6856 };
  const destination = { latitude: 10.8625, longitude: 78.6942 };

  const result = await fetchRoadRoute(origin, destination, { fetchFn: mockFetch });

  assert.equal(result.routeFound, false);
  assert.ok(result.error.includes('No road route found'));
  assert.equal(result.isFallback, true);
  // Haversine fallback should be populated
  assert.ok(result.straightLineDistanceKm > 0);
  // Road distance must NOT be fabricated
  assert.equal(result.distanceKm, undefined);
  assert.equal(result.durationMinutes, undefined);
});

test('fetchRoadRoute handles HTTP error status without fabricating estimates', async () => {
  const mockFetch = async () => ({
    ok: false,
    status: 503,
    statusText: 'Service Unavailable',
  });

  const origin = { latitude: 10.8125, longitude: 78.6856 };
  const destination = { latitude: 10.8625, longitude: 78.6942 };

  const result = await fetchRoadRoute(origin, destination, { fetchFn: mockFetch });

  assert.equal(result.routeFound, false);
  assert.ok(result.error.includes('status 503'));
  assert.equal(result.isFallback, true);
  assert.equal(result.distanceKm, undefined);
  assert.equal(result.durationMinutes, undefined);
});

test('fetchRoadRoute handles request timeouts gracefully', async () => {
  const mockFetch = async () => {
    const error = new Error('The operation was aborted');
    error.name = 'AbortError';
    throw error;
  };

  const origin = { latitude: 10.8125, longitude: 78.6856 };
  const destination = { latitude: 10.8625, longitude: 78.6942 };

  const result = await fetchRoadRoute(origin, destination, { fetchFn: mockFetch });

  assert.equal(result.routeFound, false);
  assert.ok(result.error.includes('timed out'));
  assert.equal(result.isFallback, true);
});

test('fetchDrivingTable parses table matrix for hospital ranking', async () => {
  const mockResponse = {
    code: 'Ok',
    durations: [
      [360, 900, 1800], // from origin to [dest1, dest2, dest3]
    ],
    distances: [
      [2500, 7200, 15000],
    ],
  };

  const mockFetch = async () => ({
    ok: true,
    status: 200,
    json: async () => mockResponse,
  });

  const origin = { latitude: 10.8125, longitude: 78.6856 };
  const destinations = [
    { id: 'h1', latitude: 10.8012, longitude: 78.6924 },
    { id: 'h2', latitude: 10.8625, longitude: 78.6942 },
    { id: 'h3', latitude: 10.6083, longitude: 78.4167 },
  ];

  const table = await fetchDrivingTable(origin, destinations, { fetchFn: mockFetch });

  assert.equal(table.success, true);
  assert.equal(table.results.h1.durationMinutes, 6);
  assert.equal(table.results.h1.distanceKm, 2.5);
  assert.equal(table.results.h2.durationMinutes, 15);
  assert.equal(table.results.h2.distanceKm, 7.2);
  assert.equal(table.results.h3.durationMinutes, 30);
  assert.equal(table.results.h3.distanceKm, 15.0);
});

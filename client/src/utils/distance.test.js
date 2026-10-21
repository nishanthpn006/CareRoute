import test from 'node:test';
import assert from 'node:assert/strict';
import { distanceKm } from './distance.js';

test('distance between identical coordinates is zero', () => {
  assert.equal(distanceKm({ latitude: 13, longitude: 80 }, { latitude: 13, longitude: 80 }), 0);
});

test('distance is approximately symmetric', () => {
  const a = { latitude: 13.0827, longitude: 80.2707 };
  const b = { latitude: 12.9716, longitude: 80.2206 };
  assert.ok(Math.abs(distanceKm(a, b) - distanceKm(b, a)) < 0.000001);
  assert.ok(distanceKm(a, b) > 10 && distanceKm(a, b) < 20);
});

test('invalid coordinates return null instead of NaN', () => {
  assert.equal(distanceKm({ latitude: 'bad', longitude: 80 }, { latitude: 13, longitude: 80 }), null);
});

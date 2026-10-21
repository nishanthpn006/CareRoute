const EARTH_RADIUS_KM = 6371;

export function distanceKm(from, to) {
  if (!from || !to || !Number.isFinite(Number(from.latitude)) || !Number.isFinite(Number(from.longitude)) ||
      !Number.isFinite(Number(to.latitude)) || !Number.isFinite(Number(to.longitude))) return null;
  const radians = (degrees) => (degrees * Math.PI) / 180;
  const lat1 = radians(Number(from.latitude));
  const lat2 = radians(Number(to.latitude));
  const deltaLat = radians(Number(to.latitude) - Number(from.latitude));
  const deltaLon = radians(Number(to.longitude) - Number(from.longitude));
  const a = Math.sin(deltaLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(deltaLon / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(Math.min(1, a)));
}

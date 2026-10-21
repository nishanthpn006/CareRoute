/**
 * CareRoute — Map and OpenStreetMap / OSRM Configuration
 * 
 * Configurable base URLs for OpenStreetMap raster tiles and OSRM driving engine.
 * Free public endpoints are used as best-effort demo defaults.
 */

const env = (typeof import.meta !== 'undefined' && import.meta.env)
  ? import.meta.env
  : (typeof process !== 'undefined' ? process.env : {});

export const MAP_CONFIG = {
  // Tiruchirappalli (Trichy), Tamil Nadu center coordinates
  defaultCenter: [10.8125, 78.6856],
  defaultZoom: 12,
  tileUrl: env.VITE_OSM_TILE_URL || 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
  tileAttribution:
    '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a> contributors',
  osrmBaseUrl: (env.VITE_OSRM_BASE_URL || 'https://router.project-osrm.org').replace(/\/+$/, ''),
};

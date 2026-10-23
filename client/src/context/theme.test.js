import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
  THEME_STORAGE_KEY,
  DEFAULT_THEME,
  getStoredTheme,
  persistTheme,
} from './themeStorage.js';

// Resolve client directory whether tests are invoked from repo root or client directory
const CLIENT_DIR = fs.existsSync(path.resolve('client/index.html'))
  ? path.resolve('client')
  : path.resolve('.');

// Mock storage object for testing persistence
class MockStorage {
  constructor(initial = {}) {
    this.store = { ...initial };
    this.throwOnGet = false;
    this.throwOnSet = false;
  }

  getItem(key) {
    if (this.throwOnGet) {
      throw new Error('SecurityError: The operation is insecure (localStorage blocked)');
    }
    return Object.prototype.hasOwnProperty.call(this.store, key) ? this.store[key] : null;
  }

  setItem(key, value) {
    if (this.throwOnSet) {
      throw new Error('QuotaExceededError: Storage quota exceeded');
    }
    this.store[key] = String(value);
  }

  removeItem(key) {
    delete this.store[key];
  }

  clear() {
    this.store = {};
  }
}

test('Theme System — Default behavior when no preference is saved', () => {
  const emptyStorage = new MockStorage();
  const initialTheme = getStoredTheme(emptyStorage);

  assert.equal(initialTheme, DEFAULT_THEME);
  assert.equal(initialTheme, 'light');
});

test('Theme System — Switching from Light to Dark', () => {
  const storage = new MockStorage();

  // Initially empty -> light
  assert.equal(getStoredTheme(storage), 'light');

  // Switch to dark
  persistTheme('dark', storage);
  assert.equal(storage.getItem(THEME_STORAGE_KEY), 'dark');
  assert.equal(getStoredTheme(storage), 'dark');
});

test('Theme System — Switching from Dark back to Light', () => {
  const storage = new MockStorage({ [THEME_STORAGE_KEY]: 'dark' });

  // Initially dark
  assert.equal(getStoredTheme(storage), 'dark');

  // Switch back to light
  persistTheme('light', storage);
  assert.equal(storage.getItem(THEME_STORAGE_KEY), 'light');
  assert.equal(getStoredTheme(storage), 'light');
});

test('Theme System — Persistence across sessions and page reloads', () => {
  const simulatedBrowserStorage = new MockStorage();

  // User sets dark mode
  persistTheme('dark', simulatedBrowserStorage);

  // Simulate closing tab and reopening (new instance of context reading same storage)
  const reloadedTheme = getStoredTheme(simulatedBrowserStorage);
  assert.equal(reloadedTheme, 'dark');

  // User sets light mode
  persistTheme('light', simulatedBrowserStorage);
  const reloadedLight = getStoredTheme(simulatedBrowserStorage);
  assert.equal(reloadedLight, 'light');
});

test('Theme System — Safe handling of corrupted or unknown storage values', () => {
  const corruptedStorage = new MockStorage({ [THEME_STORAGE_KEY]: 'neon-cyberpunk' });
  // Unknown theme values must safely fall back to default light theme
  assert.equal(getStoredTheme(corruptedStorage), 'light');

  const emptyStringStorage = new MockStorage({ [THEME_STORAGE_KEY]: '' });
  assert.equal(getStoredTheme(emptyStringStorage), 'light');
});

test('Theme System — Graceful fallback on storage access failure (e.g. sandboxed iframe or private browsing)', () => {
  const failingStorage = new MockStorage();
  failingStorage.throwOnGet = true;
  failingStorage.throwOnSet = true;

  // getStoredTheme must not throw an exception when localStorage is inaccessible
  assert.doesNotThrow(() => {
    const fallbackTheme = getStoredTheme(failingStorage);
    assert.equal(fallbackTheme, 'light');
  });

  // persistTheme must not crash when writing fails
  assert.doesNotThrow(() => {
    persistTheme('dark', failingStorage);
  });

  // null storage parameter handled safely
  assert.doesNotThrow(() => {
    assert.equal(getStoredTheme(null), 'light');
    persistTheme('dark', null);
  });
});

test('Theme System — Pre-hydration script in index.html prevents theme flashing', () => {
  const indexPath = path.join(CLIENT_DIR, 'index.html');
  const htmlContent = fs.readFileSync(indexPath, 'utf-8');

  // Verify that an inline script exists in <head> before page rendering
  assert.ok(htmlContent.includes('<head>'), 'index.html contains <head>');
  assert.ok(
    htmlContent.includes("localStorage.getItem('careroute-theme')"),
    'index.html contains early theme detection script'
  );
  assert.ok(
    htmlContent.includes("document.documentElement.setAttribute('data-theme'"),
    'index.html applies data-theme attribute directly to root element'
  );
});

test('Theme System — Shared architecture across Public and Staff layouts', () => {
  const publicLayoutPath = path.join(CLIENT_DIR, 'src/layouts/PublicLayout.jsx');
  const staffLayoutPath = path.join(CLIENT_DIR, 'src/layouts/StaffLayout.jsx');
  const appPath = path.join(CLIENT_DIR, 'src/App.jsx');

  const publicContent = fs.readFileSync(publicLayoutPath, 'utf-8');
  const staffContent = fs.readFileSync(staffLayoutPath, 'utf-8');
  const appContent = fs.readFileSync(appPath, 'utf-8');

  // App must wrap entire routing hierarchy in single ThemeProvider
  assert.ok(appContent.includes('<ThemeProvider>'), 'App wraps all routes with ThemeProvider');

  // Public layout must feature ThemeToggle
  assert.ok(publicContent.includes('ThemeToggle'), 'PublicLayout mounts ThemeToggle');
  assert.ok(publicContent.includes('public-header-theme-toggle'), 'PublicLayout has header theme toggle');

  // Staff layout must feature ThemeToggle
  assert.ok(staffContent.includes('ThemeToggle'), 'StaffLayout mounts ThemeToggle');
  assert.ok(staffContent.includes('staff-sidebar-theme-toggle'), 'StaffLayout has sidebar theme toggle');
});

test('Theme System — CSS variable definitions for light and dark palettes', () => {
  const cssPath = path.join(CLIENT_DIR, 'src/styles.css');
  const cssContent = fs.readFileSync(cssPath, 'utf-8');

  // Verify light tokens in :root
  assert.ok(cssContent.includes('--bg: #f8fafc;'), ':root defines light background');
  assert.ok(cssContent.includes('--surface: #ffffff;'), ':root defines light surface');
  assert.ok(cssContent.includes('--ink: #0f172a;'), ':root defines light text ink');

  // Verify dark tokens in [data-theme="dark"]
  assert.ok(cssContent.includes('[data-theme="dark"]'), 'styles.css defines [data-theme="dark"] block');
  assert.ok(cssContent.includes('--bg: #111827;'), '[data-theme="dark"] defines clinical dark background #111827');
  assert.ok(cssContent.includes('--surface: #1f2937;'), '[data-theme="dark"] defines card surface #1f2937');
  assert.ok(cssContent.includes('--ink: #f1f5f9;'), '[data-theme="dark"] defines high-contrast text #f1f5f9');
  assert.ok(cssContent.includes('--line: #374151;'), '[data-theme="dark"] defines subtle border #374151');
  assert.ok(cssContent.includes('--teal: #2dd4bf;'), '[data-theme="dark"] defines accessible teal accent');
  assert.ok(cssContent.includes('--emergency-red: #f87171;'), '[data-theme="dark"] defines visible emergency coral/red');

  // Accessible contrast: dark mode inputs, modals, cards, and staff portal must respond
  assert.ok(cssContent.includes('[data-theme="dark"] .hospital-card'), 'Dark mode styles hospital card');
  assert.ok(cssContent.includes('[data-theme="dark"] .sos-modal-dialog'), 'Dark mode styles emergency SOS modal');
  assert.ok(cssContent.includes('[data-theme="dark"] .staff-workspace'), 'Dark mode styles staff portal workspace');
  assert.ok(cssContent.includes('[data-theme="dark"] .custom-map-popup'), 'Dark mode styles map popups');

  // Home Page dark mode surfaces and notice tokens
  assert.ok(cssContent.includes('[data-theme="dark"] .home-hero-card'), 'Home hero card has dark surface styling');
  assert.ok(cssContent.includes('[data-theme="dark"] .home-category-card'), 'Home emergency category cards have dark surface styling');
  assert.ok(cssContent.includes('--notice-warn-bg:'), 'CSS defines --notice-warn-bg token for prototype disclaimer');
  assert.ok(cssContent.includes('[data-theme="dark"] .demo-notice'), 'Dark mode styles prototype disclaimer with accessible contrast');
});

test('Theme System — All page surfaces have explicit dark mode rules', () => {
  const cssPath = path.join(CLIENT_DIR, 'src/styles.css');
  const cssContent = fs.readFileSync(cssPath, 'utf-8');

  // Staff Reports Workspace (/staff/reports?facilityId=...)
  assert.ok(cssContent.includes('[data-theme="dark"] .bed-workspace-surface'), 'Staff Reports workspace container is styled in dark mode');
  assert.ok(cssContent.includes('[data-theme="dark"] .bed-title-row h1'), 'Staff Reports heading is readable in dark mode');
  assert.ok(cssContent.includes('[data-theme="dark"] .bed-summary-tile'), 'Staff Reports 2x2 operational tiles are styled in dark mode');
  assert.ok(cssContent.includes('[data-theme="dark"] .ward-breakdown-row'), 'Staff Reports ward breakdown rows are styled in dark mode');
  assert.ok(cssContent.includes('[data-theme="dark"] .history-table'), 'Staff Reports audit history table is styled in dark mode');
  assert.ok(cssContent.includes('[data-theme="dark"] .bed-form-input'), 'Staff Reports capacity update inputs are styled in dark mode');
  assert.ok(cssContent.includes('[data-theme="dark"] .bed-submit-btn'), 'Staff Reports update button is styled in dark mode');

  // Emergency Assistance (/emergency)
  assert.ok(cssContent.includes('[data-theme="dark"] .emergency-hero-banner'), 'Emergency alert banner is themed in dark mode');
  assert.ok(cssContent.includes('[data-theme="dark"] .sos-test-card'), 'Emergency dev test card has accessible dark style');
  assert.ok(cssContent.includes('[data-theme="dark"] .sos-dial-highlight'), 'Keypad numbers highlight is readable in dark mode');
  assert.ok(cssContent.includes('[data-theme="dark"] .helpline-card'), 'Healthcare helpline cards are themed in dark mode');
  assert.ok(cssContent.includes('[data-theme="dark"] .emergency-desktop-box'), 'Desktop browser dialer notice is themed in dark mode');

  // Public Find Hospitals (/find-hospitals)
  assert.ok(cssContent.includes('[data-theme="dark"] .card-bed-availability'), 'Find Hospitals bed availability panel is themed in dark mode');
  assert.ok(cssContent.includes('[data-theme="dark"] .bed-section-title'), 'Find Hospitals bed section title has readable contrast');
  assert.ok(cssContent.includes('[data-theme="dark"] .popup-card'), 'Leaflet map popup card has dark theme styling');
  assert.ok(cssContent.includes('[data-theme="dark"] .popup-status.open'), 'Map popup status tags use accessible dark tokens');

  // Hospital Details (/hospitals/:facilityId)
  assert.ok(cssContent.includes('[data-theme="dark"] .detail-header-card'), 'Hospital Details header card is themed in dark mode');
  assert.ok(cssContent.includes('[data-theme="dark"] .detail-breadcrumb'), 'Breadcrumb navigation is readable in dark mode');
  assert.ok(cssContent.includes('[data-theme="dark"] .detail-aggregate-banner'), 'Capacity summary banner is themed in dark mode');
  assert.ok(cssContent.includes('[data-theme="dark"] .detail-service-item'), 'Clinical service chips are themed in dark mode');
});



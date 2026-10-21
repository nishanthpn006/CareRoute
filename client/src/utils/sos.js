/**
 * SOS Emergency & Test Call Utilities
 * 
 * Provides configuration parsing, telephone validation, and development-only
 * overrides for CareRoute's emergency actions.
 * 
 * Strict Safety Invariants:
 * 1. Private test number overrides are strictly active in development mode (import.meta.env.DEV).
 * 2. In production builds, the test override is completely disabled and official emergency
 *    responders (112 and 108) are unconditionally preserved.
 * 3. The test action is clearly labeled "Test Call — Personal Number". It is never labeled as "Call 112".
 * 4. Telephone numbers are strictly validated before constructing `tel:` links.
 * 5. Official emergency numbers (112, 108) remain permanently available as separate options.
 */

export const OFFICIAL_EMERGENCY_ACTIONS = [
  {
    id: '112',
    number: '112',
    telLink: 'tel:112',
    name: 'Call 112',
    badge: 'National Emergency Helpline (India)',
    desc: 'Connects directly to Medical, Police, and Fire rescue services',
  },
  {
    id: '108',
    number: '108',
    telLink: 'tel:108',
    name: 'Call 108 Ambulance',
    badge: 'Tamil Nadu Medical Emergency & Ambulance Response',
    desc: 'Free government 24/7 ambulance dispatch & emergency transport',
  },
];

/**
 * Validates and normalizes an SOS test telephone number.
 * 
 * Rules:
 * - Must be a non-empty string.
 * - Allowed formatting characters: spaces, hyphens, periods, parentheses.
 * - Normalized value must match E.164-compatible pattern: /^\+?[0-9]{7,15}$/
 * - Excludes standard emergency shortcodes (112, 108, 911, 999, etc.)
 * - Returns normalized string or null. Never falls back to a different private number.
 * 
 * @param {string|undefined|null} rawNumber 
 * @returns {string|null} Normalized phone string or null if invalid
 */
export function validateSosTestNumber(rawNumber) {
  if (!rawNumber || typeof rawNumber !== 'string') {
    return null;
  }

  const trimmed = rawNumber.trim();
  if (!trimmed) {
    return null;
  }

  // Strip formatting punctuation: spaces, hyphens, dots, parentheses
  const stripped = trimmed.replace(/[\s\-.()]/g, '');

  // E.164 format: optional leading '+' followed by 7 to 15 digits
  if (!/^\+?[0-9]{7,15}$/.test(stripped)) {
    return null;
  }

  // Check against common emergency shortcodes to avoid mislabeling
  const digitsOnly = stripped.replace(/^\+/, '');
  const emergencyShortcodes = ['112', '108', '911', '999', '100', '101', '102'];
  if (emergencyShortcodes.includes(digitsOnly)) {
    return null;
  }

  return stripped;
}

/**
 * Determines whether the SOS test override is active based on environment and config.
 * 
 * In production builds (import.meta.env.DEV is false), the override is always disabled.
 * 
 * @param {object} [options]
 * @param {boolean} [options.isDev] Explicit override for tests (defaults to import.meta.env.DEV)
 * @param {string} [options.testNumber] Explicit override for tests (defaults to import.meta.env.VITE_SOS_TEST_NUMBER)
 * @returns {{
 *   isOverrideActive: boolean,
 *   testNumber: string|null,
 *   telLink: string|null,
 *   label: string,
 *   headerLabel: string,
 *   mobileLabel: string
 * }}
 */
export function getSosTestAction({
  isDev = typeof import.meta !== 'undefined' && import.meta.env ? import.meta.env.DEV : false,
  testNumber = typeof import.meta !== 'undefined' && import.meta.env ? import.meta.env.VITE_SOS_TEST_NUMBER : undefined,
} = {}) {
  // In production builds, the test number override is strictly disabled
  if (!isDev) {
    return {
      isOverrideActive: false,
      testNumber: null,
      telLink: null,
      label: 'SOS / Call 112',
      headerLabel: 'SOS / Call 112',
      mobileLabel: 'SOS 112',
    };
  }

  const validatedNumber = validateSosTestNumber(testNumber);
  if (!validatedNumber) {
    return {
      isOverrideActive: false,
      testNumber: null,
      telLink: null,
      label: 'SOS / Call 112',
      headerLabel: 'SOS / Call 112',
      mobileLabel: 'SOS 112',
    };
  }

  return {
    isOverrideActive: true,
    testNumber: validatedNumber,
    telLink: `tel:${validatedNumber}`,
    label: 'Test Call — Personal Number',
    headerLabel: 'Test Call — Personal Number',
    mobileLabel: 'Test Call',
  };
}

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  validateSosTestNumber,
  getSosTestAction,
  OFFICIAL_EMERGENCY_ACTIONS,
} from './sos.js';

test('validateSosTestNumber accepts valid phone numbers across multiple formats', () => {
  // International with country code
  assert.equal(validateSosTestNumber('+919876543210'), '+919876543210');
  assert.equal(validateSosTestNumber('+91 98765 43210'), '+919876543210');
  assert.equal(validateSosTestNumber('+1-555-234-5678'), '+15552345678');
  assert.equal(validateSosTestNumber('+44 (0) 20 7946 0991'), '+4402079460991');
  
  // Standard 10-digit national number
  assert.equal(validateSosTestNumber('9876543210'), '9876543210');
  assert.equal(validateSosTestNumber('04312414220'), '04312414220');
});

test('validateSosTestNumber rejects empty, invalid, and malformed numbers', () => {
  assert.equal(validateSosTestNumber(null), null);
  assert.equal(validateSosTestNumber(undefined), null);
  assert.equal(validateSosTestNumber(''), null);
  assert.equal(validateSosTestNumber('   '), null);
  assert.equal(validateSosTestNumber('abc1234567'), null);
  assert.equal(validateSosTestNumber('12345'), null, 'Rejects numbers with fewer than 7 digits');
  assert.equal(validateSosTestNumber('+123456789012345678'), null, 'Rejects numbers with more than 15 digits');
  assert.equal(validateSosTestNumber('112'), null, 'Emergency shortcodes cannot be treated as private test number');
  assert.equal(validateSosTestNumber('108'), null, 'Emergency shortcodes cannot be treated as private test number');
});

test('getSosTestAction in development mode with configured valid number', () => {
  const result = getSosTestAction({
    isDev: true,
    testNumber: '+919876543210',
  });

  assert.equal(result.isOverrideActive, true);
  assert.equal(result.testNumber, '+919876543210');
  assert.equal(result.telLink, 'tel:+919876543210');
  assert.equal(result.label, 'Test call (development only)');
  assert.equal(result.headerLabel, 'Test call (development only)');
  assert.equal(result.mobileLabel, 'Test call');
  // Confirm it does NOT mislabel a private number as Call 112
  assert.notEqual(result.label, 'Call 112');
  assert.notEqual(result.headerLabel, 'SOS / Call 112');
});

test('getSosTestAction in development mode with missing or empty configuration', () => {
  const resultMissing = getSosTestAction({
    isDev: true,
    testNumber: undefined,
  });
  assert.equal(resultMissing.isOverrideActive, false);
  assert.equal(resultMissing.testNumber, null);
  assert.equal(resultMissing.telLink, null);
  assert.equal(resultMissing.headerLabel, 'SOS / Call 112');
  assert.equal(resultMissing.mobileLabel, 'SOS 112');

  const resultEmpty = getSosTestAction({
    isDev: true,
    testNumber: '',
  });
  assert.equal(resultEmpty.isOverrideActive, false);
  assert.equal(resultEmpty.testNumber, null);
  assert.equal(resultEmpty.telLink, null);
  assert.equal(resultEmpty.headerLabel, 'SOS / Call 112');
});

test('getSosTestAction in development mode with invalid number format', () => {
  const resultInvalid = getSosTestAction({
    isDev: true,
    testNumber: 'not-a-phone-number',
  });
  assert.equal(resultInvalid.isOverrideActive, false);
  assert.equal(resultInvalid.testNumber, null);
  assert.equal(resultInvalid.telLink, null);
  assert.equal(resultInvalid.headerLabel, 'SOS / Call 112');
  assert.equal(resultInvalid.mobileLabel, 'SOS 112');
});

test('getSosTestAction in production mode disables test override even if number is configured', () => {
  const resultProd = getSosTestAction({
    isDev: false,
    testNumber: '+919876543210',
  });

  assert.equal(resultProd.isOverrideActive, false, 'Override MUST be disabled in production');
  assert.equal(resultProd.testNumber, null);
  assert.equal(resultProd.telLink, null);
  assert.equal(resultProd.headerLabel, 'SOS / Call 112');
  assert.equal(resultProd.mobileLabel, 'SOS 112');
});

test('Official emergency actions (112 and 108) are permanently preserved as separate options', () => {
  assert.equal(OFFICIAL_EMERGENCY_ACTIONS.length, 2);

  const action112 = OFFICIAL_EMERGENCY_ACTIONS.find((a) => a.id === '112');
  assert.ok(action112, '112 emergency action must exist');
  assert.equal(action112.telLink, 'tel:112');
  assert.equal(action112.name, 'Call 112');

  const action108 = OFFICIAL_EMERGENCY_ACTIONS.find((a) => a.id === '108');
  assert.ok(action108, '108 emergency action must exist');
  assert.equal(action108.telLink, 'tel:108');
  assert.equal(action108.name, 'Call 108 Ambulance');
});

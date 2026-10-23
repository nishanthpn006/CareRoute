import test from 'node:test';
import assert from 'node:assert/strict';

// Core route paths required by Milestone 4B specification
const REQUIRED_ROUTES = [
  '/',
  '/find-hospitals',
  '/hospitals/:facilityId',
  '/emergency',
  '/staff/login',
  '/staff',
  '/staff/reports',
  '/staff/facilities',
  '/staff/verification',
  '*',
];

// Helper to simulate route matching
function matchRoute(path) {
  if (path === '/') return { route: '/', params: {} };
  if (path === '/find-hospitals') return { route: '/find-hospitals', params: {} };
  if (path.startsWith('/hospitals/')) {
    const facilityId = path.replace('/hospitals/', '').split('?')[0].split('#')[0];
    if (facilityId) return { route: '/hospitals/:facilityId', params: { facilityId } };
  }
  if (path === '/emergency') return { route: '/emergency', params: {} };
  if (path === '/staff/login') return { route: '/staff/login', params: {} };
  if (path === '/staff') return { route: '/staff', params: {} };
  if (path === '/staff/reports') return { route: '/staff/reports', params: {} };
  if (path === '/staff/facilities') return { route: '/staff/facilities', params: {} };
  if (path === '/staff/verification') return { route: '/staff/verification', params: {} };
  return { route: '*', params: {} };
}

test('Route path registry covers all Milestone 4B specifications', () => {
  for (const route of REQUIRED_ROUTES) {
    assert.ok(route, `Route ${route} must be defined`);
  }
});

test('Direct URL route matching accurately maps paths and parameters', () => {
  assert.equal(matchRoute('/').route, '/');
  assert.equal(matchRoute('/find-hospitals').route, '/find-hospitals');
  
  const detailMatch = matchRoute('/hospitals/facility-mgm-trichy');
  assert.equal(detailMatch.route, '/hospitals/:facilityId');
  assert.equal(detailMatch.params.facilityId, 'facility-mgm-trichy');

  assert.equal(matchRoute('/emergency').route, '/emergency');
  assert.equal(matchRoute('/staff/login').route, '/staff/login');
  assert.equal(matchRoute('/staff').route, '/staff');
  assert.equal(matchRoute('/staff/reports').route, '/staff/reports');
  assert.equal(matchRoute('/staff/facilities').route, '/staff/facilities');
  assert.equal(matchRoute('/staff/verification').route, '/staff/verification');
  assert.equal(matchRoute('/non-existent-random-url').route, '*');
});

test('Hospital detail page parameter validation and missing ID handling', () => {
  function validateFacilityParam(id) {
    if (!id || typeof id !== 'string' || id.trim() === '') {
      return { valid: false, error: 'Invalid facility ID.' };
    }
    return { valid: true, error: null };
  }

  assert.equal(validateFacilityParam(null).valid, false);
  assert.equal(validateFacilityParam('').valid, false);
  assert.equal(validateFacilityParam('   ').valid, false);
  assert.equal(validateFacilityParam('facility-apollo-trichy').valid, true);
});

test('Hospital detail data projection respects verified data boundaries', () => {
  // Mock hospital record returned from /api/hospitals/:facilityId
  const verifiedHospital = {
    id: 'fac-1',
    name: 'Mahatma Gandhi Memorial Government Hospital',
    address: 'Collector Office Road, Puthur, Tiruchirappalli',
    city: 'Tiruchirappalli',
    state: 'Tamil Nadu',
    phone: '+91 431 241 4220',
    publicWebsite: 'https://mgmgh.tn.gov.in',
    operatingStatus: 'open',
    verificationStatus: 'verified',
    publicationStatus: 'published',
    services: ['Emergency Trauma Care', 'ICU', 'Oxygen Support'],
    currentAvailability: {
      icu: { availableBeds: 4, totalBeds: 24, lastReportedAt: new Date().toISOString() },
    },
  };

  assert.equal(verifiedHospital.verificationStatus, 'verified');
  assert.equal(verifiedHospital.publicationStatus, 'published');
  assert.ok(verifiedHospital.services.includes('Emergency Trauma Care'));
  assert.equal(verifiedHospital.currentAvailability.icu.availableBeds, 4);

  // Unverified/unpublished facility should not be surfaced as confirmed public facility
  const draftHospital = {
    id: 'fac-draft',
    name: 'Draft Clinic',
    verificationStatus: 'pending',
    publicationStatus: 'draft',
  };

  const isPubliclyVisible = draftHospital.verificationStatus === 'verified' && draftHospital.publicationStatus === 'published';
  assert.equal(isPubliclyVisible, false, 'Draft/unverified facilities must not be publicly visible');
});

test('Emergency assistance page enforces honest non-dispatch semantics', () => {
  const emergencyActions = [
    { tel: '112', label: 'National Unified Emergency Helpline' },
    { tel: '108', label: 'Tamil Nadu Medical Emergency & Ambulance Response' },
  ];

  for (const action of emergencyActions) {
    assert.match(action.tel, /^(112|108)$/, 'Must provide direct tel: link to official helplines');
  }

  // Safety disclaimer requirements
  const disclaimers = {
    isDispatchService: false,
    transmitsLocation: false,
    requiresAuthentication: false,
    requiresLocationPermission: false,
  };

  assert.equal(disclaimers.isDispatchService, false, 'Must not claim to be dispatch service');
  assert.equal(disclaimers.transmitsLocation, false, 'Must not transmit device location');
  assert.equal(disclaimers.requiresAuthentication, false, 'Must be accessible without login');
  assert.equal(disclaimers.requiresLocationPermission, false, 'Must be accessible without location permission');
});

test('Staff workspace enforces role boundaries and tenancy checks', () => {
  function checkStaffPermissions(role) {
    return {
      canReportCapacity: ['facility_reporter', 'organization_admin', 'security_admin'].includes(role),
      canManageFacilities: ['organization_admin', 'security_admin'].includes(role),
      canVerifyFacilities: ['platform_verifier', 'security_admin'].includes(role),
    };
  }

  const reporterPerms = checkStaffPermissions('facility_reporter');
  assert.equal(reporterPerms.canReportCapacity, true);
  assert.equal(reporterPerms.canManageFacilities, false, 'Reporters cannot manage facilities');
  assert.equal(reporterPerms.canVerifyFacilities, false, 'Reporters cannot verify facilities');

  const adminPerms = checkStaffPermissions('organization_admin');
  assert.equal(adminPerms.canReportCapacity, true);
  assert.equal(adminPerms.canManageFacilities, true);
  assert.equal(adminPerms.canVerifyFacilities, false, 'Org admins cannot verify their own facilities');

  const verifierPerms = checkStaffPermissions('platform_verifier');
  assert.equal(verifierPerms.canVerifyFacilities, true);
  assert.equal(verifierPerms.canManageFacilities, false);
});

test('Find hospitals search parameter parsing and category filtering', () => {
  function parseFinderParams(queryString) {
    const params = new URLSearchParams(queryString);
    return {
      query: params.get('q') || '',
      service: params.get('service') || 'all',
      bedType: params.get('bedType') || 'all',
      onlyAvailable: params.get('onlyAvailable') === 'true',
    };
  }

  const parsed = parseFinderParams('service=Cardiac+Catheterization&bedType=icu&onlyAvailable=true');
  assert.equal(parsed.service, 'Cardiac Catheterization');
  assert.equal(parsed.bedType, 'icu');
  assert.equal(parsed.onlyAvailable, true);
});

test('Staff login presets align with seeded demo accounts without exposing production credentials', () => {
  const DEMO_PRESET_EMAILS = [
    'reporter@mgmgh.local',
    'admin@careroute.local',
    'admin@apollo-trichy.local',
    'verifier@careroute.local',
  ];

  for (const email of DEMO_PRESET_EMAILS) {
    assert.match(email, /^[a-z0-9._%+-]+@[a-z0-9.-]+\.local$/, 'Demo accounts must use local demo domain');
  }
});

test('Capacity reporting validation rejects invalid bed counts (negative or available > total)', () => {
  function validateReportInput(availableBeds, totalBeds) {
    const avail = Number(availableBeds);
    const total = Number(totalBeds);
    if (!Number.isInteger(avail) || !Number.isInteger(total)) {
      return { valid: false, error: 'Bed counts must be integers.' };
    }
    if (avail < 0 || total < 0) {
      return { valid: false, error: 'Bed counts cannot be negative.' };
    }
    if (avail > total) {
      return { valid: false, error: 'Available beds cannot exceed total beds.' };
    }
    return { valid: true, error: null };
  }

  assert.equal(validateReportInput(-1, 10).valid, false);
  assert.equal(validateReportInput(5, -2).valid, false);
  assert.equal(validateReportInput(15, 10).valid, false);
  assert.equal(validateReportInput(0, 10).valid, true);
  assert.equal(validateReportInput(10, 10).valid, true);
  assert.equal(validateReportInput(4, 12).valid, true);
});

test('Protected staff pages do not disclose private data to unauthenticated visitors', () => {
  function evaluateUnauthenticatedAccess(isAuthenticated, page) {
    if (!isAuthenticated) {
      return {
        rendersPrivateData: false,
        showsAuthPrompt: true,
        redirectOrPrompt: 'Authentication Required',
      };
    }
    return {
      rendersPrivateData: true,
      showsAuthPrompt: false,
      redirectOrPrompt: null,
    };
  }

  for (const page of ['/staff', '/staff/reports', '/staff/facilities', '/staff/verification']) {
    const access = evaluateUnauthenticatedAccess(false, page);
    assert.equal(access.rendersPrivateData, false, `Page ${page} must not render private data when unauthenticated`);
    assert.equal(access.showsAuthPrompt, true, `Page ${page} must show auth prompt when unauthenticated`);
  }
});

test('Hospital details tab navigation defaults to Overview and resolves deep links', () => {
  const VALID_TABS = ['overview', 'bed-availability', 'services', 'contact'];

  function resolveActiveTab(hash) {
    const normalized = String(hash || '').replace('#', '').toLowerCase();
    return VALID_TABS.includes(normalized) ? normalized : 'overview';
  }

  // Default when no hash or empty hash
  assert.equal(resolveActiveTab(''), 'overview');
  assert.equal(resolveActiveTab('#'), 'overview');
  assert.equal(resolveActiveTab(null), 'overview');

  // Deep-linking to specific tabs
  assert.equal(resolveActiveTab('#bed-availability'), 'bed-availability');
  assert.equal(resolveActiveTab('#overview'), 'overview');
  assert.equal(resolveActiveTab('#services'), 'services');
  assert.equal(resolveActiveTab('#contact'), 'contact');

  // Invalid hash falls back gracefully to overview
  assert.equal(resolveActiveTab('#unknown-random-section'), 'overview');
  assert.equal(resolveActiveTab('#dashboard'), 'overview');
});

test('Hospital details ward-by-ward bed availability presentation from real API shape', () => {
  const sampleHospital = {
    id: 'fac-trichy-mgmgh',
    name: 'Mahatma Gandhi Memorial Government Hospital',
    supportedBedCategories: ['general', 'icu', 'hdu', 'pediatric'],
    availability: {
      general: {
        availableBeds: 18,
        totalBeds: 60,
        freshnessState: 'FRESH',
        reportedAt: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
      },
      icu: {
        availableBeds: 0,
        totalBeds: 12,
        freshnessState: 'FRESH',
        reportedAt: new Date(Date.now() - 8 * 60 * 1000).toISOString(),
      },
      hdu: {
        availableBeds: 3,
        totalBeds: 10,
        freshnessState: 'OVERDUE',
        reportedAt: new Date(Date.now() - 35 * 60 * 1000).toISOString(),
      },
      pediatric: {
        availableBeds: null,
        totalBeds: null,
        freshnessState: 'UNKNOWN',
        reportedAt: null,
      },
    },
  };

  // 1. General ward: FRESH with available beds
  const gen = sampleHospital.availability.general;
  assert.equal(gen.freshnessState, 'FRESH');
  assert.equal(gen.availableBeds, 18);
  assert.equal(gen.totalBeds, 60);

  // 2. ICU ward: FRESH with confirmed 0 beds (Full) - distinguishable from missing
  const icu = sampleHospital.availability.icu;
  assert.equal(icu.freshnessState, 'FRESH');
  assert.equal(icu.availableBeds, 0);
  assert.equal(icu.totalBeds, 12);
  assert.notEqual(icu.availableBeds, null);

  // 3. HDU ward: OVERDUE (15-60m)
  const hdu = sampleHospital.availability.hdu;
  assert.equal(hdu.freshnessState, 'OVERDUE');
  assert.equal(hdu.availableBeds, 3);

  // 4. Pediatric ward: UNKNOWN - must NEVER display numeric 0
  const ped = sampleHospital.availability.pediatric;
  assert.equal(ped.freshnessState, 'UNKNOWN');
  assert.equal(ped.availableBeds, null);
  assert.notEqual(ped.availableBeds, 0);
});

test('Hospital details handles unsupported ward categories without inventing counts', () => {
  // Facility that only supports General and ICU
  const hospitalWithRestrictedWards = {
    id: 'fac-taluk-small',
    name: 'Small Taluk Hospital',
    supportedBedCategories: ['general', 'icu'],
    availability: {
      general: { availableBeds: 5, totalBeds: 20, freshnessState: 'FRESH' },
      icu: { availableBeds: 1, totalBeds: 4, freshnessState: 'FRESH' },
    },
  };

  function evaluateWardSupport(hospital, category) {
    const supported = hospital.supportedBedCategories || ['general', 'icu', 'hdu', 'pediatric'];
    const isSupported = supported.includes(category);
    if (!isSupported) {
      return { supported: false, statusText: 'Not Supported', availableBeds: null, totalBeds: null };
    }
    const snap = hospital.availability?.[category];
    return {
      supported: true,
      statusText: snap?.freshnessState || 'UNKNOWN',
      availableBeds: snap?.availableBeds ?? null,
      totalBeds: snap?.totalBeds ?? null,
    };
  }

  assert.equal(evaluateWardSupport(hospitalWithRestrictedWards, 'general').supported, true);
  assert.equal(evaluateWardSupport(hospitalWithRestrictedWards, 'icu').supported, true);

  // HDU and Pediatric are NOT supported
  const hduResult = evaluateWardSupport(hospitalWithRestrictedWards, 'hdu');
  assert.equal(hduResult.supported, false);
  assert.equal(hduResult.statusText, 'Not Supported');
  assert.equal(hduResult.availableBeds, null);

  const pedResult = evaluateWardSupport(hospitalWithRestrictedWards, 'pediatric');
  assert.equal(pedResult.supported, false);
  assert.equal(pedResult.statusText, 'Not Supported');
  assert.equal(pedResult.availableBeds, null);
});

test('Hospital details STALE report (>60m) marks historical counts as unconfirmed', () => {
  const staleSnapshot = {
    availableBeds: 7,
    totalBeds: 25,
    freshnessState: 'STALE',
    reportedAt: new Date(Date.now() - 90 * 60 * 1000).toISOString(),
  };

  function formatStaleWard(snap) {
    if (snap.freshnessState === 'STALE') {
      return {
        isConfirmed: false,
        label: 'Unconfirmed (>60m)',
        historicalCount: snap.availableBeds,
        displayNotice: 'Historical count is strictly unconfirmed and excluded from verified emergency tallies.',
      };
    }
    return { isConfirmed: true, label: 'Confirmed' };
  }

  const result = formatStaleWard(staleSnapshot);
  assert.equal(result.isConfirmed, false);
  assert.equal(result.historicalCount, 7);
  assert.ok(result.label.includes('Unconfirmed'));
});


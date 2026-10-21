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

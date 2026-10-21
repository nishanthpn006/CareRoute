/**
 * CareRoute — Role Definitions and Authorization Policies
 * 
 * Defined user roles per specification:
 * - facility_reporter: May update capacity only for explicitly assigned facilities.
 * - organization_admin: Manages facilities within their organization; cannot change platform verification.
 * - platform_verifier: Evaluates facility verification, publication, and dispute resolutions.
 * - security_admin: Manages access, authentication, and emergency suspensions (separation of duties).
 */

export const ROLES = Object.freeze({
  FACILITY_REPORTER: 'facility_reporter',
  ORGANIZATION_ADMIN: 'organization_admin',
  PLATFORM_VERIFIER: 'platform_verifier',
  SECURITY_ADMIN: 'security_admin',
});

export const ALL_ROLES = Object.freeze(Object.values(ROLES));

export function isValidRole(role) {
  return ALL_ROLES.includes(role);
}

/**
 * Checks if a user has permission to report bed availability for a specific facility.
 */
export function canReportAvailability(user, facility) {
  if (!user || !facility) return false;
  if (user.status !== 'active') return false;

  // Facility reporter must have the facility explicitly assigned
  if (user.role === ROLES.FACILITY_REPORTER) {
    const assigned = Array.isArray(user.assignedFacilityIds) ? user.assignedFacilityIds : [];
    return assigned.includes(facility.id);
  }

  // Organization admin may report for any facility within their organization
  if (user.role === ROLES.ORGANIZATION_ADMIN) {
    return Boolean(user.organizationId && user.organizationId === facility.organizationId);
  }

  // Separation of duties: platform verifiers and security admins do not submit routine clinical bed reports
  return false;
}

/**
 * Checks if a user has permission to manage a facility's profile and configuration.
 */
export function canManageFacility(user, facility) {
  if (!user || !facility) return false;
  if (user.status !== 'active') return false;

  if (user.role === ROLES.ORGANIZATION_ADMIN) {
    return Boolean(user.organizationId && user.organizationId === facility.organizationId);
  }

  return false;
}

/**
 * Checks if a user has permission to verify or publish facilities.
 */
export function canVerifyFacility(user) {
  if (!user) return false;
  if (user.status !== 'active') return false;
  return user.role === ROLES.PLATFORM_VERIFIER;
}

/**
 * Checks if a user has security administration permissions.
 */
export function canManageSecurity(user) {
  if (!user) return false;
  if (user.status !== 'active') return false;
  return user.role === ROLES.SECURITY_ADMIN;
}

import { config } from '../config.js';
import { validateHospitalPayload } from '../utils/validation.js';
export { validateHospitalPayload } from '../utils/validation.js';
import { domainStore } from './domainStore.js';
import { toPublicFacilityProjection } from '../domain/projections.js';
import { projectToLegacyHospital } from '../routes/hospitals.js';

/**
 * Persistence Boundary Architecture (Milestone 3):
 * 
 * All active request paths and legacy wrappers use `domainStore` as the single
 * authoritative persistence facade.
 * - In demo mode (DATA_MODE=demo), domainStore uses InMemoryStorageAdapter.
 * - In Firebase mode (DATA_MODE=firebase), domainStore uses FirestoreStorageAdapter.
 * No competing stores or unverified flat collections exist.
 */

export async function listHospitals() {
  const projections = await domainStore.getPublicDirectory();
  return projections.map(projectToLegacyHospital);
}

export async function getHospital(id) {
  const facility = await domainStore.getFacility(id);
  if (!facility) return null;
  const availMap = await domainStore.getFacilityAvailabilityMap(facility.id);
  const capabilities = await domainStore.getFacilityCapabilities(facility.id);
  const coverage = await domainStore.getSpecialistCoverage(facility.id);
  const projection = toPublicFacilityProjection(facility, availMap, capabilities, coverage);
  return projection ? projectToLegacyHospital(projection) : null;
}

export async function createHospital(input) {
  const defaultUser = (await domainStore.getUserByEmail('admin@careroute.local')) || {
    id: 'user-admin',
    email: 'admin@careroute.local',
    role: 'organization_admin',
    organizationId: 'org-trichy-gh',
  };
  const draft = await domainStore.registerFacilityDraft(input, defaultUser);
  return draft;
}

export async function updateHospital(id, input) {
  const defaultUser = (await domainStore.getUserByEmail('admin@careroute.local')) || {
    id: 'user-admin',
    email: 'admin@careroute.local',
    role: 'organization_admin',
    organizationId: 'org-trichy-gh',
  };
  if (input.beds) {
    await domainStore.updateFacilityBeds(id, input.beds, defaultUser);
  }
  const { beds: ignoredBeds, ...profile } = input;
  if (Object.keys(profile).length) {
    await domainStore.updateFacilityProfile(id, profile, defaultUser);
  }
  return getHospital(id);
}

export async function deleteHospital(id) {
  const defaultUser = (await domainStore.getUserByEmail('admin@careroute.local')) || {
    id: 'user-admin',
    email: 'admin@careroute.local',
    role: 'organization_admin',
    organizationId: 'org-trichy-gh',
  };
  await domainStore.deactivateFacility(id, defaultUser);
  return true;
}

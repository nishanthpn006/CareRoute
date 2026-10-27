import { randomUUID } from 'node:crypto';
import { canReportAvailability, canManageFacility, canVerifyFacility } from '../../domain/roles.js';
import { validateAvailabilityReport, validateFacilityPayload } from '../../domain/schema.js';
import { toPublicFacilityProjection } from '../../domain/projections.js';
import {
  SEED_ORGANIZATIONS,
  SEED_FACILITIES,
  SEED_FACILITY_CAPABILITIES,
  SEED_USERS,
} from '../../data/trichySeedData.js';

export class InMemoryStorageAdapter {
  constructor() {
    this.reset();
  }

  reset() {
    this.organizations = new Map(SEED_ORGANIZATIONS.map((org) => [org.id, structuredClone(org)]));
    this.facilities = new Map(SEED_FACILITIES.map((fac) => [fac.id, structuredClone(fac)]));
    this.facilityCapabilities = structuredClone(SEED_FACILITY_CAPABILITIES);
    this.specialistCoverage = [];
    this.availabilityReports = [];
    this.availabilityCurrent = new Map(); // key: `${facilityId}:${category}`
    this.auditEvents = [];
    this.users = new Map(SEED_USERS.map((u) => [u.id, structuredClone(u)]));
    this.usersByEmail = new Map(SEED_USERS.map((u) => [u.email.toLowerCase(), structuredClone(u)]));
    this.passwordHashes = new Map(); // key: userId / email
  }

  async seedIfEmpty() {
    // In-memory demo data is seeded on reset / instantiation
    return;
  }

  // Organizations
  getOrganization(orgId) {
    const org = this.organizations.get(orgId);
    return org ? structuredClone(org) : null;
  }

  listOrganizations() {
    return Array.from(this.organizations.values()).map((org) => structuredClone(org));
  }

  // Users
  getUser(userId) {
    const user = this.users.get(userId);
    return user ? structuredClone(user) : null;
  }

  getUserByEmail(email) {
    if (!email) return null;
    const user = this.usersByEmail.get(String(email).trim().toLowerCase());
    return user ? structuredClone(user) : null;
  }

  getUserPasswordHashByEmail(email) {
    if (!email) return null;
    const user = this.usersByEmail.get(String(email).trim().toLowerCase());
    if (!user) return null;
    const passwordHash = this.passwordHashes.get(user.id) || this.passwordHashes.get(user.email) || null;
    return {
      id: user.id,
      email: user.email,
      status: user.status,
      passwordHash,
    };
  }

  setUserPassword(userIdOrEmail, passwordHash) {
    if (!userIdOrEmail || !passwordHash) {
      throw new Error('User identifier and password hash are required.');
    }
    const target = String(userIdOrEmail).trim().toLowerCase();
    const user = this.users.get(target) || this.usersByEmail.get(target);
    if (!user) return null;
    this.passwordHashes.set(user.id, passwordHash);
    this.passwordHashes.set(user.email, passwordHash);
    return structuredClone(user);
  }

  registerUser(userData) {
    const id = userData.id || `user-${randomUUID()}`;
    const user = {
      id,
      email: userData.email.toLowerCase(),
      name: userData.name || userData.email,
      role: userData.role,
      status: userData.status || 'active',
      organizationId: userData.organizationId || null,
      assignedFacilityIds: Array.isArray(userData.assignedFacilityIds) ? [...userData.assignedFacilityIds] : [],
      createdAt: new Date().toISOString(),
    };
    this.users.set(id, user);
    this.usersByEmail.set(user.email, user);
    if (userData.passwordHash) {
      this.passwordHashes.set(id, userData.passwordHash);
      this.passwordHashes.set(user.email, userData.passwordHash);
    }
    return structuredClone(user);
  }

  // Facilities
  getFacility(facilityId) {
    const fac = this.facilities.get(facilityId);
    return fac ? structuredClone(fac) : null;
  }

  listFacilities(filterFn = null) {
    const all = Array.from(this.facilities.values());
    const matched = filterFn ? all.filter(filterFn) : all;
    return matched.map((f) => structuredClone(f));
  }

  updateFacility(facilityId, input, user = null) {
    const existing = this.facilities.get(facilityId);
    if (!existing) return null;

    const validationErrors = validateFacilityPayload(input, true);
    if (validationErrors.length) {
      throw new Error(`Facility validation failed: ${validationErrors.join(' ')}`);
    }

    const updated = {
      ...existing,
      ...input,
      updatedAt: new Date().toISOString(),
    };
    this.facilities.set(facilityId, updated);

    if (user) {
      this.recordAuditEvent({
        actor: user,
        facilityId,
        organizationId: existing.organizationId,
        action: 'facility.updated',
        outcome: 'accepted',
        changes: { ...input },
      });
    }

    return structuredClone(updated);
  }

  // Capabilities & Coverage
  getFacilityCapabilities(facilityId) {
    return this.facilityCapabilities
      .filter((c) => c.facilityId === facilityId)
      .map((c) => structuredClone(c));
  }

  getSpecialistCoverage(facilityId) {
    return this.specialistCoverage
      .filter((cov) => cov.facilityId === facilityId)
      .map((cov) => structuredClone(cov));
  }

  // Availability Snapshots
  getAvailabilityCurrent(facilityId, category) {
    const key = `${facilityId}:${category.toLowerCase()}`;
    const snapshot = this.availabilityCurrent.get(key);
    return snapshot ? structuredClone(snapshot) : null;
  }

  getFacilityAvailabilityMap(facilityId) {
    const facility = this.facilities.get(facilityId);
    if (!facility) return {};

    const categories = facility.supportedBedCategories || [];
    const map = {};

    for (const cat of categories) {
      const key = `${facilityId}:${cat.toLowerCase()}`;
      map[cat] = this.availabilityCurrent.get(key)
        ? structuredClone(this.availabilityCurrent.get(key))
        : null;
    }
    return map;
  }

  listAvailabilityReports(facilityId, { limit = 50, category = null } = {}) {
    let reports = this.availabilityReports.filter((r) => r.facilityId === facilityId);
    if (category) {
      reports = reports.filter((r) => r.category.toLowerCase() === category.toLowerCase());
    }
    reports.sort((a, b) => new Date(b.reportedAt) - new Date(a.reportedAt));
    return reports.slice(0, limit).map((r) => structuredClone(r));
  }

  // Audit Events
  recordAuditEvent({ actor, facilityId, organizationId, action, outcome, changes = null, reason = null, now = Date.now() }) {
    const event = {
      eventId: randomUUID(),
      actorUid: actor?.id || 'anonymous',
      actorEmail: actor?.email || 'anonymous',
      actorRole: actor?.role || 'public',
      facilityId: facilityId || null,
      organizationId: organizationId || null,
      action,
      outcome, // 'accepted' | 'rejected'
      timestamp: new Date(now).toISOString(),
      changes: changes ? structuredClone(changes) : null,
      reason: reason || null,
    };
    this.auditEvents.push(event);
    return structuredClone(event);
  }

  listAuditEvents({ facilityId = null, actorUid = null, limit = 100 } = {}) {
    let events = this.auditEvents;
    if (facilityId) events = events.filter((e) => e.facilityId === facilityId);
    if (actorUid) events = events.filter((e) => e.actorUid === actorUid);
    events.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    return events.slice(0, limit).map((e) => structuredClone(e));
  }

  /**
   * ATOMIC AVAILABILITY REPORT SUBMISSION (IN-MEMORY)
   */
  submitAvailabilityReport({
    facilityId,
    category,
    availableBeds,
    totalBeds,
    user,
    source = 'manual_staff_portal',
    now = Date.now(),
  }) {
    const facility = this.facilities.get(facilityId);
    if (!facility) {
      throw new Error(`Facility not found: ${facilityId}`);
    }

    // Permission enforcement
    if (!canReportAvailability(user, facility)) {
      this.recordAuditEvent({
        actor: user,
        facilityId,
        organizationId: facility.organizationId,
        action: 'availability_report.rejected',
        outcome: 'rejected',
        reason: 'Forbidden: User not authorized to report for this facility',
        changes: { category, availableBeds, totalBeds },
        now,
      });
      const err = new Error('Forbidden: You are not authorized to report availability for this facility.');
      err.statusCode = 403;
      throw err;
    }

    // Schema validation
    const payload = { category, availableBeds, totalBeds };
    const errors = validateAvailabilityReport(payload, facility);
    if (errors.length) {
      this.recordAuditEvent({
        actor: user,
        facilityId,
        organizationId: facility.organizationId,
        action: 'availability_report.rejected',
        outcome: 'rejected',
        reason: errors.join('; '),
        changes: { category, availableBeds, totalBeds },
        now,
      });
      const err = new Error(`Validation failed: ${errors.join(' ')}`);
      err.statusCode = 400;
      throw err;
    }

    const normCat = category.trim().toLowerCase();
    const timestampStr = new Date(now).toISOString();

    // 1. Create append-only report
    const report = {
      reportId: randomUUID(),
      facilityId,
      category: normCat,
      availableBeds: Number(availableBeds),
      totalBeds: Number(totalBeds),
      reportedAt: timestampStr,
      receivedAt: timestampStr,
      reportedByUid: user.id,
      reportedByEmail: user.email,
      reportedByRole: user.role,
      source,
      status: 'accepted',
    };
    this.availabilityReports.push(report);

    // 2. Atomically update current snapshot
    const key = `${facilityId}:${normCat}`;
    const previousSnapshot = this.availabilityCurrent.get(key);
    const newVersion = previousSnapshot ? (previousSnapshot.version || 1) + 1 : 1;

    const snapshot = {
      facilityId,
      category: normCat,
      availableBeds: Number(availableBeds),
      totalBeds: Number(totalBeds),
      latestReportId: report.reportId,
      reportedAt: timestampStr,
      updatedAt: timestampStr,
      version: newVersion,
    };
    this.availabilityCurrent.set(key, snapshot);

    // 3. Record audit event
    const auditEvent = this.recordAuditEvent({
      actor: user,
      facilityId,
      organizationId: facility.organizationId,
      action: 'availability_report.submitted',
      outcome: 'accepted',
      changes: {
        category: normCat,
        previousAvailable: previousSnapshot ? previousSnapshot.availableBeds : null,
        newAvailable: Number(availableBeds),
        previousTotal: previousSnapshot ? previousSnapshot.totalBeds : null,
        newTotal: Number(totalBeds),
        reportId: report.reportId,
      },
      now,
    });

    return {
      report: structuredClone(report),
      snapshot: structuredClone(snapshot),
      auditEvent: structuredClone(auditEvent),
    };
  }

  /**
   * PLATFORM VERIFICATION DECISION
   */
  updateFacilityVerification({ facilityId, verificationStatus, publicationStatus, user, notes = '', now = Date.now() }) {
    if (!canVerifyFacility(user)) {
      const err = new Error('Forbidden: Only platform verifiers may update facility verification status.');
      err.statusCode = 403;
      throw err;
    }

    const facility = this.facilities.get(facilityId);
    if (!facility) {
      throw new Error(`Facility not found: ${facilityId}`);
    }

    const previousStatus = facility.verificationStatus;
    const previousPublication = facility.publicationStatus;

    const updated = {
      ...facility,
      verificationStatus: verificationStatus || facility.verificationStatus,
      publicationStatus: publicationStatus || facility.publicationStatus,
      verifiedAt: verificationStatus === 'verified' ? new Date(now).toISOString() : facility.verifiedAt,
      updatedAt: new Date(now).toISOString(),
    };
    this.facilities.set(facilityId, updated);

    const auditEvent = this.recordAuditEvent({
      actor: user,
      facilityId,
      organizationId: facility.organizationId,
      action: 'facility_verification.updated',
      outcome: 'accepted',
      changes: {
        previousVerificationStatus: previousStatus,
        newVerificationStatus: updated.verificationStatus,
        previousPublicationStatus: previousPublication,
        newPublicationStatus: updated.publicationStatus,
        notes,
      },
      now,
    });

    return {
      facility: structuredClone(updated),
      auditEvent: structuredClone(auditEvent),
    };
  }

  /**
   * PUBLIC DIRECTORY PROJECTION QUERY
   */
  getPublicDirectory(filters = {}, now = Date.now()) {
    const verifiedPublished = Array.from(this.facilities.values()).filter(
      (f) =>
        f.verificationStatus === 'verified' &&
        f.publicationStatus === 'published' &&
        f.operatingStatus !== 'suspended'
    );

    const q = String(filters.q || '').trim().toLowerCase();
    const locality = String(filters.locality || filters.city || '').trim().toLowerCase();
    const district = String(filters.district || '').trim().toLowerCase();
    const bedCategory = filters.bedCategory || filters.bedType ? String(filters.bedCategory || filters.bedType).trim().toLowerCase() : null;
    const availableOnly = filters.availableOnly === true || String(filters.availableOnly || '') === 'true';

    const projectedList = [];

    for (const fac of verifiedPublished) {
      const availMap = this.getFacilityAvailabilityMap(fac.id);
      const capabilities = this.getFacilityCapabilities(fac.id);
      const coverage = this.getSpecialistCoverage(fac.id);

      const projection = toPublicFacilityProjection(fac, availMap, capabilities, coverage, now);
      if (!projection) continue;

      if (q) {
        const searchable = [
          projection.name,
          projection.address,
          projection.locality,
          projection.district,
          ...projection.capabilities.map((c) => c.name),
        ].join(' ').toLowerCase();
        if (!searchable.includes(q)) continue;
      }

      if (locality && !projection.locality.toLowerCase().includes(locality) && !projection.city.toLowerCase().includes(locality)) {
        continue;
      }

      if (district && !projection.district.toLowerCase().includes(district)) {
        continue;
      }

      if (bedCategory && bedCategory !== 'all') {
        const catData = projection.availability[bedCategory];
        if (!catData) continue;
        if (availableOnly && Number(catData.availableBeds || 0) < 1) continue;
      } else if (availableOnly) {
        const hasAnyAvailable = Object.values(projection.availability).some(
          (c) => Number(c.availableBeds || 0) > 0
        );
        if (!hasAnyAvailable) continue;
      }

      projectedList.push(projection);
    }

    return projectedList;
  }

  listAuthorizedFacilities(user) {
    if (!user || user.status !== 'active') return [];

    let facilities = [];
    if (user.role === 'organization_admin') {
      facilities = Array.from(this.facilities.values()).filter(
        (f) => f.organizationId === user.organizationId
      );
    } else if (user.role === 'facility_reporter') {
      const assigned = Array.isArray(user.assignedFacilityIds) ? user.assignedFacilityIds : [];
      facilities = Array.from(this.facilities.values()).filter(
        (f) => assigned.includes(f.id)
      );
    }

    return facilities.map((f) => {
      const copy = structuredClone(f);
      const availMap = this.getFacilityAvailabilityMap(f.id);
      const beds = {};
      for (const cat of f.supportedBedCategories || ['general', 'icu', 'hdu', 'pediatric']) {
        beds[cat] = availMap[cat]?.availableBeds || 0;
      }
      copy.beds = beds;
      return copy;
    });
  }

  registerFacilityDraft(input, user, now = Date.now()) {
    if (!user || user.status !== 'active') {
      const err = new Error('Authentication is required.');
      err.statusCode = 401;
      throw err;
    }
    if (user.role !== 'organization_admin' || !user.organizationId) {
      const err = new Error('Forbidden: Only organization administrators can register new facilities.');
      err.statusCode = 403;
      throw err;
    }

    const facilityInput = {
      ...input,
      organizationId: user.organizationId,
      district: input.district || input.city || 'Tiruchirappalli',
      state: input.state || 'Tamil Nadu',
    };

    const errors = validateFacilityPayload(facilityInput, false);
    if (errors.length) {
      const err = new Error(`Facility validation failed: ${errors.join(' ')}`);
      err.statusCode = 400;
      err.details = errors;
      throw err;
    }

    const facilityId = input.id || `fac-${randomUUID().slice(0, 8)}`;
    const supportedBedCategories = Array.isArray(input.supportedBedCategories) && input.supportedBedCategories.length
      ? input.supportedBedCategories
      : ['general', 'icu', 'hdu', 'pediatric'];

    const draft = {
      id: facilityId,
      organizationId: user.organizationId,
      name: String(input.name).trim(),
      displayName: String(input.displayName || input.name).trim(),
      facilityType: input.facilityType || 'hospital',
      address: String(input.address).trim(),
      locality: String(input.locality || '').trim(),
      city: String(input.city).trim(),
      district: String(input.district || input.city).trim(),
      state: String(input.state || 'Tamil Nadu').trim(),
      postalCode: String(input.postalCode || '').trim(),
      latitude: Number(input.latitude),
      longitude: Number(input.longitude),
      phone: String(input.phone).trim(),
      publicWebsite: input.publicWebsite || null,
      operatingStatus: input.operatingStatus === 'closed' ? 'closed' : 'open',
      verificationStatus: 'pending',
      publicationStatus: 'draft',
      verifiedAt: null,
      sourceReference: input.sourceReference || 'Draft Registration',
      isDemo: true,
      supportedBedCategories,
      privateVerificationData: {
        registeredBy: user.email,
        registeredAt: new Date(now).toISOString(),
      },
      createdAt: new Date(now).toISOString(),
      updatedAt: new Date(now).toISOString(),
    };

    this.facilities.set(facilityId, draft);

    this.recordAuditEvent({
      actor: user,
      facilityId,
      organizationId: user.organizationId,
      action: 'facility.registered',
      outcome: 'accepted',
      changes: {
        name: draft.name,
        verificationStatus: 'pending',
        publicationStatus: 'draft',
      },
      now,
    });

    if (input.beds && typeof input.beds === 'object') {
      for (const [cat, count] of Object.entries(input.beds)) {
        if (!supportedBedCategories.includes(cat.toLowerCase())) continue;
        const available = typeof count === 'object' ? Number(count.availableBeds || 0) : Number(count || 0);
        const total = typeof count === 'object' ? Number(count.totalBeds ?? available) : available;
        if (total >= 0 && available >= 0 && available <= total) {
          try {
            this.submitAvailabilityReport({
              facilityId,
              category: cat.toLowerCase(),
              availableBeds: available,
              totalBeds: total,
              user,
              source: 'facility_registration',
              now,
            });
          } catch (_) {}
        }
      }
    }

    return structuredClone(draft);
  }

  updateFacilityBeds(facilityId, bedsInput, user, now = Date.now()) {
    const facility = this.facilities.get(facilityId);
    if (!facility) {
      const err = new Error(`Facility not found: "${facilityId}".`);
      err.statusCode = 404;
      throw err;
    }

    if (!canReportAvailability(user, facility)) {
      this.recordAuditEvent({
        actor: user,
        facilityId,
        organizationId: facility.organizationId,
        action: 'availability_report.rejected',
        outcome: 'rejected',
        reason: 'Forbidden: User not authorized to report availability for this facility',
        changes: { bedsInput },
        now,
      });
      const err = new Error('Forbidden: You are not authorized to report availability for this facility.');
      err.statusCode = 403;
      throw err;
    }

    const results = {};
    for (const [category, bedData] of Object.entries(bedsInput)) {
      const normCat = category.trim().toLowerCase();
      if (!facility.supportedBedCategories.includes(normCat)) {
        continue;
      }

      const existingSnapshot = this.getAvailabilityCurrent(facilityId, normCat);
      let availableBeds;
      let totalBeds;

      if (typeof bedData === 'object' && bedData !== null) {
        availableBeds = Number(bedData.availableBeds);
        totalBeds = bedData.totalBeds !== undefined ? Number(bedData.totalBeds) : availableBeds;
      } else {
        availableBeds = Number(bedData);
        totalBeds = existingSnapshot?.totalBeds ? Math.max(existingSnapshot.totalBeds, availableBeds) : availableBeds;
      }

      const submission = this.submitAvailabilityReport({
        facilityId,
        category: normCat,
        availableBeds,
        totalBeds,
        user,
        source: 'admin_portal',
        now,
      });
      results[normCat] = submission;
    }

    return results;
  }

  updateFacilityProfile(facilityId, input, user, now = Date.now()) {
    const facility = this.facilities.get(facilityId);
    if (!facility) {
      const err = new Error(`Facility not found: "${facilityId}".`);
      err.statusCode = 404;
      throw err;
    }

    if (!canManageFacility(user, facility)) {
      const err = new Error('Forbidden: You cannot manage a facility outside your organization.');
      err.statusCode = 403;
      throw err;
    }

    const { verificationStatus, publicationStatus, organizationId, id, privateVerificationData, ...allowed } = input;

    const validationErrors = validateFacilityPayload(allowed, true);
    if (validationErrors.length) {
      const err = new Error(`Facility validation failed: ${validationErrors.join(' ')}`);
      err.statusCode = 400;
      err.details = validationErrors;
      throw err;
    }

    const updated = {
      ...facility,
      ...allowed,
      updatedAt: new Date(now).toISOString(),
    };
    this.facilities.set(facilityId, updated);

    this.recordAuditEvent({
      actor: user,
      facilityId,
      organizationId: facility.organizationId,
      action: 'facility.profile_updated',
      outcome: 'accepted',
      changes: allowed,
      now,
    });

    return structuredClone(updated);
  }

  deactivateFacility(facilityId, user, now = Date.now()) {
    const facility = this.facilities.get(facilityId);
    if (!facility) {
      const err = new Error(`Facility not found: "${facilityId}".`);
      err.statusCode = 404;
      throw err;
    }

    if (!canManageFacility(user, facility)) {
      const err = new Error('Forbidden: You cannot deactivate a facility outside your organization.');
      err.statusCode = 403;
      throw err;
    }

    const updated = {
      ...facility,
      operatingStatus: 'closed',
      publicationStatus: 'hidden',
      updatedAt: new Date(now).toISOString(),
    };
    this.facilities.set(facilityId, updated);

    this.recordAuditEvent({
      actor: user,
      facilityId,
      organizationId: facility.organizationId,
      action: 'facility.deactivated',
      outcome: 'accepted',
      changes: { operatingStatus: 'closed', publicationStatus: 'hidden' },
      now,
    });

    return structuredClone(updated);
  }

  async ping() {
    return { ok: true };
  }

  async close() {
    return;
  }
}

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

export class FirestoreStorageAdapter {
  /**
   * @param {import('@google-cloud/firestore').Firestore} db
   */
  constructor(db) {
    if (!db || typeof db.collection !== 'function') {
      throw new Error('FirestoreStorageAdapter requires a valid Firestore instance.');
    }
    this.db = db;
  }

  /**
   * Idempotent initialization: seeds pilot data only if the database is unpopulated.
   * Keeps capacity explicitly UNKNOWN until valid reports are submitted.
   */
  async seedIfEmpty() {
    const facilitiesSnapshot = await this.db.collection('facilities').limit(1).get();
    if (!facilitiesSnapshot.empty) {
      return; // Already seeded
    }

    const batch = this.db.batch();

    for (const org of SEED_ORGANIZATIONS) {
      batch.set(this.db.collection('organizations').doc(org.id), org);
    }
    for (const fac of SEED_FACILITIES) {
      batch.set(this.db.collection('facilities').doc(fac.id), fac);
    }
    for (const cap of SEED_FACILITY_CAPABILITIES) {
      const docId = `${cap.facilityId}_${cap.capabilityId}`;
      batch.set(this.db.collection('facility_capabilities').doc(docId), cap);
    }
    for (const user of SEED_USERS) {
      batch.set(this.db.collection('users').doc(user.id), user);
    }

    await batch.commit();
  }

  // Organizations
  async getOrganization(orgId) {
    if (!orgId) return null;
    const doc = await this.db.collection('organizations').doc(orgId).get();
    return doc.exists ? structuredClone(doc.data()) : null;
  }

  async listOrganizations() {
    const snap = await this.db.collection('organizations').get();
    return snap.docs.map((d) => structuredClone(d.data()));
  }

  // Users
  async getUser(userId) {
    if (!userId) return null;
    const doc = await this.db.collection('users').doc(userId).get();
    return doc.exists ? structuredClone(doc.data()) : null;
  }

  async getUserByEmail(email) {
    if (!email) return null;
    const normalized = String(email).trim().toLowerCase();
    const snap = await this.db.collection('users').where('email', '==', normalized).limit(1).get();
    return snap.empty ? null : structuredClone(snap.docs[0].data());
  }

  async getUserPasswordHashByEmail(email) {
    if (!email) return null;
    const normalized = String(email).trim().toLowerCase();
    const snap = await this.db.collection('users').where('email', '==', normalized).limit(1).get();
    if (snap.empty) return null;
    const data = snap.docs[0].data();
    return {
      id: data.id,
      email: data.email,
      status: data.status,
      passwordHash: data.passwordHash || null,
    };
  }

  async setUserPassword(userIdOrEmail, passwordHash) {
    if (!userIdOrEmail || !passwordHash) {
      throw new Error('User identifier and password hash are required.');
    }
    const target = String(userIdOrEmail).trim().toLowerCase();
    let docRef = this.db.collection('users').doc(target);
    let snap = await docRef.get();
    if (!snap.exists) {
      const emailSnap = await this.db.collection('users').where('email', '==', target).limit(1).get();
      if (emailSnap.empty) return null;
      docRef = emailSnap.docs[0].ref;
    }
    await docRef.update({ passwordHash });
    const updated = (await docRef.get()).data();
    return structuredClone(updated);
  }

  async registerUser(userData) {
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
    if (userData.passwordHash) {
      user.passwordHash = userData.passwordHash;
    }
    await this.db.collection('users').doc(id).set(user);
    return structuredClone(user);
  }

  // Facilities
  async getFacility(facilityId) {
    if (!facilityId) return null;
    const doc = await this.db.collection('facilities').doc(facilityId).get();
    return doc.exists ? structuredClone(doc.data()) : null;
  }

  async listFacilities(filterFn = null) {
    const snap = await this.db.collection('facilities').get();
    const all = snap.docs.map((d) => d.data());
    const matched = filterFn ? all.filter(filterFn) : all;
    return matched.map((f) => structuredClone(f));
  }

  async updateFacility(facilityId, input, user = null) {
    const docRef = this.db.collection('facilities').doc(facilityId);
    const doc = await docRef.get();
    if (!doc.exists) return null;

    const validationErrors = validateFacilityPayload(input, true);
    if (validationErrors.length) {
      throw new Error(`Facility validation failed: ${validationErrors.join(' ')}`);
    }

    const updated = {
      ...doc.data(),
      ...input,
      updatedAt: new Date().toISOString(),
    };
    await docRef.set(updated, { merge: true });

    if (user) {
      await this.recordAuditEvent({
        actor: user,
        facilityId,
        organizationId: doc.data().organizationId,
        action: 'facility.updated',
        outcome: 'accepted',
        changes: { ...input },
      });
    }

    return structuredClone(updated);
  }

  // Capabilities & Coverage
  async getFacilityCapabilities(facilityId) {
    const snap = await this.db.collection('facility_capabilities').where('facilityId', '==', facilityId).get();
    return snap.docs.map((d) => structuredClone(d.data()));
  }

  async getSpecialistCoverage(facilityId) {
    const snap = await this.db.collection('specialist_coverage').where('facilityId', '==', facilityId).get();
    return snap.docs.map((d) => structuredClone(d.data()));
  }

  // Availability Snapshots
  async getAvailabilityCurrent(facilityId, category) {
    const key = `${facilityId}_${category.toLowerCase()}`;
    const doc = await this.db.collection('availability_current').doc(key).get();
    return doc.exists ? structuredClone(doc.data()) : null;
  }

  async getFacilityAvailabilityMap(facilityId) {
    const facility = await this.getFacility(facilityId);
    if (!facility) return {};

    const categories = facility.supportedBedCategories || [];
    const map = {};
    for (const cat of categories) {
      map[cat] = null;
    }

    const snap = await this.db.collection('availability_current').where('facilityId', '==', facilityId).get();
    for (const doc of snap.docs) {
      const data = doc.data();
      if (data.category) {
        map[data.category] = structuredClone(data);
      }
    }

    return map;
  }

  async listAvailabilityReports(facilityId, { limit = 50, category = null } = {}) {
    let query = this.db.collection('availability_reports').where('facilityId', '==', facilityId);
    if (category) {
      query = query.where('category', '==', category.toLowerCase());
    }

    const snap = await query.get();
    let reports = snap.docs.map((d) => d.data());
    reports.sort((a, b) => new Date(b.reportedAt) - new Date(a.reportedAt));
    return reports.slice(0, limit).map((r) => structuredClone(r));
  }

  // Audit Events
  async recordAuditEvent({ actor, facilityId, organizationId, action, outcome, changes = null, reason = null, now = Date.now() }) {
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
    await this.db.collection('audit_events').doc(event.eventId).set(event);
    return structuredClone(event);
  }

  async listAuditEvents({ facilityId = null, actorUid = null, limit = 100 } = {}) {
    let query = this.db.collection('audit_events');
    if (facilityId) {
      query = query.where('facilityId', '==', facilityId);
    }
    if (actorUid) {
      query = query.where('actorUid', '==', actorUid);
    }

    const snap = await query.get();
    let events = snap.docs.map((d) => d.data());
    events.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    return events.slice(0, limit).map((e) => structuredClone(e));
  }

  /**
   * ATOMIC AVAILABILITY REPORT SUBMISSION USING FIRESTORE TRANSACTIONS
   * 
   * Atomically within db.runTransaction:
   * 1. Reads facility document.
   * 2. Enforces permissions and schema invariants.
   * 3. Reads current snapshot document.
   * 4. Appends immutable report to availability_reports.
   * 5. Atomically writes updated snapshot to availability_current.
   * 6. Appends audit event to audit_events.
   * 7. Any failure completely aborts without modifying snapshot.
   */
  async submitAvailabilityReport({
    facilityId,
    category,
    availableBeds,
    totalBeds,
    user,
    source = 'manual_staff_portal',
    now = Date.now(),
  }) {
    const normCat = String(category || '').trim().toLowerCase();
    const timestampStr = new Date(now).toISOString();
    const facilityRef = this.db.collection('facilities').doc(facilityId);
    const currentKey = `${facilityId}_${normCat}`;
    const currentRef = this.db.collection('availability_current').doc(currentKey);

    try {
      return await this.db.runTransaction(async (transaction) => {
        // --- 1. Transaction Reads ---
        const facilityDoc = await transaction.get(facilityRef);
        if (!facilityDoc.exists) {
          const err = new Error(`Facility not found: ${facilityId}`);
          err.statusCode = 404;
          throw err;
        }
        const facility = facilityDoc.data();

        // --- 2. Permission Validation ---
        if (!canReportAvailability(user, facility)) {
          const err = new Error('Forbidden: You are not authorized to report availability for this facility.');
          err.statusCode = 403;
          throw err;
        }

        // --- 3. Schema Invariants Validation ---
        const payload = { category: normCat, availableBeds, totalBeds };
        const errors = validateAvailabilityReport(payload, facility);
        if (errors.length) {
          const err = new Error(`Validation failed: ${errors.join(' ')}`);
          err.statusCode = 400;
          err.details = errors;
          throw err;
        }

        // --- 4. Read Current Snapshot in Transaction ---
        const currentDoc = await transaction.get(currentRef);
        const previousSnapshot = currentDoc.exists ? currentDoc.data() : null;
        const newVersion = previousSnapshot ? (previousSnapshot.version || 1) + 1 : 1;

        // --- 5. Prepare Writes ---
        const reportId = randomUUID();
        const report = {
          reportId,
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

        const snapshot = {
          facilityId,
          category: normCat,
          availableBeds: Number(availableBeds),
          totalBeds: Number(totalBeds),
          latestReportId: reportId,
          reportedAt: timestampStr,
          updatedAt: timestampStr,
          version: newVersion,
        };

        const eventId = randomUUID();
        const auditEvent = {
          eventId,
          actorUid: user.id || 'anonymous',
          actorEmail: user.email || 'anonymous',
          actorRole: user.role || 'public',
          facilityId,
          organizationId: facility.organizationId || null,
          action: 'availability_report.submitted',
          outcome: 'accepted',
          timestamp: timestampStr,
          changes: {
            category: normCat,
            previousAvailable: previousSnapshot ? previousSnapshot.availableBeds : null,
            newAvailable: Number(availableBeds),
            previousTotal: previousSnapshot ? previousSnapshot.totalBeds : null,
            newTotal: Number(totalBeds),
            reportId,
          },
          reason: null,
        };

        // --- 6. Transaction Writes ---
        transaction.set(this.db.collection('availability_reports').doc(reportId), report);
        transaction.set(currentRef, snapshot);
        transaction.set(this.db.collection('audit_events').doc(eventId), auditEvent);

        return {
          report: structuredClone(report),
          snapshot: structuredClone(snapshot),
          auditEvent: structuredClone(auditEvent),
        };
      });
    } catch (err) {
      // Record rejected audit event if permission or validation failed
      if (err.statusCode === 400 || err.statusCode === 403) {
        try {
          await this.recordAuditEvent({
            actor: user,
            facilityId,
            organizationId: user?.organizationId || null,
            action: 'availability_report.rejected',
            outcome: 'rejected',
            reason: err.message,
            changes: { category: normCat, availableBeds, totalBeds },
            now,
          });
        } catch (_) {}
      }
      throw err;
    }
  }

  async updateFacilityVerification({ facilityId, verificationStatus, publicationStatus, user, notes = '', now = Date.now() }) {
    if (!canVerifyFacility(user)) {
      const err = new Error('Forbidden: Only platform verifiers may update facility verification status.');
      err.statusCode = 403;
      throw err;
    }

    const docRef = this.db.collection('facilities').doc(facilityId);
    const doc = await docRef.get();
    if (!doc.exists) {
      throw new Error(`Facility not found: ${facilityId}`);
    }

    const facility = doc.data();
    const previousStatus = facility.verificationStatus;
    const previousPublication = facility.publicationStatus;

    const updated = {
      ...facility,
      verificationStatus: verificationStatus || facility.verificationStatus,
      publicationStatus: publicationStatus || facility.publicationStatus,
      verifiedAt: verificationStatus === 'verified' ? new Date(now).toISOString() : facility.verifiedAt,
      updatedAt: new Date(now).toISOString(),
    };
    await docRef.set(updated, { merge: true });

    const auditEvent = await this.recordAuditEvent({
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

  async getPublicDirectory(filters = {}, now = Date.now()) {
    const snap = await this.db.collection('facilities')
      .where('verificationStatus', '==', 'verified')
      .where('publicationStatus', '==', 'published')
      .get();

    const verifiedPublished = snap.docs
      .map((d) => d.data())
      .filter((f) => f.operatingStatus !== 'suspended');

    const q = String(filters.q || '').trim().toLowerCase();
    const locality = String(filters.locality || filters.city || '').trim().toLowerCase();
    const district = String(filters.district || '').trim().toLowerCase();
    const bedCategory = filters.bedCategory || filters.bedType ? String(filters.bedCategory || filters.bedType).trim().toLowerCase() : null;
    const availableOnly = filters.availableOnly === true || String(filters.availableOnly || '') === 'true';

    const projectedList = [];

    for (const fac of verifiedPublished) {
      const [availMap, capabilities, coverage] = await Promise.all([
        this.getFacilityAvailabilityMap(fac.id),
        this.getFacilityCapabilities(fac.id),
        this.getSpecialistCoverage(fac.id),
      ]);

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

  async listAuthorizedFacilities(user) {
    if (!user || user.status !== 'active') return [];

    let facilities = [];
    if (user.role === 'organization_admin') {
      const snap = await this.db.collection('facilities').where('organizationId', '==', user.organizationId).get();
      facilities = snap.docs.map((d) => d.data());
    } else if (user.role === 'facility_reporter') {
      const assigned = Array.isArray(user.assignedFacilityIds) ? user.assignedFacilityIds : [];
      if (assigned.length) {
        // Fetch assigned facilities
        const fetched = await Promise.all(assigned.map((id) => this.getFacility(id)));
        facilities = fetched.filter(Boolean);
      }
    }

    const results = [];
    for (const f of facilities) {
      const copy = structuredClone(f);
      const availMap = await this.getFacilityAvailabilityMap(f.id);
      const beds = {};
      for (const cat of f.supportedBedCategories || ['general', 'icu', 'hdu', 'pediatric']) {
        beds[cat] = availMap[cat]?.availableBeds || 0;
      }
      copy.beds = beds;
      results.push(copy);
    }

    return results;
  }

  async registerFacilityDraft(input, user, now = Date.now()) {
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
      isDemo: false,
      supportedBedCategories,
      privateVerificationData: {
        registeredBy: user.email,
        registeredAt: new Date(now).toISOString(),
      },
      createdAt: new Date(now).toISOString(),
      updatedAt: new Date(now).toISOString(),
    };

    await this.db.collection('facilities').doc(facilityId).set(draft);

    await this.recordAuditEvent({
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
            await this.submitAvailabilityReport({
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

  async updateFacilityBeds(facilityId, bedsInput, user, now = Date.now()) {
    const facility = await this.getFacility(facilityId);
    if (!facility) {
      const err = new Error(`Facility not found: "${facilityId}".`);
      err.statusCode = 404;
      throw err;
    }

    if (!canReportAvailability(user, facility)) {
      await this.recordAuditEvent({
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

      const existingSnapshot = await this.getAvailabilityCurrent(facilityId, normCat);
      let availableBeds;
      let totalBeds;

      if (typeof bedData === 'object' && bedData !== null) {
        availableBeds = Number(bedData.availableBeds);
        totalBeds = bedData.totalBeds !== undefined ? Number(bedData.totalBeds) : availableBeds;
      } else {
        availableBeds = Number(bedData);
        totalBeds = existingSnapshot?.totalBeds ? Math.max(existingSnapshot.totalBeds, availableBeds) : availableBeds;
      }

      const submission = await this.submitAvailabilityReport({
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

  async updateFacilityProfile(facilityId, input, user, now = Date.now()) {
    const facility = await this.getFacility(facilityId);
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
    await this.db.collection('facilities').doc(facilityId).set(updated, { merge: true });

    await this.recordAuditEvent({
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

  async deactivateFacility(facilityId, user, now = Date.now()) {
    const facility = await this.getFacility(facilityId);
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
    await this.db.collection('facilities').doc(facilityId).set(updated, { merge: true });

    await this.recordAuditEvent({
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

  /**
   * Resets all collections (used in automated test teardown)
   */
  async reset() {
    const collections = [
      'facilities',
      'organizations',
      'users',
      'facility_capabilities',
      'specialist_coverage',
      'availability_reports',
      'availability_current',
      'audit_events',
    ];

    for (const name of collections) {
      const snap = await this.db.collection(name).get();
      if (!snap.empty) {
        const batch = this.db.batch();
        for (const doc of snap.docs) {
          batch.delete(doc.ref);
        }
        await batch.commit();
      }
    }
  }

  async ping() {
    return { ok: true };
  }

  async close() {
    return;
  }
}

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
import { runMigrations } from './migrate.js';

// Row mapping utilities
function mapOrgRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    legalName: row.legal_name,
    displayName: row.display_name,
    organizationType: row.organization_type,
    status: row.status,
    contactEmail: row.contact_email,
    contactPhone: row.contact_phone,
    createdAt: row.created_at instanceof Date ? row.created_at.toISOString() : row.created_at,
  };
}

function mapUserRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    role: row.role,
    status: row.status,
    organizationId: row.organization_id,
    assignedFacilityIds: Array.isArray(row.assigned_facility_ids) ? row.assigned_facility_ids : [],
    createdAt: row.created_at instanceof Date ? row.created_at.toISOString() : row.created_at,
  };
}

function mapFacilityRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    organizationId: row.organization_id,
    name: row.name,
    displayName: row.display_name,
    facilityType: row.facility_type,
    address: row.address,
    locality: row.locality || '',
    city: row.city,
    district: row.district,
    state: row.state,
    postalCode: row.postal_code || '',
    latitude: Number(row.latitude),
    longitude: Number(row.longitude),
    phone: row.phone,
    publicWebsite: row.public_website,
    operatingStatus: row.operating_status,
    verificationStatus: row.verification_status,
    publicationStatus: row.publication_status,
    verifiedAt: row.verified_at ? (row.verified_at instanceof Date ? row.verified_at.toISOString() : row.verified_at) : null,
    sourceReference: row.source_reference,
    isDemo: Boolean(row.is_demo),
    supportedBedCategories: Array.isArray(row.supported_bed_categories) ? row.supported_bed_categories : ['general', 'icu', 'hdu', 'pediatric'],
    privateVerificationData: row.private_verification_data || {},
    createdAt: row.created_at instanceof Date ? row.created_at.toISOString() : row.created_at,
    updatedAt: row.updated_at instanceof Date ? row.updated_at.toISOString() : row.updated_at,
  };
}

function mapCapabilityRow(row) {
  if (!row) return null;
  return {
    facilityId: row.facility_id,
    capabilityId: row.capability_id,
    name: row.name,
    category: row.category,
    status: row.status,
    verifiedAt: row.verified_at ? (row.verified_at instanceof Date ? row.verified_at.toISOString() : row.verified_at) : null,
  };
}

function mapCoverageRow(row) {
  if (!row) return null;
  return {
    facilityId: row.facility_id,
    specialty: row.specialty,
    coverageState: row.coverage_state,
    updatedAt: row.updated_at instanceof Date ? row.updated_at.toISOString() : row.updated_at,
  };
}

function mapReportRow(row) {
  if (!row) return null;
  return {
    reportId: row.report_id,
    facilityId: row.facility_id,
    category: row.category,
    availableBeds: Number(row.available_beds),
    totalBeds: Number(row.total_beds),
    reportedAt: row.reported_at instanceof Date ? row.reported_at.toISOString() : row.reported_at,
    receivedAt: row.received_at instanceof Date ? row.received_at.toISOString() : row.received_at,
    reportedByUid: row.reported_by_uid,
    reportedByEmail: row.reported_by_email,
    reportedByRole: row.reported_by_role,
    source: row.source,
    status: row.status,
  };
}

function mapSnapshotRow(row) {
  if (!row) return null;
  return {
    facilityId: row.facility_id,
    category: row.category,
    availableBeds: Number(row.available_beds),
    totalBeds: Number(row.total_beds),
    latestReportId: row.latest_report_id,
    reportedAt: row.reported_at instanceof Date ? row.reported_at.toISOString() : row.reported_at,
    updatedAt: row.updated_at instanceof Date ? row.updated_at.toISOString() : row.updated_at,
    version: Number(row.version),
  };
}

function mapAuditEventRow(row) {
  if (!row) return null;
  return {
    eventId: row.event_id,
    actorUid: row.actor_uid,
    actorEmail: row.actor_email,
    actorRole: row.actor_role,
    facilityId: row.facility_id,
    organizationId: row.organization_id,
    action: row.action,
    outcome: row.outcome,
    timestamp: row.timestamp instanceof Date ? row.timestamp.toISOString() : row.timestamp,
    changes: row.changes,
    reason: row.reason,
  };
}

export class PostgresStorageAdapter {
  /**
   * @param {import('pg').Pool} pool
   */
  constructor(pool) {
    if (!pool || typeof pool.query !== 'function') {
      throw new Error('PostgresStorageAdapter requires a valid pg.Pool instance.');
    }
    this.pool = pool;
  }

  /**
   * Idempotent initialization: seeds pilot data only if the database is unpopulated.
   * Keeps capacity explicitly UNKNOWN until valid reports are submitted.
   */
  async seedIfEmpty() {
    await runMigrations(this.pool);
    const { rows } = await this.pool.query('SELECT 1 FROM facilities LIMIT 1');
    if (rows.length > 0) {
      return; // Already populated
    }

    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');

      for (const org of SEED_ORGANIZATIONS) {
        await client.query(`
          INSERT INTO organizations (
            id, legal_name, display_name, organization_type, status, contact_email, contact_phone, created_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
          ON CONFLICT (id) DO NOTHING
        `, [
          org.id, org.legalName, org.displayName, org.organizationType,
          org.status, org.contactEmail, org.contactPhone, org.createdAt
        ]);
      }

      for (const fac of SEED_FACILITIES) {
        await client.query(`
          INSERT INTO facilities (
            id, organization_id, name, display_name, facility_type, address, locality, city, district,
            state, postal_code, latitude, longitude, phone, public_website, operating_status,
            verification_status, publication_status, verified_at, source_reference, is_demo,
            supported_bed_categories, private_verification_data, created_at, updated_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, NOW(), NOW())
          ON CONFLICT (id) DO NOTHING
        `, [
          fac.id, fac.organizationId, fac.name, fac.displayName, fac.facilityType,
          fac.address, fac.locality, fac.city, fac.district, fac.state, fac.postalCode,
          fac.latitude, fac.longitude, fac.phone, fac.publicWebsite, fac.operatingStatus,
          fac.verificationStatus, fac.publicationStatus, fac.verifiedAt, fac.sourceReference,
          fac.isDemo, JSON.stringify(fac.supportedBedCategories), JSON.stringify(fac.privateVerificationData)
        ]);
      }

      for (const cap of SEED_FACILITY_CAPABILITIES) {
        await client.query(`
          INSERT INTO facility_capabilities (
            facility_id, capability_id, name, category, status, verified_at
          ) VALUES ($1, $2, $3, $4, $5, $6)
          ON CONFLICT (facility_id, capability_id) DO NOTHING
        `, [
          cap.facilityId, cap.capabilityId, cap.name, cap.category, cap.status, cap.verifiedAt
        ]);
      }

      for (const user of SEED_USERS) {
        await client.query(`
          INSERT INTO users (
            id, email, name, role, status, organization_id, assigned_facility_ids, created_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
          ON CONFLICT (id) DO NOTHING
        `, [
          user.id, user.email.toLowerCase(), user.name, user.role,
          user.status, user.organizationId, JSON.stringify(user.assignedFacilityIds)
        ]);
      }

      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      console.error('[CareRoute Postgres] Seed error:', err);
      throw err;
    } finally {
      client.release();
    }
  }

  // Organizations
  async getOrganization(orgId) {
    if (!orgId) return null;
    const { rows } = await this.pool.query('SELECT * FROM organizations WHERE id = $1', [orgId]);
    return mapOrgRow(rows[0]);
  }

  async listOrganizations() {
    const { rows } = await this.pool.query('SELECT * FROM organizations ORDER BY id');
    return rows.map(mapOrgRow);
  }

  // Users
  async getUser(userId) {
    if (!userId) return null;
    const { rows } = await this.pool.query('SELECT * FROM users WHERE id = $1', [userId]);
    return mapUserRow(rows[0]);
  }

  async getUserByEmail(email) {
    if (!email) return null;
    const normalized = String(email).trim().toLowerCase();
    const { rows } = await this.pool.query('SELECT * FROM users WHERE LOWER(email) = LOWER($1) LIMIT 1', [normalized]);
    return mapUserRow(rows[0]);
  }

  async getUserPasswordHashByEmail(email) {
    if (!email) return null;
    const normalized = String(email).trim().toLowerCase();
    const { rows } = await this.pool.query(
      'SELECT id, email, status, password_hash FROM users WHERE LOWER(email) = LOWER($1) LIMIT 1',
      [normalized]
    );
    if (!rows.length) return null;
    return {
      id: rows[0].id,
      email: rows[0].email,
      status: rows[0].status,
      passwordHash: rows[0].password_hash,
    };
  }

  async setUserPassword(userIdOrEmail, passwordHash) {
    if (!userIdOrEmail || !passwordHash) {
      throw new Error('User identifier and password hash are required.');
    }
    const target = String(userIdOrEmail).trim().toLowerCase();
    const { rows } = await this.pool.query(`
      UPDATE users
      SET password_hash = $1
      WHERE id = $2 OR LOWER(email) = $2
      RETURNING id, email, name, role, status, organization_id, assigned_facility_ids, created_at
    `, [passwordHash, target]);
    if (!rows.length) return null;
    return mapUserRow(rows[0]);
  }

  async registerUser(userData) {
    const id = userData.id || `user-${randomUUID()}`;
    const email = userData.email.toLowerCase();
    const name = userData.name || userData.email;
    const role = userData.role;
    const status = userData.status || 'active';
    const organizationId = userData.organizationId || null;
    const assignedFacilityIds = Array.isArray(userData.assignedFacilityIds) ? userData.assignedFacilityIds : [];
    const passwordHash = userData.passwordHash || null;

    const { rows } = await this.pool.query(`
      INSERT INTO users (
        id, email, name, role, status, organization_id, assigned_facility_ids, created_at, password_hash
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), $8)
      RETURNING *
    `, [id, email, name, role, status, organizationId, JSON.stringify(assignedFacilityIds), passwordHash]);

    return mapUserRow(rows[0]);
  }

  // Facilities
  async getFacility(facilityId) {
    if (!facilityId) return null;
    const { rows } = await this.pool.query('SELECT * FROM facilities WHERE id = $1', [facilityId]);
    return mapFacilityRow(rows[0]);
  }

  async listFacilities(filterFn = null) {
    const { rows } = await this.pool.query('SELECT * FROM facilities ORDER BY id');
    const all = rows.map(mapFacilityRow);
    return filterFn ? all.filter(filterFn) : all;
  }

  async updateFacility(facilityId, input, user = null) {
    const existing = await this.getFacility(facilityId);
    if (!existing) return null;

    const validationErrors = validateFacilityPayload(input, true);
    if (validationErrors.length) {
      throw new Error(`Facility validation failed: ${validationErrors.join(' ')}`);
    }

    const updates = [];
    const values = [];
    let paramIndex = 1;

    const fieldMap = {
      name: 'name',
      displayName: 'display_name',
      facilityType: 'facility_type',
      address: 'address',
      locality: 'locality',
      city: 'city',
      district: 'district',
      state: 'state',
      postalCode: 'postal_code',
      latitude: 'latitude',
      longitude: 'longitude',
      phone: 'phone',
      publicWebsite: 'public_website',
      operatingStatus: 'operating_status',
      verificationStatus: 'verification_status',
      publicationStatus: 'publication_status',
      verifiedAt: 'verified_at',
      sourceReference: 'source_reference',
      isDemo: 'is_demo',
      supportedBedCategories: 'supported_bed_categories',
      privateVerificationData: 'private_verification_data',
    };

    for (const [key, col] of Object.entries(fieldMap)) {
      if (input[key] !== undefined) {
        updates.push(`${col} = $${paramIndex++}`);
        if (key === 'supportedBedCategories' || key === 'privateVerificationData') {
          values.push(JSON.stringify(input[key]));
        } else {
          values.push(input[key]);
        }
      }
    }

    updates.push(`updated_at = NOW()`);
    values.push(facilityId);

    const { rows } = await this.pool.query(`
      UPDATE facilities
      SET ${updates.join(', ')}
      WHERE id = $${paramIndex}
      RETURNING *
    `, values);

    const updated = mapFacilityRow(rows[0]);

    if (user) {
      await this.recordAuditEvent({
        actor: user,
        facilityId,
        organizationId: existing.organizationId,
        action: 'facility.updated',
        outcome: 'accepted',
        changes: { ...input },
      });
    }

    return updated;
  }

  // Capabilities & Coverage
  async getFacilityCapabilities(facilityId) {
    const { rows } = await this.pool.query(
      'SELECT * FROM facility_capabilities WHERE facility_id = $1 ORDER BY capability_id',
      [facilityId]
    );
    return rows.map(mapCapabilityRow);
  }

  async getSpecialistCoverage(facilityId) {
    const { rows } = await this.pool.query(
      'SELECT * FROM specialist_coverage WHERE facility_id = $1 ORDER BY specialty',
      [facilityId]
    );
    return rows.map(mapCoverageRow);
  }

  // Availability Snapshots
  async getAvailabilityCurrent(facilityId, category) {
    const { rows } = await this.pool.query(
      'SELECT * FROM availability_current WHERE facility_id = $1 AND LOWER(category) = LOWER($2)',
      [facilityId, String(category || '').trim()]
    );
    return mapSnapshotRow(rows[0]);
  }

  async getFacilityAvailabilityMap(facilityId) {
    const facility = await this.getFacility(facilityId);
    if (!facility) return {};

    const categories = facility.supportedBedCategories || [];
    const map = {};
    for (const cat of categories) {
      map[cat] = null;
    }

    const { rows } = await this.pool.query(
      'SELECT * FROM availability_current WHERE facility_id = $1',
      [facilityId]
    );

    for (const row of rows) {
      if (row.category) {
        map[row.category] = mapSnapshotRow(row);
      }
    }

    return map;
  }

  async listAvailabilityReports(facilityId, { limit = 50, category = null } = {}) {
    let query = 'SELECT * FROM availability_reports WHERE facility_id = $1';
    const params = [facilityId];

    if (category) {
      params.push(category.toLowerCase());
      query += ` AND LOWER(category) = $${params.length}`;
    }

    query += ` ORDER BY reported_at DESC LIMIT $${params.length + 1}`;
    params.push(limit);

    const { rows } = await this.pool.query(query, params);
    return rows.map(mapReportRow);
  }

  // Audit Events
  async recordAuditEvent({ actor, facilityId, organizationId, action, outcome, changes = null, reason = null, now = Date.now() }) {
    const eventId = randomUUID();
    const actorUid = actor?.id || 'anonymous';
    const actorEmail = actor?.email || 'anonymous';
    const actorRole = actor?.role || 'public';
    const timestamp = new Date(now).toISOString();

    const { rows } = await this.pool.query(`
      INSERT INTO audit_events (
        event_id, actor_uid, actor_email, actor_role, facility_id, organization_id, action, outcome, timestamp, changes, reason
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      RETURNING *
    `, [
      eventId, actorUid, actorEmail, actorRole, facilityId || null,
      organizationId || null, action, outcome, timestamp,
      changes ? JSON.stringify(changes) : null, reason || null
    ]);

    return mapAuditEventRow(rows[0]);
  }

  async listAuditEvents({ facilityId = null, actorUid = null, limit = 100 } = {}) {
    const conditions = [];
    const params = [];

    if (facilityId) {
      params.push(facilityId);
      conditions.push(`facility_id = $${params.length}`);
    }
    if (actorUid) {
      params.push(actorUid);
      conditions.push(`actor_uid = $${params.length}`);
    }

    let query = 'SELECT * FROM audit_events';
    if (conditions.length > 0) {
      query += ` WHERE ${conditions.join(' AND ')}`;
    }

    params.push(limit);
    query += ` ORDER BY timestamp DESC LIMIT $${params.length}`;

    const { rows } = await this.pool.query(query, params);
    return rows.map(mapAuditEventRow);
  }

  /**
   * ATOMIC AVAILABILITY REPORT SUBMISSION USING POSTGRESQL TRANSACTIONS
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

    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');

      // 1. Transaction Reads: Lock and retrieve facility
      const { rows: facRows } = await client.query(
        'SELECT * FROM facilities WHERE id = $1 FOR UPDATE',
        [facilityId]
      );
      if (facRows.length === 0) {
        const err = new Error(`Facility not found: ${facilityId}`);
        err.statusCode = 404;
        throw err;
      }
      const facility = mapFacilityRow(facRows[0]);

      // 2. Permission Validation
      if (!canReportAvailability(user, facility)) {
        const err = new Error('Forbidden: You are not authorized to report availability for this facility.');
        err.statusCode = 403;
        throw err;
      }

      // 3. Schema Invariants Validation
      const payload = { category: normCat, availableBeds, totalBeds };
      const errors = validateAvailabilityReport(payload, facility);
      if (errors.length) {
        const err = new Error(`Validation failed: ${errors.join(' ')}`);
        err.statusCode = 400;
        err.details = errors;
        throw err;
      }

      // 4. Read Current Snapshot in Transaction
      const { rows: currentRows } = await client.query(
        'SELECT * FROM availability_current WHERE facility_id = $1 AND category = $2 FOR UPDATE',
        [facilityId, normCat]
      );
      const previousSnapshot = mapSnapshotRow(currentRows[0]);
      const newVersion = previousSnapshot ? (previousSnapshot.version || 1) + 1 : 1;

      // 5. Insert immutable report
      const reportId = randomUUID();
      await client.query(`
        INSERT INTO availability_reports (
          report_id, facility_id, category, available_beds, total_beds, reported_at, received_at,
          reported_by_uid, reported_by_email, reported_by_role, source, status
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      `, [
        reportId, facilityId, normCat, Number(availableBeds), Number(totalBeds),
        timestampStr, timestampStr, user.id, user.email, user.role, source, 'accepted'
      ]);

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

      // 6. Upsert current snapshot atomically
      await client.query(`
        INSERT INTO availability_current (
          facility_id, category, available_beds, total_beds, latest_report_id, reported_at, updated_at, version
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        ON CONFLICT (facility_id, category) DO UPDATE SET
          available_beds = EXCLUDED.available_beds,
          total_beds = EXCLUDED.total_beds,
          latest_report_id = EXCLUDED.latest_report_id,
          reported_at = EXCLUDED.reported_at,
          updated_at = EXCLUDED.updated_at,
          version = EXCLUDED.version
      `, [
        facilityId, normCat, Number(availableBeds), Number(totalBeds),
        reportId, timestampStr, timestampStr, newVersion
      ]);

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

      // 7. Write audit event in same transaction
      const eventId = randomUUID();
      const auditChanges = {
        category: normCat,
        previousAvailable: previousSnapshot ? previousSnapshot.availableBeds : null,
        newAvailable: Number(availableBeds),
        previousTotal: previousSnapshot ? previousSnapshot.totalBeds : null,
        newTotal: Number(totalBeds),
        reportId,
      };

      await client.query(`
        INSERT INTO audit_events (
          event_id, actor_uid, actor_email, actor_role, facility_id, organization_id, action, outcome, timestamp, changes, reason
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      `, [
        eventId, user.id || 'anonymous', user.email || 'anonymous', user.role || 'public',
        facilityId, facility.organizationId || null, 'availability_report.submitted', 'accepted',
        timestampStr, JSON.stringify(auditChanges), null
      ]);

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
        changes: auditChanges,
        reason: null,
      };

      await client.query('COMMIT');

      return { report, snapshot, auditEvent };
    } catch (err) {
      await client.query('ROLLBACK');

      // Record rejected audit event outside transaction if validation or permission failed
      if (err.statusCode === 400 || err.statusCode === 403) {
        try {
          const { rows } = await this.pool.query('SELECT organization_id FROM facilities WHERE id = $1', [facilityId]);
          await this.recordAuditEvent({
            actor: user,
            facilityId,
            organizationId: rows[0]?.organization_id || null,
            action: 'availability_report.rejected',
            outcome: 'rejected',
            reason: err.message,
            changes: { category: normCat, availableBeds, totalBeds },
            now,
          });
        } catch (_) {}
      }

      throw err;
    } finally {
      client.release();
    }
  }

  /**
   * PLATFORM VERIFICATION DECISION
   */
  async updateFacilityVerification({ facilityId, verificationStatus, publicationStatus, user, notes = '', now = Date.now() }) {
    if (!canVerifyFacility(user)) {
      const err = new Error('Forbidden: Only platform verifiers may update facility verification status.');
      err.statusCode = 403;
      throw err;
    }

    const facility = await this.getFacility(facilityId);
    if (!facility) {
      throw new Error(`Facility not found: ${facilityId}`);
    }

    const previousStatus = facility.verificationStatus;
    const previousPublication = facility.publicationStatus;
    const newVerification = verificationStatus || facility.verificationStatus;
    const newPublication = publicationStatus || facility.publicationStatus;
    const timestampStr = new Date(now).toISOString();
    const verifiedAt = newVerification === 'verified' ? timestampStr : facility.verifiedAt;

    const { rows } = await this.pool.query(`
      UPDATE facilities
      SET verification_status = $1, publication_status = $2, verified_at = $3, updated_at = $4
      WHERE id = $5
      RETURNING *
    `, [newVerification, newPublication, verifiedAt, timestampStr, facilityId]);

    const updated = mapFacilityRow(rows[0]);

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

    return { facility: updated, auditEvent };
  }

  /**
   * PUBLIC DIRECTORY PROJECTION QUERY
   */
  async getPublicDirectory(filters = {}, now = Date.now()) {
    const { rows: facRows } = await this.pool.query(`
      SELECT * FROM facilities
      WHERE verification_status = 'verified'
        AND publication_status = 'published'
        AND operating_status != 'suspended'
      ORDER BY id
    `);

    const q = String(filters.q || '').trim().toLowerCase();
    const locality = String(filters.locality || filters.city || '').trim().toLowerCase();
    const district = String(filters.district || '').trim().toLowerCase();
    const bedCategory = filters.bedCategory || filters.bedType ? String(filters.bedCategory || filters.bedType).trim().toLowerCase() : null;
    const availableOnly = filters.availableOnly === true || String(filters.availableOnly || '') === 'true';

    const projectedList = [];

    for (const facRow of facRows) {
      const fac = mapFacilityRow(facRow);
      const availMap = await this.getFacilityAvailabilityMap(fac.id);
      const capabilities = await this.getFacilityCapabilities(fac.id);
      const coverage = await this.getSpecialistCoverage(fac.id);

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
      const { rows } = await this.pool.query(
        'SELECT * FROM facilities WHERE organization_id = $1 ORDER BY id',
        [user.organizationId]
      );
      facilities = rows.map(mapFacilityRow);
    } else if (user.role === 'facility_reporter') {
      const assigned = Array.isArray(user.assignedFacilityIds) ? user.assignedFacilityIds : [];
      if (assigned.length > 0) {
        const { rows } = await this.pool.query(
          'SELECT * FROM facilities WHERE id = ANY($1::varchar[]) ORDER BY id',
          [assigned]
        );
        facilities = rows.map(mapFacilityRow);
      }
    }

    const results = [];
    for (const f of facilities) {
      const availMap = await this.getFacilityAvailabilityMap(f.id);
      const beds = {};
      for (const cat of f.supportedBedCategories || ['general', 'icu', 'hdu', 'pediatric']) {
        beds[cat] = availMap[cat]?.availableBeds || 0;
      }
      f.beds = beds;
      results.push(f);
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

    const timestampStr = new Date(now).toISOString();
    const privateVerificationData = {
      registeredBy: user.email,
      registeredAt: timestampStr,
    };

    const { rows } = await this.pool.query(`
      INSERT INTO facilities (
        id, organization_id, name, display_name, facility_type, address, locality, city, district, state,
        postal_code, latitude, longitude, phone, public_website, operating_status, verification_status,
        publication_status, verified_at, source_reference, is_demo, supported_bed_categories,
        private_verification_data, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25)
      RETURNING *
    `, [
      facilityId, user.organizationId, String(input.name).trim(), String(input.displayName || input.name).trim(),
      input.facilityType || 'hospital', String(input.address).trim(), String(input.locality || '').trim(),
      String(input.city).trim(), String(input.district || input.city).trim(), String(input.state || 'Tamil Nadu').trim(),
      String(input.postalCode || '').trim(), Number(input.latitude), Number(input.longitude),
      String(input.phone).trim(), input.publicWebsite || null,
      input.operatingStatus === 'closed' ? 'closed' : 'open',
      'pending', 'draft', null, input.sourceReference || 'Draft Registration',
      true, JSON.stringify(supportedBedCategories), JSON.stringify(privateVerificationData),
      timestampStr, timestampStr
    ]);

    const draft = mapFacilityRow(rows[0]);

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

    return draft;
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

    const updated = await this.updateFacility(facilityId, allowed, null);

    await this.recordAuditEvent({
      actor: user,
      facilityId,
      organizationId: facility.organizationId,
      action: 'facility.profile_updated',
      outcome: 'accepted',
      changes: allowed,
      now,
    });

    return updated;
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

    const { rows } = await this.pool.query(`
      UPDATE facilities
      SET operating_status = 'closed', publication_status = 'hidden', updated_at = NOW()
      WHERE id = $1
      RETURNING *
    `, [facilityId]);

    const updated = mapFacilityRow(rows[0]);

    await this.recordAuditEvent({
      actor: user,
      facilityId,
      organizationId: facility.organizationId,
      action: 'facility.deactivated',
      outcome: 'accepted',
      changes: { operatingStatus: 'closed', publicationStatus: 'hidden' },
      now,
    });

    return updated;
  }

  async ping(timeoutMs = 3000) {
    let timeoutHandle;
    const timeoutPromise = new Promise((_, reject) => {
      timeoutHandle = setTimeout(() => {
        const err = new Error('Database ping timed out.');
        err.code = 'ETIMEDOUT';
        reject(err);
      }, timeoutMs);
    });

    const queryPromise = (async () => {
      const client = await this.pool.connect();
      try {
        await client.query('SELECT 1');
        return { ok: true };
      } finally {
        client.release();
      }
    })();

    try {
      return await Promise.race([queryPromise, timeoutPromise]);
    } finally {
      clearTimeout(timeoutHandle);
    }
  }

  async close() {
    await this.pool.end();
  }
}

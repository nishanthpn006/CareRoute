-- Migration 001: Initial CareRoute Relational Schema
-- Version-controlled relational definition for PostgreSQL 17

CREATE TABLE IF NOT EXISTS schema_migrations (
  id VARCHAR(128) PRIMARY KEY,
  applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS organizations (
  id VARCHAR(64) PRIMARY KEY,
  legal_name TEXT NOT NULL,
  display_name TEXT NOT NULL,
  organization_type VARCHAR(64) NOT NULL,
  status VARCHAR(32) NOT NULL DEFAULT 'active',
  contact_email VARCHAR(255),
  contact_phone VARCHAR(64),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS users (
  id VARCHAR(64) PRIMARY KEY,
  email VARCHAR(255) NOT NULL UNIQUE,
  name TEXT NOT NULL,
  role VARCHAR(64) NOT NULL,
  status VARCHAR(32) NOT NULL DEFAULT 'active',
  organization_id VARCHAR(64) REFERENCES organizations(id) ON DELETE SET NULL,
  assigned_facility_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS facilities (
  id VARCHAR(64) PRIMARY KEY,
  organization_id VARCHAR(64) REFERENCES organizations(id) ON DELETE RESTRICT,
  name TEXT NOT NULL,
  display_name TEXT NOT NULL,
  facility_type VARCHAR(64) NOT NULL,
  address TEXT NOT NULL,
  locality TEXT NOT NULL DEFAULT '',
  city TEXT NOT NULL,
  district TEXT NOT NULL,
  state TEXT NOT NULL DEFAULT 'Tamil Nadu',
  postal_code VARCHAR(32) NOT NULL DEFAULT '',
  latitude DOUBLE PRECISION NOT NULL,
  longitude DOUBLE PRECISION NOT NULL,
  phone VARCHAR(64) NOT NULL,
  public_website TEXT,
  operating_status VARCHAR(32) NOT NULL DEFAULT 'open',
  verification_status VARCHAR(32) NOT NULL DEFAULT 'pending',
  publication_status VARCHAR(32) NOT NULL DEFAULT 'draft',
  verified_at TIMESTAMPTZ,
  source_reference TEXT,
  is_demo BOOLEAN NOT NULL DEFAULT false,
  supported_bed_categories JSONB NOT NULL DEFAULT '["general","icu","hdu","pediatric"]'::jsonb,
  private_verification_data JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_facilities_org ON facilities(organization_id);
CREATE INDEX IF NOT EXISTS idx_facilities_public ON facilities(verification_status, publication_status, operating_status);

CREATE TABLE IF NOT EXISTS facility_capabilities (
  id SERIAL PRIMARY KEY,
  facility_id VARCHAR(64) NOT NULL REFERENCES facilities(id) ON DELETE CASCADE,
  capability_id VARCHAR(64) NOT NULL,
  name TEXT NOT NULL,
  category VARCHAR(64) NOT NULL,
  status VARCHAR(32) NOT NULL DEFAULT 'available',
  verified_at TIMESTAMPTZ,
  UNIQUE(facility_id, capability_id)
);

CREATE INDEX IF NOT EXISTS idx_facility_capabilities_fac ON facility_capabilities(facility_id);

CREATE TABLE IF NOT EXISTS specialist_coverage (
  id SERIAL PRIMARY KEY,
  facility_id VARCHAR(64) NOT NULL REFERENCES facilities(id) ON DELETE CASCADE,
  specialty VARCHAR(64) NOT NULL,
  coverage_state VARCHAR(32) NOT NULL DEFAULT 'unknown',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(facility_id, specialty)
);

CREATE INDEX IF NOT EXISTS idx_specialist_coverage_fac ON specialist_coverage(facility_id);

CREATE TABLE IF NOT EXISTS availability_reports (
  report_id VARCHAR(64) PRIMARY KEY,
  facility_id VARCHAR(64) NOT NULL REFERENCES facilities(id) ON DELETE CASCADE,
  category VARCHAR(32) NOT NULL,
  available_beds INTEGER NOT NULL CHECK (available_beds >= 0),
  total_beds INTEGER NOT NULL CHECK (total_beds >= 0 AND available_beds <= total_beds),
  reported_at TIMESTAMPTZ NOT NULL,
  received_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  reported_by_uid VARCHAR(64) NOT NULL,
  reported_by_email VARCHAR(255) NOT NULL,
  reported_by_role VARCHAR(64) NOT NULL,
  source VARCHAR(64) NOT NULL DEFAULT 'manual_staff_portal',
  status VARCHAR(32) NOT NULL DEFAULT 'accepted'
);

CREATE INDEX IF NOT EXISTS idx_availability_reports_fac_cat_time ON availability_reports(facility_id, category, reported_at DESC);
CREATE INDEX IF NOT EXISTS idx_availability_reports_time ON availability_reports(reported_at DESC);

CREATE TABLE IF NOT EXISTS availability_current (
  facility_id VARCHAR(64) NOT NULL REFERENCES facilities(id) ON DELETE CASCADE,
  category VARCHAR(32) NOT NULL,
  available_beds INTEGER NOT NULL CHECK (available_beds >= 0),
  total_beds INTEGER NOT NULL CHECK (total_beds >= 0 AND available_beds <= total_beds),
  latest_report_id VARCHAR(64) NOT NULL REFERENCES availability_reports(report_id) ON DELETE RESTRICT,
  reported_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  version INTEGER NOT NULL DEFAULT 1,
  PRIMARY KEY (facility_id, category)
);

CREATE TABLE IF NOT EXISTS audit_events (
  event_id VARCHAR(64) PRIMARY KEY,
  actor_uid VARCHAR(64) NOT NULL,
  actor_email VARCHAR(255) NOT NULL,
  actor_role VARCHAR(64) NOT NULL,
  facility_id VARCHAR(64),
  organization_id VARCHAR(64),
  action VARCHAR(64) NOT NULL,
  outcome VARCHAR(32) NOT NULL,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  changes JSONB,
  reason TEXT
);

CREATE INDEX IF NOT EXISTS idx_audit_events_facility ON audit_events(facility_id, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_audit_events_actor ON audit_events(actor_uid, timestamp DESC);

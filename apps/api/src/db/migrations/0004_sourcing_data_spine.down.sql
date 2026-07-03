-- =============================================================================
-- Wave-6 deal-sourcing data spine — DOWN migration (ROLLBACK).
-- Reverses ONLY the objects introduced by 0004_sourcing_data_spine.sql.
-- Existing tables (users/roles/invites/app_meta/audit_log_entries/compliance_*)
-- are NOT touched; this migration is fully additive-reversible.
--
-- Drop order (dependency-safe, FK-dependency reverse):
--   1. Hand-appended partial-unique index on companies (must be dropped before
--      DROP TABLE; explicit drop is clearer and matches the forward migration's
--      hand-append section — though DROP TABLE would cascade-drop it automatically).
--   2. Tables in FK-dependency order (deepest FK-dependent first):
--      a. dedupe_candidates  — FKs to raw_companies + companies + users
--      b. contact_provenance — FKs to contacts + raw_companies + data_source_connections
--      c. company_provenance — FKs to companies + raw_companies + data_source_connections
--      d. contacts           — FK to companies
--      e. companies          — no FK to other new tables
--      f. raw_companies      — FK to data_source_connections
--      g. data_source_connections — FK to users (pre-existing)
--   3. pgEnum type — must be dropped AFTER all tables that reference it.
--
-- No REVOKE/GRANT rollback: sourcing tables are mutable (no privilege controls
-- analogous to audit_log_entries' immutability machinery). Dropping the tables
-- removes all associated constraints, indexes, and FK references automatically.
-- =============================================================================

-- 1. Drop hand-appended partial-unique index (explicit for symmetry with forward).
DROP INDEX IF EXISTS "companies_normalized_domain_partial_unique";
--> statement-breakpoint

-- 2a. dedupe_candidates (FKs to raw_companies, companies, users)
DROP TABLE IF EXISTS "dedupe_candidates";
--> statement-breakpoint

-- 2b. contact_provenance (FKs to contacts, raw_companies, data_source_connections)
DROP TABLE IF EXISTS "contact_provenance";
--> statement-breakpoint

-- 2c. company_provenance (FKs to companies, raw_companies, data_source_connections)
DROP TABLE IF EXISTS "company_provenance";
--> statement-breakpoint

-- 2d. contacts (FK to companies)
DROP TABLE IF EXISTS "contacts";
--> statement-breakpoint

-- 2e. companies (no FK to other new tables)
DROP TABLE IF EXISTS "companies";
--> statement-breakpoint

-- 2f. raw_companies (FK to data_source_connections)
DROP TABLE IF EXISTS "raw_companies";
--> statement-breakpoint

-- 2g. data_source_connections (FK to users — pre-existing; row dropped, FK intact)
DROP TABLE IF EXISTS "data_source_connections";
--> statement-breakpoint

-- 3. pgEnum type — drop after all referencing tables are gone.
DROP TYPE IF EXISTS "public"."dedupe_candidate_status";

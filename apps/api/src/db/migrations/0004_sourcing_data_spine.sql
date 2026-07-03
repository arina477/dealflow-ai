-- =============================================================================
-- Wave-6 deal-sourcing data spine (tasks ff378a95 + db274731).
-- Migration 0004 — forward (UP).
--
-- Creates 7 new tables + 1 pgEnum + all indexes and FKs.
-- Strictly ADDITIVE: no existing table, column, constraint, or index is touched.
-- All new objects are in the 'public' schema.
--
-- Hand-append section (after drizzle-generated DDL):
--   1. companies(normalized_domain) partial-unique index — DB-level dedup backstop.
--      (drizzle-kit cannot emit partial indexes — following 0002/0003 precedent.)
--   2. company_provenance(company_id, raw_company_id) unique — idempotency backstop.
--      (Hand-appended for clarity + symmetry with the down migration.)
--   3. contact_provenance(contact_id, raw_company_id) unique — idempotency backstop.
--
-- Down migration: 0004_sourcing_data_spine.down.sql
-- =============================================================================

-- pgEnum: dedupe_candidate_status
CREATE TYPE "public"."dedupe_candidate_status" AS ENUM('pending', 'merged', 'rejected');
--> statement-breakpoint

-- 1. data_source_connections
CREATE TABLE "data_source_connections" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"provider_key" text NOT NULL,
	"display_name" text NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"config" jsonb DEFAULT '{}' NOT NULL,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint

-- 2. raw_companies (staging)
CREATE TABLE "raw_companies" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"connection_id" uuid NOT NULL,
	"source_record_id" text NOT NULL,
	"name" text,
	"domain" text,
	"normalized_domain" text,
	"raw" jsonb NOT NULL,
	"ingested_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint

-- 3. companies (canonical)
CREATE TABLE "companies" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"domain" text,
	"normalized_domain" text,
	"normalized_name" text,
	"sector" text,
	"status" text DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone
);
--> statement-breakpoint

-- 4. contacts (canonical)
CREATE TABLE "contacts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"name" text,
	"email" text,
	"normalized_email" text,
	"title" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone
);
--> statement-breakpoint

-- 5. company_provenance
CREATE TABLE "company_provenance" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"raw_company_id" uuid NOT NULL,
	"connection_id" uuid NOT NULL,
	"contributed_fields" jsonb,
	"ingested_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint

-- 6. contact_provenance  (PRINCIPLE-3 CONTACT LINEAGE — DO NOT DROP)
CREATE TABLE "contact_provenance" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"contact_id" uuid NOT NULL,
	"raw_company_id" uuid NOT NULL,
	"connection_id" uuid NOT NULL,
	"ingested_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint

-- 7. dedupe_candidates
CREATE TABLE "dedupe_candidates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"raw_company_id" uuid NOT NULL,
	"matched_company_id" uuid,
	"score" real,
	"reason" text,
	"status" "dedupe_candidate_status" DEFAULT 'pending' NOT NULL,
	"resolved_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"resolved_at" timestamp with time zone
);
--> statement-breakpoint

-- Foreign keys (all new-table → new-table except created_by/resolved_by → users)
ALTER TABLE "data_source_connections"
	ADD CONSTRAINT "data_source_connections_created_by_fk"
	FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint

ALTER TABLE "raw_companies"
	ADD CONSTRAINT "raw_companies_connection_id_fk"
	FOREIGN KEY ("connection_id") REFERENCES "public"."data_source_connections"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint

ALTER TABLE "contacts"
	ADD CONSTRAINT "contacts_company_id_fk"
	FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint

ALTER TABLE "company_provenance"
	ADD CONSTRAINT "company_provenance_company_id_fk"
	FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "company_provenance"
	ADD CONSTRAINT "company_provenance_raw_company_id_fk"
	FOREIGN KEY ("raw_company_id") REFERENCES "public"."raw_companies"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "company_provenance"
	ADD CONSTRAINT "company_provenance_connection_id_fk"
	FOREIGN KEY ("connection_id") REFERENCES "public"."data_source_connections"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint

ALTER TABLE "contact_provenance"
	ADD CONSTRAINT "contact_provenance_contact_id_fk"
	FOREIGN KEY ("contact_id") REFERENCES "public"."contacts"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "contact_provenance"
	ADD CONSTRAINT "contact_provenance_raw_company_id_fk"
	FOREIGN KEY ("raw_company_id") REFERENCES "public"."raw_companies"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "contact_provenance"
	ADD CONSTRAINT "contact_provenance_connection_id_fk"
	FOREIGN KEY ("connection_id") REFERENCES "public"."data_source_connections"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint

ALTER TABLE "dedupe_candidates"
	ADD CONSTRAINT "dedupe_candidates_raw_company_id_fk"
	FOREIGN KEY ("raw_company_id") REFERENCES "public"."raw_companies"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "dedupe_candidates"
	ADD CONSTRAINT "dedupe_candidates_matched_company_id_fk"
	FOREIGN KEY ("matched_company_id") REFERENCES "public"."companies"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "dedupe_candidates"
	ADD CONSTRAINT "dedupe_candidates_resolved_by_fk"
	FOREIGN KEY ("resolved_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint

-- Regular indexes (dedupe match scans + screen filters)
CREATE UNIQUE INDEX "raw_companies_connection_source_unique"
	ON "raw_companies" ("connection_id", "source_record_id");
--> statement-breakpoint
CREATE INDEX "raw_companies_normalized_domain_idx"
	ON "raw_companies" ("normalized_domain");
--> statement-breakpoint
CREATE INDEX "raw_companies_connection_id_idx"
	ON "raw_companies" ("connection_id");
--> statement-breakpoint
CREATE INDEX "companies_normalized_domain_idx"
	ON "companies" ("normalized_domain");
--> statement-breakpoint
CREATE INDEX "companies_normalized_name_idx"
	ON "companies" ("normalized_name");
--> statement-breakpoint
CREATE INDEX "companies_status_name_domain_idx"
	ON "companies" ("status", "name", "domain");
--> statement-breakpoint
CREATE INDEX "contacts_company_id_idx"
	ON "contacts" ("company_id");
--> statement-breakpoint
CREATE INDEX "contacts_normalized_email_idx"
	ON "contacts" ("normalized_email");
--> statement-breakpoint
CREATE UNIQUE INDEX "company_provenance_company_raw_unique"
	ON "company_provenance" ("company_id", "raw_company_id");
--> statement-breakpoint
CREATE INDEX "company_provenance_company_id_idx"
	ON "company_provenance" ("company_id");
--> statement-breakpoint
CREATE UNIQUE INDEX "contact_provenance_contact_raw_unique"
	ON "contact_provenance" ("contact_id", "raw_company_id");
--> statement-breakpoint
CREATE INDEX "contact_provenance_contact_id_idx"
	ON "contact_provenance" ("contact_id");
--> statement-breakpoint
CREATE INDEX "dedupe_candidates_status_idx"
	ON "dedupe_candidates" ("status");
--> statement-breakpoint
CREATE INDEX "dedupe_candidates_matched_company_id_idx"
	ON "dedupe_candidates" ("matched_company_id");

-- =============================================================================
-- HAND-APPENDED: partial unique indexes and idempotency constraints.
-- (drizzle-kit cannot emit partial indexes — following the 0002/0003
--  hand-append precedent.)
--
-- Wave-6, B-2 P-4 remediation (delta 0 + karen MEDIUM).
-- Refs: ff378a95, db274731.
--
-- Index 1 — companies(normalized_domain) WHERE normalized_domain IS NOT NULL.
--   The DB-level dedup backstop guaranteeing "idempotent re-run = no duplicate
--   canonical" even under a future concurrent/async dedupe path.
--   Deterministic single-run dedupe won't hit it in normal operation; the index
--   is the correctness guarantee for the race, not just an optimization.
--   Two concurrent promotions of the same normalized_domain: the second
--   INSERT fails with SQLSTATE 23505 (unique_violation), which the engine's
--   ON CONFLICT catch handles as "already promoted — skip".
--   NULL normalized_domain rows (name-only matches) are excluded — multiple
--   name-only canonical companies may coexist without conflicting here;
--   their dedup is enforced by the engine's name-match step at promotion time.
--
-- Index 2 — company_provenance(company_id, raw_company_id).
--   Idempotency backstop: a raw record contributes to a canonical company at
--   most once. Re-running the dedupe engine uses ON CONFLICT DO NOTHING on
--   this unique pair, so re-runs add no duplicate provenance rows.
--   (Also emitted as a regular unique above; this comment is the authoritative
--   explanation of why the constraint exists.)
--
-- Index 3 — contact_provenance(contact_id, raw_company_id).
--   Mirrors index 2 for the contact dimension — principle-3 invariant for
--   contacts. Re-running dedupe adds no duplicate contact provenance rows.
-- =============================================================================

--> statement-breakpoint
-- Index 1: partial-unique dedup backstop on companies.normalized_domain.
CREATE UNIQUE INDEX "companies_normalized_domain_partial_unique"
	ON "companies" ("normalized_domain")
	WHERE normalized_domain IS NOT NULL;

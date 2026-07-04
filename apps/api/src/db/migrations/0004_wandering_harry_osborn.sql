CREATE TYPE "public"."dedupe_candidate_status" AS ENUM('pending', 'merged', 'rejected');--> statement-breakpoint
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
CREATE TABLE "company_provenance" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"raw_company_id" uuid NOT NULL,
	"connection_id" uuid NOT NULL,
	"contributed_fields" jsonb,
	"ingested_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "company_provenance_company_raw_unique" UNIQUE("company_id","raw_company_id")
);
--> statement-breakpoint
CREATE TABLE "contact_provenance" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"contact_id" uuid NOT NULL,
	"raw_company_id" uuid NOT NULL,
	"connection_id" uuid NOT NULL,
	"ingested_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "contact_provenance_contact_raw_unique" UNIQUE("contact_id","raw_company_id")
);
--> statement-breakpoint
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
CREATE TABLE "raw_companies" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"connection_id" uuid NOT NULL,
	"source_record_id" text NOT NULL,
	"name" text,
	"domain" text,
	"normalized_domain" text,
	"raw" jsonb NOT NULL,
	"ingested_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "raw_companies_connection_source_unique" UNIQUE("connection_id","source_record_id")
);
--> statement-breakpoint
ALTER TABLE "company_provenance" ADD CONSTRAINT "company_provenance_company_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "company_provenance" ADD CONSTRAINT "company_provenance_raw_company_id_fk" FOREIGN KEY ("raw_company_id") REFERENCES "public"."raw_companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "company_provenance" ADD CONSTRAINT "company_provenance_connection_id_fk" FOREIGN KEY ("connection_id") REFERENCES "public"."data_source_connections"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contact_provenance" ADD CONSTRAINT "contact_provenance_contact_id_fk" FOREIGN KEY ("contact_id") REFERENCES "public"."contacts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contact_provenance" ADD CONSTRAINT "contact_provenance_raw_company_id_fk" FOREIGN KEY ("raw_company_id") REFERENCES "public"."raw_companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contact_provenance" ADD CONSTRAINT "contact_provenance_connection_id_fk" FOREIGN KEY ("connection_id") REFERENCES "public"."data_source_connections"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contacts" ADD CONSTRAINT "contacts_company_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "data_source_connections" ADD CONSTRAINT "data_source_connections_created_by_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dedupe_candidates" ADD CONSTRAINT "dedupe_candidates_raw_company_id_fk" FOREIGN KEY ("raw_company_id") REFERENCES "public"."raw_companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dedupe_candidates" ADD CONSTRAINT "dedupe_candidates_matched_company_id_fk" FOREIGN KEY ("matched_company_id") REFERENCES "public"."companies"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dedupe_candidates" ADD CONSTRAINT "dedupe_candidates_resolved_by_fk" FOREIGN KEY ("resolved_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "raw_companies" ADD CONSTRAINT "raw_companies_connection_id_fk" FOREIGN KEY ("connection_id") REFERENCES "public"."data_source_connections"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "companies_normalized_domain_idx" ON "companies" USING btree ("normalized_domain");--> statement-breakpoint
CREATE INDEX "companies_normalized_name_idx" ON "companies" USING btree ("normalized_name");--> statement-breakpoint
CREATE INDEX "companies_status_name_domain_idx" ON "companies" USING btree ("status","name","domain");--> statement-breakpoint
CREATE INDEX "company_provenance_company_id_idx" ON "company_provenance" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "contact_provenance_contact_id_idx" ON "contact_provenance" USING btree ("contact_id");--> statement-breakpoint
CREATE INDEX "contacts_company_id_idx" ON "contacts" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "contacts_normalized_email_idx" ON "contacts" USING btree ("normalized_email");--> statement-breakpoint
CREATE INDEX "dedupe_candidates_status_idx" ON "dedupe_candidates" USING btree ("status");--> statement-breakpoint
CREATE INDEX "dedupe_candidates_matched_company_id_idx" ON "dedupe_candidates" USING btree ("matched_company_id");--> statement-breakpoint
CREATE INDEX "raw_companies_normalized_domain_idx" ON "raw_companies" USING btree ("normalized_domain");--> statement-breakpoint
CREATE INDEX "raw_companies_connection_id_idx" ON "raw_companies" USING btree ("connection_id");
--> statement-breakpoint
-- HAND-APPENDED (drizzle-kit cannot emit partial indexes — 0002/0003 precedent):
-- companies(normalized_domain) partial-unique = the DB-level dedup backstop
-- guaranteeing at most one canonical company per normalized domain (idempotent
-- dedupe even under a future concurrent/async promotion path).
CREATE UNIQUE INDEX "companies_normalized_domain_partial_unique" ON "companies" ("normalized_domain") WHERE "normalized_domain" IS NOT NULL;
-- HAND-APPENDED: dedupe_candidates partial-unique idempotency backstop.
-- UNIQUE(raw_company_id, matched_company_id) WHERE status = 'pending' ensures
-- that a re-sync producing an ambiguous candidate for the same (raw, canonical)
-- pair does NOT pile up duplicate pending review-queue rows.
-- Partial on status='pending' so a resolved candidate (rejected/merged) does
-- NOT prevent a legitimately re-raised pending candidate in a future sync.
-- The engine uses .onConflictDoNothing({ target, targetWhere }) against this index.
CREATE UNIQUE INDEX "dedupe_candidates_raw_matched_pending_unique" ON "dedupe_candidates" ("raw_company_id", "matched_company_id") WHERE status = 'pending';

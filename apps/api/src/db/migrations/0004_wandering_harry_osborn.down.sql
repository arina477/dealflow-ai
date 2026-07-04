-- Down migration for 0004_wandering_harry_osborn (deal-sourcing data spine).
-- Drops only the new objects in FK-dependency order; existing tables untouched.
DROP INDEX IF EXISTS "dedupe_candidates_raw_matched_pending_unique";--> statement-breakpoint
DROP INDEX IF EXISTS "companies_normalized_domain_partial_unique";--> statement-breakpoint
DROP TABLE IF EXISTS "contact_provenance";--> statement-breakpoint
DROP TABLE IF EXISTS "company_provenance";--> statement-breakpoint
DROP TABLE IF EXISTS "dedupe_candidates";--> statement-breakpoint
DROP TABLE IF EXISTS "contacts";--> statement-breakpoint
DROP TABLE IF EXISTS "raw_companies";--> statement-breakpoint
DROP TABLE IF EXISTS "companies";--> statement-breakpoint
DROP TABLE IF EXISTS "data_source_connections";--> statement-breakpoint
DROP TYPE IF EXISTS "dedupe_candidate_status";

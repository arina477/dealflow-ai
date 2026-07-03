-- Down-migration for 0003_giant_outlaw_kid (wave-5 B-2 compliance rules engine).
-- Reverses ONLY the objects introduced by the forward migration.
-- Existing tables (users/roles/invites/app_meta/audit_log_entries) are NOT touched;
-- this migration is fully additive-reversible.
--
-- Drop order (dependency-safe):
--   1. Indexes (implicit via DROP TABLE; listed conceptually for clarity)
--   2. Tables in FK-dependency order:
--      a. compliance_approvals  — FK to users (no other table depends on it)
--      b. compliance_rules      — FK to users (no other table depends on it)
--      c. disclaimer_templates  — FK to users (no other table depends on it)
--      d. suppression_list      — FK to users (no other table depends on it)
--   3. pgEnum types — must be dropped AFTER all tables that reference them
--
-- No REVOKE/GRANT rollback needed — these tables have no immutability privilege
-- controls (unlike audit_log_entries in 0002). Dropping the tables removes all
-- associated constraints, indexes, and FK references automatically.

DROP TABLE IF EXISTS "compliance_approvals";
--> statement-breakpoint
DROP TABLE IF EXISTS "compliance_rules";
--> statement-breakpoint
DROP TABLE IF EXISTS "disclaimer_templates";
--> statement-breakpoint
DROP TABLE IF EXISTS "suppression_list";
--> statement-breakpoint
DROP TYPE IF EXISTS "public"."approval_status";
--> statement-breakpoint
DROP TYPE IF EXISTS "public"."compliance_rule_type";
--> statement-breakpoint
DROP TYPE IF EXISTS "public"."suppression_match_type";

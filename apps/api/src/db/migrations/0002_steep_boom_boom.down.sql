-- Down-migration for 0002_steep_boom_boom (wave-4 B-2 audit_log_entries).
-- Reverses ONLY the objects introduced by the forward migration.
-- Existing tables (users/roles/invites/app_meta) are NOT touched;
-- this migration is fully additive-reversible.
--
-- Drop order:
--   1. Triggers first (depend on the functions and the table)
--   2. Trigger functions
--   3. Table (drops the FK constraint and identity sequence automatically)
-- No REVOKE/GRANT rollback needed — dropping the table removes the object
-- the grant/revoke targeted; the grants (incl. the PUBLIC revoke) cease to
-- exist with the table.

DROP TRIGGER IF EXISTS audit_log_no_truncate ON audit_log_entries;
--> statement-breakpoint
DROP TRIGGER IF EXISTS audit_log_no_mutate ON audit_log_entries;
--> statement-breakpoint
DROP FUNCTION IF EXISTS audit_log_block_truncate();
--> statement-breakpoint
DROP FUNCTION IF EXISTS audit_log_block_mutation();
--> statement-breakpoint
DROP TABLE IF EXISTS "audit_log_entries";

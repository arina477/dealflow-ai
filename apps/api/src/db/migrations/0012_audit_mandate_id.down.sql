-- Rollback: wave-14 additive mandate_id column on audit_log_entries.
-- Drops the column added by 0012_audit_mandate_id.sql.

ALTER TABLE "audit_log_entries"
  DROP COLUMN IF EXISTS "mandate_id";

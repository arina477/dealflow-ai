-- Rollback for migration 0013 (wave-15 admin vertical — additive only).
-- Removes workspace_settings table + encrypted_credentials column +
-- users.deactivated_at column.
--
-- Additive-only: the original tables are untouched; this rollback is safe.

ALTER TABLE "users" DROP COLUMN IF EXISTS "deactivated_at";
ALTER TABLE "data_source_connections" DROP COLUMN IF EXISTS "encrypted_credentials";
DROP TABLE IF EXISTS "workspace_settings";

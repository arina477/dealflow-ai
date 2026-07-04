-- Down migration for 0005_unique_connection_display_name
-- Drops the UNIQUE constraint on data_source_connections(display_name).
ALTER TABLE "data_source_connections" DROP CONSTRAINT IF EXISTS "data_source_connections_display_name_unique";

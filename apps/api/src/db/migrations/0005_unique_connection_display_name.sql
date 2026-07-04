-- Migration 0005: UNIQUE constraint on data_source_connections(display_name)
--
-- INFO integrity fix (wave-7 B-6 review):
--   Without this constraint, an analyst can create N duplicate connector rows
--   with the same display_name. Because every fixture connection ingests the same
--   fixture universe, the ≥2-source facet and per-company connectionIds count the
--   same dataset multiple times — the workspace shows "2 sources" when it is really
--   one dataset ingested twice from duplicate connectors.
--
--   Adding UNIQUE(display_name) prevents duplicate connectors at the DB level.
--   The repository's createConnection method catches SQLSTATE 23505 → 409
--   ConflictException ('a connection with that name exists').
--
-- Additive-only: does not alter any existing table structure beyond adding
-- the unique constraint. Safe to apply against an existing populated DB
-- (provided no duplicate display_name rows already exist).

ALTER TABLE "data_source_connections" ADD CONSTRAINT "data_source_connections_display_name_unique" UNIQUE("display_name");

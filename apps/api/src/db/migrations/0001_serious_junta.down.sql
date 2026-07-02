-- Down-migration for 0001_serious_junta (wave-2 B-0 auth data model).
-- Reverses ONLY the three tables introduced by the forward migration.
-- app_meta is NOT touched; this migration is fully additive-reversible.
--
-- Drop order respects FK dependency graph:
--   invites → users → roles
-- Dropping the tables cascades their constraints and indexes automatically.

DROP TABLE IF EXISTS "invites";
--> statement-breakpoint
DROP TABLE IF EXISTS "users";
--> statement-breakpoint
DROP TABLE IF EXISTS "roles";

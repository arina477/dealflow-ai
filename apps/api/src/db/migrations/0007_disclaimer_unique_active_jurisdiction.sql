-- Migration 0007: disclaimer_templates partial unique index (CRITICAL-3 defence-in-depth)
--
-- Adds a partial unique index on disclaimer_templates(jurisdiction) WHERE active = true.
-- This enforces at the DB level that at most one active disclaimer template exists per
-- jurisdiction, making the ambiguous-disclaimer hazard (CRITICAL-3) structurally
-- impossible rather than just caught by application code.
--
-- Safe-to-apply condition: this migration may only be run if no jurisdiction currently
-- has more than one active row. The pre-check query is:
--
--   SELECT jurisdiction, count(*)
--   FROM disclaimer_templates
--   WHERE active = true
--   GROUP BY jurisdiction
--   HAVING count(*) > 1;
--
-- If that query returns rows, deactivate the duplicates first (by setting active=false
-- on all but the intended current version), then apply this migration.
--
-- The application-layer ConflictException in findActiveDisclaimerByJurisdiction provides
-- the primary ambiguity guard; this index is defence-in-depth.
--> statement-breakpoint
CREATE UNIQUE INDEX "disclaimer_templates_one_active_per_jurisdiction_idx"
  ON "disclaimer_templates" ("jurisdiction")
  WHERE "active" = true;

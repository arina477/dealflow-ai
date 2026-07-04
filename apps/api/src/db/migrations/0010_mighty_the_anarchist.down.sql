-- Rollback: wave-11 outreach spine (B-0)
-- Drops 3 tables and the 2 pgEnums introduced by 0010_mighty_the_anarchist.sql.
-- Order: drop child tables first (outreach has FK → outreach_template_versions,
-- outreach_template_versions has FK → outreach_templates), then enums.

DROP TABLE IF EXISTS "outreach";
DROP TABLE IF EXISTS "outreach_template_versions";
DROP TABLE IF EXISTS "outreach_templates";
DROP TYPE IF EXISTS "public"."outreach_status";
DROP TYPE IF EXISTS "public"."outreach_approval_status";

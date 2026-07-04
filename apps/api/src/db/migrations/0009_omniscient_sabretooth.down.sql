-- Rollback: wave-10 match spine (B-0)
-- Drops 2 tables and the 2 pgEnums introduced by 0009_omniscient_sabretooth.sql.
-- Order: drop child table first (match_candidates has FK → match_run),
-- then match_run, then the enums.

DROP TABLE IF EXISTS "match_candidates";
DROP TABLE IF EXISTS "match_run";
DROP TYPE IF EXISTS "public"."match_candidate_disposition";
DROP TYPE IF EXISTS "public"."match_run_status";

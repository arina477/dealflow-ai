-- Rollback: wave-9 buyer-universe spine (B-0)
-- Drops 2 tables and the 2 pgEnums introduced by 0008_noisy_hitman.sql.
-- Order: drop child table first (buyer_universe_candidates has FK → buyer_universe),
-- then buyer_universe, then the enums.

DROP TABLE IF EXISTS "buyer_universe_candidates";
DROP TABLE IF EXISTS "buyer_universe";
DROP TYPE IF EXISTS "public"."buyer_universe_candidate_membership_status";
DROP TYPE IF EXISTS "public"."buyer_universe_status";

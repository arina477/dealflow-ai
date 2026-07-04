-- Rollback: wave-8 mandate spine (B-0)
-- Drops 3 tables and the mandate_status enum introduced by 0006_mandate_spine.sql.
-- Order: drop child FKs first (mandate_buyer_criteria, mandate_compliance_profile),
-- then mandates (has the enum + the created_by FK ref), then the enum itself.

DROP TABLE IF EXISTS "mandate_compliance_profile";
DROP TABLE IF EXISTS "mandate_buyer_criteria";
DROP TABLE IF EXISTS "mandates";
DROP TYPE IF EXISTS "public"."mandate_status";

-- Rollback: wave-12 pipeline spine (B-0, task 07989285)
-- Drops 2 tables and the 2 pgEnums introduced by 0011_brainy_the_liberteens.sql.
-- Order: drop child table first (pipeline_events has FK → pipeline),
-- then parent table (pipeline), then enums (pipeline_stage is referenced by
-- both tables; pipeline_event_type is referenced by pipeline_events).

DROP TABLE IF EXISTS "pipeline_events";
DROP TABLE IF EXISTS "pipeline";
DROP TYPE IF EXISTS "public"."pipeline_event_type";
DROP TYPE IF EXISTS "public"."pipeline_stage";

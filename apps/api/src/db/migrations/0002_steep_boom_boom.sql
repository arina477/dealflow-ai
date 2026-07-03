CREATE TABLE "audit_log_entries" (
	"sequence_number" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "audit_log_entries_sequence_number_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"actor_user_id" uuid,
	"actor_role" text NOT NULL,
	"action" text NOT NULL,
	"resource_type" text NOT NULL,
	"resource_id" text,
	"content_hash" text NOT NULL,
	"payload_hash" text NOT NULL,
	"prev_hash" text NOT NULL,
	"entry_hash" text NOT NULL,
	"chain_version" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "audit_log_entries" ADD CONSTRAINT "audit_log_entries_actor_user_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
-- =============================================================================
-- HAND-APPENDED: immutability controls (drizzle-kit cannot emit these).
-- Wave-4, task ec1f279d. Following the 0001_serious_junta.sql precedent of
-- appending raw SQL after the drizzle-generated DDL.
--
-- Two independent DB-layer controls (P-3 plan §Δ1):
--   Control 1 — REVOKE/GRANT: blocks the app role at the privilege layer.
--     Note: grants do not bind the table owner/superuser; the TRIGGER (control 2)
--     covers those privileged actors.
--   Control 2 — BEFORE UPDATE OR DELETE trigger: fires for EVERY connecting role,
--     including superuser/table-owner. Postgres evaluates BEFORE row triggers before
--     applying the DML, regardless of session privileges. The only escapes
--     (ALTER TABLE DISABLE TRIGGER / SET session_replication_role = replica) are
--     privileged, non-default, and auditable — they cannot be performed by the app
--     in the normal path.
--
-- Deployment note (CURRENT_USER):
--   This migration runs as the same role the NestJS runtime uses (DATABASE_URL).
--   CURRENT_USER inside the migration transaction IS the app role, so the grant
--   targets the correct role without hard-coding its name (self-adjusting for
--   Railway's single-role deploy model). If a future deployment separates the
--   migration role from the runtime role, set AUDIT_APP_ROLE to the runtime role
--   name and replace CURRENT_USER with that variable in a deployment script.
-- =============================================================================

-- Control 1: Restrict the app role to INSERT + SELECT only.
-- REVOKE is explicit and belt-and-suspenders: a freshly created table grants no
-- UPDATE/DELETE to non-owners by default, but the REVOKE makes intent auditable
-- and covers the case where the app role IS the table owner (owners hold implicit
-- full rights; REVOKE-from-owner is a no-op at the privilege layer, which is why
-- Control 2 — the trigger — is the load-bearing immutability control for that case).
REVOKE UPDATE, DELETE, TRUNCATE ON audit_log_entries FROM CURRENT_USER;
GRANT INSERT, SELECT ON audit_log_entries TO CURRENT_USER;
--> statement-breakpoint

-- Control 1b: Revoke ALL from PUBLIC. Any role that is neither the table owner
-- nor the explicitly-granted app role must hold NO privilege on the audit table
-- (defense-in-depth: a future secondary role — reporting, migration, a leaked
-- low-priv login — cannot mutate or even read the chain by default). PUBLIC is
-- the implicit grantee every role inherits; revoking here closes that channel
-- without affecting the owner (owner rights are implicit, not PUBLIC-derived)
-- or the app role (re-granted explicitly above).
REVOKE ALL ON audit_log_entries FROM PUBLIC;
--> statement-breakpoint

-- Control 2: Trigger function — blocks UPDATE and DELETE for every role.
-- OR REPLACE makes forward re-runs idempotent (safe to apply twice).
--
-- NOTE: no SECURITY DEFINER. A pure RAISE needs no elevated privilege — it reads
-- no protected object and writes nothing; running with the INVOKER's rights
-- (SECURITY INVOKER, the default) is least-privilege and removes an unnecessary
-- privilege-escalation surface. This is a ROW-level function: OLD is available,
-- so it references OLD.sequence_number directly.
CREATE OR REPLACE FUNCTION audit_log_block_mutation()
  RETURNS trigger
  LANGUAGE plpgsql
AS $$
BEGIN
  -- TG_OP is 'UPDATE' or 'DELETE' — include it in the error so the caller
  -- gets a precise, machine-stable message for incident investigation.
  RAISE EXCEPTION
    'audit_log_entries is append-only: % blocked on row sequence_number=%',
    TG_OP,
    OLD.sequence_number;
  -- RETURN NULL would suppress the operation in an AFTER trigger; in a BEFORE
  -- trigger it cancels the row change. The RAISE EXCEPTION above never returns,
  -- but the RETURN is required by PL/pgSQL syntax.
  RETURN NULL;
END;
$$;
--> statement-breakpoint

-- Attach the trigger: fires BEFORE every UPDATE or DELETE, for each affected row.
-- DROP IF EXISTS before CREATE makes the forward migration re-run safe.
DROP TRIGGER IF EXISTS audit_log_no_mutate ON audit_log_entries;
CREATE TRIGGER audit_log_no_mutate
  BEFORE UPDATE OR DELETE ON audit_log_entries
  FOR EACH ROW
  EXECUTE FUNCTION audit_log_block_mutation();
--> statement-breakpoint

-- Control 3: TRUNCATE guard. The UPDATE/DELETE trigger above is FOR EACH ROW and
-- does NOT fire on TRUNCATE — which is a full-table wipe path available to the
-- table owner/superuser (the exact privileged actor Control 2 exists to stop for
-- row-level DML). A STATEMENT-level BEFORE TRUNCATE trigger closes that gap
-- symmetrically. A separate function is used because at STATEMENT level OLD is
-- unavailable (no per-row context) — referencing OLD.sequence_number here would
-- error; this function raises without any OLD reference.
CREATE OR REPLACE FUNCTION audit_log_block_truncate()
  RETURNS trigger
  LANGUAGE plpgsql
AS $$
BEGIN
  -- TG_OP is 'TRUNCATE'. STATEMENT-level: no OLD, so we cite the table, not a row.
  RAISE EXCEPTION
    'audit_log_entries is append-only: % blocked (full-table wipe is not permitted)',
    TG_OP;
  RETURN NULL;
END;
$$;
--> statement-breakpoint

-- Attach the TRUNCATE guard: fires BEFORE every TRUNCATE, once per statement.
DROP TRIGGER IF EXISTS audit_log_no_truncate ON audit_log_entries;
CREATE TRIGGER audit_log_no_truncate
  BEFORE TRUNCATE ON audit_log_entries
  FOR EACH STATEMENT
  EXECUTE FUNCTION audit_log_block_truncate();

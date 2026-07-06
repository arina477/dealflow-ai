-- Migration 0016 — dealflow_app non-superuser application role (wave-17, M8 B-6 rework2)
-- Tasks: 96026365 (workspace-isolation enforcement) + df2f3b2f (isolation e2e)
--
-- SECURITY CRITICAL — Finding #2 (P0):
--   When the app (or CI) connects as `postgres` (SUPERUSER), FORCE ROW LEVEL SECURITY
--   is bypassed because superusers have implicit BYPASSRLS. All isolation is silently
--   unenforced and every isolation e2e assertion is vacuous — a real cross-tenant leak
--   WOULD NOT be caught by the tests.
--
-- FIX: create a non-superuser application role that the app must connect as. RLS applies
--   to this role, so isolation is genuinely enforced. The role has only the minimum
--   privileges required: DML on tenant tables, USAGE on sequences, EXECUTE on the three
--   SECURITY DEFINER bootstrap functions.
--
-- JOURNALED: idx 16, when > 1784073600000 (0015 when = 1784073600000).
--
-- C-2 PROD HAND-OFF (Railway):
--   In Railway, set DATABASE_URL to a connection string that authenticates as
--   `dealflow_app` (e.g., postgres://dealflow_app:<password>@host:5432/db).
--   The migration itself is run by the owning superuser (migration role). The app's
--   runtime DATABASE_URL must NOT be the postgres/superuser URL.
--   The startup is_superuser assertion (in the NestJS bootstrap) will FAIL LOUDLY
--   if the app boots as a superuser or BYPASSRLS role, so a misconfigured Railway
--   DATABASE_URL is caught at startup rather than silently shipping broken isolation.
--
-- EXECUTION ORDER (additive, no schema changes):
--   1. CREATE ROLE dealflow_app (NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE LOGIN).
--      Password is set via Railway env; local dev uses .env.local DATABASE_URL override.
--   2. GRANT USAGE on the public schema.
--   3. GRANT SELECT/INSERT/UPDATE/DELETE on all tenant tables.
--   4. GRANT USAGE/SELECT on all sequences (for gen_random_uuid()-backed columns and
--      nextval-backed sequences like audit_log_entries.sequence_number).
--   5. GRANT EXECUTE on the three SECURITY DEFINER bootstrap functions.
--   6. GRANT SELECT on non-tenant global tables (roles, workspaces, app_meta).
--
-- NOTE: The role owner (postgres / migration superuser) retains ownership of all
--   tables. dealflow_app is a GRANTEE, not an owner. FORCE ROW LEVEL SECURITY is
--   enforced on non-owner, non-superuser, non-BYPASSRLS connections — dealflow_app
--   satisfies all three conditions, so RLS applies.

-- ============================================================================
-- STEP 1 — Create the application role
-- IF NOT EXISTS is idempotent: re-running this migration (e.g. idempotent CI reset)
-- does not error. The role will exist; subsequent GRANT statements are idempotent.
-- ============================================================================

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'dealflow_app') THEN
    CREATE ROLE dealflow_app
      NOSUPERUSER
      NOBYPASSRLS
      NOCREATEDB
      NOCREATEROLE
      LOGIN;
  END IF;
END
$$;
--> statement-breakpoint

-- ============================================================================
-- STEP 2 — Schema-level USAGE (required to reference objects in the schema)
-- ============================================================================

GRANT USAGE ON SCHEMA public TO dealflow_app;
--> statement-breakpoint

-- ============================================================================
-- STEP 3 — DML on all 28 tenant tables + 2 global tables the app reads
-- ============================================================================

-- Tenant tables (RLS applies when connected as dealflow_app)
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.users                      TO dealflow_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.invites                    TO dealflow_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.audit_log_entries          TO dealflow_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.compliance_rules           TO dealflow_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.suppression_list           TO dealflow_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.disclaimer_templates       TO dealflow_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.compliance_approvals       TO dealflow_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.mandates                   TO dealflow_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.mandate_buyer_criteria     TO dealflow_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.mandate_compliance_profile TO dealflow_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.data_source_connections    TO dealflow_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.raw_companies              TO dealflow_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.companies                  TO dealflow_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.contacts                   TO dealflow_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.company_provenance         TO dealflow_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.contact_provenance         TO dealflow_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.dedupe_candidates          TO dealflow_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.buyer_universe             TO dealflow_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.buyer_universe_candidates  TO dealflow_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.match_run                  TO dealflow_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.match_candidates           TO dealflow_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.outreach_templates         TO dealflow_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.outreach_template_versions TO dealflow_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.outreach                   TO dealflow_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.pipeline                   TO dealflow_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.pipeline_events            TO dealflow_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.workspace_settings         TO dealflow_app;

-- Global tables (no RLS — RBAC, workspace catalogue, app bootstrap)
GRANT SELECT ON TABLE public.roles       TO dealflow_app;
GRANT SELECT ON TABLE public.workspaces  TO dealflow_app;
GRANT SELECT ON TABLE public.app_meta    TO dealflow_app;
--> statement-breakpoint

-- ============================================================================
-- STEP 4 — Sequences
-- audit_log_entries uses a bigserial sequence (sequence_number). All other
-- primary keys use gen_random_uuid() (no sequence dependency), but granting
-- ALL SEQUENCES is defensive and avoids per-sequence enumeration.
-- ============================================================================

GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO dealflow_app;
--> statement-breakpoint

-- ============================================================================
-- STEP 5 — EXECUTE on the three SECURITY DEFINER bootstrap functions
-- These bypass RLS for specific narrow bootstrap paths. Without EXECUTE the
-- app cannot call them and signup / workspace resolution / audit chain breaks.
-- ============================================================================

GRANT EXECUTE ON FUNCTION public.resolve_user_workspace(text)             TO dealflow_app;
GRANT EXECUTE ON FUNCTION public.resolve_invite(text)                     TO dealflow_app;
GRANT EXECUTE ON FUNCTION public.read_audit_chain_rls_exempt(bigint, bigint) TO dealflow_app;
--> statement-breakpoint

-- ============================================================================
-- STEP 6 — Drizzle migration bookkeeping table (schema: drizzle)
-- The app does NOT run migrations at runtime (migrations are run by the
-- superuser in CI/deploy). BUT read access to __drizzle_migrations is needed
-- by ensureMigrated() in the e2e test helpers which connect as dealflow_app
-- in the non-superuser pool. Additive: only the schema USAGE + table SELECT.
-- ============================================================================

GRANT USAGE ON SCHEMA drizzle TO dealflow_app;
GRANT SELECT ON TABLE drizzle.__drizzle_migrations TO dealflow_app;

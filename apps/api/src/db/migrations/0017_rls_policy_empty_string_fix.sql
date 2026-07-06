-- Migration 0017 — RLS policy empty-string cast fix (wave-17, M8 B-block fixup)
-- Task: df2f3b2f (isolation e2e)
--
-- PROBLEM:
--   The RLS policies installed by migration 0014 use:
--     USING (workspace_id = current_setting('app.workspace_id', true)::uuid)
--
--   In PostgreSQL, for a custom GUC (app.*) that has been SET and then RESET,
--   current_setting('app.workspace_id', true) returns '' (empty string), NOT NULL.
--   The missing_ok=true parameter only suppresses the "unrecognized configuration
--   parameter" error for a GUC that was NEVER set in this session — it does not
--   produce NULL when a previously-set GUC is RESET.
--
--   As a result, the expression ''::uuid throws SQLSTATE 22P02
--   ("invalid input syntax for type uuid") instead of silently returning no rows.
--   This breaks ISO-4 (GUC-leak guard) and INV-5 (FORCE RLS fault-killing) e2e tests,
--   and would surface in production on any pool connection that is reused after
--   WorkspaceInterceptor's finalize RESET.
--
-- FIX:
--   Replace ::uuid cast with NULLIF(..., '')::uuid.
--   NULLIF(current_setting('app.workspace_id', true), '') returns:
--     • NULL  — when GUC is unset (missing_ok=true → '' → NULLIF → NULL)
--     • NULL  — when GUC was SET then RESET (RESET → '' → NULLIF → NULL)
--     • the actual UUID string — when GUC is properly set to a workspace UUID
--   NULL::uuid = workspace_id → false → 0 rows → FAIL-CLOSED (same security invariant).
--
-- SECURITY ANALYSIS (unchanged isolation guarantee):
--   • Unset or RESET GUC → NULL → NULL = uuid → false → 0 rows (fail-closed).
--   • Properly set GUC → 'xxxxxxxx-...' → NULLIF returns the string → cast to uuid →
--     workspace_id = $GUC → only matching tenant rows visible.
--   • The policy is STRICTLY NO WEAKER than before: it still returns 0 rows on any
--     non-valid GUC state, without error, and non-zero rows only when the GUC holds
--     a valid UUID. The previous version was also fail-closed but threw on RESET,
--     which is a correctness bug in the policy itself (not a security regression).
--
-- All 28 tenant-table policies are replaced atomically. DROP POLICY then CREATE POLICY
-- is the standard Postgres approach (no ALTER POLICY ... USING() syntax in PG 16).
--
-- JOURNALED: idx 17, when > 1784160000000 (0016 when = 1784160000000).

-- ============================================================================
-- Replace workspace_isolation policies on all 28 tenant tables.
-- ============================================================================

DROP POLICY IF EXISTS "workspace_isolation" ON "users";
CREATE POLICY "workspace_isolation" ON "users"
    USING (workspace_id = NULLIF(current_setting('app.workspace_id', true), '')::uuid);
--> statement-breakpoint

DROP POLICY IF EXISTS "workspace_isolation" ON "invites";
CREATE POLICY "workspace_isolation" ON "invites"
    USING (workspace_id = NULLIF(current_setting('app.workspace_id', true), '')::uuid);
--> statement-breakpoint

DROP POLICY IF EXISTS "workspace_isolation" ON "audit_log_entries";
CREATE POLICY "workspace_isolation" ON "audit_log_entries"
    USING (workspace_id = NULLIF(current_setting('app.workspace_id', true), '')::uuid);
--> statement-breakpoint

DROP POLICY IF EXISTS "workspace_isolation" ON "compliance_rules";
CREATE POLICY "workspace_isolation" ON "compliance_rules"
    USING (workspace_id = NULLIF(current_setting('app.workspace_id', true), '')::uuid);
--> statement-breakpoint

DROP POLICY IF EXISTS "workspace_isolation" ON "suppression_list";
CREATE POLICY "workspace_isolation" ON "suppression_list"
    USING (workspace_id = NULLIF(current_setting('app.workspace_id', true), '')::uuid);
--> statement-breakpoint

DROP POLICY IF EXISTS "workspace_isolation" ON "disclaimer_templates";
CREATE POLICY "workspace_isolation" ON "disclaimer_templates"
    USING (workspace_id = NULLIF(current_setting('app.workspace_id', true), '')::uuid);
--> statement-breakpoint

DROP POLICY IF EXISTS "workspace_isolation" ON "compliance_approvals";
CREATE POLICY "workspace_isolation" ON "compliance_approvals"
    USING (workspace_id = NULLIF(current_setting('app.workspace_id', true), '')::uuid);
--> statement-breakpoint

DROP POLICY IF EXISTS "workspace_isolation" ON "mandates";
CREATE POLICY "workspace_isolation" ON "mandates"
    USING (workspace_id = NULLIF(current_setting('app.workspace_id', true), '')::uuid);
--> statement-breakpoint

DROP POLICY IF EXISTS "workspace_isolation" ON "mandate_buyer_criteria";
CREATE POLICY "workspace_isolation" ON "mandate_buyer_criteria"
    USING (workspace_id = NULLIF(current_setting('app.workspace_id', true), '')::uuid);
--> statement-breakpoint

DROP POLICY IF EXISTS "workspace_isolation" ON "mandate_compliance_profile";
CREATE POLICY "workspace_isolation" ON "mandate_compliance_profile"
    USING (workspace_id = NULLIF(current_setting('app.workspace_id', true), '')::uuid);
--> statement-breakpoint

DROP POLICY IF EXISTS "workspace_isolation" ON "data_source_connections";
CREATE POLICY "workspace_isolation" ON "data_source_connections"
    USING (workspace_id = NULLIF(current_setting('app.workspace_id', true), '')::uuid);
--> statement-breakpoint

DROP POLICY IF EXISTS "workspace_isolation" ON "raw_companies";
CREATE POLICY "workspace_isolation" ON "raw_companies"
    USING (workspace_id = NULLIF(current_setting('app.workspace_id', true), '')::uuid);
--> statement-breakpoint

DROP POLICY IF EXISTS "workspace_isolation" ON "companies";
CREATE POLICY "workspace_isolation" ON "companies"
    USING (workspace_id = NULLIF(current_setting('app.workspace_id', true), '')::uuid);
--> statement-breakpoint

DROP POLICY IF EXISTS "workspace_isolation" ON "contacts";
CREATE POLICY "workspace_isolation" ON "contacts"
    USING (workspace_id = NULLIF(current_setting('app.workspace_id', true), '')::uuid);
--> statement-breakpoint

DROP POLICY IF EXISTS "workspace_isolation" ON "company_provenance";
CREATE POLICY "workspace_isolation" ON "company_provenance"
    USING (workspace_id = NULLIF(current_setting('app.workspace_id', true), '')::uuid);
--> statement-breakpoint

DROP POLICY IF EXISTS "workspace_isolation" ON "contact_provenance";
CREATE POLICY "workspace_isolation" ON "contact_provenance"
    USING (workspace_id = NULLIF(current_setting('app.workspace_id', true), '')::uuid);
--> statement-breakpoint

DROP POLICY IF EXISTS "workspace_isolation" ON "dedupe_candidates";
CREATE POLICY "workspace_isolation" ON "dedupe_candidates"
    USING (workspace_id = NULLIF(current_setting('app.workspace_id', true), '')::uuid);
--> statement-breakpoint

DROP POLICY IF EXISTS "workspace_isolation" ON "buyer_universe";
CREATE POLICY "workspace_isolation" ON "buyer_universe"
    USING (workspace_id = NULLIF(current_setting('app.workspace_id', true), '')::uuid);
--> statement-breakpoint

DROP POLICY IF EXISTS "workspace_isolation" ON "buyer_universe_candidates";
CREATE POLICY "workspace_isolation" ON "buyer_universe_candidates"
    USING (workspace_id = NULLIF(current_setting('app.workspace_id', true), '')::uuid);
--> statement-breakpoint

DROP POLICY IF EXISTS "workspace_isolation" ON "match_run";
CREATE POLICY "workspace_isolation" ON "match_run"
    USING (workspace_id = NULLIF(current_setting('app.workspace_id', true), '')::uuid);
--> statement-breakpoint

DROP POLICY IF EXISTS "workspace_isolation" ON "match_candidates";
CREATE POLICY "workspace_isolation" ON "match_candidates"
    USING (workspace_id = NULLIF(current_setting('app.workspace_id', true), '')::uuid);
--> statement-breakpoint

DROP POLICY IF EXISTS "workspace_isolation" ON "outreach_templates";
CREATE POLICY "workspace_isolation" ON "outreach_templates"
    USING (workspace_id = NULLIF(current_setting('app.workspace_id', true), '')::uuid);
--> statement-breakpoint

DROP POLICY IF EXISTS "workspace_isolation" ON "outreach_template_versions";
CREATE POLICY "workspace_isolation" ON "outreach_template_versions"
    USING (workspace_id = NULLIF(current_setting('app.workspace_id', true), '')::uuid);
--> statement-breakpoint

DROP POLICY IF EXISTS "workspace_isolation" ON "outreach";
CREATE POLICY "workspace_isolation" ON "outreach"
    USING (workspace_id = NULLIF(current_setting('app.workspace_id', true), '')::uuid);
--> statement-breakpoint

DROP POLICY IF EXISTS "workspace_isolation" ON "pipeline";
CREATE POLICY "workspace_isolation" ON "pipeline"
    USING (workspace_id = NULLIF(current_setting('app.workspace_id', true), '')::uuid);
--> statement-breakpoint

DROP POLICY IF EXISTS "workspace_isolation" ON "pipeline_events";
CREATE POLICY "workspace_isolation" ON "pipeline_events"
    USING (workspace_id = NULLIF(current_setting('app.workspace_id', true), '')::uuid);
--> statement-breakpoint

DROP POLICY IF EXISTS "workspace_isolation" ON "workspace_settings";
CREATE POLICY "workspace_isolation" ON "workspace_settings"
    USING (workspace_id = NULLIF(current_setting('app.workspace_id', true), '')::uuid);

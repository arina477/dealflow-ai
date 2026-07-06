-- Rollback for migration 0014 — workspace isolation (wave-17, M8).
-- Removes all workspace_id columns, RLS policies, SECURITY DEFINER functions,
-- and the workspaces table. Additive-only up: safe rollback.
--
-- EXECUTION ORDER: reverse of up migration.
--   1. Drop SECURITY DEFINER functions.
--   2. Drop RLS policies.
--   3. Disable RLS (FORCE + ENABLE).
--   4. Drop workspace_id indexes.
--   5. Drop workspace_id FK columns from all tenant tables.
--   6. Drop workspaces table.

-- ============================================================================
-- STEP 1 — Drop SECURITY DEFINER functions
-- ============================================================================

DROP FUNCTION IF EXISTS read_audit_chain_rls_exempt(bigint, bigint);
DROP FUNCTION IF EXISTS resolve_user_workspace(text);

-- ============================================================================
-- STEP 2 — Drop RLS policies
-- ============================================================================

DROP POLICY IF EXISTS "workspace_isolation" ON "workspace_settings";
DROP POLICY IF EXISTS "workspace_isolation" ON "pipeline_events";
DROP POLICY IF EXISTS "workspace_isolation" ON "pipeline";
DROP POLICY IF EXISTS "workspace_isolation" ON "outreach";
DROP POLICY IF EXISTS "workspace_isolation" ON "outreach_template_versions";
DROP POLICY IF EXISTS "workspace_isolation" ON "outreach_templates";
DROP POLICY IF EXISTS "workspace_isolation" ON "match_candidates";
DROP POLICY IF EXISTS "workspace_isolation" ON "match_run";
DROP POLICY IF EXISTS "workspace_isolation" ON "buyer_universe_candidates";
DROP POLICY IF EXISTS "workspace_isolation" ON "buyer_universe";
DROP POLICY IF EXISTS "workspace_isolation" ON "dedupe_candidates";
DROP POLICY IF EXISTS "workspace_isolation" ON "contact_provenance";
DROP POLICY IF EXISTS "workspace_isolation" ON "company_provenance";
DROP POLICY IF EXISTS "workspace_isolation" ON "contacts";
DROP POLICY IF EXISTS "workspace_isolation" ON "companies";
DROP POLICY IF EXISTS "workspace_isolation" ON "raw_companies";
DROP POLICY IF EXISTS "workspace_isolation" ON "data_source_connections";
DROP POLICY IF EXISTS "workspace_isolation" ON "mandate_compliance_profile";
DROP POLICY IF EXISTS "workspace_isolation" ON "mandate_buyer_criteria";
DROP POLICY IF EXISTS "workspace_isolation" ON "mandates";
DROP POLICY IF EXISTS "workspace_isolation" ON "compliance_approvals";
DROP POLICY IF EXISTS "workspace_isolation" ON "disclaimer_templates";
DROP POLICY IF EXISTS "workspace_isolation" ON "suppression_list";
DROP POLICY IF EXISTS "workspace_isolation" ON "compliance_rules";
DROP POLICY IF EXISTS "workspace_isolation" ON "audit_log_entries";
DROP POLICY IF EXISTS "workspace_isolation" ON "invites";
DROP POLICY IF EXISTS "workspace_isolation" ON "users";

-- ============================================================================
-- STEP 3 — Disable FORCE + ENABLE RLS
-- ============================================================================

ALTER TABLE "workspace_settings"        NO FORCE ROW LEVEL SECURITY;
ALTER TABLE "workspace_settings"        DISABLE ROW LEVEL SECURITY;
ALTER TABLE "pipeline_events"           NO FORCE ROW LEVEL SECURITY;
ALTER TABLE "pipeline_events"           DISABLE ROW LEVEL SECURITY;
ALTER TABLE "pipeline"                  NO FORCE ROW LEVEL SECURITY;
ALTER TABLE "pipeline"                  DISABLE ROW LEVEL SECURITY;
ALTER TABLE "outreach"                  NO FORCE ROW LEVEL SECURITY;
ALTER TABLE "outreach"                  DISABLE ROW LEVEL SECURITY;
ALTER TABLE "outreach_template_versions" NO FORCE ROW LEVEL SECURITY;
ALTER TABLE "outreach_template_versions" DISABLE ROW LEVEL SECURITY;
ALTER TABLE "outreach_templates"        NO FORCE ROW LEVEL SECURITY;
ALTER TABLE "outreach_templates"        DISABLE ROW LEVEL SECURITY;
ALTER TABLE "match_candidates"          NO FORCE ROW LEVEL SECURITY;
ALTER TABLE "match_candidates"          DISABLE ROW LEVEL SECURITY;
ALTER TABLE "match_run"                 NO FORCE ROW LEVEL SECURITY;
ALTER TABLE "match_run"                 DISABLE ROW LEVEL SECURITY;
ALTER TABLE "buyer_universe_candidates" NO FORCE ROW LEVEL SECURITY;
ALTER TABLE "buyer_universe_candidates" DISABLE ROW LEVEL SECURITY;
ALTER TABLE "buyer_universe"            NO FORCE ROW LEVEL SECURITY;
ALTER TABLE "buyer_universe"            DISABLE ROW LEVEL SECURITY;
ALTER TABLE "dedupe_candidates"         NO FORCE ROW LEVEL SECURITY;
ALTER TABLE "dedupe_candidates"         DISABLE ROW LEVEL SECURITY;
ALTER TABLE "contact_provenance"        NO FORCE ROW LEVEL SECURITY;
ALTER TABLE "contact_provenance"        DISABLE ROW LEVEL SECURITY;
ALTER TABLE "company_provenance"        NO FORCE ROW LEVEL SECURITY;
ALTER TABLE "company_provenance"        DISABLE ROW LEVEL SECURITY;
ALTER TABLE "contacts"                  NO FORCE ROW LEVEL SECURITY;
ALTER TABLE "contacts"                  DISABLE ROW LEVEL SECURITY;
ALTER TABLE "companies"                 NO FORCE ROW LEVEL SECURITY;
ALTER TABLE "companies"                 DISABLE ROW LEVEL SECURITY;
ALTER TABLE "raw_companies"             NO FORCE ROW LEVEL SECURITY;
ALTER TABLE "raw_companies"             DISABLE ROW LEVEL SECURITY;
ALTER TABLE "data_source_connections"   NO FORCE ROW LEVEL SECURITY;
ALTER TABLE "data_source_connections"   DISABLE ROW LEVEL SECURITY;
ALTER TABLE "mandate_compliance_profile" NO FORCE ROW LEVEL SECURITY;
ALTER TABLE "mandate_compliance_profile" DISABLE ROW LEVEL SECURITY;
ALTER TABLE "mandate_buyer_criteria"    NO FORCE ROW LEVEL SECURITY;
ALTER TABLE "mandate_buyer_criteria"    DISABLE ROW LEVEL SECURITY;
ALTER TABLE "mandates"                  NO FORCE ROW LEVEL SECURITY;
ALTER TABLE "mandates"                  DISABLE ROW LEVEL SECURITY;
ALTER TABLE "compliance_approvals"      NO FORCE ROW LEVEL SECURITY;
ALTER TABLE "compliance_approvals"      DISABLE ROW LEVEL SECURITY;
ALTER TABLE "disclaimer_templates"      NO FORCE ROW LEVEL SECURITY;
ALTER TABLE "disclaimer_templates"      DISABLE ROW LEVEL SECURITY;
ALTER TABLE "suppression_list"          NO FORCE ROW LEVEL SECURITY;
ALTER TABLE "suppression_list"          DISABLE ROW LEVEL SECURITY;
ALTER TABLE "compliance_rules"          NO FORCE ROW LEVEL SECURITY;
ALTER TABLE "compliance_rules"          DISABLE ROW LEVEL SECURITY;
ALTER TABLE "audit_log_entries"         NO FORCE ROW LEVEL SECURITY;
ALTER TABLE "audit_log_entries"         DISABLE ROW LEVEL SECURITY;
ALTER TABLE "invites"                   NO FORCE ROW LEVEL SECURITY;
ALTER TABLE "invites"                   DISABLE ROW LEVEL SECURITY;
ALTER TABLE "users"                     NO FORCE ROW LEVEL SECURITY;
ALTER TABLE "users"                     DISABLE ROW LEVEL SECURITY;

-- ============================================================================
-- STEP 4 — Drop workspace_id indexes
-- ============================================================================

DROP INDEX IF EXISTS "workspace_settings_workspace_id_idx";
DROP INDEX IF EXISTS "pipeline_events_workspace_id_idx";
DROP INDEX IF EXISTS "pipeline_workspace_id_idx";
DROP INDEX IF EXISTS "outreach_workspace_id_idx";
DROP INDEX IF EXISTS "outreach_template_versions_workspace_id_idx";
DROP INDEX IF EXISTS "outreach_templates_workspace_id_idx";
DROP INDEX IF EXISTS "match_candidates_workspace_id_idx";
DROP INDEX IF EXISTS "match_run_workspace_id_idx";
DROP INDEX IF EXISTS "buyer_universe_candidates_workspace_id_idx";
DROP INDEX IF EXISTS "buyer_universe_workspace_id_idx";
DROP INDEX IF EXISTS "dedupe_candidates_workspace_id_idx";
DROP INDEX IF EXISTS "contact_provenance_workspace_id_idx";
DROP INDEX IF EXISTS "company_provenance_workspace_id_idx";
DROP INDEX IF EXISTS "contacts_workspace_id_idx";
DROP INDEX IF EXISTS "companies_workspace_id_idx";
DROP INDEX IF EXISTS "raw_companies_workspace_id_idx";
DROP INDEX IF EXISTS "data_source_connections_workspace_id_idx";
DROP INDEX IF EXISTS "mandate_compliance_profile_workspace_id_idx";
DROP INDEX IF EXISTS "mandate_buyer_criteria_workspace_id_idx";
DROP INDEX IF EXISTS "mandates_workspace_id_idx";
DROP INDEX IF EXISTS "compliance_approvals_workspace_id_idx";
DROP INDEX IF EXISTS "disclaimer_templates_workspace_id_idx";
DROP INDEX IF EXISTS "suppression_list_workspace_id_idx";
DROP INDEX IF EXISTS "compliance_rules_workspace_id_idx";
DROP INDEX IF EXISTS "audit_log_entries_workspace_id_idx";
DROP INDEX IF EXISTS "invites_workspace_id_idx";
DROP INDEX IF EXISTS "users_workspace_id_idx";

-- ============================================================================
-- STEP 5 — Drop workspace_id columns from all tenant tables
-- ============================================================================

ALTER TABLE "workspace_settings"         DROP COLUMN IF EXISTS "workspace_id";
ALTER TABLE "pipeline_events"            DROP COLUMN IF EXISTS "workspace_id";
ALTER TABLE "pipeline"                   DROP COLUMN IF EXISTS "workspace_id";
ALTER TABLE "outreach"                   DROP COLUMN IF EXISTS "workspace_id";
ALTER TABLE "outreach_template_versions" DROP COLUMN IF EXISTS "workspace_id";
ALTER TABLE "outreach_templates"         DROP COLUMN IF EXISTS "workspace_id";
ALTER TABLE "match_candidates"           DROP COLUMN IF EXISTS "workspace_id";
ALTER TABLE "match_run"                  DROP COLUMN IF EXISTS "workspace_id";
ALTER TABLE "buyer_universe_candidates"  DROP COLUMN IF EXISTS "workspace_id";
ALTER TABLE "buyer_universe"             DROP COLUMN IF EXISTS "workspace_id";
ALTER TABLE "dedupe_candidates"          DROP COLUMN IF EXISTS "workspace_id";
ALTER TABLE "contact_provenance"         DROP COLUMN IF EXISTS "workspace_id";
ALTER TABLE "company_provenance"         DROP COLUMN IF EXISTS "workspace_id";
ALTER TABLE "contacts"                   DROP COLUMN IF EXISTS "workspace_id";
ALTER TABLE "companies"                  DROP COLUMN IF EXISTS "workspace_id";
ALTER TABLE "raw_companies"              DROP COLUMN IF EXISTS "workspace_id";
ALTER TABLE "data_source_connections"    DROP COLUMN IF EXISTS "workspace_id";
ALTER TABLE "mandate_compliance_profile" DROP COLUMN IF EXISTS "workspace_id";
ALTER TABLE "mandate_buyer_criteria"     DROP COLUMN IF EXISTS "workspace_id";
ALTER TABLE "mandates"                   DROP COLUMN IF EXISTS "workspace_id";
ALTER TABLE "compliance_approvals"       DROP COLUMN IF EXISTS "workspace_id";
ALTER TABLE "disclaimer_templates"       DROP COLUMN IF EXISTS "workspace_id";
ALTER TABLE "suppression_list"           DROP COLUMN IF EXISTS "workspace_id";
ALTER TABLE "compliance_rules"           DROP COLUMN IF EXISTS "workspace_id";
ALTER TABLE "audit_log_entries"          DROP COLUMN IF EXISTS "workspace_id";
ALTER TABLE "invites"                    DROP COLUMN IF EXISTS "workspace_id";
ALTER TABLE "users"                      DROP COLUMN IF EXISTS "workspace_id";

-- ============================================================================
-- STEP 6 — Drop workspaces table
-- ============================================================================

DROP TABLE IF EXISTS "workspaces";

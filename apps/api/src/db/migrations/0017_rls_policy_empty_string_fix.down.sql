-- Rollback migration 0017 — restore original RLS policies (::uuid without NULLIF guard)
-- WARNING: Rolling back to ::uuid without NULLIF guard reintroduces SQLSTATE 22P02
-- on RESET app.workspace_id, breaking ISO-4 / INV-5 e2e tests and production behaviour.
-- Only roll back if also reverting to the pre-0017 test suite.

DROP POLICY IF EXISTS "workspace_isolation" ON "users";
CREATE POLICY "workspace_isolation" ON "users"
    USING (workspace_id = current_setting('app.workspace_id', true)::uuid);

DROP POLICY IF EXISTS "workspace_isolation" ON "invites";
CREATE POLICY "workspace_isolation" ON "invites"
    USING (workspace_id = current_setting('app.workspace_id', true)::uuid);

DROP POLICY IF EXISTS "workspace_isolation" ON "audit_log_entries";
CREATE POLICY "workspace_isolation" ON "audit_log_entries"
    USING (workspace_id = current_setting('app.workspace_id', true)::uuid);

DROP POLICY IF EXISTS "workspace_isolation" ON "compliance_rules";
CREATE POLICY "workspace_isolation" ON "compliance_rules"
    USING (workspace_id = current_setting('app.workspace_id', true)::uuid);

DROP POLICY IF EXISTS "workspace_isolation" ON "suppression_list";
CREATE POLICY "workspace_isolation" ON "suppression_list"
    USING (workspace_id = current_setting('app.workspace_id', true)::uuid);

DROP POLICY IF EXISTS "workspace_isolation" ON "disclaimer_templates";
CREATE POLICY "workspace_isolation" ON "disclaimer_templates"
    USING (workspace_id = current_setting('app.workspace_id', true)::uuid);

DROP POLICY IF EXISTS "workspace_isolation" ON "compliance_approvals";
CREATE POLICY "workspace_isolation" ON "compliance_approvals"
    USING (workspace_id = current_setting('app.workspace_id', true)::uuid);

DROP POLICY IF EXISTS "workspace_isolation" ON "mandates";
CREATE POLICY "workspace_isolation" ON "mandates"
    USING (workspace_id = current_setting('app.workspace_id', true)::uuid);

DROP POLICY IF EXISTS "workspace_isolation" ON "mandate_buyer_criteria";
CREATE POLICY "workspace_isolation" ON "mandate_buyer_criteria"
    USING (workspace_id = current_setting('app.workspace_id', true)::uuid);

DROP POLICY IF EXISTS "workspace_isolation" ON "mandate_compliance_profile";
CREATE POLICY "workspace_isolation" ON "mandate_compliance_profile"
    USING (workspace_id = current_setting('app.workspace_id', true)::uuid);

DROP POLICY IF EXISTS "workspace_isolation" ON "data_source_connections";
CREATE POLICY "workspace_isolation" ON "data_source_connections"
    USING (workspace_id = current_setting('app.workspace_id', true)::uuid);

DROP POLICY IF EXISTS "workspace_isolation" ON "raw_companies";
CREATE POLICY "workspace_isolation" ON "raw_companies"
    USING (workspace_id = current_setting('app.workspace_id', true)::uuid);

DROP POLICY IF EXISTS "workspace_isolation" ON "companies";
CREATE POLICY "workspace_isolation" ON "companies"
    USING (workspace_id = current_setting('app.workspace_id', true)::uuid);

DROP POLICY IF EXISTS "workspace_isolation" ON "contacts";
CREATE POLICY "workspace_isolation" ON "contacts"
    USING (workspace_id = current_setting('app.workspace_id', true)::uuid);

DROP POLICY IF EXISTS "workspace_isolation" ON "company_provenance";
CREATE POLICY "workspace_isolation" ON "company_provenance"
    USING (workspace_id = current_setting('app.workspace_id', true)::uuid);

DROP POLICY IF EXISTS "workspace_isolation" ON "contact_provenance";
CREATE POLICY "workspace_isolation" ON "contact_provenance"
    USING (workspace_id = current_setting('app.workspace_id', true)::uuid);

DROP POLICY IF EXISTS "workspace_isolation" ON "dedupe_candidates";
CREATE POLICY "workspace_isolation" ON "dedupe_candidates"
    USING (workspace_id = current_setting('app.workspace_id', true)::uuid);

DROP POLICY IF EXISTS "workspace_isolation" ON "buyer_universe";
CREATE POLICY "workspace_isolation" ON "buyer_universe"
    USING (workspace_id = current_setting('app.workspace_id', true)::uuid);

DROP POLICY IF EXISTS "workspace_isolation" ON "buyer_universe_candidates";
CREATE POLICY "workspace_isolation" ON "buyer_universe_candidates"
    USING (workspace_id = current_setting('app.workspace_id', true)::uuid);

DROP POLICY IF EXISTS "workspace_isolation" ON "match_run";
CREATE POLICY "workspace_isolation" ON "match_run"
    USING (workspace_id = current_setting('app.workspace_id', true)::uuid);

DROP POLICY IF EXISTS "workspace_isolation" ON "match_candidates";
CREATE POLICY "workspace_isolation" ON "match_candidates"
    USING (workspace_id = current_setting('app.workspace_id', true)::uuid);

DROP POLICY IF EXISTS "workspace_isolation" ON "outreach_templates";
CREATE POLICY "workspace_isolation" ON "outreach_templates"
    USING (workspace_id = current_setting('app.workspace_id', true)::uuid);

DROP POLICY IF EXISTS "workspace_isolation" ON "outreach_template_versions";
CREATE POLICY "workspace_isolation" ON "outreach_template_versions"
    USING (workspace_id = current_setting('app.workspace_id', true)::uuid);

DROP POLICY IF EXISTS "workspace_isolation" ON "outreach";
CREATE POLICY "workspace_isolation" ON "outreach"
    USING (workspace_id = current_setting('app.workspace_id', true)::uuid);

DROP POLICY IF EXISTS "workspace_isolation" ON "pipeline";
CREATE POLICY "workspace_isolation" ON "pipeline"
    USING (workspace_id = current_setting('app.workspace_id', true)::uuid);

DROP POLICY IF EXISTS "workspace_isolation" ON "pipeline_events";
CREATE POLICY "workspace_isolation" ON "pipeline_events"
    USING (workspace_id = current_setting('app.workspace_id', true)::uuid);

DROP POLICY IF EXISTS "workspace_isolation" ON "workspace_settings";
CREATE POLICY "workspace_isolation" ON "workspace_settings"
    USING (workspace_id = current_setting('app.workspace_id', true)::uuid);

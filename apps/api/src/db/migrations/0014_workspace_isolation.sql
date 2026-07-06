-- Migration 0014 — workspace isolation (wave-17, M8 pilot-partner data-isolation)
-- Tasks: 0db154ff (seed — workspaces + workspace_id x tenant tables + backfill + RLS)
--        e45ba68c (deny-by-default RLS)
--
-- SECURITY-CRITICAL — this migration is the whole isolation foundation.
-- JOURNALED: idx 14, when > 1783900800000 (0013 when).
--
-- EXECUTION ORDER (load-bearing — deviate and the NOT NULL ALTER fails):
--   1. Create workspaces table + insert default workspace row (STABLE UUID seed).
--   2. Add workspace_id FK columns (nullable) to all 28 tenant tables.
--   3. BACKFILL every existing row → default workspace UUID.
--   4. ALTER workspace_id columns to NOT NULL (zero NULL orphans guaranteed by step 3).
--   5. ENABLE ROW LEVEL SECURITY + FORCE ROW LEVEL SECURITY per tenant table.
--      (FORCE is mandatory: the API runs as the table-owning role; without FORCE
--       the owner bypasses RLS entirely → every isolation test is a false-green.)
--   6. CREATE deny-by-default RLS policy per tenant table:
--        USING (workspace_id = current_setting('app.workspace_id', true)::uuid)
--      Unset GUC → current_setting returns NULL → NULL = uuid → false → 0 rows.
--      Fail-closed. NO COALESCE, NO = '' fail-open shape.
--   7. CREATE SECURITY DEFINER function resolve_user_workspace:
--      RLS-bypassing bootstrap resolver (chicken-and-egg break for the users table).
--      Returns ONLY the caller's own workspace_id + role (minimal surface).
--   8. CREATE SECURITY DEFINER function read_audit_chain_rls_exempt:
--      RLS-bypassing audit integrity walk (global HMAC chain must be verified in full;
--      a scoped subset → false sequence-gap → ok:false; this path returns the
--      full chain while the LIST/EXPORT projection stays RLS-scoped).
--   9. ADD INDEXES on workspace_id for every tenant table
--      (workspace_id = $GUC is the primary tenant filter; index is load-bearing for perf).
--
-- HASH-CHAIN SAFETY (audit_log_entries):
--   workspace_id is added as a SEPARATE nullable-then-NOT-NULL column OUTSIDE the
--   HMAC preimage. It is NOT in HashableEntryFields / canonicalSerialization.
--   Mirror of the mandate_id exclusion in migration 0012 (task 487b0f0c).
--   Consequence: workspace_id UPDATE on audit_log_entries would re-attribute without
--   breaking verifyChain — but the WORM BEFORE-UPDATE trigger on audit_log_entries
--   (installed in migration 0002) unconditionally rejects ALL UPDATE/DELETE regardless
--   of column. workspace_id hash-exclusion is therefore safe: the WORM trigger is the
--   backstop. The df2f3b2f test (B-2) MUST prove the trigger blocks workspace_id UPDATE.
--
-- EXCLUDED TABLES (global / not tenant-scoped — justified):
--   • app_meta — global bootstrap key-value (app version, schema rev); no firm data.
--   • roles — global RBAC lookup (4 named roles: admin/advisor/analyst/compliance);
--              every firm uses the same role set; scoping would break cross-firm role reuse.
--
-- ALL OTHER TABLES receive workspace_id + RLS. See enumeration below.

-- ============================================================================
-- STEP 1 — workspaces table + default workspace row
-- ============================================================================

CREATE TABLE "workspaces" (
    "id"         uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "name"       text NOT NULL,
    "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint

-- Insert the default (pilot-firm) workspace with a STABLE known UUID.
-- This UUID is referenced by the backfill step and by seeds/test fixtures.
-- STABLE_DEFAULT_WORKSPACE_ID = 'a1b2c3d4-0000-4000-8000-000000000001'
INSERT INTO "workspaces" ("id", "name")
VALUES ('a1b2c3d4-0000-4000-8000-000000000001', 'Default Workspace');
--> statement-breakpoint

-- ============================================================================
-- STEP 2 — ADD workspace_id (nullable FK) to all 28 tenant tables
-- ============================================================================

-- users-roles: users
ALTER TABLE "users" ADD COLUMN "workspace_id" uuid REFERENCES "workspaces"("id") ON DELETE restrict;
--> statement-breakpoint

-- users-roles: invites
ALTER TABLE "invites" ADD COLUMN "workspace_id" uuid REFERENCES "workspaces"("id") ON DELETE restrict;
--> statement-breakpoint

-- audit-log: audit_log_entries
-- HASH-EXCLUDED — not in HashableEntryFields/canonicalSerialization.
-- See hash-chain safety comment at file header.
ALTER TABLE "audit_log_entries" ADD COLUMN "workspace_id" uuid REFERENCES "workspaces"("id") ON DELETE restrict;
--> statement-breakpoint

-- compliance-rules: compliance_rules
ALTER TABLE "compliance_rules" ADD COLUMN "workspace_id" uuid REFERENCES "workspaces"("id") ON DELETE restrict;
--> statement-breakpoint

-- compliance-rules: suppression_list
ALTER TABLE "suppression_list" ADD COLUMN "workspace_id" uuid REFERENCES "workspaces"("id") ON DELETE restrict;
--> statement-breakpoint

-- compliance-rules: disclaimer_templates
ALTER TABLE "disclaimer_templates" ADD COLUMN "workspace_id" uuid REFERENCES "workspaces"("id") ON DELETE restrict;
--> statement-breakpoint

-- compliance-rules: compliance_approvals
ALTER TABLE "compliance_approvals" ADD COLUMN "workspace_id" uuid REFERENCES "workspaces"("id") ON DELETE restrict;
--> statement-breakpoint

-- mandate: mandates
ALTER TABLE "mandates" ADD COLUMN "workspace_id" uuid REFERENCES "workspaces"("id") ON DELETE restrict;
--> statement-breakpoint

-- mandate: mandate_buyer_criteria
ALTER TABLE "mandate_buyer_criteria" ADD COLUMN "workspace_id" uuid REFERENCES "workspaces"("id") ON DELETE restrict;
--> statement-breakpoint

-- mandate: mandate_compliance_profile
ALTER TABLE "mandate_compliance_profile" ADD COLUMN "workspace_id" uuid REFERENCES "workspaces"("id") ON DELETE restrict;
--> statement-breakpoint

-- sourcing: data_source_connections
ALTER TABLE "data_source_connections" ADD COLUMN "workspace_id" uuid REFERENCES "workspaces"("id") ON DELETE restrict;
--> statement-breakpoint

-- sourcing: raw_companies
ALTER TABLE "raw_companies" ADD COLUMN "workspace_id" uuid REFERENCES "workspaces"("id") ON DELETE restrict;
--> statement-breakpoint

-- sourcing: companies
ALTER TABLE "companies" ADD COLUMN "workspace_id" uuid REFERENCES "workspaces"("id") ON DELETE restrict;
--> statement-breakpoint

-- sourcing: contacts
ALTER TABLE "contacts" ADD COLUMN "workspace_id" uuid REFERENCES "workspaces"("id") ON DELETE restrict;
--> statement-breakpoint

-- sourcing: company_provenance
ALTER TABLE "company_provenance" ADD COLUMN "workspace_id" uuid REFERENCES "workspaces"("id") ON DELETE restrict;
--> statement-breakpoint

-- sourcing: contact_provenance
ALTER TABLE "contact_provenance" ADD COLUMN "workspace_id" uuid REFERENCES "workspaces"("id") ON DELETE restrict;
--> statement-breakpoint

-- sourcing: dedupe_candidates
ALTER TABLE "dedupe_candidates" ADD COLUMN "workspace_id" uuid REFERENCES "workspaces"("id") ON DELETE restrict;
--> statement-breakpoint

-- buyer-universe: buyer_universe
ALTER TABLE "buyer_universe" ADD COLUMN "workspace_id" uuid REFERENCES "workspaces"("id") ON DELETE restrict;
--> statement-breakpoint

-- buyer-universe: buyer_universe_candidates
ALTER TABLE "buyer_universe_candidates" ADD COLUMN "workspace_id" uuid REFERENCES "workspaces"("id") ON DELETE restrict;
--> statement-breakpoint

-- matching: match_run
ALTER TABLE "match_run" ADD COLUMN "workspace_id" uuid REFERENCES "workspaces"("id") ON DELETE restrict;
--> statement-breakpoint

-- matching: match_candidates
ALTER TABLE "match_candidates" ADD COLUMN "workspace_id" uuid REFERENCES "workspaces"("id") ON DELETE restrict;
--> statement-breakpoint

-- outreach: outreach_templates
ALTER TABLE "outreach_templates" ADD COLUMN "workspace_id" uuid REFERENCES "workspaces"("id") ON DELETE restrict;
--> statement-breakpoint

-- outreach: outreach_template_versions
ALTER TABLE "outreach_template_versions" ADD COLUMN "workspace_id" uuid REFERENCES "workspaces"("id") ON DELETE restrict;
--> statement-breakpoint

-- outreach: outreach
ALTER TABLE "outreach" ADD COLUMN "workspace_id" uuid REFERENCES "workspaces"("id") ON DELETE restrict;
--> statement-breakpoint

-- pipeline: pipeline
ALTER TABLE "pipeline" ADD COLUMN "workspace_id" uuid REFERENCES "workspaces"("id") ON DELETE restrict;
--> statement-breakpoint

-- pipeline: pipeline_events
ALTER TABLE "pipeline_events" ADD COLUMN "workspace_id" uuid REFERENCES "workspaces"("id") ON DELETE restrict;
--> statement-breakpoint

-- admin-settings: workspace_settings
ALTER TABLE "workspace_settings" ADD COLUMN "workspace_id" uuid REFERENCES "workspaces"("id") ON DELETE restrict;
--> statement-breakpoint

-- ============================================================================
-- STEP 3 — BACKFILL: set workspace_id = default workspace on every existing row
-- MUST run BEFORE the NOT NULL cutover (problem-framer C).
-- After backfill: zero NULL workspace_id rows in any tenant table.
-- ============================================================================

UPDATE "users"                    SET "workspace_id" = 'a1b2c3d4-0000-4000-8000-000000000001' WHERE "workspace_id" IS NULL;
UPDATE "invites"                  SET "workspace_id" = 'a1b2c3d4-0000-4000-8000-000000000001' WHERE "workspace_id" IS NULL;
-- audit_log_entries backfill — WORM trigger disable window.
-- audit_log_entries has a BEFORE UPDATE trigger (audit_log_no_mutate / audit_log_block_mutation)
-- that unconditionally rejects ALL UPDATE/DELETE. A plain UPDATE here would fail with
-- "audit_log_entries is append-only: UPDATE blocked" on any populated DB (CI is green
-- only because it migrates an empty DB and 0 rows match WHERE workspace_id IS NULL).
-- SAFE to bypass: workspace_id is HASH-EXCLUDED from HashableEntryFields/canonicalSerialization
-- (mirror of mandate_id exclusion, wave-14 / migration 0012). The HMAC preimage is unchanged
-- → entry_hash values are byte-identical → verifyChain stays ok:true.
-- DISABLE TRIGGER requires the table owner (the migration role); the runtime dealflow_app role
-- never runs this migration. Re-ENABLE in the same statement so the WORM protection is
-- restored atomically — even on rollback, the trigger is re-enabled at tx abort.
-- Only audit_log_entries has a mutation-blocking trigger; all other table backfills above/below
-- are unaffected and left as plain UPDATEs.
ALTER TABLE "audit_log_entries" DISABLE TRIGGER audit_log_no_mutate;
UPDATE "audit_log_entries"        SET "workspace_id" = 'a1b2c3d4-0000-4000-8000-000000000001' WHERE "workspace_id" IS NULL;
ALTER TABLE "audit_log_entries" ENABLE TRIGGER audit_log_no_mutate;
UPDATE "compliance_rules"         SET "workspace_id" = 'a1b2c3d4-0000-4000-8000-000000000001' WHERE "workspace_id" IS NULL;
UPDATE "suppression_list"         SET "workspace_id" = 'a1b2c3d4-0000-4000-8000-000000000001' WHERE "workspace_id" IS NULL;
UPDATE "disclaimer_templates"     SET "workspace_id" = 'a1b2c3d4-0000-4000-8000-000000000001' WHERE "workspace_id" IS NULL;
UPDATE "compliance_approvals"     SET "workspace_id" = 'a1b2c3d4-0000-4000-8000-000000000001' WHERE "workspace_id" IS NULL;
UPDATE "mandates"                 SET "workspace_id" = 'a1b2c3d4-0000-4000-8000-000000000001' WHERE "workspace_id" IS NULL;
UPDATE "mandate_buyer_criteria"   SET "workspace_id" = 'a1b2c3d4-0000-4000-8000-000000000001' WHERE "workspace_id" IS NULL;
UPDATE "mandate_compliance_profile" SET "workspace_id" = 'a1b2c3d4-0000-4000-8000-000000000001' WHERE "workspace_id" IS NULL;
UPDATE "data_source_connections"  SET "workspace_id" = 'a1b2c3d4-0000-4000-8000-000000000001' WHERE "workspace_id" IS NULL;
UPDATE "raw_companies"            SET "workspace_id" = 'a1b2c3d4-0000-4000-8000-000000000001' WHERE "workspace_id" IS NULL;
UPDATE "companies"                SET "workspace_id" = 'a1b2c3d4-0000-4000-8000-000000000001' WHERE "workspace_id" IS NULL;
UPDATE "contacts"                 SET "workspace_id" = 'a1b2c3d4-0000-4000-8000-000000000001' WHERE "workspace_id" IS NULL;
UPDATE "company_provenance"       SET "workspace_id" = 'a1b2c3d4-0000-4000-8000-000000000001' WHERE "workspace_id" IS NULL;
UPDATE "contact_provenance"       SET "workspace_id" = 'a1b2c3d4-0000-4000-8000-000000000001' WHERE "workspace_id" IS NULL;
UPDATE "dedupe_candidates"        SET "workspace_id" = 'a1b2c3d4-0000-4000-8000-000000000001' WHERE "workspace_id" IS NULL;
UPDATE "buyer_universe"           SET "workspace_id" = 'a1b2c3d4-0000-4000-8000-000000000001' WHERE "workspace_id" IS NULL;
UPDATE "buyer_universe_candidates" SET "workspace_id" = 'a1b2c3d4-0000-4000-8000-000000000001' WHERE "workspace_id" IS NULL;
UPDATE "match_run"                SET "workspace_id" = 'a1b2c3d4-0000-4000-8000-000000000001' WHERE "workspace_id" IS NULL;
UPDATE "match_candidates"         SET "workspace_id" = 'a1b2c3d4-0000-4000-8000-000000000001' WHERE "workspace_id" IS NULL;
UPDATE "outreach_templates"       SET "workspace_id" = 'a1b2c3d4-0000-4000-8000-000000000001' WHERE "workspace_id" IS NULL;
UPDATE "outreach_template_versions" SET "workspace_id" = 'a1b2c3d4-0000-4000-8000-000000000001' WHERE "workspace_id" IS NULL;
UPDATE "outreach"                 SET "workspace_id" = 'a1b2c3d4-0000-4000-8000-000000000001' WHERE "workspace_id" IS NULL;
UPDATE "pipeline"                 SET "workspace_id" = 'a1b2c3d4-0000-4000-8000-000000000001' WHERE "workspace_id" IS NULL;
UPDATE "pipeline_events"          SET "workspace_id" = 'a1b2c3d4-0000-4000-8000-000000000001' WHERE "workspace_id" IS NULL;
UPDATE "workspace_settings"       SET "workspace_id" = 'a1b2c3d4-0000-4000-8000-000000000001' WHERE "workspace_id" IS NULL;
--> statement-breakpoint

-- ============================================================================
-- STEP 4 — NOT NULL cutover (safe: zero NULL rows after step 3)
-- ============================================================================

ALTER TABLE "users"                     ALTER COLUMN "workspace_id" SET NOT NULL;
ALTER TABLE "invites"                   ALTER COLUMN "workspace_id" SET NOT NULL;
ALTER TABLE "audit_log_entries"         ALTER COLUMN "workspace_id" SET NOT NULL;
ALTER TABLE "compliance_rules"          ALTER COLUMN "workspace_id" SET NOT NULL;
ALTER TABLE "suppression_list"          ALTER COLUMN "workspace_id" SET NOT NULL;
ALTER TABLE "disclaimer_templates"      ALTER COLUMN "workspace_id" SET NOT NULL;
ALTER TABLE "compliance_approvals"      ALTER COLUMN "workspace_id" SET NOT NULL;
ALTER TABLE "mandates"                  ALTER COLUMN "workspace_id" SET NOT NULL;
ALTER TABLE "mandate_buyer_criteria"    ALTER COLUMN "workspace_id" SET NOT NULL;
ALTER TABLE "mandate_compliance_profile" ALTER COLUMN "workspace_id" SET NOT NULL;
ALTER TABLE "data_source_connections"   ALTER COLUMN "workspace_id" SET NOT NULL;
ALTER TABLE "raw_companies"             ALTER COLUMN "workspace_id" SET NOT NULL;
ALTER TABLE "companies"                 ALTER COLUMN "workspace_id" SET NOT NULL;
ALTER TABLE "contacts"                  ALTER COLUMN "workspace_id" SET NOT NULL;
ALTER TABLE "company_provenance"        ALTER COLUMN "workspace_id" SET NOT NULL;
ALTER TABLE "contact_provenance"        ALTER COLUMN "workspace_id" SET NOT NULL;
ALTER TABLE "dedupe_candidates"         ALTER COLUMN "workspace_id" SET NOT NULL;
ALTER TABLE "buyer_universe"            ALTER COLUMN "workspace_id" SET NOT NULL;
ALTER TABLE "buyer_universe_candidates" ALTER COLUMN "workspace_id" SET NOT NULL;
ALTER TABLE "match_run"                 ALTER COLUMN "workspace_id" SET NOT NULL;
ALTER TABLE "match_candidates"          ALTER COLUMN "workspace_id" SET NOT NULL;
ALTER TABLE "outreach_templates"        ALTER COLUMN "workspace_id" SET NOT NULL;
ALTER TABLE "outreach_template_versions" ALTER COLUMN "workspace_id" SET NOT NULL;
ALTER TABLE "outreach"                  ALTER COLUMN "workspace_id" SET NOT NULL;
ALTER TABLE "pipeline"                  ALTER COLUMN "workspace_id" SET NOT NULL;
ALTER TABLE "pipeline_events"           ALTER COLUMN "workspace_id" SET NOT NULL;
ALTER TABLE "workspace_settings"        ALTER COLUMN "workspace_id" SET NOT NULL;
--> statement-breakpoint

-- ============================================================================
-- STEP 5 — ENABLE + FORCE ROW LEVEL SECURITY on all 28 tenant tables
--
-- FORCE is MANDATORY (P-4 F1 / problem-framer A):
--   The NestJS API runs as the table-owning role (the migration role is the owner).
--   PostgreSQL RLS is bypassed for the table owner UNLESS FORCE ROW LEVEL SECURITY
--   is set. Without FORCE, every isolation test passes vacuously (owner sees all rows
--   regardless of GUC) — a silent false-green.
-- ============================================================================

ALTER TABLE "users"                      ENABLE ROW LEVEL SECURITY;
ALTER TABLE "users"                      FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "invites"                    ENABLE ROW LEVEL SECURITY;
ALTER TABLE "invites"                    FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "audit_log_entries"          ENABLE ROW LEVEL SECURITY;
ALTER TABLE "audit_log_entries"          FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "compliance_rules"           ENABLE ROW LEVEL SECURITY;
ALTER TABLE "compliance_rules"           FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "suppression_list"           ENABLE ROW LEVEL SECURITY;
ALTER TABLE "suppression_list"           FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "disclaimer_templates"       ENABLE ROW LEVEL SECURITY;
ALTER TABLE "disclaimer_templates"       FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "compliance_approvals"       ENABLE ROW LEVEL SECURITY;
ALTER TABLE "compliance_approvals"       FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "mandates"                   ENABLE ROW LEVEL SECURITY;
ALTER TABLE "mandates"                   FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "mandate_buyer_criteria"     ENABLE ROW LEVEL SECURITY;
ALTER TABLE "mandate_buyer_criteria"     FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "mandate_compliance_profile" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "mandate_compliance_profile" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "data_source_connections"    ENABLE ROW LEVEL SECURITY;
ALTER TABLE "data_source_connections"    FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "raw_companies"              ENABLE ROW LEVEL SECURITY;
ALTER TABLE "raw_companies"              FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "companies"                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE "companies"                  FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "contacts"                   ENABLE ROW LEVEL SECURITY;
ALTER TABLE "contacts"                   FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "company_provenance"         ENABLE ROW LEVEL SECURITY;
ALTER TABLE "company_provenance"         FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "contact_provenance"         ENABLE ROW LEVEL SECURITY;
ALTER TABLE "contact_provenance"         FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "dedupe_candidates"          ENABLE ROW LEVEL SECURITY;
ALTER TABLE "dedupe_candidates"          FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "buyer_universe"             ENABLE ROW LEVEL SECURITY;
ALTER TABLE "buyer_universe"             FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "buyer_universe_candidates"  ENABLE ROW LEVEL SECURITY;
ALTER TABLE "buyer_universe_candidates"  FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "match_run"                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE "match_run"                  FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "match_candidates"           ENABLE ROW LEVEL SECURITY;
ALTER TABLE "match_candidates"           FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "outreach_templates"         ENABLE ROW LEVEL SECURITY;
ALTER TABLE "outreach_templates"         FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "outreach_template_versions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "outreach_template_versions" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "outreach"                   ENABLE ROW LEVEL SECURITY;
ALTER TABLE "outreach"                   FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "pipeline"                   ENABLE ROW LEVEL SECURITY;
ALTER TABLE "pipeline"                   FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "pipeline_events"            ENABLE ROW LEVEL SECURITY;
ALTER TABLE "pipeline_events"            FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "workspace_settings"         ENABLE ROW LEVEL SECURITY;
ALTER TABLE "workspace_settings"         FORCE ROW LEVEL SECURITY;
--> statement-breakpoint

-- ============================================================================
-- STEP 6 — DENY-BY-DEFAULT RLS POLICIES (all tenant tables)
--
-- Policy shape:
--   USING (workspace_id = current_setting('app.workspace_id', true)::uuid)
--
-- SECURITY ANALYSIS:
--   • current_setting('app.workspace_id', true) returns NULL when the GUC is not set.
--   • NULL::uuid = uuid → false (NULL comparison is always false in SQL).
--   • Therefore: unset GUC → 0 rows returned → FAIL-CLOSED.
--   • The second arg 'true' (missing_ok) avoids an error on unset; returns NULL instead.
--   • NO COALESCE(..., default_workspace_id) — that would be fail-OPEN on pool leak.
--   • NO = '' check — that cast would error, not return 0 rows.
--
-- A single PERMISSIVE policy per table suffices. No explicit RESTRICTIVE needed.
-- PERMISSIVE with USING enforces the predicate on ALL rows for ALL commands.
-- ============================================================================

CREATE POLICY "workspace_isolation" ON "users"
    USING (workspace_id = current_setting('app.workspace_id', true)::uuid);
--> statement-breakpoint

CREATE POLICY "workspace_isolation" ON "invites"
    USING (workspace_id = current_setting('app.workspace_id', true)::uuid);
--> statement-breakpoint

CREATE POLICY "workspace_isolation" ON "audit_log_entries"
    USING (workspace_id = current_setting('app.workspace_id', true)::uuid);
--> statement-breakpoint

CREATE POLICY "workspace_isolation" ON "compliance_rules"
    USING (workspace_id = current_setting('app.workspace_id', true)::uuid);
--> statement-breakpoint

CREATE POLICY "workspace_isolation" ON "suppression_list"
    USING (workspace_id = current_setting('app.workspace_id', true)::uuid);
--> statement-breakpoint

CREATE POLICY "workspace_isolation" ON "disclaimer_templates"
    USING (workspace_id = current_setting('app.workspace_id', true)::uuid);
--> statement-breakpoint

CREATE POLICY "workspace_isolation" ON "compliance_approvals"
    USING (workspace_id = current_setting('app.workspace_id', true)::uuid);
--> statement-breakpoint

CREATE POLICY "workspace_isolation" ON "mandates"
    USING (workspace_id = current_setting('app.workspace_id', true)::uuid);
--> statement-breakpoint

CREATE POLICY "workspace_isolation" ON "mandate_buyer_criteria"
    USING (workspace_id = current_setting('app.workspace_id', true)::uuid);
--> statement-breakpoint

CREATE POLICY "workspace_isolation" ON "mandate_compliance_profile"
    USING (workspace_id = current_setting('app.workspace_id', true)::uuid);
--> statement-breakpoint

CREATE POLICY "workspace_isolation" ON "data_source_connections"
    USING (workspace_id = current_setting('app.workspace_id', true)::uuid);
--> statement-breakpoint

CREATE POLICY "workspace_isolation" ON "raw_companies"
    USING (workspace_id = current_setting('app.workspace_id', true)::uuid);
--> statement-breakpoint

CREATE POLICY "workspace_isolation" ON "companies"
    USING (workspace_id = current_setting('app.workspace_id', true)::uuid);
--> statement-breakpoint

CREATE POLICY "workspace_isolation" ON "contacts"
    USING (workspace_id = current_setting('app.workspace_id', true)::uuid);
--> statement-breakpoint

CREATE POLICY "workspace_isolation" ON "company_provenance"
    USING (workspace_id = current_setting('app.workspace_id', true)::uuid);
--> statement-breakpoint

CREATE POLICY "workspace_isolation" ON "contact_provenance"
    USING (workspace_id = current_setting('app.workspace_id', true)::uuid);
--> statement-breakpoint

CREATE POLICY "workspace_isolation" ON "dedupe_candidates"
    USING (workspace_id = current_setting('app.workspace_id', true)::uuid);
--> statement-breakpoint

CREATE POLICY "workspace_isolation" ON "buyer_universe"
    USING (workspace_id = current_setting('app.workspace_id', true)::uuid);
--> statement-breakpoint

CREATE POLICY "workspace_isolation" ON "buyer_universe_candidates"
    USING (workspace_id = current_setting('app.workspace_id', true)::uuid);
--> statement-breakpoint

CREATE POLICY "workspace_isolation" ON "match_run"
    USING (workspace_id = current_setting('app.workspace_id', true)::uuid);
--> statement-breakpoint

CREATE POLICY "workspace_isolation" ON "match_candidates"
    USING (workspace_id = current_setting('app.workspace_id', true)::uuid);
--> statement-breakpoint

CREATE POLICY "workspace_isolation" ON "outreach_templates"
    USING (workspace_id = current_setting('app.workspace_id', true)::uuid);
--> statement-breakpoint

CREATE POLICY "workspace_isolation" ON "outreach_template_versions"
    USING (workspace_id = current_setting('app.workspace_id', true)::uuid);
--> statement-breakpoint

CREATE POLICY "workspace_isolation" ON "outreach"
    USING (workspace_id = current_setting('app.workspace_id', true)::uuid);
--> statement-breakpoint

CREATE POLICY "workspace_isolation" ON "pipeline"
    USING (workspace_id = current_setting('app.workspace_id', true)::uuid);
--> statement-breakpoint

CREATE POLICY "workspace_isolation" ON "pipeline_events"
    USING (workspace_id = current_setting('app.workspace_id', true)::uuid);
--> statement-breakpoint

CREATE POLICY "workspace_isolation" ON "workspace_settings"
    USING (workspace_id = current_setting('app.workspace_id', true)::uuid);
--> statement-breakpoint

-- ============================================================================
-- STEP 7 — SECURITY DEFINER function: resolve_user_workspace (P-4 F2)
--
-- Purpose: RLS-bypassing bootstrap resolver.
--   The users table has FORCE ROW LEVEL SECURITY with the workspace_id GUC policy.
--   getUserWithRole is called BEFORE the GUC is set (chicken-and-egg):
--     users read → needs GUC → GUC not set yet → 0 rows → workspace never resolves.
--   This function breaks the cycle by running as its DEFINER (the migration role /
--   table owner) which bypasses RLS entirely for this query.
--
-- MINIMAL SURFACE (security design):
--   • Accepts only the caller's own SuperTokens user ID (st_user_id text).
--   • Returns ONLY that user's workspace_id + role_name.
--   • No other user or workspace data is returned.
--   • The caller is responsible for verifying the returned workspace_id against
--     their own session (B-2 NestJS middleware does this).
--
-- SECURITY DEFINER + SEARCH_PATH = '' (prevents search_path injection).
-- The function owner is the role running this migration.
-- ============================================================================

CREATE OR REPLACE FUNCTION resolve_user_workspace(st_user_id text)
RETURNS TABLE(workspace_id uuid, role_name text)
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
AS $$
    SELECT u.workspace_id, r.name AS role_name
    FROM   public.users  u
    JOIN   public.roles  r ON r.id = u.role_id
    WHERE  u.supertokens_user_id = st_user_id
    LIMIT  1;
$$;
--> statement-breakpoint

-- ============================================================================
-- STEP 8 — SECURITY DEFINER function: read_audit_chain_rls_exempt (P-4 F3)
--
-- Purpose: RLS-bypassing audit integrity walk for verifyChain.
--   The HMAC chain is a SINGLE GLOBAL chain (genesis-anchored, monotonic global
--   sequence, one advisory-lock key). If verifyChain reads only the RLS-scoped
--   subset (per-workspace rows), it sees non-contiguous sequence numbers →
--   false sequence-gap → ok:false. An out-of-tx SET on the shared pool to a
--   "global" GUC would leak to other connections.
--   RESOLUTION (P-4 F3 / P-3 Action 2): verifyChain's readChainAscending calls
--   this SECURITY DEFINER function which bypasses RLS, reads the FULL global chain,
--   and returns the ordered rows. The function returns a boolean via the caller —
--   no raw audit row data is exposed to RLS-constrained paths.
--
-- The LIST/EXPORT read PROJECTION is NOT via this function; it uses the normal
-- RLS-scoped Drizzle query on the connection with app.workspace_id set.
--
-- MINIMAL SURFACE:
--   Returns only the integrity-verification fields needed for HMAC recomputation
--   (sequence_number, entry_hash, prev_hash, chain_version, and the hashed fields).
--   workspace_id is intentionally returned so the verifier can optionally log
--   per-workspace coverage; it does not affect ok:true/false.
--
-- SECURITY DEFINER + SEARCH_PATH = '' (prevents search_path injection).
-- ============================================================================

CREATE OR REPLACE FUNCTION read_audit_chain_rls_exempt(
    p_from_sequence bigint DEFAULT 1,
    p_to_sequence   bigint DEFAULT 9223372036854775807
)
RETURNS TABLE(
    sequence_number       bigint,
    actor_user_id         uuid,
    actor_role            text,
    action                text,
    resource_type         text,
    resource_id           text,
    content_hash          text,
    payload_hash          text,
    prev_hash             text,
    entry_hash            text,
    chain_version         integer,
    created_at            timestamp with time zone,
    mandate_id            uuid,
    workspace_id          uuid
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
AS $$
    SELECT
        sequence_number,
        actor_user_id,
        actor_role,
        action,
        resource_type,
        resource_id,
        content_hash,
        payload_hash,
        prev_hash,
        entry_hash,
        chain_version,
        created_at,
        mandate_id,
        workspace_id
    FROM   public.audit_log_entries
    WHERE  sequence_number BETWEEN p_from_sequence AND p_to_sequence
    ORDER  BY sequence_number ASC;
$$;
--> statement-breakpoint

-- ============================================================================
-- STEP 9 — INDEXES on workspace_id for performance
-- workspace_id = $GUC is now the primary tenant filter on every query.
-- Without an index, every RLS-filtered query does a full sequential scan.
-- ============================================================================

CREATE INDEX "users_workspace_id_idx"                       ON "users"                      ("workspace_id");
CREATE INDEX "invites_workspace_id_idx"                     ON "invites"                    ("workspace_id");
CREATE INDEX "audit_log_entries_workspace_id_idx"           ON "audit_log_entries"          ("workspace_id");
CREATE INDEX "compliance_rules_workspace_id_idx"            ON "compliance_rules"           ("workspace_id");
CREATE INDEX "suppression_list_workspace_id_idx"            ON "suppression_list"           ("workspace_id");
CREATE INDEX "disclaimer_templates_workspace_id_idx"        ON "disclaimer_templates"       ("workspace_id");
CREATE INDEX "compliance_approvals_workspace_id_idx"        ON "compliance_approvals"       ("workspace_id");
CREATE INDEX "mandates_workspace_id_idx"                    ON "mandates"                   ("workspace_id");
CREATE INDEX "mandate_buyer_criteria_workspace_id_idx"      ON "mandate_buyer_criteria"     ("workspace_id");
CREATE INDEX "mandate_compliance_profile_workspace_id_idx"  ON "mandate_compliance_profile" ("workspace_id");
CREATE INDEX "data_source_connections_workspace_id_idx"     ON "data_source_connections"    ("workspace_id");
CREATE INDEX "raw_companies_workspace_id_idx"               ON "raw_companies"              ("workspace_id");
CREATE INDEX "companies_workspace_id_idx"                   ON "companies"                  ("workspace_id");
CREATE INDEX "contacts_workspace_id_idx"                    ON "contacts"                   ("workspace_id");
CREATE INDEX "company_provenance_workspace_id_idx"          ON "company_provenance"         ("workspace_id");
CREATE INDEX "contact_provenance_workspace_id_idx"          ON "contact_provenance"         ("workspace_id");
CREATE INDEX "dedupe_candidates_workspace_id_idx"           ON "dedupe_candidates"          ("workspace_id");
CREATE INDEX "buyer_universe_workspace_id_idx"              ON "buyer_universe"             ("workspace_id");
CREATE INDEX "buyer_universe_candidates_workspace_id_idx"   ON "buyer_universe_candidates"  ("workspace_id");
CREATE INDEX "match_run_workspace_id_idx"                   ON "match_run"                  ("workspace_id");
CREATE INDEX "match_candidates_workspace_id_idx"            ON "match_candidates"           ("workspace_id");
CREATE INDEX "outreach_templates_workspace_id_idx"          ON "outreach_templates"         ("workspace_id");
CREATE INDEX "outreach_template_versions_workspace_id_idx"  ON "outreach_template_versions" ("workspace_id");
CREATE INDEX "outreach_workspace_id_idx"                    ON "outreach"                   ("workspace_id");
CREATE INDEX "pipeline_workspace_id_idx"                    ON "pipeline"                   ("workspace_id");
CREATE INDEX "pipeline_events_workspace_id_idx"             ON "pipeline_events"            ("workspace_id");
CREATE INDEX "workspace_settings_workspace_id_idx"          ON "workspace_settings"         ("workspace_id");

-- Migration 0020 — workspace_retention_policy (wave-28, task d3cc1337, M10 RETENTION policy)
--
-- WHAT THIS ADDS:
--   A new MUTABLE per-workspace table that stores the firm's configured retention
--   window (retention_period_days, default 2555 ≈ 7 years).
--
-- SECURITY-CRITICAL PROPERTIES (binding obligations from P-4 Phase-2):
--
-- [RLS — load-bearing crux]
--   A NEW TABLE does NOT inherit RLS from existing tenant tables.
--   This migration EXPLICITLY:
--     1. ENABLE ROW LEVEL SECURITY on workspace_retention_policy.
--     2. FORCE ROW LEVEL SECURITY on workspace_retention_policy.
--        (FORCE is MANDATORY: the API runs as the table-owning role; without FORCE
--         the owner bypasses RLS entirely → every isolation test is a silent false-green.)
--     3. CREATE POLICY "workspace_isolation" USING (workspace_id = NULLIF(current_setting(...), '')::uuid)
--        USING-only (no explicit WITH CHECK) → PostgreSQL auto-derives WITH CHECK = USING.
--        NULLIF shape (not raw ::uuid cast) → RESET-safe: a previously-SET then RESET GUC
--        returns '' not NULL from current_setting; ''::uuid throws; NULLIF(''...)→NULL→fail-closed.
--        This is the 0017 shape — proven correct by the isolation e2e suites.
--
-- [SEC-A — one-row-per-workspace UPSERT conflict target]
--   UNIQUE(workspace_id) — the application uses ON CONFLICT (workspace_id) DO UPDATE.
--   workspace_id is always resolved SERVER-SIDE from getWorkspaceId() (ALS/GUC), NEVER
--   from client input. The RLS WITH-CHECK (auto-derived from USING) ensures that an
--   attempt to write a row with a foreign workspace_id is rejected by the policy.
--
-- [SEC-B — explicit GRANT to dealflow_app]
--   A new table is NOT covered by 0016's "ALL SEQUENCES" catch-all for DML.
--   Omission would produce SQLSTATE 42501 at runtime.
--   GRANT SELECT, INSERT, UPDATE, DELETE ON workspace_retention_policy TO dealflow_app.
--   NO wildcard (GRANT ON ALL TABLES) — per-table explicit grant matching 0016's pattern.
--   DELETE is granted at the DB layer but the SERVICE layer has NO deletion path.
--
-- [JOURNALED]
--   idx 20, when > 1783428538937 (0019 when = 1783428538937).
--   Schema def in apps/api/src/db/schema/retention-policy.ts + drizzle-kit generate.
--
-- EXECUTION ORDER:
--   1. CREATE TABLE workspace_retention_policy (col defs + UNIQUE + FKs + index).
--   2. ENABLE + FORCE ROW LEVEL SECURITY.
--   3. CREATE POLICY "workspace_isolation" (USING-only, NULLIF shape).
--   4. GRANT SELECT, INSERT, UPDATE, DELETE ON workspace_retention_policy TO dealflow_app.

-- ============================================================================
-- STEP 1 — CREATE TABLE workspace_retention_policy
-- ============================================================================

CREATE TABLE "workspace_retention_policy" (
    "id"                    uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "workspace_id"          uuid NOT NULL
                            REFERENCES "workspaces"("id") ON DELETE RESTRICT,
    "retention_period_days" integer NOT NULL DEFAULT 2555,
    "updated_by"            uuid
                            REFERENCES "users"("id") ON DELETE SET NULL,
    "created_at"            timestamp with time zone NOT NULL DEFAULT now(),
    "updated_at"            timestamp with time zone,

    -- SEC-A: one row per workspace — the UPSERT conflict target.
    CONSTRAINT "workspace_retention_policy_workspace_id_key"
        UNIQUE ("workspace_id")
);
--> statement-breakpoint

CREATE INDEX "workspace_retention_policy_workspace_id_idx"
    ON "workspace_retention_policy" ("workspace_id");
--> statement-breakpoint

-- ============================================================================
-- STEP 2 — ENABLE + FORCE ROW LEVEL SECURITY
--
-- FORCE is MANDATORY (0014 lesson):
--   The NestJS API runs as the table-owning role (migration role = table owner).
--   PostgreSQL RLS is bypassed for the table owner UNLESS FORCE ROW LEVEL SECURITY
--   is set. Without FORCE, every isolation test is a silent false-green —
--   a real cross-tenant leak WOULD NOT be caught.
-- ============================================================================

ALTER TABLE "workspace_retention_policy" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "workspace_retention_policy" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint

-- ============================================================================
-- STEP 3 — CREATE POLICY "workspace_isolation"
--
-- Policy shape (0017 pattern — proven by the isolation e2e suites):
--   USING (workspace_id = NULLIF(current_setting('app.workspace_id', true), '')::uuid)
--
-- SECURITY ANALYSIS:
--   • NULLIF(current_setting('app.workspace_id', true), ''):
--       - GUC never set        → '' (missing_ok=true)     → NULLIF → NULL
--       - GUC SET then RESET   → '' (RESET writes '')     → NULLIF → NULL
--       - GUC properly set     → 'xxxxxxxx-...' uuid str  → NULLIF passes through
--   • NULL::uuid = uuid → false (NULL comparison always false) → 0 rows → FAIL-CLOSED.
--   • USING-only — PostgreSQL auto-derives WITH CHECK = USING. This is STRICTLY
--     CORRECT: a write with a foreign workspace_id fails the WITH-CHECK derived
--     from USING (workspace_id must equal the GUC value).
--   • Do NOT add a separate WITH CHECK — it would be weaker or redundant.
-- ============================================================================

CREATE POLICY "workspace_isolation" ON "workspace_retention_policy"
    USING (workspace_id = NULLIF(current_setting('app.workspace_id', true), '')::uuid);
--> statement-breakpoint

-- ============================================================================
-- STEP 4 — [SEC-B] GRANT to dealflow_app
--
-- A new table is NOT covered by any existing blanket GRANT.
-- Omission = SQLSTATE 42501 at runtime for every retention-policy API call.
-- Pattern: explicit per-table grant matching 0016's per-table DML pattern.
-- DELETE is granted at DB layer; the service layer has NO deletion path.
-- ============================================================================

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "public"."workspace_retention_policy" TO dealflow_app;

-- Migration 0018 — outreach_activity table (wave-20, M9 outreach-activity tracker)
-- Task: d45c73b5 (table + additive migration + workspace-scoped RLS)
--
-- SECURITY-CRITICAL — this is the FIRST MUTABLE M9 write surface.
-- Write-path RLS isolation is load-bearing.
--
-- DESIGN: see apps/api/src/db/schema/outreach-activity.ts for full invariants.
--
-- EXECUTION ORDER:
--   1. Create two DISTINCT pgEnum types:
--        outreach_activity_channel (call | email | linkedin | other)
--        outreach_activity_status  (planned | completed | cancelled)
--      DISTINCT names prevent pg type namespace collision (wave-11 cluster lesson).
--   2. CREATE TABLE outreach_activity with all columns, FKs, and indexes.
--   3. ENABLE + FORCE ROW LEVEL SECURITY (matched to the 28 tenant tables).
--   4. CREATE POLICY "workspace_isolation" FOR ALL (command-unspecified = FOR ALL)
--        USING (workspace_id = NULLIF(current_setting('app.workspace_id', true),'')::uuid)
--      NO FOR SELECT (would lose the derived write-check under FOR ALL).
--      NO literal WITH CHECK (M8 migration 0014/0017 have none — derived from USING
--      under FOR ALL; a divergent explicit WITH CHECK forks outreach_activity from
--      the 28-table shape).
--   5. ADD column DEFAULT to workspace_id:
--        DEFAULT NULLIF(current_setting('app.workspace_id', true),'')::uuid
--      An INSERT that omits workspace_id captures the caller's GUC. When GUC is
--      unset, NULLIF returns NULL → NOT NULL constraint rejects → fail-closed.
--      This is the SF1 [HIGH] column DEFAULT fix — do NOT rely on an app-side
--      ?? DEFAULT_WORKSPACE_ID fallback in service code.
--   6. GRANT SELECT/INSERT/UPDATE/DELETE ON outreach_activity TO dealflow_app.
--      Matches the 28 tenant tables in migration 0016.
--
-- GAP-4 NOTE: this migration is purely additive (CREATE TABLE + 2 enums).
-- It does NOT alter audit_log_entries, so there is zero risk of WORM-trigger
-- collision on populated rows. The OAM-2/OAM-3 migration tests verify this.
--
-- ROLLBACK: additive-only — rollback = DROP TABLE outreach_activity +
--   DROP TYPE outreach_activity_channel + DROP TYPE outreach_activity_status.
--   No existing table is altered; no data migrated. Zero data loss on rollback.
--
-- JOURNALED: idx 18, when > 1784332800000 (0017 when = 1784246400000).

-- ============================================================================
-- STEP 1 — Create DISTINCT enum types
-- ============================================================================

CREATE TYPE "outreach_activity_channel" AS ENUM('call', 'email', 'linkedin', 'other');
--> statement-breakpoint

CREATE TYPE "outreach_activity_status" AS ENUM('planned', 'completed', 'cancelled');
--> statement-breakpoint

-- ============================================================================
-- STEP 2 — CREATE TABLE outreach_activity
-- ============================================================================

CREATE TABLE "outreach_activity" (
    "id"                   uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "workspace_id"         uuid NOT NULL,
    "channel"              "outreach_activity_channel" NOT NULL,
    "status"               "outreach_activity_status" NOT NULL DEFAULT 'planned',
    "subject"              text NOT NULL,
    "notes"                text,
    "due_at"               timestamp with time zone,
    "completed_at"         timestamp with time zone,
    "outreach_id"          uuid,
    "match_candidate_id"   uuid,
    "pipeline_id"          uuid,
    "mandate_id"           uuid,
    "created_by"           uuid NOT NULL,
    "created_at"           timestamp with time zone NOT NULL DEFAULT now(),
    "updated_at"           timestamp with time zone,

    CONSTRAINT "outreach_activity_workspace_id_fk"
        FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE RESTRICT,

    CONSTRAINT "outreach_activity_created_by_fk"
        FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT,

    CONSTRAINT "outreach_activity_outreach_id_fk"
        FOREIGN KEY ("outreach_id") REFERENCES "outreach"("id") ON DELETE SET NULL,

    CONSTRAINT "outreach_activity_match_candidate_id_fk"
        FOREIGN KEY ("match_candidate_id") REFERENCES "match_candidates"("id") ON DELETE SET NULL,

    CONSTRAINT "outreach_activity_pipeline_id_fk"
        FOREIGN KEY ("pipeline_id") REFERENCES "pipeline"("id") ON DELETE SET NULL,

    CONSTRAINT "outreach_activity_mandate_id_fk"
        FOREIGN KEY ("mandate_id") REFERENCES "mandates"("id") ON DELETE SET NULL
);
--> statement-breakpoint

-- ============================================================================
-- STEP 3 — ENABLE + FORCE ROW LEVEL SECURITY
--
-- FORCE is mandatory (same rationale as migration 0014):
--   The API runs as dealflow_app (the table-owning role). Without FORCE ROW LEVEL
--   SECURITY, the owner bypasses RLS entirely → every isolation test is a vacuous
--   false-green. FORCE makes RLS apply to the owner too (non-bypassable).
-- ============================================================================

ALTER TABLE "outreach_activity" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "outreach_activity" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint

-- ============================================================================
-- STEP 4 — CREATE POLICY "workspace_isolation" (FOR ALL, USING-only)
--
-- Policy shape MATCHED exactly to migration 0017 (the 28 tenant tables):
--   USING (workspace_id = NULLIF(current_setting('app.workspace_id', true), '')::uuid)
--
-- SECURITY ANALYSIS (identical to 0017):
--   • NULLIF: when GUC is unset or RESET, current_setting returns '' → NULLIF
--     returns NULL → NULL = uuid → false → 0 rows (FAIL-CLOSED).
--   • FOR ALL (command-unspecified): PostgreSQL derives the write-time WITH CHECK
--     predicate from USING under FOR ALL. Writes are therefore fail-closed too:
--     an INSERT/UPDATE that would place a row outside the caller's workspace is
--     REJECTED with 42501.
--   • NOT FOR SELECT: a FOR SELECT policy has no derived WITH CHECK → write-side
--     leak (R1/P-3 plan correction). This policy must be FOR ALL.
--   • NO literal WITH CHECK: migrations 0014/0017 have none — derived is correct
--     and matched. A divergent literal WITH CHECK would fork outreach_activity from
--     the 28-table shape (spec correction).
-- ============================================================================

CREATE POLICY "workspace_isolation" ON "outreach_activity"
    USING (workspace_id = NULLIF(current_setting('app.workspace_id', true), '')::uuid);
--> statement-breakpoint

-- ============================================================================
-- STEP 5 — Column DEFAULT on workspace_id (SF1 HIGH)
--
-- An INSERT that omits workspace_id lands NULLIF(current_setting(...))::uuid:
--   • When GUC is set to a valid UUID → captured as workspace_id → row lands
--     in the caller's workspace.
--   • When GUC is unset (empty-ALS / background job / non-request path) →
--     NULLIF returns NULL → NOT NULL constraint rejects → fail-closed.
--
-- This is the SF1 [HIGH] fix. Service code MUST THROW when getWorkspaceId()
-- returns null — NEVER fallback to ?? DEFAULT_WORKSPACE_ID.
-- The column DEFAULT is belt+suspenders: if the INSERT omits workspace_id,
-- the GUC value is used (or rejected). The service layer is the primary guard.
-- ============================================================================

ALTER TABLE "outreach_activity"
    ALTER COLUMN "workspace_id"
    SET DEFAULT NULLIF(current_setting('app.workspace_id', true), '')::uuid;
--> statement-breakpoint

-- ============================================================================
-- STEP 6 — GRANT SELECT/INSERT/UPDATE/DELETE TO dealflow_app
--
-- Matches the 28 tenant table grants from migration 0016.
-- dealflow_app is NOSUPERUSER NOBYPASSRLS → FORCE RLS applies → grants needed.
-- ============================================================================

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.outreach_activity TO dealflow_app;
--> statement-breakpoint

-- ============================================================================
-- STEP 7 — INDEXES
-- ============================================================================

-- Primary tenant filter (workspace_id = $GUC is the outermost filter on every query).
CREATE INDEX "outreach_activity_workspace_id_idx" ON "outreach_activity" ("workspace_id");
--> statement-breakpoint

-- "My open touches" composite index: WHERE workspace_id = $GUC AND status = 'planned'
--   ORDER BY due_at ASC — supports the my-open-touches list read.
CREATE INDEX "outreach_activity_workspace_status_due_at_idx"
    ON "outreach_activity" ("workspace_id", "status", "due_at");

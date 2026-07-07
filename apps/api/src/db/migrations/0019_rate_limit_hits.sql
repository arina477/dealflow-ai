-- Migration 0019 — rate_limit_hits table (wave-25, M10 auth-hardening)
-- Task: 6fe232e3
--
-- PURPOSE: Shared Postgres-backed rate-limit counter store for the auth
-- rate-limiter. Pre-auth, global (NOT tenant-scoped — no workspace_id, no RLS).
-- All Railway replicas share this table, so a key bucketed here is a true
-- global limit, not a per-instance limit.
--
-- DESIGN INVARIANTS (SEC-1/SEC-2):
--   • Two-bucket shape: short window (60 s) + coarse window (3600 s).
--     key = '<scope>:<identifier>:<window_seconds>:<window_index>'
--     window_index = floor(epoch_seconds / window_seconds)
--   • PRIMARY KEY (key, window_start) enforces uniqueness atomically.
--     The SEC-1 atomic UPSERT:
--       INSERT INTO rate_limit_hits (key, window_start, count)
--       VALUES ($1, $2, 1)
--       ON CONFLICT (key, window_start) DO UPDATE
--         SET count = rate_limit_hits.count + 1
--       RETURNING count
--     reads the POST-INCREMENT count in a single round-trip; NO SELECT-then-UPDATE.
--   • count is int (max 2 147 483 647 — well above any sane limit).
--   • first_hit_at is informational (first time the bucket was opened; useful
--     for ops / audit; never used in the limit decision).
--
-- SECURITY PROPERTIES:
--   • NOT tenant-scoped: pre-auth path has no workspace_id. NOT under RLS.
--   • NOT WORM: rows are deleted by a periodic cleanup job (or pg_cron if
--     installed). This is NOT an audit table.
--   • Additive only: no existing table is altered.
--
-- INDEX: a partial index on expires_at (< now()) so a future cleanup job
-- can efficiently sweep expired buckets without a seqscan.
--
-- GRANTS: SELECT/INSERT/UPDATE/DELETE to dealflow_app.
--   • INSERT: open the counter bucket.
--   • UPDATE: increment via ON CONFLICT DO UPDATE.
--   • SELECT: the RETURNING clause implicitly requires SELECT; also used by
--     the fail-closed-soft in-process fallback to read current counts.
--   • DELETE: future cleanup / manual flush.
--   dealflow_app is the role the API runs as (migration 0016).
--
-- ROLLBACK: purely additive — DROP TABLE rate_limit_hits. No data migrated.
--
-- JOURNALED: idx 19, when > 1784678400000 (0018 when = 1784332800000).

-- ============================================================================
-- STEP 1 — CREATE TABLE rate_limit_hits
-- ============================================================================

CREATE TABLE IF NOT EXISTS "rate_limit_hits" (
    -- Composite bucket key: '<scope>:<identifier_normalized>:<window_seconds>:<window_index>'
    -- Example: 'signin:a@x.com:60:28079320'
    "key"            text NOT NULL,

    -- window_start is a bigint window index (floor(epoch_seconds / window_seconds)).
    -- Using bigint avoids timestamptz rounding concerns and is trivially
    -- computed in application code. A bigint PK partition is also more
    -- compressible than timestamptz for the typical cardinality here.
    "window_start"   bigint NOT NULL,

    -- Post-increment counter. The atomic UPSERT bumps this column; the
    -- RETURNING clause reads the post-increment value — NO separate SELECT.
    "count"          integer NOT NULL DEFAULT 1,

    -- Informational: when this bucket was first opened (first hit in the window).
    -- Never used in the limit decision. Useful for ops dashboards and incident
    -- triage (how long has this account been hammering?).
    "first_hit_at"   timestamp with time zone NOT NULL DEFAULT now(),

    -- Logical expiry for the bucket: first_hit_at + window_seconds seconds.
    -- Populated by the application (it knows the window_seconds). A periodic
    -- cleanup job can DELETE WHERE expires_at < now() without a full seqscan.
    "expires_at"     timestamp with time zone NOT NULL,

    PRIMARY KEY ("key", "window_start")
);
--> statement-breakpoint

-- ============================================================================
-- STEP 2 — GRANTS
-- ============================================================================

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.rate_limit_hits TO dealflow_app;
--> statement-breakpoint

-- ============================================================================
-- STEP 3 — INDEX: partial on expires_at for efficient cleanup
-- ============================================================================

-- Cleanup agent: DELETE FROM rate_limit_hits WHERE expires_at < now()
-- Without this index the cleanup query is a seqscan on the entire table.
-- Partial (WHERE expires_at < now() is dynamic so a full index on expires_at
-- is used, not a truly static partial, but naming it _expired_idx signals intent).
CREATE INDEX "rate_limit_hits_expires_at_idx" ON "rate_limit_hits" ("expires_at");
--> statement-breakpoint

-- ============================================================================
-- NOTE: NO RLS, NO workspace_id, NOT WORM.
--
-- RLS rationale: rate-limiting is pre-auth (the user is not authenticated yet;
-- no workspace GUC is set). Applying RLS would require every limiter UPSERT to
-- carry a workspace_id even for unauthenticated requests — impossible. The table
-- stores only a hashed/normalized bucket key (no email in plaintext, no PII).
--
-- WORM rationale: this is a rolling counter, not an audit log. Rows are expected
-- to be deleted after their window expires. The WORM trigger pattern used on
-- audit_log_entries must NOT be applied here.
-- ============================================================================

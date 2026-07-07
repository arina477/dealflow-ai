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
--       INSERT INTO rate_limit_hits (key, window_start, count, expires_at)
--       VALUES ($1, $2, 1, $3)
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
--   • NOT WORM: expired rows are deleted by an unref'd interval sweeper started
--     in createRateLimitMiddleware() (apps/api/src/modules/auth/rate-limit.middleware.ts).
--     The sweeper runs DELETE FROM rate_limit_hits WHERE expires_at < now() every
--     5 minutes, bounded by the expires_at index below. This is NOT an audit table.
--   • Additive only: no existing table is altered.
--
-- INDEX: a partial index on expires_at so a future cleanup job can efficiently
-- sweep expired buckets without a seqscan.
--
-- GRANTS: SELECT/INSERT/UPDATE/DELETE to dealflow_app.
--   • INSERT: open the counter bucket.
--   • UPDATE: increment via ON CONFLICT DO UPDATE.
--   • SELECT: the RETURNING clause implicitly requires SELECT.
--   • DELETE: future cleanup / manual flush.
--   dealflow_app is the role the API runs as (migration 0016).
--
-- ROLLBACK: purely additive — DROP TABLE rate_limit_hits. No data migrated.
--
-- JOURNALED: idx 19, tag 0019_rate_limit_hits.

-- ============================================================================
-- STEP 1 — CREATE TABLE rate_limit_hits
-- ============================================================================

CREATE TABLE "rate_limit_hits" (
	"key" text NOT NULL,
	"window_start" bigint NOT NULL,
	"count" integer DEFAULT 1 NOT NULL,
	"first_hit_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	CONSTRAINT "rate_limit_hits_key_window_start_pk" PRIMARY KEY("key","window_start")
);
--> statement-breakpoint

-- ============================================================================
-- STEP 2 — GRANTS
-- ============================================================================

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.rate_limit_hits TO dealflow_app;
--> statement-breakpoint

-- ============================================================================
-- STEP 3 — INDEX: on expires_at for efficient cleanup
-- ============================================================================

CREATE INDEX "rate_limit_hits_expires_at_idx" ON "rate_limit_hits" USING btree ("expires_at");

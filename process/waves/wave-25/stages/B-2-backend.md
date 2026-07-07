# Wave 25 — B-0/B-1/B-2 (auth-hardening)
Commits 18f798e (B-0 migration 0019_rate_limit_hits) + 1aef449 (B-2). ALL 11 SEC obligations honored:
- SEC-1 atomic UPSERT (ON CONFLICT(key,window_start) DO UPDATE count+1 RETURNING; post-increment decision; concurrent Promise.all test → ≤1 over-limit passes).
- SEC-2 dual fixed-window (SHORT 60s + COARSE 3600s; exceed EITHER→429+Retry-After; boundary-burst killed by the hourly bucket). Limits: signin 10/60s+20/h, signup 5/60s+10/h, reset/request+confirm 5/60s+10/h.
- SEC-3 app.set('trust proxy',1) [Railway 1 hop, doc'd command-center/dev/trust-proxy-hop-count.md]; req.ip resolved; forged-XFF→no fresh bucket (test).
- SEC-4 makeKey normalizes email.trim().toLowerCase() (3 variants→1 bucket test).
- SEC-5 differentiated: FAIL_OPEN [signup, reset/request]; FAIL_CLOSED_SOFT [signin, reset/confirm] → in-proc 5/min fallback on DB-error (4 paths tested).
- SEC-6 bucket on submitted email pre-lookup; byte-identical 429 real-vs-fake.
- SEC-7 all 4 endpoints (reset/confirm per-IP, fail-closed-soft).
- SEC-8 Express app.use(createRateLimitMiddleware()) BEFORE app.use(middleware()) in main.ts (NOT a Nest guard — would miss /auth/signin); signin-flood→429 test.
- SEC-9 per-handler safeParse on all 4 auth handlers (@Body unknown); NO global pipe (18 controllers/186 .strict/passthrough tests unaffected — guard test: /compliance/rules unknown-key passes).
- SEC-10 generic 'Invalid or expired invite' byte-identical for missing/empty/malformed/non-existent; no account created.
- SEC-11 SuperTokens VIA_CUSTOM_HEADER + SessionGuard on logout verified (unit: config+annotation; integration no-rid→401 runs at T-8/C-2, needs live SuperTokens Core).
- typecheck clean; 970 pass / 93 skip; 52 new tests (33 rate-limit + 19 auth-controller). Deviations: none. B-3 SKIP (backend-only; API returns proper 429/400 the web's existing error-handling surfaces).
```yaml
skipped: false
sec_obligations_all_honored: true
migration: 0019_rate_limit_hits (additive, pre-auth-global, not-tenant-not-WORM)
deviations: []
```

## B-6 rework

head-builder found 3 defects in the original implementation that made the rate-limiter non-functional in production. All 3 fixed below.

### DEFECT-1 — migration 0019 not journaled (CRITICAL)

The SQL file `0019_rate_limit_hits.sql` existed but `meta/_journal.json` ended at idx 18 with no 0019 entry. The Drizzle `migrate()` runner reads `_journal.json` to discover which migrations to apply — without the entry, the migration was silently skipped in prod. The `rate_limit_hits` table never existed, so every atomic UPSERT threw an error, causing permanent fail-open on signup/reset-request and in-memory fallback on signin/reset-confirm.

Fix: Added the Drizzle schema file (`apps/api/src/db/schema/rate-limit-hits.ts`) using `primaryKey()` for the composite PK, added it to the schema barrel (`schema/index.ts`), then ran `drizzle-kit generate --name rate_limit_hits`. This produced `meta/0019_snapshot.json` and added `{ idx: 19, tag: "0019_rate_limit_hits" }` to `_journal.json`. The generated SQL lacked the composite PK (the initial schema had an incorrect raw-object syntax), so 0019 SQL was updated to include `CONSTRAINT "rate_limit_hits_key_window_start_pk" PRIMARY KEY("key","window_start")` and the snapshot was patched with the `compositePrimaryKeys` entry. `drizzle-kit check` confirms "Everything's fine" — schema, journal, and snapshot are consistent. `drizzle-kit generate` then produces "No schema changes, nothing to migrate."

### DEFECT-2 — SEC-1 atomicity unverified (only in-memory mock)

The concurrent test fired N+1 requests through an in-memory mock pool. A racing SELECT-then-UPDATE would pass the mock identically — the mock returns monotonically increasing counts synchronously regardless of concurrency. Real Postgres atomicity was unproven.

Fix: Added `SEC-1-DB` DB-gated integration test in `rate-limit.middleware.spec.ts` (guarded by `TEST_DATABASE_URL`, skipped in unit context, runs at C-1/T-8). The test:
- Calls `ensureMigrated` so the real `rate_limit_hits` table exists
- Fires `limit+1` concurrent `INSERT...ON CONFLICT DO UPDATE...RETURNING` statements against real Postgres
- Asserts: all `limit+1` returned RETURNING values are unique (atomic serialisation), max value = total request count (no under-count), stored DB count = total request count
- Demonstrates per-middleware logic: exactly `limit` calls have count ≤ limit (pass), exactly 1 has count > limit (429)
A SELECT-then-UPDATE would fail this test under real concurrency because two concurrent reads would return the same count, both write count+1, and the RETURNING values would not all be unique.

### DEFECT-3 — email keying is prod-theater (body not parsed)

`extractIdentifier` tried to read `req.body.email` but the middleware runs before SuperTokens middleware() and before Nest's body parser. At that point `req.body` is `undefined`, so all requests fell back to `req.ip`. Per-account (per-email) keying never happened in prod.

Fix: Added `ensureBodyParsed(req)` which:
1. Returns existing `req.body` if already a parsed object (handles pre-populated bodies in unit tests and downstream middlewares)
2. Checks whether `req` is a real readable stream (EventEmitter with `.on`) — mock objects without `.on` return `{}` gracefully
3. Buffers the raw stream, JSON-parses it, sets `req.body` to the parsed object in-place
Setting `req.body` to a parsed object before SuperTokens runs is safe: SuperTokens' `assertThatBodyParserHasBeenUsedForExpressLikeRequest` (in `supertokens-node/lib/build/framework/utils.js`) checks whether `req.body` is `undefined`, a Buffer, or an empty+readable object — if `req.body` is already a non-empty plain object, it uses it directly without reading the stream again. Stream is consumed exactly once (by this middleware).

Added `SEC-4-DB` DB-gated test (guarded by `TEST_DATABASE_URL`, skipped in unit context, runs at C-1/T-8). The test sends two requests with the same email from different IPs and asserts both land in the same bucket (count=2 for the email-keyed bucket key). A negative control confirms different emails from the same IP get independent buckets (count=1 each).

Both new DB-gated tests are `describe.skipIf(!hasTestDb)(...)` where `hasTestDb = typeof TEST_DATABASE_URL === 'string' && TEST_DATABASE_URL.trim().length > 0`.

Post-rework state: `pnpm -w typecheck` clean, `pnpm -w lint` exit 0 (115 warnings + 84 infos, all pre-existing), `pnpm test` 970 pass / 95 skip (35 rate-limit tests pass; 2 DB-gated correctly skip without TEST_DATABASE_URL).

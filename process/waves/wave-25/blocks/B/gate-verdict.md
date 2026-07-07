# B-6 Review — Gate Verdict (wave-25, M10 auth-hardening)

**Block:** B (Build) | **Stage:** B-6 Review | **Attempt:** 1 (Phase 1)
**Branch:** wave-25-auth-hardening | **Task:** 6fe232e3 | **Class:** SECURITY-SCOPE-TIGHTENED
**Gate author:** head-builder (fresh spawn) | **Date:** 2026-07-07

---

## VERDICT: REWORK

The rate-limiter *code* is well-architected and most SEC obligations are genuinely
present in source. But a **load-bearing infra defect makes the entire Postgres-backed
limiter dead in production**, which collapses the 4 HIGH obligations (SEC-1/2/3/5)
from "real" to "theater once deployed." Two secondary findings compound it. This
cannot pass to C-block.

---

## FAILED / DEFECTIVE CHECKS

### DEFECT-1 [BLOCKER — HIGH, collapses SEC-1/2/3/5] — Migration 0019 is NOT journaled → limiter table never created in prod

`apps/api/src/db/migrations/0019_rate_limit_hits.sql` exists on disk, but:

- `apps/api/src/db/migrations/meta/_journal.json` last entry is **idx 18**
  (`0018_outreach_activity`). There is **no idx-19 / `0019_rate_limit_hits`
  entry** (`grep -c 0019 _journal.json` → 0; `any 0019 → False`).
- There is **no `0019_snapshot.json`** in `meta/`.

Drizzle's migrator (`drizzle-kit migrate`) iterates `_journal.json` — an unjournaled
`.sql` file is invisible to the runner and **will never execute against prod
Postgres**. The migration's own header comment asserts `JOURNALED: idx 19, when >
1784678400000` — that assertion is **false**; the journal was never updated.

**Blast radius (why this is a HIGH, not a nit):**
- `rate_limit_hits` table is never created in prod/CI-with-migrate.
- Therefore **every** `atomicIncrement()` call throws → the `catch` (SEC-5) fires on
  **every request**, not just on a DB blip.
- signup + reset/request → permanent fail-OPEN → **no rate limiting at all** on those
  paths. The atomic Postgres counter (SEC-1) and dual-window (SEC-2) never run.
- signin + reset/confirm → permanent degrade to the **in-process `_softBuckets` Map**
  (~5/min, per-replica, non-atomic, not shared across Railway replicas). This is
  exactly the "in-memory limiter" anti-pattern the HIGH obligations exist to forbid —
  an attacker rotates across replicas / waits out the 60 s prune, and SEC-1's whole
  reason for being (a shared atomic counter) is bypassed.

The atomic UPSERT is correctly written (`INSERT ... ON CONFLICT (key,window_start)
DO UPDATE SET count = rate_limit_hits.count + 1 RETURNING count`, single round-trip,
post-increment read, no SELECT-then-UPDATE) — the *code* satisfies SEC-1. But
**code that never runs is theater.** Fix = journal the migration (add the idx-19
entry + `0019_snapshot.json`, regenerate via `drizzle-kit generate` rather than
hand-authoring the `.sql`) and prove it applies against a real Postgres.

### DEFECT-2 [HIGH — SEC-1 concurrency test is tautological] — No real-DB concurrent test proves atomicity

`rate-limit.middleware.spec.ts` "concurrent parallel calls" test (lines 240-266)
runs against `makeCountingPool()` — an **in-memory synchronous JS counter**. Node's
single-threaded event loop serializes the mock, so `Promise.all` cannot interleave;
the test's own comment concedes "With the mock ... sequential ordering is guaranteed
by the Promise.all — so exactly one call crosses." This falsifies **nothing** about a
racing DB implementation — a naive SELECT-then-UPDATE would pass this identical test.
The genuine atomicity proof (the SEC-1 obligation's "CONCURRENT-request test") is
**deferred to a `TEST_DATABASE_URL`-gated path that does not exist in this file** — the
header comment (lines 17-19) promises DB-gated tests for SEC-1/SEC-2 but no such
`describe.skipIf`/`describe.runIf(TEST_DATABASE_URL)` block is present. Fix: add a real
Postgres concurrent test (N+1 parallel real connections, assert exactly one 429) gated
on `TEST_DATABASE_URL`, run at C-1/T-8. Until then SEC-1 is unverified.

### DEFECT-3 [MED — SEC-4/SEC-6 partially theater for signin/signup in prod] — email bucketing relies on a body that isn't parsed at this stage

`extractIdentifier()` (lines 250-299) buckets on the submitted email **only if
`req.body` is already parsed**. Per the middleware's own 40-line comment (lines
260-298), it runs BEFORE body parsing for the real `/auth/signin` path (SuperTokens
parses internally) — so in production **signin/signup fall back to `req.ip`**, not the
email. The comment even promises "we will buffer-parse the body in this middleware.
See the rawBodyBuffer implementation below" — **that implementation does not exist**
(`grep rawBody|getRawBody|on('data'` → only the dangling comment reference at line 275).
Consequences:
- SEC-4 (email normalization → one bucket) and SEC-6 (per-submitted-email pre-lookup
  bucketing, no enumeration) are only exercised by tests that **inject a pre-parsed
  `body`** (SEC-4/SEC-6 tests pass `{ body: { email } }` directly). In prod those paths
  are **IP-bucketed**, so the email-based obligations are not actually in force for
  signin/signup. IP-bucketing is a defensible fallback (documented), but the spec
  obligation is email-keyed — this is a spec-vs-deployed gap that must be either
  (a) made real (buffer-parse the body, or move the email-keyed limit to the
  Nest-parsed reset/request path where body IS available), or (b) explicitly
  descoped to IP-keyed with founder/head sign-off and the SEC-4/SEC-6 ACs amended.
  Do not leave the code claiming email-keying it doesn't deliver.

---

## CHECKS THAT GENUINELY PASS (retain on rework)

- **SEC-3 trust proxy [HIGH]:** `app.set('trust proxy', 1)` in main.ts (exact hop count
  1, NOT `true`, NOT unset), documented in `command-center/dev/trust-proxy-hop-count.md`;
  `req.ip` used, not raw XFF; forged-XFF test present and non-tautological (asserts same
  bucket key for the resolved IP). Genuinely correct.
- **SEC-5 differentiated fail [HIGH] — policy correct:** FAIL_OPEN={signup,reset/request},
  FAIL_CLOSED_SOFT={signin,reset/confirm}; all 4 paths tested; the signin/reset-confirm
  soft-bucket cap is real and falsifying. (The pivotal risk call — signin fail-closed
  because invite-only doesn't protect it — is correct.) Downgraded in practice only
  because DEFECT-1 makes it the *always-on* path rather than the degraded path.
- **SEC-8 Express placement [load-bearing]:** `app.use(createRateLimitMiddleware())`
  registered BEFORE `app.use(middleware())` in main.ts — correct; a Nest guard would
  miss the SuperTokens-internal /auth/signin route. signin-flood 429 test present.
- **SEC-9 no global pipe [MED]:** per-handler `safeParse` on all 4 auth handlers
  (`@Body() body: unknown`), no `useGlobalPipes`/`APP_PIPE`; 18 controllers unaffected.
  Solid. (Note: the "tenant CRUD passes through" guard test is a `expect(true).toBe(true)`
  marker, not a real assertion — weak, but the real evidence is the untouched controllers.)
- **SEC-10 generic 400:** byte-identical `'Invalid or expired invite'` for
  missing/empty/malformed; service not called on validation failure (no account created).
  Tested with identical-message assertion. Good.
- **SEC-11 logout anti-CSRF:** `antiCsrf: 'VIA_CUSTOM_HEADER'` confirmed in
  supertokens.config.ts (line 145); `@UseGuards(SessionGuard)` on logout; no hand-rolled
  CSRF. Integration test (no-rid→401) correctly deferred to T-8/C-2 (needs live Core).
- **No regression:** invite-only signup + session model intact; migration is additive,
  correctly NOT tenant-scoped / NOT RLS / NOT WORM (rationale documented). Table shape
  and grants are correct — the *content* of 0019 is fine; only its journaling is broken.

---

## REQUIRED REWORK (Attempt 2 must land all three)

1. **[BLOCKER] Journal migration 0019** — regenerate via `drizzle-kit generate` so
   `_journal.json` gains the idx-19 entry AND `0019_snapshot.json` exists; prove
   `drizzle-kit migrate` creates `rate_limit_hits` against a real Postgres. Route to
   **postgres-pro** to verify the journal/snapshot pair and the migrate dry-run.
2. **[HIGH] Real concurrent atomicity test** — add a `TEST_DATABASE_URL`-gated test:
   N+1 truly-parallel real DB connections against one bucket, assert exactly one 429,
   count never under-counts. Route to **postgres-pro** / **security-engineer**.
3. **[MED] Resolve the body-parse gap** — either buffer-parse the request body so
   signin/signup are genuinely email-keyed (SEC-4/SEC-6), OR descope those two paths to
   IP-keyed with an explicit AC amendment + head sign-off, and delete the dangling
   "rawBodyBuffer implementation below" comment.

---

```yaml
head_signoff:
  verdict: REWORK
  stage: B-6
  attempt: 1
  reviewers: {}
  failed_checks:
    - "DEFECT-1 [BLOCKER]: migration 0019 not in _journal.json (last idx 18) + no 0019_snapshot.json → rate_limit_hits never created in prod → limiter dead, SEC-1/2 never run, SEC-5 fires on every request (permanent fail-open on signup/reset-request; per-replica in-memory soft bucket on signin/reset-confirm)"
    - "DEFECT-2 [HIGH]: SEC-1 concurrent test uses in-memory mock pool (tautological — a racing SELECT-then-UPDATE would pass it); no TEST_DATABASE_URL-gated real-DB concurrency test exists despite header claim"
    - "DEFECT-3 [MED]: SEC-4/SEC-6 email-keying is prod-theater for signin/signup — extractIdentifier falls back to req.ip pre-body-parse; promised rawBodyBuffer buffer-parse does not exist; email tests only pass pre-injected bodies"
  passed_checks:
    - "SEC-3 trust proxy=1 (exact hop, doc'd), req.ip not raw XFF, non-tautological forged-XFF test"
    - "SEC-5 differentiated-fail POLICY correct + 4 paths tested (fail modes real)"
    - "SEC-8 Express app.use() before middleware() — correct placement, signin-flood test"
    - "SEC-9 per-handler safeParse, no global pipe (18 controllers unregressed)"
    - "SEC-10 byte-identical generic 400, no account created on failure"
    - "SEC-11 VIA_CUSTOM_HEADER + SessionGuard + no hand-roll; integration test correctly DB/Core-gated to T-8/C-2"
    - "no-regression: additive, non-tenant/non-RLS/non-WORM migration content correct; invite-only + session intact"
  rationale: >
    The limiter is competently designed and 6 of 11 SEC obligations (SEC-3, and the
    policy/placement/validation SEC-5/8/9/10/11) genuinely hold in source with
    falsifying tests. But migration 0019 was never journaled — no idx-19 entry in
    _journal.json (last is idx 18) and no 0019_snapshot.json — so drizzle-kit migrate
    will never create rate_limit_hits in production. That single defect makes the
    Postgres-backed atomic counter (SEC-1) and dual fixed-window (SEC-2) dead code once
    deployed: the SEC-5 catch fires on every request, degrading signup/reset-request to
    NO rate limiting and signin/reset-confirm to a per-replica in-memory Map — the exact
    in-memory-limiter anti-pattern the HIGH obligations forbid. Compounding: the SEC-1
    concurrency test is tautological against an in-memory mock (proves nothing about DB
    races), and SEC-4/SEC-6 email-keying is theater in prod because the middleware runs
    before body parsing and the promised buffer-parse was never implemented, silently
    falling back to IP-keying. None of these are blockers to the load-bearing audit-log
    (this wave adds no audit-touching mutations), so this is REWORK not ESCALATE — the
    defects are concrete and fixable within the block.
  next_action: REWORK_B-2
```

---
---

# B-6 Review — Gate Verdict (wave-25, M10 auth-hardening) — ATTEMPT 2 (RE-VERDICT)

**Block:** B (Build) | **Stage:** B-6 Review | **Attempt:** 2 (re-verdict of the 3 REWORK defects)
**Branch:** wave-25-auth-hardening | **Task:** 6fe232e3 | **Class:** SECURITY-SCOPE-TIGHTENED
**Fix commit under review:** 0e423cf | **Gate author:** head-builder (fresh spawn) | **Date:** 2026-07-07

---

## VERDICT: APPROVED

All three Attempt-1 defects are **genuinely closed** against the current code (commit
0e423cf), each confirmed from a concrete artifact — not from the fix commit's own claims.
The Postgres-backed rate-limiter now **actually works in production**: the migration is
journaled and creates the table, real atomicity is proven against real Postgres, and
email-keying reads a genuinely-parsed body without breaking SuperTokens. No fix
introduced a new defect. The six Attempt-1 passes still hold. Green build/test state is
verified live, not inherited.

---

## DEFECT-BY-DEFECT RE-VERIFICATION

### DEFECT-1 [was BLOCKER] — CLOSED. Migration 0019 is journaled → table creates in prod.

- `meta/_journal.json` now carries an **idx-19 entry** `{ idx: 19, tag: "0019_rate_limit_hits" }`
  (grep confirmed at line 142; journal tail shows it appended after idx-18).
- `meta/0019_snapshot.json` **exists** (126 KB, mtime 12:50) and its snapshot chain is
  intact: `0019.prevId = c4c721d6-…` **==** `0018.id = c4c721d6-…`. No broken chain.
- Snapshot internals consistent with the SQL and the Drizzle table def: composite PK
  `rate_limit_hits_key_window_start_pk` on `(key, window_start)` present in
  `compositePrimaryKeys`, matching `0019_rate_limit_hits.sql` (`CONSTRAINT … PRIMARY KEY("key","window_start")`)
  and `schema/rate-limit-hits.ts` (`primaryKey({ columns: [table.key, table.windowStart] })`).
- `schema/rate-limit-hits.ts` exists and is **exported** from `schema/index.ts` (line 47).
- **`npx drizzle-kit check` → "Everything's fine"** — journal + snapshot + SQL are
  mutually consistent; the migrator will iterate to idx-19 and run the CREATE TABLE.
- Note (non-blocking): idx-19's `when` (1783428538937) is numerically earlier than
  idx-18's — Drizzle applies migrations by **journal array index**, not by `when`, so
  ordering is correct and the table still creates after 0018. Cosmetic only; flagged for
  the L-block, not a gate blocker.
- **Conclusion:** `ensureMigrated` / `drizzle-kit migrate` WILL create `rate_limit_hits`
  in prod/CI → the atomic UPSERT has a table → SEC-1/SEC-2 are live, not dead code.
  The permanent-fail-open / per-replica-in-memory degradation of Attempt-1 is gone.

### DEFECT-2 [was HIGH] — CLOSED. Real-DB concurrent atomicity test now exists and is falsifying.

- New `describe.skipIf(!hasTestDb)` block **SEC-1-DB** (spec lines 819-911), gated on
  `TEST_DATABASE_URL` (`hasTestDb`, lines 816-817). Correctly **skips in unit context**
  (verified: spec run shows `2 skipped`) and runs at C-1/T-8 where the DB URL is set.
- It opens a **real pg Pool** (`new PgPool({ connectionString: TEST_DB_URL, max: 20 })`),
  calls `ensureMigrated` to create the table, then fires **N+1 truly-concurrent** real
  `INSERT … ON CONFLICT (key,window_start) DO UPDATE SET count = count+1 RETURNING count`
  via `Promise.all` against one bucket.
- Assertions are genuinely falsifying against a SELECT-then-UPDATE impl:
  `uniqueCounts.size === concurrentCount` (every caller gets a **distinct** post-increment
  value — a lost-update race would collide), `maxCount === concurrentCount`, and a
  post-hoc `SELECT count` == `concurrentCount` (no under-count). A naive read-modify-write
  would fail all three. This is the real atomicity proof Attempt-1 demanded.

### DEFECT-3 [was MED] — CLOSED. Email-keying reads a real parsed body; SuperTokens not broken.

- `ensureBodyParsed` (lines 279-316) now **buffers the raw stream** (`req.on('data'/'end')`),
  `JSON.parse`s it, and sets `req.body` in-place before `extractIdentifier` runs (invoked
  at line 412 before line 413). The dangling "rawBodyBuffer implementation below" comment
  is resolved — the implementation now exists.
- **SuperTokens no-double-consume claim VERIFIED against the actual installed SDK source**
  (`node_modules/supertokens-node/lib/build/framework/utils.js:211-252`), not inferred
  from the code comment. `assertThatBodyParserHasBeenUsedForExpressLikeRequest` re-parses
  the stream ONLY when `request.body === undefined || isBuffer(body) || (Object.keys(body).length===0 && request.readable)`.
  After `ensureBodyParsed` sets a **non-empty parsed object** AND drains the stream to
  'end' (so `request.readable === false`), none of those branches fire → SuperTokens uses
  `req.body` directly. **No stream double-consume.** Even the empty-body edge is safe: the
  stream is drained, so `request.readable` is false and the `{}`-and-readable branch can't
  trigger a re-read. Reasoning is sound.
- **SEC-4-DB** test (lines 925-1002), `TEST_DATABASE_URL`-gated: same email from two
  **different IPs** → asserts the shared per-email bucket has `count === 2` (proves
  email-keying, not IP-keying — under IP-keying each IP would be count=1), plus a negative
  control (different email / same IP → its own bucket, count=1). Correct falsifying design.
- reset/confirm remains IP-keyed by design (no email in `{token,password}` body — line
  334), which is correct and documented. SEC-4/SEC-6 (per-account keying, no enumeration)
  now hold for signin/signup/reset-request in prod.

---

## ATTEMPT-1 PASSES RE-CONFIRMED (still hold on 0e423cf)

- **SEC-3** `app.set('trust proxy', 1)` at main.ts:102 (exact hop `1`, not `true`) — holds.
- **SEC-5** differentiated fail policy + soft-bucket cap intact (unchanged in fix).
- **SEC-8** `app.use(createRateLimitMiddleware())` (main.ts:127) BEFORE `app.use(middleware())`
  (main.ts:135) — ordering correct, load-bearing placement holds.
- **SEC-9** per-handler safeParse, **no `useGlobalPipes`** anywhere in `src/` — holds.
- **SEC-10 / SEC-11** unchanged by the fix — retained.
- **No regression:** migration additive / non-tenant / non-RLS / non-WORM; no audit-log
  path touched (pre-auth counter, no state mutation → no audit obligation triggered).
- **Green state verified live (not inherited):** `pnpm -r typecheck` exit 0 (3 projects
  with the script, all Done); full API suite **970 passed | 95 skipped (1065)** — matches
  the claim exactly; rate-limit spec **33 passed | 2 skipped** (the 2 DB-gated tests skip
  correctly in unit context); `pnpm -r lint` exit 0 (warnings/infos only, no errors).

---

```yaml
head_signoff:
  verdict: APPROVED
  stage: B-6
  attempt: 2
  reviewers:
    postgres-pro: not-required (journal/snapshot consistency machine-verified via `drizzle-kit check` → "Everything's fine")
    security-engineer: not-required (SuperTokens no-double-consume claim verified directly against installed SDK source utils.js:211-252)
  failed_checks: []
  passed_checks:
    - "DEFECT-1 CLOSED: _journal.json has idx-19 (0019_rate_limit_hits) + 0019_snapshot.json exists + snapshot chain intact (0019.prevId==0018.id) + composite PK matches SQL/schema + `drizzle-kit check` green → migrate WILL create rate_limit_hits in prod; SEC-1/2 are live"
    - "DEFECT-2 CLOSED: SEC-1-DB describe.skipIf(!hasTestDb) fires N+1 concurrent real-PG UPSERTs, asserts unique RETURNING (size==N+1) + max==N+1 + stored count==N+1 — a SELECT-then-UPDATE fails this; correctly skips in unit, runs at C-1/T-8"
    - "DEFECT-3 CLOSED: ensureBodyParsed buffers+parses the raw stream before extractIdentifier → prod signin/signup key on normalized email, not req.ip; SuperTokens no-double-consume VERIFIED against installed SDK (utils.js re-parses only when body undefined/Buffer/empty-and-readable — none fire after a non-empty parsed body + drained stream); SEC-4-DB proves same-email/different-IP shared bucket"
    - "SEC-3/5/8/9/10/11 Attempt-1 passes still hold on 0e423cf"
    - "Green verified live: typecheck exit 0; 970 pass/95 skip; rate-limit spec 33 pass/2 DB-gated skip; lint exit 0"
  rationale: >
    All three prod-killing defects from Attempt 1 are genuinely closed, each proven from a
    concrete artifact rather than the fix commit's own assertions. DEFECT-1: the migration
    is now journaled (idx-19 entry + 0019_snapshot.json with an intact prevId chain) and
    `drizzle-kit check` returns clean, so drizzle-kit migrate will create rate_limit_hits
    in prod/CI — the atomic counter is no longer dead code. DEFECT-2: a real
    TEST_DATABASE_URL-gated test fires N+1 genuinely-concurrent UPSERTs against real
    Postgres and asserts unique post-increment RETURNING values plus an exact stored
    count, which a lost-update SELECT-then-UPDATE could not pass; it skips correctly in
    unit context and runs at C-1/T-8. DEFECT-3: the middleware now buffer-parses the raw
    request body before identifier extraction, and — the load-bearing risk of this fix —
    I verified directly against the installed supertokens-node source (utils.js:211-252)
    that this does NOT double-consume the stream: SuperTokens re-parses only when body is
    undefined / a Buffer / empty-and-still-readable, none of which hold after a non-empty
    parsed object with a drained stream. The SEC-4-DB test proves same-email/different-IP
    shares one bucket. No fix introduced a regression; the six Attempt-1 passes hold; and
    the green build/test state (typecheck 0, 970 pass/95 skip, lint 0) is confirmed live.
    The one cosmetic nit — idx-19's out-of-order `when` timestamp — is non-blocking
    because Drizzle applies migrations by journal index, not timestamp; logged for L-block.
    This wave adds no audit-log-touching mutation (pre-auth counter, no state change), so
    the load-bearing compliance invariant is not implicated. Clear to C-block.
  next_action: PROCEED_TO_C-1
```

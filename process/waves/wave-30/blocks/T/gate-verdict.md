# Wave 30 — T-block gate verdict (T-8 Security + T-9 Journey)

**Agent:** head-tester (fresh-spawned @ T-9 Journey gate)
**Wave topic:** M9 Affinity DataSourceAdapter — external-SDK CRM adapter behind the existing DataSourceAdapter interface (paginate-all + 429-backoff + 5xx-retry + timeout-abort + boundary-Zod + normalize) + 13 mocked tests
**Branch:** wave-30-affinity-adapter | **Live commit:** a6ad02c (registered, DORMANT until founder AFFINITY_API_KEY)
**CI run:** 28935866473 (5/5 green on exact headSha a6ad02c) | **Prod:** dealflow-api @ a6ad02c, /health 200 {db:ok}

---

## VERDICT: **APPROVED**

Coverage is GENUINE, not theater. Verified against the actual shipped adapter code + spec + CI logs + live /health — not the summaries. All T-8 security cruxes hold; T-9 journey has no delta (backend-only, no new user route). No Playwright-binary blocker applies (Vitest backend suite; no E2E/layout in scope).

---

## T-8 Security — each item verified GENUINELY tested (code-level, not inferred)

### 1. NO secret leak (crux) — PASS
- `process.env.AFFINITY_API_KEY`, env-only (`affinity.adapter.ts:294`). Never hard-coded.
- `git show a6ad02c` grep for a committed real key value → NONE. Only fake test keys present: `test-api-key-do-not-use` (spec:92), `my-test-api-key` (spec:494).
- `.env.example:42` is NAME-ONLY (`AFFINITY_API_KEY=` + comment, no value).

### 2. Graceful-no-key / crash-safety (crux) — PASS (genuine)
- Adapter bails BEFORE any network: `:296-302` — `if (!apiKey) { console.warn(...); return []; }`. No throw.
- The only `throw` (`:184`) is contained inside `fetchWithRetry` (retry-exhausted) and CAUGHT by the outer loop (`:328-334`), degrading to partial results (`break`) — never propagated out of `fetchCompanies`.
- Registration is construction-only (`adapter.registry.ts:59` — no env read at module load), so the DI container boots dormant.
- TEST 6 (absent-key-noop) genuinely verifies: `delete process.env.AFFINITY_API_KEY` → asserts `results).toEqual([])` AND `mockFetch).not.toHaveBeenCalled()` AND the warning log. Proves no-throw + no-network on absent key.
- Independently proven LIVE: CI `test`+`build` ran with NO key (green); `sourcing.di-boot.spec.ts (5)` boots the NestJS DI container with the adapter registered; prod `/health` → 200 `{status:ok, db:ok, version:a6ad02c}` with no key set, stable across 3 probes (no crash-loop). App cannot crash at boot without the key.

### 3. Robustness genuinely fault-killing (not tautological) — PASS
- TEST 1 (pagination): asserts `orgFetchCount).toBe(3)` + `ids).toEqual(['1'..'6'])` + per-page `page_token=TOKEN_1/TOKEN_2` URL checks — a page-1-only bug HARD-fails all three. Not a mock-invoked tautology.
- TEST 2 (429): real 429→200 (asserts callCount>=2 + record returned).
- TEST 3 (5xx→success), TEST 4 (timeout-abort→partial []), TEST 7 (page-2 network fail → page-1 records returned, asserts ids `100`/`101` + "fetch failed after retries" log).
- TEST 8 (boundary-Zod): malformed response (missing `organizations`) → asserts `toEqual([])` + does-NOT-throw + "failed Zod validation" log. Plus person-Zod-skip test.
- 42 `expect()` assertions across 13 tests (>3/test) — no single-assert coverage-theater smell. Assertions bind concrete output state (record IDs, lengths, normalized shape, log strings), not `expect(mock).toHaveBeenCalled()` alone.

### 4. SDK-doc-first — PASS
- `command-center/dev/SDK-Docs/Affinity/affinity.md` (345 lines) — research-grounded (auth as key-as-password, page_token loop, rate-limit headers, error shapes, normalize map, internal Zod). `SDK-Docs/registry.md` row present. Authored before the adapter (B-6 verified).

### 5. No coverage gap / no regression; live-verify correctly key-gated — PASS
- CI: affinity.adapter.spec `(13 tests) 82ms` — executed-test count NON-ZERO with real duration (CI-blindness guard cleared; not a silent-skip false-PASS). api 65 test files + web 33 passed; no regression.
- The LIVE Affinity integration test is CORRECTLY deferred (key-gated): mock-unit-test the adapter now (all fault paths covered), live e2e when the founder's key arrives. This is the RIGHT call — a live test is impossible without the key and would be a false-green if faked. NOT a coverage gap.

### 6. The 2 P2s (accepted) + founder-key follow-up — acceptable / routed
- P2-a (adapter doesn't safeParse its OWN output vs normalizedSourceRecordSchema): accepted, carried PRE-LIVE-HOOKUP (fold before real data flows, C-2+key). Acceptable — no real Affinity data flows until the key; output shape is covered by TEST-1/5 normalize assertions against a `.strict()` schema at the registry boundary.
- P2-b (backoff TIMING untested; retry IS covered): accepted, `vi.useFakeTimers` follow-up. Non-blocking — retry correctness is proven; only wall-clock backoff duration is unasserted.
- INFO (live hookup awaits AFFINITY_API_KEY): routed to founder (`process/session/updates/founder-request-affinity-api-key.md`); no-new-code activation path recorded. Correctly deferred.
- None are compliance/security/robustness defects. All routed; none block.

## T-9 Journey — no delta needed
- NO new user-facing route. The Affinity adapter is a backend data-provider feeding the EXISTING sourcing search behind the shared DataSourceAdapter interface. Live smoke: `/sourcing/companies` 401, `/sourcing/connections` 401 (routes mounted + auth guard booted). Existing user-journey-map unaffected — minor note only: sourcing search may surface Affinity-origin companies once the key activates (no UI/route change).
- Env-credential check: CI + deploy used NO elevated/long-lived token for the adapter; the key is a deploy-scoped Railway secret, unset (dormant). Deploy-scoped Railway probe (`project(id)`, never `me{}`). Ephemeral-test-credential invariant holds.

## Playwright Chrome binary gate — NOT APPLICABLE
- No UI change, no T-5 E2E / T-6 layout stage in scope this wave. The executed suite is Vitest (backend, mocked HTTP). No browser binary required; no silent-skip false-PASS risk. Gate does not fire.

---

```yaml
head_signoff:
  verdict: APPROVED
  stage: T-9
  reviewers: {}
  failed_checks: []
  rationale: >
    Coverage verified GENUINE against actual code, spec, CI logs and live /health — not summaries.
    T-8 secret: API key env-only (affinity.adapter.ts:294), never committed (diff grep clean — only fake
    test keys), .env.example name-only. Graceful-no-key crash-safety: adapter returns [] + warns before any
    network (:296-302, no throw); the sole throw is contained in fetchWithRetry and caught by the outer loop
    (:328-334); TEST 6 genuinely proves it (toEqual([]) + fetch not-called); independently proven live —
    di-boot spec + prod /health 200 {db:ok, version:a6ad02c} with NO key, no crash-loop. Robustness genuinely
    fault-killing: TEST 1 asserts orgFetchCount===3 + ids [1..6] + per-page page_token (page-1-only bug fails
    it); TEST 2 real 429->200; TEST 7 partial-failure returns page-1; TEST 8 malformed->[]-no-throw. 42 assertions
    over 13 tests bind concrete output state, not mock-invoked tautologies. SDK-doc-first (Affinity 345-line
    research doc + registry row). Executed-test count NON-ZERO (affinity.spec 13 tests 82ms) — CI-blindness guard
    cleared. Live Affinity integration correctly key-gated (mock-unit now, live-e2e on key arrival) — the right
    call, not a coverage gap. 2 P2s accepted + routed (output-safeParse PRE-LIVE-HOOKUP; backoff-timing follow-up),
    founder-key INFO routed. T-9: no new user route (backend adapter feeding existing sourcing search) — no journey
    delta. Playwright Chrome-binary gate N/A (Vitest backend suite; no E2E/layout in scope).
  next_action: PROCEED_TO_V-block
```

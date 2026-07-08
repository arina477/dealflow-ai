# Wave 31 — T-block gate verdict (T-8 Security + T-9 Journey)

**Agent:** head-tester (fresh-spawned @ T-9 Journey gate)
**Wave topic:** M9 Twenty CRM DataSourceAdapter — external-SDK CRM adapter behind the existing DataSourceAdapter interface (paginate-all + 429-backoff + 5xx-retry + timeout-abort + boundary-Zod + normalize + [P2-a] output-validation) + 18 mocked tests
**Live commit:** d46a42f (registered, DORMANT until founder TWENTY_API_KEY + TWENTY_BASE_URL) | C-block APPROVED on b1f81d79 (CI green, Railway deploy boot-clean-dormant)
**Precedent:** wave-30 Affinity T-block APPROVED — same shape, same key-gated-deferral disposition. Reasoning adopted where it holds; re-verified against wave-31 code.

---

## VERDICT: **APPROVED**

Coverage is GENUINE, not theater. Verified against the actual shipped adapter code + spec + shared schema + registry — not the summaries. The two tests most prone to tautology (multi-page pagination, [P2-a] output-validation) were code-inspected and are real fault-injections. The key-gated LIVE E2E deferral is LEGITIMATE (matches wave-30). No Playwright-binary blocker applies (Vitest backend suite; no E2E/layout in scope). No compliance-invariant surface added.

---

## Judge item 1 — T-1 Unit adequacy: 18 tests GENUINE + adequate for the risk surface

Confirmed real assertions, not tautologies (56 `expect()` across 18 tests — >3/test; no single-assert smell):

- **(a) multi-page cursor pagination (TEST 1) — GENUINE.** Mocks 3 pages via `pageInfo.hasNextPage`/`endCursor`; asserts `fetchCount).toBe(3)` AND `ids).toEqual(['id-1'..'id-6'])` (all 6 across pages) AND per-page URL checks (`starting_after=CURSOR_1`/`CURSOR_2`, page 1 has NO `starting_after`). A page-1-only bug HARD-fails all three assertions. NOT a mock-invoked tautology. Adapter code (`twenty.adapter.ts:412-468`) genuinely loops on the cursor and terminates on `!hasNextPage || endCursor==null`.
- **(b) 429/5xx/timeout — GENUINE.** TEST 2 real 429→200 (`callCount>=2` + record returned + "429 rate-limited" log); TEST 3 real 503→200; TEST 4 AbortError → `toEqual([])` + no-throw + error logged. Retry paths in `fetchWithRetry` (`:214-285`) are bounded by MAX_RETRIES.
- **(c) normalize (TEST 5 + domain/no-domain/no-email/depth extras) — GENUINE.** Asserts concrete `sourceRecordId`, `name`, `domain==='acme.com'`, `contacts[0]` `{name,email,title}`, `raw` shape. Domain-extraction, absent-domain (undefined), absent-email (undefined) all asserted against exact output state.
- **(d) absent-key AND absent-URL graceful no-op (TEST 6 + 7) — GENUINE, boot-safety.** Each asserts `toEqual([])` AND `mockFetch).not.toHaveBeenCalled()` AND the specific warning log. Proves no-throw + no-network on absent config. Adapter bails BEFORE any network (`:365-381`). Registration is construction-only (`adapter.registry.ts:61` — no `process.env` read at register site → DI container boots dormant, verified).
- **(e) [P2-a] OUTPUT-validation (TEST 11) — GENUINE, and this is the one I checked hardest.** It feeds a REAL invalid record: `invalidCompany` with `name: ''`. The shared `normalizedSourceRecordSchema` (`packages/shared/src/sourcing.ts:24`) is `name: z.string().min(1)` — an empty string genuinely FAILS. Test asserts only the valid record survives (`toHaveLength(1)` + `sourceRecordId==='id-valid'`) AND "failed output schema validation" is logged for the skipped one. The adapter (`:478-487`) `safeParse`s each normalized output and `continue`s on failure. This is a real fault-injection killing a real mutant, NOT a test that "doesn't feed an invalid record." (Also closes the wave-30 Affinity P2-a gap — wave-30 validated inbound but not outbound; wave-31 folds outbound validation.)
- **(f) boundary-Zod (TEST 10) — GENUINE.** Malformed response (missing `data` key) → `toEqual([])` + no-throw + "failed Zod validation" log. `twentyCompaniesResponseSchema.safeParse` at `:445`.
- **(g) SSRF/https-guard (TEST 8 non-https + TEST 9 malformed-URL) — GENUINE.** `http://` → no-op + "is not HTTPS" warn + `fetch` not called; unparseable URL → no-op + warn. Adapter https-validates `TWENTY_BASE_URL` before any HTTP (`:383-401`). Plus TEST 12 auth-Bearer format + TEST 13 partial-failure (page-2 error → page-1 records returned).

All assertions bind concrete output state (record IDs, lengths, normalized shape, log strings), not `expect(mock).toHaveBeenCalled()` alone. **No tautology found — the one thing to not let slide is clear.**

## Judge item 2 — Key-gated E2E deferral: LEGITIMATE (not a coverage gap)

The LIVE Twenty fetch → sourcing-search E2E (T-4/T-5) is NOT runnable without `TWENTY_API_KEY` + `TWENTY_BASE_URL`, both founder-gated. Mock-unit-testing every fault path now (pagination/429/5xx/timeout/normalize/no-key/no-URL/SSRF/boundary-Zod/output-validation/partial-failure) and deferring the live E2E to key-arrival is the RIGHT call — a live test is impossible without the key and a faked one would be a false-green. The DORMANT path (adapter registered construction-only, returns [] on absent config, app boots, fixture/Affinity search unaffected) is C-2-verified (Railway deploy boot-clean-dormant on b1f81d79). This matches the wave-30 Affinity precedent exactly — a legitimate key-gated deferral, NOT a swept-under-the-rug gap.

## Judge item 3 — T-2/T-3/T-6/T-7 genuinely N/A (not skipped-to-save-time)

- **T-2 Integration / T-3 Contract — N/A.** No new API endpoint: the adapter feeds the EXISTING sourcing search via the registry's unchanged `DataSourceAdapter` interface (contract unit-covered). No new DB: config schema `dataSourceConnectionConfigSchema` UNTOUCHED (wave-16 boundary respected), 0 migrations.
- **T-6 Layout / T-7 Perf — N/A.** No UI (no route/layout/journey change). No perf-sensitive request path: the adapter is an off-request ETL-style fetch, internally bounded (pagination cap-by-cursor, 30s timeout, MAX_RETRIES-bounded). These are structurally N/A, not schedule-skips.

## Judge item 4 — T-8 Security: SATISFIED (adversarially verified at B-6, no separate spawn needed)

- **No secret leak (crux) — PASS.** `process.env.TWENTY_API_KEY` + `TWENTY_BASE_URL`, env-only (`:365,:374`). `git show HEAD` + adapters-dir grep for a committed long-key literal → NONE (only fake test key `test-twenty-api-key-do-not-use` spec:118, `my-twenty-api-key` spec:503). `.env.example:43-44` are NAME-ONLY (`TWENTY_API_KEY=` / `TWENTY_BASE_URL=` + comment, no values).
- **Graceful-no-key/URL crash-safety — PASS.** Adapter returns [] + warns before any network on absent key OR URL (no throw); the sole `throw` is contained in `fetchWithRetry` and caught by the outer loop (`:427-435`), degrading to partial results. TEST 6/7 genuinely prove it. Construction-only registration → dormant boot.
- **SSRF/https-guard — PASS.** Non-https and malformed `TWENTY_BASE_URL` refused before any HTTP (`:383-401`); TEST 8/9 prove it.
- **Config-schema-untouched — PASS** (wave-16 secret-sink boundary respected). All adversarially verified at B-6 /review (no P0/P1/P2) — same disposition as wave-30; no separate security-auditor spawn required.

## Judge item 5 — Compliance-invariant map: NO new surface

This wave adds NO compliance-invariant surface: no audit-log (HMAC-SHA256 hash-chain) path, no auth/RBAC/SoD path, no user-data mutation. It is a read-only external-source adapter feeding the existing sourcing search. The compliance-invariant test map is unchanged. Confirmed.

## Playwright Chrome binary gate — NOT APPLICABLE
No UI change, no T-5 E2E / T-6 layout stage in scope. Executed suite is Vitest (backend, mocked HTTP) — no browser binary required, no silent-skip false-PASS risk. Gate does not fire.

---

```yaml
head_signoff:
  verdict: APPROVED
  stage: T-9
  reviewers: {}
  failed_checks: []
  rationale: >
    Coverage verified GENUINE against actual code, shared schema, and registry — not summaries. The two
    tautology-prone tests were code-inspected and are real fault-injections: TEST 1 (pagination) asserts
    fetchCount===3 + ids [id-1..id-6] + per-page starting_after cursor URLs (a page-1-only bug fails all three);
    TEST 11 ([P2-a] output-validation) feeds a REAL invalid record (name:'') that genuinely fails the shared
    normalizedSourceRecordSchema (sourcing.ts:24 name:z.string().min(1)), asserting the invalid record is skipped
    + logged and only the valid one survives. 429/5xx/timeout/partial-failure/boundary-Zod/SSRF-https-guard all
    assert concrete output state (record IDs, lengths, logs), not mock-invoked tautologies (56 expect over 18
    tests). Absent-key AND absent-URL no-op (TEST 6/7) prove boot-safety: []+warn, fetch not called, no throw;
    registration is construction-only (adapter.registry.ts:61, no env read at load) → dormant boot, C-2-verified
    on b1f81d79. T-8: key + base-URL env-only (:365,:374), never committed (git grep clean, only fake test keys),
    .env.example:43-44 name-only; graceful-no-key/URL crash-safety; https/SSRF guard; config schema untouched
    (wave-16 boundary) — adversarially verified at B-6, no separate spawn. Key-gated LIVE Twenty E2E correctly
    deferred (needs founder TWENTY_API_KEY + TWENTY_BASE_URL) — legitimate, matches wave-30 Affinity precedent,
    not a coverage gap. T-2/T-3/T-6/T-7 genuinely N/A (no new endpoint — feeds existing sourcing search via
    unchanged registry contract; 0 migrations; no UI; off-request bounded fetch). No compliance-invariant surface
    added (read-only external-source adapter; no audit-log/auth/RBAC/user-data-mutation path). Playwright
    Chrome-binary gate N/A (Vitest backend suite; no E2E/layout in scope).
  next_action: PROCEED_TO_V-block
  followup:
    - live_twenty_e2e: FOUNDER-GATED — the LIVE Twenty fetch → sourcing-search E2E runs when TWENTY_API_KEY +
      TWENTY_BASE_URL arrive (Railway dealflow-api service). No new code — activation is env-only. Mirrors the
      wave-30 Affinity live-hookup follow-up.
```

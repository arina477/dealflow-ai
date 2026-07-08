# Wave 30 — B-block gate verdict (B-6 Review, Phase 1)

**Agent:** head-builder (fresh-spawned)
**Stage:** B-6 Review
**Wave topic:** M9 Affinity DataSourceAdapter — SDK doc (research-first) + adapter (fetchCompanies: internal pagination + 429-backoff + retry + timeout + boundary-Zod + normalize) behind the existing DataSourceAdapter interface + mocked-HTTP tests
**Branch:** wave-30-affinity-adapter
**Commit reviewed:** 4ee349c
**Seed:** 345dfbc6

---

## VERDICT: **APPROVED**

Every binding obligation is satisfied against the *actual shipped code* (not the summary). No page-1-only fetch, no fake backoff test, no committed key, no crash-without-key. Full sourcing suite re-run green (144/144, incl. 13 affinity tests).

---

## Binding-obligation verification (each checked in code)

### 1. SDK-doc-FIRST — PASS (genuine, research-grounded)
`command-center/dev/SDK-Docs/Affinity/affinity.md` (345 lines) is a genuine reference, not a stub:
- **Auth:** HTTP Basic, key-as-**password** (`base64(":" + apiKey)`, leading colon / empty username) — correctly documents the `-u :$APIKEY` curl form and warns against the wrong `apiKey + ":"` encoding (Gotcha #6).
- **Pagination:** `page_size=500` + `page_token` loop; termination on `next_page_token == null || absent`; explicit warning that a *present* token does NOT guarantee more records (check null, not empty array) — Gotcha #4.
- **Rate limits:** 900/user/min; `429`; full `X-Ratelimit-Limit-User-*` header table; honestly flags that `Retry-After` is NOT in documented headers and that the adapter falls back to `X-Ratelimit-Limit-User-Reset` + exponential — assumption tagged for C-2 live-verify.
- **Error shapes:** 401/403/404/422/429/500/503 table + JSON `{message}` body.
- **Normalize map** (org/persons → NormalizedSourceRecord) + **internal Zod schemas** (`.passthrough()`) + **Runtime Literals** table + **registry.md row** all present.
- Assumptions (person-cap=10, no-Retry-After) are explicitly tagged `[to verify at live-hookup]` — honest, not fabricated.

### 2. REUSE-not-rebuild — PASS
`affinity.adapter.ts` implements the EXISTING `DataSourceAdapter` interface from `@dealflow/shared` (`packages/shared/src/sourcing.ts`): `readonly providerKey` + `fetchCompanies(connection): Promise<NormalizedSourceRecord[]>`. Single-method contract, NO cursor — matches `fixture.adapter.ts`. Registered in `createDefaultRegistry()` alongside the fixture (`adapter.registry.ts:59`). NOT a parallel pipeline. Output conforms to the `.strict()` `normalizedSourceRecordSchema` (conditional `domain` spread avoids emitting undefined keys).

### 3. ROBUSTNESS (the crux) — PASS, all inline, genuinely tested
Read `fetchCompanies` + `fetchWithRetry`:
- (a) **Paginate ALL pages:** `while(true)` `page_token` loop, breaks only on `next_page_token == null`. TEST 1 asserts `orgFetchCount === 3` + all 6 IDs + page-2 URL carries `page_token=TOKEN_1`, page-3 carries `TOKEN_2` — a page-1-only bug hard-fails this test.
- (b) **429 backoff:** reads `X-Ratelimit-Limit-User-Reset` (sec→ms), falls back to exponential; bounded by MAX_RETRIES. TEST 2 is a REAL 429→retry→success (asserts callCount>=2 AND record '10' returned) — not a tautology.
- (c) **Transient retry:** 5xx + network/AbortError retried, bounded (MAX_RETRIES=3, exponential). TEST 3 (503→success) genuine.
- (d) **Timeout:** per-request `AbortController` (30s), cleared in `finally`. TEST 4 (AbortError→partial `[]`, no throw).
- (e) **Boundary-Zod:** every page + every person `safeParse`d; malformed → logged + clean break/skip, never crash. TEST 8 (malformed page→`[]`+logged) + person-Zod-skip test genuine.
- (f) **Partial-failure:** page error returns orgs-collected-so-far. TEST 7 (page-2 network fail → page-1 records returned) genuine.

### 4. SECRET (rule 2/6) — PASS
`process.env.AFFINITY_API_KEY`, env-only, never hard-coded. `git diff main...HEAD` grep for real-key patterns → NONE (test keys `test-api-key-do-not-use` / `my-test-api-key` only). `.env.example` carries name-only (`AFFINITY_API_KEY=` + comment, no value). **NOTE-1 resolved:** the interface's `process.env[providerKey]` is conceptual (`providerKey='AFFINITY'`, which is not a usable env name); the adapter self-containedly reads the concrete `AFFINITY_API_KEY` and documents it. Registry reads only `.providerKey` (map key) — nothing generic does `process.env['AFFINITY']`, so nothing breaks.

### 5. GRACEFUL-no-key — PASS
Absent `AFFINITY_API_KEY` → `fetchCompanies` returns `[]` + `console.warn`, NO throw. Registration is construction-only (no env read), so the app boots and the fixture-adapter search keeps working. TEST 6 verifies: returns `[]`, `fetch` never called, warning logged.

### 6. NOTE-2 — PASS
No `healthCheck` method, no shared `withRetry` util (correctly NOT built — robustness fully inlined in `fetchWithRetry`). Workspace-scoping correctly deferred to IngestionService (adapter workspace-agnostic).

### 7. No migration + green gates — PASS
Diff vs main: `.env.example` (+1) / `adapter.registry.ts` (+2) / `affinity.adapter.ts` (+412) / `.spec.ts` (+512) / SDK-Docs (+346) / stage transcripts. **No migration file** (schema SKIP confirmed). Sourcing suite re-run by this gate: **144/144 green** (affinity 13/13). Typecheck/lint/build greens per B-2 accepted.

---

## Deviations reviewed — all acceptable (deferred to C-2 live-verify, key-gated)
1. NOTE-1 env-name (`AFFINITY_API_KEY` vs conceptual `process.env[providerKey]`) — documented, self-contained, correct.
2. `contact.title` = undefined (Affinity v1 has no title field on person resource) — documented deferral.
3. `MAX_PERSONS_PER_ORG = 10` cap (rate-limit protection) — documented assumption, verify at live-hookup.
4. `Retry-After` not used (undocumented by Affinity) — uses `X-Ratelimit-Limit-User-Reset`, verify at live-hookup.

None of these are compliance/security/robustness defects. Live HTTP behaviour is legitimately gated on the founder's key at C-2 (adapter wired + ready; setting the Railway env var triggers the live fetch).

---

```yaml
head_signoff:
  verdict: APPROVED
  stage: B-6
  reviewers: {}
  failed_checks: []
  rationale: >
    All five binding obligations verified against actual code, not the summary. SDK doc is a
    genuine research-grounded reference (auth/pagination/rate-limits/error-shapes/normalize/registry),
    authored before the adapter. The adapter reuses the existing DataSourceAdapter interface and is
    registered in createDefaultRegistry — not a parallel pipeline. Robustness is fully inlined in
    fetchCompanies/fetchWithRetry (paginate-all-pages + 429-backoff + 5xx/network-retry + AbortController
    timeout + boundary-Zod-skip + partial-failure) and GENUINELY mock-tested: TEST 1 asserts orgFetchCount===3
    (page-1-only bug fails it), TEST 2 is a real 429→retry→success (not a tautology). API key is env-only,
    never committed (diff grep clean), .env.example name-only. Graceful no-key path returns [] + warns, no
    throw — app boots + fixture search works (TEST 6). No healthCheck/withRetry (correctly not built). No
    migration. Sourcing suite 144/144 green (13 affinity). Live HTTP verify correctly key-gated to C-2.
  next_action: PROCEED_TO_C1
```

# B-6 Review — Gate Verdict (Phase 1)

**Wave:** 31 — M9 Twenty CRM DataSourceAdapter (SDK doc + adapter + mocked tests)
**Branch:** wave-31-twenty-adapter
**Seed:** 1eb63a40
**Gate:** B-6 Review · **Stage-owner verdict:** head-builder
**Date:** 2026-07-08

## Verdict: APPROVED

All seven binding obligations verified against the actual shipped code — not inferred. Independent test run: **18/18 green**. Config schema diff vs `main`: **0 lines** (verified via `git diff`).

---

## Binding-obligation verification (each checked in real artifacts)

### 1. SDK-doc-FIRST — PASS
`command-center/dev/SDK-Docs/Twenty/twenty.md` is genuine and research-grounded, not a stub:
- Bearer auth (`Authorization: Bearer <TWENTY_API_KEY>`), documented from Twenty's open-source server source with file-path citations.
- Cursor pagination model: `starting_after` request param ↔ `pageInfo.endCursor` / `pageInfo.hasNextPage` response fields; explicit termination condition (`hasNextPage===false OR endCursor===null`).
- `GET /rest/companies` with `depth=2` for inline people relation-loading; `/rest/people` documented.
- Full normalize map (Twenty → NormalizedSourceRecord), runtime-literals table, error-shape table (400/401/403/404/429/500), 8 known gotchas.
- Registry row present (SDK-Docs/registry.md). Env-var naming ambiguity (canonical `TWENTY_API_URL` vs adapter's spec-chosen `TWENTY_BASE_URL`) is explicitly documented — this is the D-8 deviation, disclosed not hidden.

### 2. MIRROR wave-30 + reuse-interface — PASS
`twenty.adapter.ts` implements `DataSourceAdapter` (`providerKey='TWENTY'`, `fetchCompanies(connection)→NormalizedSourceRecord[]`) and is registered in `createDefaultRegistry()` (adapter.registry.ts:61, alongside FIXTURE + AFFINITY). Structural mirror of `affinity.adapter.ts` confirmed: same `fetchWithRetry` shape, `AbortController` timeout, 429/5xx backoff, inline pagination, boundary-Zod. Same `DataSourceAdapter` interface reused — no interface change.

### 3. BASE-URL from ENV + config UNTOUCHED (the crux) — PASS
- `TWENTY_API_KEY` and `TWENTY_BASE_URL` read from `process.env` inside `fetchCompanies` (lazy, NOT constructor) — never from `connection.config`. The `_connection` arg is interface-compliance only.
- **`packages/shared/src/data-source-admin.ts` is 0-diff vs `main`** (`git diff main...HEAD` returns 0 lines). The wave-16 secret-sink boundary (`dataSourceConnectionConfigSchema`) is untouched. DRIFT-1 (prose "connection.config" superseded by env-only) correctly applied.
- HTTPS guard present: `new URL(baseUrl)` in try/catch → malformed URL no-ops with `[]`; `parsedBaseUrl.protocol !== 'https:'` → non-HTTPS no-ops with `[]`. Both paths make **zero** HTTP calls. Verified by TEST 8 (http:// → no-op) + TEST 9 (unparseable → no-op), both asserting `mockFetch` not called.

### 4. ROBUSTNESS (internal, tested-genuine) — PASS
- **(a) Cursor-paginates ALL pages** — `while(true)` loop, `starting_after=<endCursor>`, terminates on `!hasNextPage || endCursor==null`. TEST 1 is genuine: 3 mocked pages, asserts `fetchCount===3`, all 6 companies returned, AND asserts page 2/3 carry the correct `starting_after=<cursor>` param. This is NOT a page-1-only fetch.
- **(b) 429 + 5xx backoff+retry (bounded)** — exponential from `BASE_BACKOFF_MS`, capped by `MAX_RETRIES=3`. TEST 2 (429→retry→success) + TEST 3 (503→retry→success) both assert retry occurred and warn logged.
- **(c) Timeout** — `AbortController` per request, `clearTimeout` in `finally`. TEST 4 (AbortError → returns `[]`, no throw).
- **(d) Boundary-Zod inbound** — each page `safeParse`d against `twentyCompaniesResponseSchema`; malformed → logged skip, no crash (TEST 10).
- Partial-failure semantics genuine: TEST 13 asserts page-2 failure returns page-1 records (not zero, not throw).

### 5. [P2-a FOLD] OUTPUT-validation — PASS (the real improvement)
The adapter `safeParse`s each normalized record against `normalizedSourceRecordSchema` (twenty.adapter.ts:478) and skips+warns on failure — mirroring the fixture.adapter.ts:85 pattern. **This closes the confirmed wave-30 Affinity gap** (`affinity.adapter.ts` has NO output-validation — grep-verified). TEST 11 is genuine: a company with `name:''` passes inbound boundary-Zod (`z.string()`) but FAILS `normalizedSourceRecordSchema` (`name: z.string().min(1)` — verified in sourcing.ts:24), so it is skipped while the valid sibling is kept; asserts `results.length===1` + skip-warn logged.

### 6. SECRET + graceful (rules 2/6) — PASS
- No committed key/URL value: `.env.example` lines 43–44 carry `TWENTY_API_KEY=` / `TWENTY_BASE_URL=` name-only (empty values, with guidance comments). Grep for any assigned Twenty secret value returns nothing.
- Graceful no-op if EITHER absent: key read lazily in `fetchCompanies` (not constructor), so app boots. TEST 6 (absent key → `[]` + warn, fetch never called) + TEST 7 (absent URL → `[]` + warn, fetch never called).

### 7. No migration / no config-schema change; greens — PASS
- No schema migration; config schema 0-diff (see #3).
- Independently re-ran the Twenty spec: **18 tests, 18 passed** (vitest v3.2.6). Consistent with the reported typecheck 4/4 · lint 0 · build 3/3 · api 1048 greens.
- **D-8 deviation (`TWENTY_BASE_URL` vs Twenty's canonical `TWENTY_API_URL`): NON-BLOCKING.** It is a documented, benign naming choice — the spec explicitly names the var `TWENTY_BASE_URL`, the SDK doc discloses the divergence and the reconciliation path (align on `TWENTY_API_URL` if the official SDK is later adopted), and the founder sets `TWENTY_BASE_URL` at deploy. No functional or security consequence.

---

## Anti-pattern sweep
- **Direct Provider SDK Coupling** — N/A: native fetch, no vendor SDK imported; adapter behind the `DataSourceAdapter` interface.
- **Unbounded external payload trust** — mitigated on BOTH boundaries (inbound `twentyCompaniesResponseSchema` + outbound `normalizedSourceRecordSchema`).
- **Hollow AI test suite** — not present: assertions verify state (record counts, IDs, normalized shape, warn/error log content, fetch-not-called, cursor params), not mere execution. Multi-page + backoff + partial-failure + output-skip all carry meaningful assertions.
- **Silent Audit Bypass** — N/A: read-only adapter, no deal-state/outreach/config mutation, no audit-log surface in scope.
- **SSRF / misconfig** — actively guarded (https-only, malformed-URL no-op).

## Load-bearing confirmation
SDK-doc-first + mirror-wave-30 + base-URL-from-env-https + config-untouched(0-diff) + robustness(cursor-pagination-all + 429/5xx-backoff + timeout + boundary-Zod)-tested + P2-a-output-validation-folded(closes wave-30 gap) + secret-env-never-committed + graceful-no-key/URL + no-regression. All present.

---

```yaml
head_signoff:
  verdict: APPROVED
  stage: B-6
  reviewers: {}
  failed_checks: []
  rationale: >
    All seven binding obligations verified in the actual shipped code, not inferred.
    SDK doc is research-grounded and authored first (Bearer auth, cursor pagination,
    depth=2, normalize map, registry row). The adapter mirrors affinity.adapter.ts's
    robustness (fetchWithRetry, AbortController timeout, 429/5xx backoff, inline
    all-page cursor pagination, inbound boundary-Zod) and is registered in
    createDefaultRegistry. TWENTY_API_KEY + TWENTY_BASE_URL are read lazily from
    process.env with an https/malformed-URL SSRF guard that no-ops to []; the
    dataSourceConnectionConfigSchema is 0-diff vs main (git-verified). The P2-a
    output-validation fold (safeParse vs normalizedSourceRecordSchema, skip+log) is
    genuine and closes the confirmed wave-30 Affinity gap — TEST 11 proves an
    empty-name record is skipped while the valid sibling survives. Secrets are
    env-only (.env.example name-only, no committed values); absent key OR URL boots
    gracefully. 18/18 tests re-run green independently. The D-8 TWENTY_BASE_URL vs
    canonical TWENTY_API_URL naming is a documented benign deviation, non-blocking.
    No migration, no config-schema change, no compliance/audit surface in scope.
  next_action: PROCEED_TO_C
```

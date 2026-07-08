# Wave 30 — V-1 jenny (spec-vs-built verification)

**Agent:** jenny (fresh-spawned, V-1)
**Wave topic:** M9 Affinity DataSourceAdapter — external-SDK integration
**Spec source:** seed 345dfbc6 (DB `tasks.description` — P-2 SCOPE + P-4 NOTE-1/2/3) + `process/waves/wave-30/stages/P-2-spec.md` + `P-3-plan.md`
**Method:** examined actual shipped code (adapter/registry/tests/.env.example/SDK-doc), the DB seed, the founder decision log, and the B-block gate verdict. Verified against spec intent, not against summaries.

---

## VERDICT: **APPROVE**

MATCHES 6/6 · DRIFTS 0/6. Every load-bearing obligation in the seed is present in the shipped code and consistent with all prior decisions (P-2 SCOPE, P-4 NOTE-1/2/3, the B-6 gate, the founder Affinity decision at product-decisions.md:486, and external-sdk-integration-rules). No drift.

---

## Check-by-check (each traced to shipped artifact)

### 1. SDK-doc-first — MATCH
`command-center/dev/SDK-Docs/Affinity/affinity.md` (`Last verified: 2026-07-08`) is a genuine research-grounded reference (auth = Basic key-as-password with the leading-colon encoding + the wrong-encoding gotcha; pagination page_token/null-termination; 429/rate-limit headers; error table; normalize map). Registry row present in `command-center/dev/SDK-Docs/registry.md` (`Affinity REST API | … | v1 (REST, no npm SDK) | 2026-07-08`). Adapter file header (`affinity.adapter.ts:4`) links back to the doc as its authoritative reference. No code-first-guess: the adapter's concrete literals (base URL, auth encoding at `:132`, `X-Ratelimit-Limit-User-Reset` at `:198`, page_token termination on `next_page_token == null` at `:361`) match the documented API surface. Consistent with external-sdk-integration-rules Steps 1-4.

### 2. REUSE-not-rebuild — MATCH
`AffinityDataSourceAdapter` (`affinity.adapter.ts:267`) `implements DataSourceAdapter` from `@dealflow/shared` — the single-method `fetchCompanies(connection): Promise<NormalizedSourceRecord[]>` + `readonly providerKey` contract (`packages/shared/src/sourcing.ts:59-68`), matching `fixture.adapter.ts`. Registered in `createDefaultRegistry()` alongside the fixture (`adapter.registry.ts:59`). Output conforms to the shared `normalizedSourceRecordSchema` (conditional `domain` spread at `:256` avoids emitting an undefined key against the `.strict()` schema). NOT a parallel pipeline; rides the existing pluggable-adapter + ingestion fan-out. Consistent with the P-2 SCOPE "behind the EXISTING interface" hard-boundary.

### 3. SECRET posture (rule 2/6) — MATCH
`process.env.AFFINITY_API_KEY`, env-only, read inside `fetchCompanies` (`:294`); never hard-coded. `.env.example:42` carries name-only (`AFFINITY_API_KEY=` + comment, no value). No real key value committed — the only `AFFINITY_API_KEY` string hits in the tree are documentation/comments and the (git-ignored-eligible) `dist/` build output mirroring the source comments; test keys are literal `test-*` placeholders. The key is **requested** from the founder, not fabricated (`process/session/updates/founder-request-affinity-api-key.md` — "generate in Affinity → Settings → API… store as platform secret, never committed"), consistent with rule-6's account-issued-credential exception and the founder decision's "founder-reserved still-open: the Affinity API key" (product-decisions.md:489).
- **NOTE-1 reconciliation — reasonable adaptation, not drift.** The interface's conceptual `process.env[providerKey]` would resolve `process.env['AFFINITY']` (undefined). The adapter self-containedly reads the concrete `AFFINITY_API_KEY` and documents the divergence in-file (`:30-34`, `:291-293`) + `.env.example` + SDK doc. The registry keys on `.providerKey` (map key, `adapter.registry.ts:35`) — nothing generic does `process.env['AFFINITY']`, so nothing silently breaks. This is exactly the NOTE-1 "reconcile the exact name so the interface resolves it" instruction executed. MATCH.

### 4. Robustness — MATCH (all inline, per P-4 disposition)
Inside `fetchCompanies`/`fetchWithRetry`:
- **Paginate all pages:** `while(true)` page_token loop, breaks only on `next_page_token == null` (`:311-365`).
- **429 backoff:** reads `X-Ratelimit-Limit-User-Reset` → ms, falls back to exponential, bounded by MAX_RETRIES (`:192-207`).
- **Transient retry:** 5xx (`:210`) + network/abort (`:173-186`), bounded, exponential.
- **Timeout:** per-request `AbortController` (30s), cleared in `finally` (`:160-189`).
- **Boundary Zod INLINE (NOTE-3):** every org page + every person `safeParse`d; malformed → logged clean break/skip, never crash (`:344-351`, `:394-401`).
- **Partial-failure:** page error returns orgs-collected-so-far (`:336-341`).
- **NOTE-2 respected:** NO `healthCheck` method, NO shared `withRetry` util — robustness fully inlined. The aspirational architecture-doc references were correctly NOT built. MATCH to the P-4 tightened disposition.

### 5. Key-gated live-verify — MATCH (buildable core shipped, dormant; no faking)
The wave shipped the buildable core with MOCKED-HTTP tests only (13 tests: pagination-all-3-pages asserting `orgFetchCount === 3` + 6 records `:160-163`; real 429→retry→success asserting `callCount >= 2` `:210`; 5xx-retry; timeout→partial; normalize; absent-key no-op; partial-failure; boundary-Zod; auth-header). NO live HTTP faked. Live hookup is deferred to the founder's key at C-2 (`founder-request-affinity-api-key.md` C-2 status: adapter "LIVE in production but DORMANT" @ a6ad02c; safe no-op without key; 3-step no-new-code activation). No drift into faking the live connection — the adapter genuinely no-ops (`:296-302`) so the app boots + fixture search keeps working. Consistent with rule 6 + the P-2 "LIVE-verify GATED on the founder key at C-2 (do NOT block the wave)".

### 6. Scope (mvp) — MATCH
Core companies/contacts read-only shipped (orgs + capped person hydration → normalize). Write-back / webhooks / incremental-sync / opportunities / multi-workspace-key all deferred (no such code present; title/enrichment explicitly deferred at `:26`, `:250`). Consistent with the seed hard-boundary "MVP core companies/contacts; opportunities/write-back/webhooks/incremental-sync/multi-workspace-key = LATER" and the founder Affinity decision (product-decisions.md:486-489). NO migration (schema SKIP honored), NO UI. **M9 _TBD metric flagged** — carried as founder-reserved-still-open (product-decisions.md:489 "M9's _TBD success metric for eventual M9 close"); not resolved this wave, correctly not blocking. The P2-a output-validation carried PRE-LIVE-HOOKUP is reasonable: boundary-Zod is fully built + mock-tested now; the only thing awaiting the live key is confirming the *real* Affinity payload shape against the schema — legitimately gated, not skipped.

---

## Conflicting prior decisions
None. Fully consistent with: P-2 SCOPE (DB seed), P-4 NOTE-1/2/3 (DB seed), B-6 gate-verdict APPROVED, the founder Affinity vendor decision (product-decisions.md:486), and external-sdk-integration-rules (SDK-doc-first + reuse + env-secret).

---

**Return line:** APPROVE — MATCHES 6/6, DRIFTS 0/6. No conflicting prior decision.

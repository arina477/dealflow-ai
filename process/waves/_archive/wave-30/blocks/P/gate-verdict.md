# Wave 30 — P-4 Gate Verdict (Phase 1)

**Block:** P (Product) | **Gate:** P-4 | **Reviewer:** head-product (fresh spawn) | **Phase:** 1 of 2 (head verdict → Phase 2 specialist cross-review)
**Wave:** M9 Affinity DataSourceAdapter — first REAL DataSourceAdapter (single-spec, external-SDK integration)
**claimed_task_ids:** [345dfbc6-1c96-4f6a-98aa-12ac7d61794b]
**milestone:** 099cee10 — M9 Integrations & insight (in_progress)
**bet:** "Integrated platform beats stitched-together tools for M&A" (live)

---

## VERDICT: APPROVED (Phase 1) → proceed to Phase 2 cross-review (karen + jenny)

Every stage-exit check is tickable from concrete artifacts. The spec is tightly scoped to the MVP-critical core, correctly reuses the existing interface rather than rebuilding, front-loads SDK research as a process gate, and puts all real-integration robustness (pagination/backoff/retry/timeout) inside the one method that has no cursor seam. No scope smuggle, no implementation leakage, no orphaned edge cases, no un-checkable secret handling.

---

## Judgment matrix (the 8 criteria)

| # | Criterion | Result | Evidence |
|---|---|---|---|
| 1 | **SDK-research-FIRST** (external-sdk process gate) | PASS | P-2 AC1 + P-3 Action 1 + seed DB "Acceptance sketch" bullet 1 all mandate authoring `command-center/dev/SDK-Docs/Affinity/affinity.md` (endpoints, API-key HTTP-Basic auth, page-token pagination, 429/rate-limit, error shapes, normalize map) + a registry.md row BEFORE any adapter code. Not code-first-guessing. Verified: no Affinity SDK doc exists yet (registry has only SuperTokens) — so this is a real, ordered prerequisite, not a rubber-stamp. |
| 2 | **REUSE-not-rebuild** | PASS | Verified `packages/shared/src/sourcing.ts:59` `DataSourceAdapter` + `:67` `fetchCompanies(connection): Promise<NormalizedSourceRecord[]>`, `adapter.registry.ts`, `fixture.adapter.ts` all pre-exist (M3). Spec implements the EXISTING single-method interface + registers in `adapter.registry` for `provider='affinity'`. No parallel pipeline; B-0 schema SKIP, B-1 reuses interface + company shape. |
| 3 | **ROBUSTNESS inside fetchCompanies** (the crux) | PASS | Interface exposes NO streaming/cursor seam (single call returns the full array), so ALL of: paginate every Affinity org page (page_token loop, not page 1), 429 backoff (Retry-After/exponential), transient 5xx/network retry (bounded), per-request timeout, partial-failure — MUST live inside `fetchCompanies`. P-2 AC2 + AC4 + P-3 Action 1.2 require it AND require MOCKED-HTTP unit tests for each: multi-page (all pages), 429→backoff→retry→success, 5xx-retry, timeout, partial-failure. Reuses shared `withRetry`. This closes the "fetch page 1 and hope" failure the problem-framer flagged as load-bearing. |
| 4 | **SECRET handling** (rules 2/6) | PASS | AFFINITY_API_KEY = account-issued credential → PLATFORM ENV SECRET via `process.env`, NEVER committed. Interface docstring (sourcing.ts:65) already mandates credential resolution from `process.env[providerKey]`, never DB — matches spec. Graceful no-op if absent: app boots + fixture-adapter search still works (P-2 AC3, P-3 Action 3). Binary + observable (app-boots-without-key, fixture-search-still-returns). |
| 5 | **Normalize in scope** | PASS | P-2 AC2 + P-3 Action 1.2: normalize Affinity organizations (+ associated persons) → the DealFlow company/contact shape (`NormalizedSourceRecord`: source_record_id/name/domain/contacts[]) the fixture adapter returns → feeds existing sourcing search. Mocked normalize-mapping test required. |
| 6 | **API-KEY GATE (live-verify)** | PASS / SOUND | Buildable core (adapter + mocked unit tests) ships autonomously; ONLY the live real-Affinity e2e is deferred to C-2 gated on the founder's key. If key absent by C-2 → deploy the adapter (registered, live-pull gated on key presence) + a founder-provides-key follow-up; do NOT block the wave. Handling is sound and rule-6-compliant (account-issued exception). DoD must NOT claim "live-verified" — that AC is key-gated (ceo-reviewer flag carried). |
| 7 | **LIGHT / scope discipline** | PASS | MVP = core companies/contacts read into sourcing search. Explicitly DEFERRED: write-back, webhooks, incremental-sync, opportunities/lists/custom-fields, multi-workspace-per-firm-key. Not over-built (no speculative infra; native fetch/undici, no heavy dep, no new runtime SDK) and not under-built (robust multi-page read, not a toy page-1 fetch). mvp-thinner: nothing to peel (sketch already MVP-tight); ceo-reviewer HOLD-SCOPE ~6-7/10 correctly sized. |
| 8 | **M9 _TBD metric + design_gap + security_scope** | FLAGGED / PASS | **M9 `## Success metric` = `_TBD by founder`** — genuine close-blocker (carried since wave-18; product-decisions 2026-07-08). Flagged by all three P-0 reviewers. This wave builds REAL M9 scope regardless, but **M9 cannot formally CLOSE until the founder sets the metric** — surface to founder digest alongside the API-key request. **design_gap = false → D-block SKIP** (backend adapter, reuses existing sourcing UI/search; no new screen). **security_scope = external-SDK integration + a NEW secret** → standard karen + jenny Phase-2 cross-review warranted (secret-handling: never-committed + graceful-no-key; provider-boundary Zod validation; workspace-scoping of the per-connection key). |

---

## Stage-exit checklist (P-4 Gate)

- [x] All ACs touching audit-log / compliance-gate / RBAC suppression are binary/observable/machine-readable — **N/A this wave** (no audit-log/compliance-gate/RBAC mutation; backend read-adapter behind existing interface). Secret-handling + graceful-no-key ACs are binary (app-boots-without-key, fixture-search-works, key-never-in-commit).
- [x] Cross-review responses logged + resolved — Phase 1 head verdict issued; **Phase 2 karen + jenny pending** (routing below). P-0 reviewers (problem-framer PROCEED, ceo-reviewer PROCEED/HOLD-SCOPE, mvp-thinner OK) logged + integrated.
- [x] Gate does NOT default to No-Go — every artifact is machine-readable + traceable end-to-end to the P-0 frame (seed 345dfbc6 → M9 → live bet). No missing artifact, no ambiguity forcing ESCALATE.

## Traceability (P-3 steps → P-0 bet)

Every P-3 deliverable maps back: SDK doc + adapter + registry wiring + env-secret + mocked tests → seed 345dfbc6 "one real DataSourceAdapter → normalize → feed sourcing search" → M9 Integrations → "integrated platform beats stitched-together tools" (live). No orphaned task.

## Convergence note (non-blocking — NOT drift)

The seed DB "Acceptance sketch" was authored generically (vendor = TBD spend-gate; env naming `DATA_SOURCE_<VENDOR>_API_KEY`; a full ≥2-source E2E as the M3-completing acceptance). P-2/P-3 correctly NARROWED it to the founder's resolved concrete choice (Affinity; existing-account = NO new spend gate; `AFFINITY_API_KEY`; live-verify key-gated at C-2). This is convergence of a generic seed onto a made decision, not scope drift — the founder decision (2026-07-08) resolves the seed's open vendor/spend gate. B-block should adopt the `AFFINITY_API_KEY` naming per P-2/P-3 as authoritative and note the seed's generic `DATA_SOURCE_*` naming is superseded.

---

## Phase-2 routing (specialist cross-review)

- **karen** (reality/robustness red-team) — assert the mocked-HTTP tests GENUINELY exercise multi-page pagination (all pages, not page 1), 429→backoff→retry, timeout, and partial-failure — not hollow/tautological assertions; and that graceful-no-key is a real no-op (app boots, fixture search returns), not a crash-swallow. Plus vendor failure-modes (timeout/malformed-JSON/rate-limit → circuit-breaker/dead-letter/degraded-not-silent).
- **jenny** (compliance/secret-handling audit) — assert AFFINITY_API_KEY is env-only (never committed, `.env.example` name-only, ConfigModule Zod startup validation), per-connection/workspace-scoped so Firm A's key/data never crosses to Firm B, and the provider boundary Zod-validates (`PROVIDER_CONTRACT_ERROR` → dead-letter, never swallowed).

---

```yaml
head_signoff:
  verdict: APPROVED
  stage: P-4
  phase: 1
  reviewers: { problem-framer: PROCEED, ceo-reviewer: PROCEED (HOLD-SCOPE), mvp-thinner: OK, karen: PENDING-phase2, jenny: PENDING-phase2 }
  failed_checks: []
  confirmed: [sdk-doc-first, reuse-existing-DataSourceAdapter-interface, robustness-pagination-all-pages+429-backoff+retry+timeout-tested, secret-env-never-committed, graceful-no-key-app-boots, normalize-affinity-to-dealflow-model, key-gated-live-verify-at-C-2, deferred-scope(writeback/webhooks/incremental/opportunities/multi-workspace-key), M9-_TBD-metric-flagged]
  design_gap_flag: false
  d_block: skip
  security_scope: external-sdk + new-secret → karen + jenny Phase-2 (secret-handling + workspace-scoping)
  flags: [M9-success-metric-_TBD-founder-close-blocker (surface to founder digest w/ API-key request), affinity-api-key-account-issued-request, DoD-must-not-claim-live-verified (key-gated)]
  rationale: >
    Single-spec external-SDK wave, tightly MVP-scoped. Reuse-not-rebuild verified against the
    live codebase (DataSourceAdapter/adapter.registry/fixture.adapter pre-exist). SDK-research-first
    is an ordered process gate, not a rubber-stamp. The real-integration crux — pagination(all pages)
    + 429-backoff + transient-retry + timeout — is correctly mandated INSIDE fetchCompanies (the
    interface has no cursor seam) AND mocked-HTTP-tested for each path. Secret is env-only/never-committed
    with a binary graceful-no-key boot AC. Live-verify is key-gated at C-2 without blocking the wave.
    No scope smuggle, no implementation leakage, no orphaned edge case. M9 close-metric _TBD is a
    founder poll (non-blocking to build). Phase-1 APPROVED; Phase-2 karen+jenny confirm test-honesty
    + secret/workspace-scoping.
  next_action: PROCEED_TO_P4_PHASE2  # karen + jenny cross-review; then B-block (D-skip)
```

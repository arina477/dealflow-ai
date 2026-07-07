# Wave 23 — T-9 Journey gate verdict (Phase 1)

**Block:** T (Test) | **Stage:** T-9 Journey (block-exit gate) | **Wave topic:** M9 seller-intent vertical (pure deterministic scorer + workspace-scoped `SellerIntentService` + shared-Zod contracts + RBAC `/seller-intent` API + `/insights` UI) — LIVE @6c22919
**wave_type:** [backend, ui, analytics] — hard invariants: PURE DETERMINISM + CROSS-FIRM WORKSPACE ISOLATION
**Gate agent:** head-tester (fresh spawn at T-9)
**Deployed tip:** 6c229197f4dfb12352e766e1754502a9f76b51e9 (CI run 28858565829, 5/5 jobs success; both Railway services SUCCESS @6c22919)

---

## Stage-entry gate

Prior C-block exits PASS (C-1 head-ci-cd APPROVED; C-2 head-ci-cd APPROVED). B-6 head-builder APPROVED (SI1–SI4 + all load-bearing invariants traced to shipped code). T-1..T-8 all `done` per review-artifacts.md. T-7 correctly skipped (perf — batch fetch, no N+1; O(n²) sort accepted-debt at firm scale). Entry accepted.

```json
{
  "agent": "head-tester",
  "stage": "T-9",
  "status": "gating",
  "block_state": {
    "test_gate_results": {
      "scorer_unit": "26/26 RAN+GREEN in CI",
      "cross_firm_e2e": "3/3 RAN+GREEN in CI (real service, dealflow_app)",
      "api": "950 pass",
      "web": "837 pass",
      "shared": "pass"
    },
    "journey_map_version": "wave-23 (+/insights seller-intent section, +/seller-intent API)",
    "coverage_report": "CI 28858565829 — 509+950+837 passed, 0 skipped, 0 failed",
    "escalation_log": []
  }
}
```

---

## Hard-invariant test map — verified NON-HOLLOW / NON-VACUOUS / NON-SKIPPED (source + CI-log evidence)

### 1. PURE DETERMINISM (the compliance-first hard boundary) — **PASS, genuinely non-hollow**
Verified against the actual shipped source `apps/api/src/modules/seller-intent/seller-intent.scorer.spec.ts` (26 tests), not a summary claim:
- **Real repeat/snapshot (not tautological):** group A asserts `JSON.stringify(out1) === JSON.stringify(out2)` for identical input (byte-identical output), plus a time-invariance snapshot that re-runs against a fixed `referenceInstant` and a mutated-referenceInstant case proving the instant is USED (so the score is not a function of wall-clock).
- **No-Date.now / no-Math.random grep-assert is fault-killing:** group B `readFileSync`s the real `seller-intent.scorer.ts`, strips block + line comments, then asserts the executable code `not.toMatch(/Date\.now\s*\(/)` and `/Math\.random\s*\(/`. Comment-stripping defeats the "documentation mentions Date.now" false-negative — a genuine regression guard, not coverage theater.
- **No LLM/SDK/network/randomness:** B-6 grep over scorer+service+repo returned NONE for `anthropic|openai|@ai-sdk|fetch|axios|http|bullmq|llm|claude` in executable code; scorer is pure (plain arrays + ISO strings in, object out; only `Date.parse` of caller-supplied fixed strings). For a compliance-first product this yields a reproducible, auditable score rather than a black-box LLM guess. CONFIRMED.
- **RAN in CI @6c22919:** C-1 test-job log grep `seller-intent.scorer.spec.ts (26 tests) ✓ 17ms` — RAN, not skipped.

### 2. CROSS-FIRM WORKSPACE ISOLATION (post-M8) — **PASS, REAL + fault-killing, RAN not skipped**
Verified against `apps/api/test/seller-intent-isolation.e2e-spec.ts` (3 tests):
- **REAL service, not re-implemented SQL:** SIT-1 instantiates `new SellerIntentService(new SellerIntentRepository(gucHandle))` and calls `service.getList()` inside `workspaceAls.run({db,workspaceId})` under `SET ROLE dealflow_app` (NOSUPERUSER NOBYPASSRLS → FORCE RLS). Asserts WS_A mandate IDs present AND WS_B mandate IDs fully absent, backed by an independent `wsBCountViaSql === 0` cross-check.
- **Fault-killing (SIT-3):** `getList()` called OUTSIDE `workspaceAls.run` → `getWorkspaceId()` returns null → `rejects.toThrow('fail-closed')`. Proves the fail-closed null-check is live, not decorative; if it were removed the leak would surface in SIT-1.
- **Positive control (SIT-2):** WS_A A1 `outreachEngagement > 0`, `score > 0`, `direction ∈ {heating,cooling,flat}` — guards against a vacuous "all-empty passes trivially" result.
- **RAN in CI @6c22919:** C-1 test-job log grep `seller-intent-isolation.e2e-spec.ts (3 tests) ✓ 2288ms` — RAN as dealflow_app, not skipped. CONFIRMED.

### 3. [SI1] NO tieBreak surfaced (PRODUCT #1) — **PASS, adequate**
Triple-asserted in scorer.spec group C: runtime output `'tieBreak' in out.breakdown === false` + `not.toHaveProperty('tieBreak')`; Zod schema `Object.keys(sellerIntentBreakdownSchema.shape) not.toContain('tieBreak')`; exact-key-set equality on the 5-field breakdown. UI grep of `/insights/page.tsx` for non-comment tie-break text is CLEAN (only assertion comments remain). The earlier B-3 visible-text slip was caught + removed at 525667f — the SI1 obligation demonstrably worked.

### 4. [SI2/SI3] window/epsilon boundary + empty/single-event — **PASS; NaN-seed recency fix confirmed in tested code**
Group D asserts direction at `delta === DIRECTION_EPSILON → 'flat'` (strict `>` boundary), `delta === EPSILON+1 → 'heating'`, cooling, plus a direct boundary assertion. Groups E/F assert empty-data → score 0 / all notApplied / direction flat / `not.toThrow()`, and single-event boundaries (1 activity / 1 enrolled event / 1 pending candidate) all no-crash with defined outputs. The B-6 timestamp fix that uncovered the real NaN-seed recency bug is IN the tested code — scorer.spec is 26/26 GREEN @6c22919 with concrete value assertions restored (caps 40/25/25, full-score 100), so the fix is regression-covered, not merely claimed.

### 5. RBAC + read-only — **PASS**
`rbac.ts` `/seller-intent → ['advisor','admin']`; controller refuses boot on `[]` drift; SessionGuard (401 anon) + RolesGuard (403 wrong role); spec asserts advisor+admin included, analyst+compliance excluded. Read-only: module write-op sweep found no `.insert/.update/.delete/AuditService.append` in executable code (analytics-class, no audit row required). Live-confirmed @6c22919: `/seller-intent` anon → **401** (mounted, fail-closed, not 404/500); `/compliance/audit-log/verify` anon → **401** (audit chain undisturbed by this read-only wave); `/insights` → 307.

---

## Playwright-binary / silently-skipped-E2E check — **NOT TRIGGERED**
This wave's T-5/T-6 are CI component tests (`web 837 passed`, RAN, 0 skipped) + live HTTP probes (C-2), NOT live-browser Playwright. There is no live-Playwright E2E result claiming green, therefore no zero-execution browser run to false-PASS. The executed-test count is provably non-zero (509+950+837, 0 skipped) on head_sha == deployed tip. No infra-readiness ESCALATE condition is present.

## Findings + deferral disposition
- **P2 O(n²) `.find()`-in-comparator sort (accepted-debt):** ACCEPTABLE — bounded n at firm scale, cosmetic, no correctness or isolation impact; carried as tech-debt.
- **Live authed per-mandate score DEFERRED (no prod advisor fixtures):** ACCEPTABLE — this is a live-fixture gap, NOT a test gap. The determinism + cross-firm proof is the CI `seller-intent-isolation.e2e` (3/3, real service) + `scorer.spec` (26/26), both RAN+GREEN @6c22919; the anon-401 mount probe confirms the endpoint is wired + fail-closed in prod. Consistent with the wave-18/19/21 CI-authoritative policy.
- **INFO SI4** (confirm wave-23 decomposer decision logged in product-decisions.md): downstream → N-3 (head-next). Not a T-9 blocker.

## Heuristic sweep — all clear
Coverage theater — NO (concrete value assertions). Tautological/over-mock — NO (real service under real RLS). Untested determinism invariant — NO (repeat + snapshot + comment-stripped source grep). Untested isolation invariant — NO (real-service positive+negative + fault-killing throw + SQL cross-check). Silently-skipped E2E — NO (CI grep shows both KEY suites RAN, 0 skipped, on the deployed SHA). Happy-path-only — NO (empty-data, cross-firm absence, fail-closed, RBAC 403/401 negatives present).

---

```yaml
head_signoff:
  verdict: APPROVED
  stage: T-9
  reviewers: {}   # Phase-1 gate walked from concrete artifacts (shipped test source + CI-log grep + live probes); every checklist item tickable without re-delegation
  failed_checks: []
  rationale: >
    Both hard invariants are proven against shipped test source and CI-log evidence, not
    inferred. PURE DETERMINISM is genuinely non-hollow: scorer.spec (26/26, RAN+GREEN @6c22919)
    asserts byte-identical output on repeat calls, a time-invariance snapshot that mutates
    referenceInstant to prove it is used, and a comment-stripped source-level grep that fault-kills
    any future Date.now()/Math.random() regression — a reproducible auditable score, no LLM/SDK/
    network/randomness. CROSS-FIRM ISOLATION is REAL and fault-killing: seller-intent-isolation.e2e
    (3/3, RAN+GREEN @6c22919, not skipped) drives the actual SellerIntentService via workspaceAls.run
    under SET ROLE dealflow_app FORCE RLS (WS_A present / WS_B absent + independent SQL cross-check),
    and SIT-3 asserts the no-ALS getList() throws fail-closed. SI1 holds — no tieBreak in scorer
    output, Zod schema, or UI (triple-asserted; the earlier visible-text slip was caught+removed at
    525667f). Empty/single-event and the epsilon boundary are value-asserted, and the B-6 NaN-seed
    recency fix is in the 26/26-green tested code. RBAC advisor+admin with 401/403 and a strictly
    read-only surface are confirmed in code and live (anon 401, audit chain intact). The P2 O(n^2)
    sort is accepted firm-scale debt, and the live authed per-mandate score is a fixture gap (not a
    test gap) honestly deferred with CI as authoritative per the wave-18/19/21 policy. No coverage
    theater, no tautology, no silently-skipped E2E (509+950+837 passed, 0 skipped, on the deployed
    tip). T-block exits APPROVED.
  next_action: PROCEED_TO_V-block
  downstream_obligations:
    - SI4 (INFO): head-next confirms the wave-23 seller-intent decomposer decision is appended to command-center/product/product-decisions.md before N-3 archive.
    - Tech-debt (P2 accepted): O(n^2) .find()-in-comparator sort in seller-intent.service.ts — revisit if firm-scale mandate counts grow.
```

# B-6 Review — Gate verdict (wave-19, M9 match-feedback calibration)

**Block:** B (Build) | **Wave:** 19 | **Topic:** M9 matching-feedback calibration
**Branch:** wave-19-match-calibration | **Attempt:** 1
**Gate:** B-6 Review | **Reviewer:** head-builder (fresh spawn)
**Seed spec:** 5568ad44 | **claimed_task_ids:** [5568ad44, 69387b56, e206a56a, 077974a2]

---

## Verdict: APPROVED

All P-4 B-block obligations and load-bearing invariants landed correctly on the
first attempt. The wave-18 hollow-test lesson was pre-empted, not repeated: the
G1 cross-firm e2e is a REAL-service, fault-killing test. Read-only, no LLM/ML,
no audit-write, RBAC-scoped, no gold-plating. Evidence traced to the shipped
code and green suites — not inferred from deliverable prose.

---

## Stage-exit checklist

| # | Check | Result | Evidence |
|---|---|---|---|
| B-2.1 | External SDKs via typed adapter | N/A — PASS | No SDK use. Scan of `apps/api/src/modules/match-feedback/` finds zero `anthropic`/`claude`/`openai`/`bullmq`/`resend` imports (only doc-comment negatives). |
| B-2.3 | Mutating endpoints audit-logged | N/A — PASS | Read-only surface: repository has ZERO `insert`/`update`/`delete`/`.execute()`; controller is GET-only. No state mutation → no audit obligation. |
| B-2.4 | LLM output Zod-validated | N/A — PASS | No LLM output. Read aggregation over `match_candidates`. |
| B-3.1 | Server-side authz + ownership | PASS | `/insights` page re-fetches `/auth/me` then `assertRole('/insights', me.role)`; API `MatchFeedbackController` guards `SessionGuard`+`RolesGuard` with `@Roles(advisor,admin)`, fail-closed at boot if `rolesForRoute` resolves `[]`. |
| B-3.2 | Client validation synced to shared schema | PASS | Page imports `calibrationSummarySchema` from `@dealflow/shared` and `.safeParse()`s the SSR response. Single source of truth. |
| B-3.3 | Server Components for data fetch | PASS | `InsightsPage` is an async Server Component; SSR fetch via `apiBase()`, `cache: 'no-store'`; no `'use client'`. |
| B-5.1 | No hollow high-coverage tests | PASS | Assertions carry semantic weight — MFC-4 fault-kills a getDb→raw regression; page test line 495 asserts null is NOT rendered as "0.0%". |
| B-5.3 | Integration tests hit real schema | PASS | `match-feedback-isolation.e2e-spec.ts` runs REAL service under `SET ROLE dealflow_app` GUC handle; skipped locally (no TEST_DATABASE_URL), runs in CI. |
| B-6.1 | No speculative generality | PASS | Plain procedural aggregation in JS; no abstract repo base-class, no generic factories. |
| B-6.2 | Features map to frozen spec | PASS | Bands + dimension-lifts + G2 null-vs-zero all trace to seed 5568ad44; no gold-plating (no charts-lib, real-time, or export). |
| B-6.5 | Author ≠ sole reviewer; cross-boundary specialist sign-off | PASS | P-4 obligations authored by jenny (G1/G2) + karen (per-row exclusion); head-builder gate independent of stage authors. |
| B-6.6 | Uniform structured error handling | PASS | Fetch failures → null → graceful error/empty UI states; no swallowed context in a load-bearing path (read-only surface). |

---

## Targeted verification (P-4 obligations + load-bearing invariants)

### 1. [G1 — wave-18 hollow-test lesson] REAL-service cross-firm e2e is fault-killing — PASS

`apps/api/test/match-feedback-isolation.e2e-spec.ts` `runServiceInAls()` (lines
527–564) checks out a PoolClient, `SET ROLE dealflow_app` (NOSUPERUSER, FORCE RLS),
`set_config('app.workspace_id', …)`, builds
`new MatchFeedbackService(new MatchFeedbackRepository(gucHandle))` **unmocked**,
and runs `getCalibration()` inside `workspaceAls.run({ db: gucHandle, workspaceId })`
so `getDb(this.db)` resolves to the GUC handle. This is the wave-18
analytics-isolation pattern copied exactly — NOT re-implemented SQL.

**MFC-4 is genuinely fault-killing** (lines 654–683): compares ALS-scoped
totalDecided vs a no-ALS singleton call (superuser BYPASSRLS → all-tenant) and
asserts `noAls.totalDecided !== als.totalDecided`. WS_B seeds 6 decided
candidates; a `getDb → raw this.db` regression collapses both totals to the same
all-tenant value → inequality fails → regression caught automatically. The
wave-18 rework is RIGHT here the first time.

### 2. Every-query-via-getDb — PASS

Both repository methods use `getDb(this.db)`: `getBandCalibration()` (line 105)
and `getDimensionLifts()` (line 164). No raw `this.db`/`pool.query` in any query
path. Service holds no Drizzle handle; isolation enforced structurally at the
repository layer.

### 3. [karen] Per-row exclusion for nullable score_breakdown — PASS

`getDimensionLifts()` skips rows where `score_breakdown` is null (line 187) and
skips per-dimension where the field is absent/non-number (line 192) — no
assume-non-null, no throw. Proven by MFC-5 (null-breakdown row counted in bands
but excluded from dimension lifts, service does not crash) and unit per-row-C1.

### 4. [G2] null-vs-zero honest — PASS

Contract: `acceptRate: z.number().min(0).max(1).nullable()`. Service:
`decidedCount === 0 ? null : accepted/decided` (repo lines 130, 233). UI
`fmtAcceptRate`: null → "n/a", 0 → "0.0%" (page lines 156–159, distinct colors).
Non-conflation asserted by page test line 495 ("does NOT render null acceptRate
as 0.0%") and unit B-2/per-row-C2. Decided-only denominators — `WHERE
disposition IN ('accepted','rejected')`; pending/flagged excluded.

### 5. Read-only / NO LLM + RBAC — PASS

Zero writes, no scorer-retrain, no Anthropic/Claude/BullMQ/Resend import. RBAC
`@Roles(advisor, admin)` sourced from shared `roleRoutes` (single source of
truth); RBAC matrix tests: advisor/admin 200, analyst/compliance 403, anon 401.
No gold-plating: no charts library, real-time, or export affordance.

### 6. General — PASS

Schema correctly skipped (read aggregation over shipped `match_candidates`).
Commit-per-spec: B-1 764c51c, B-2 ac303d6, B-3 3e66359. Typecheck 4/4 green
(turbo). API 812 passed / 69 skipped; web 767 passed. No hollow tests.

---

## Failed checks

None.

---

```yaml
head_signoff:
  verdict: APPROVED
  stage: B-6
  reviewers:
    G1_cross_firm_e2e: jenny (REAL-service via workspaceAls.run, MFC-4 fault-killing)
    G2_null_vs_zero: jenny (contract number|null + UI non-conflation)
    per_row_exclusion: karen (null/absent score_breakdown skipped, no throw)
  failed_checks: []
  rationale: >
    All P-4 B-block obligations and load-bearing invariants landed on attempt 1.
    The G1 cross-firm e2e invokes the REAL MatchFeedbackService (unmocked repo +
    service) inside workspaceAls.run under SET ROLE dealflow_app, and MFC-4 is
    genuinely fault-killing — a getDb→raw regression collapses ALS-scoped and
    no-ALS totals to the same all-tenant value and the inequality assertion fails.
    Both repository methods route through getDb(this.db); per-row exclusion for
    nullable score_breakdown is enforced and proven (MFC-5); G2 null-vs-zero is
    pinned in the shared Zod contract, honored by the service (decided-only
    denominators), and rendered honestly in the UI with an explicit non-conflation
    assertion. The surface is strictly read-only — no writes, no audit obligation,
    no LLM/ML — RBAC-scoped to advisor+admin, with no gold-plating. Typecheck 4/4,
    api 812 + web 767 unit green, commit-per-spec. The wave-18 hollow-test lesson
    held.
  next_action: PROCEED_TO_C-1
```

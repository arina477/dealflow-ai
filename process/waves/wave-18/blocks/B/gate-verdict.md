# Wave 18 — B-6 Review gate verdict (Phase 1, Attempt 1)

**Block:** B (Build) | **Wave topic:** M9 advisor-insights analytics | **Branch:** wave-18-advisor-insights
**Gate:** B-6 Review | **Verdict source:** head-builder (fresh spawn) | **Attempt:** 1

---

## VERDICT: REWORK

**Stage returned:** B-5 Verify (with a B-2-adjacent test authoring fix)
**Specialist to route:** `security-engineer` (own the fault-killing isolation e2e) with `code-quality-pragmatist` for the hollow-test rewrite scope.

The **production code is correct and would PASS on its own.** The block is rejected because the single **load-bearing verification** this wave exists to provide — proof that the shipped `AnalyticsRepository` cannot leak cross-firm — **does not exist.** The test that claims to provide it is coverage theater (VERIFY rule 3 / "Hollow AI Test Suite" anti-pattern), on the highest-risk invariant.

---

## Checklist walk (B-6 + carried B-2/B-5 checks)

### Production implementation — PASS (every check tickable from code)

- [x] **THE ISOLATION INVARIANT — every analytics query via getDb.** All 6 query invocations in `analytics.repository.ts` use `getDb(this.db)` (F1 L64, F2 L100, F3 L144 + L153, F4 L199). Grep for raw `this.db` outside `getDb(...)` returns only doc-comment lines (L13, L15), never a query. No `pool.query`, no `.query(`, no raw client anywhere in the module. Service (`analytics.service.ts`) holds no Drizzle handle; all DB access is structurally forced through the repository. **No cross-firm leak vector in the shipped code.**
- [x] **F2 honest — no vanity metric.** Fields are `gatePassRate` / `blockedRate` over `outreach.status` (compose/send_eligible/blocked). Grep for `responseRate` / "response rate" across repo/service/shared/UI: ABSENT from all production surfaces (only appears in negative-assertion contexts). Div-by-zero guarded: `total > 0 ? … : null` (repo L120-121; shared schema `.nullable()` L68-70).
- [x] **Empty-state + RBAC.** Empty workspace → all-zero counts, F2 rates null → `fmtRate(null)="n/a"` (page L105-108); no div-by-zero. `@Roles(...ANALYTICS_ROLES)` from `rolesForRoute('/analytics')` = `['admin','advisor']`; fail-closed boot-throw if RBAC drifts to `[]` (controller L40-45). `/insights` page re-fetches session, `assertRole('/insights')`, redirects non-permitted to `/` and anon to `/login` (page L202-206).
- [x] **No gold-plating.** No charts library, no real-time/websocket/polling, no export affordance, no new npm dep (page banner + B-3 deliverable; confirmed by grep). ceo-reviewer HOLD-SCOPE respected.
- [x] **Read-only.** Zero `insert`/`update`/`delete`/audit calls in the module. No audit row on a read (consistent with wave-16 admin-activity read pattern). Controller is GET-only.
- [x] **No schema change.** Confirmed skipped (on-the-fly aggregation); B-0 deliverable `schema_skipped: true`.
- [x] **UI labels honest.** "Compliance-gate pass rate" / "Blocked rate" rendered; error banner (`role="alert"`) on fetch/parse failure — no white screen. Zod `safeParse` on both `/auth/me` and `/analytics` responses.

### Verification — FAIL (load-bearing gap)

- [ ] **Cross-firm negative-read e2e genuinely fault-killing.** **FAILS.** `apps/api/test/analytics-isolation.e2e-spec.ts` never imports, instantiates, or calls `AnalyticsRepository` / `AnalyticsService` / `getSummary` (grep confirms: the name appears only in comments, never as an import or call). The test re-implements the aggregation SQL **inline** via `client.query('SELECT status, COUNT(*) … GROUP BY status')` under a `withWorkspace` (SET ROLE dealflow_app + GUC) client. It self-admits this at L579-583 ("DIRECT QUERY APPROACH: we run the same SQL that AnalyticsRepository uses"). Consequence: the suite's stated FAULT-KILLING property (L23-30, L105-112 — "if any query in AnalyticsRepository used a raw this.db handle … the count assertion fails") is **false**. If a developer replaced `getDb(this.db)` with raw `this.db` in the shipped repository tomorrow, **this e2e stays green.** What the test actually re-proves is that Postgres FORCE RLS filters by GUC — already established by wave-17 `workspace-isolation.e2e-spec.ts`. It provides **zero** coverage of the wave-18 production isolation code path.
- [ ] **No hollow tests (VERIFY rule 3 / T-4).** **FAILS** on the isolation e2e per above. Compounding: the unit suite `analytics.spec.ts` fully mocks `AnalyticsRepository` (L42-62), so `getDb(this.db)` is exercised by **no test at any layer** — not unit, not e2e. The empty-state, F2-math, and RBAC unit assertions are genuine and semantically weighted (they PASS on their own merits), but they test the service/guard, not the isolation invariant.
- [x] WORM-safe teardown (T-4 rule 1): audit_log_entries not deleted; scoped DELETE by tracked IDs — correct. Scoped-rows (T-4 rule 2): assertions use `toBeGreaterThanOrEqual(seeded)` + `WHERE workspace_id=B → toBe(0)` — correct *shape*, but guarding the wrong (inline) query.

---

## failed_checks
- `B-5 / cross-firm-negative-read-e2e-fault-killing`: the isolation e2e does not exercise `AnalyticsRepository`; it re-implements the SQL inline, so it cannot catch a raw off-GUC regression in the shipped repository (its own load-bearing claim is false).
- `B-5 / no-hollow-tests`: `getDb(this.db)` inside the production repository is covered by NO test (unit mocks the repo; e2e bypasses it). Highest-risk invariant of the wave is unverified.

## Rework instructions (specific, code-level)
Rewrite `analytics-isolation.e2e-spec.ts` so the negative-read assertions run **through the production `AnalyticsRepository`**, not inline SQL. Concretely: bind the ALS workspace-context store to a `getDb`-resolvable handle backed by a `SET ROLE dealflow_app` + GUC-set client (the same request-emulation the WorkspaceInterceptor performs), then call `repo.getMandateThroughput()` / `getOutreachGateOutcomes()` / `getAdvisorProductivity()` / `getMatchDisposition()` under WS_A and assert WS_B's seeded rows are excluded + positive control (A > 0). Prove the test is fault-killing by the required demonstration: temporarily swap `getDb(this.db)` → `this.db` in one repo method and confirm the e2e goes RED (then revert). If ALS cannot be driven from the e2e harness, that is the actual gap to solve — do NOT paper over it with inline SQL that reproduces the query.

## rationale
The shipped analytics code is clean: every aggregation is workspace-scoped via `getDb`, F2 is the honest gate-outcome metric (not the karen-rejected responseRate), div-by-zero is guarded, the surface is read-only with no audit write, RBAC is fail-closed, and there is no gold-plating — the production defect surface is empty. But B-block does not gate on code alone; it gates on *proof*. This wave's entire reason to exist is the isolation guarantee (a cross-firm leak here silently undoes the M8/wave-17 isolation layer — the exact "Silent Audit Bypass"-class catastrophe this role must never pass). The one test asserted to lock that guarantee never touches the production repository — it re-implements the SQL and re-proves Postgres RLS, a property already covered upstream. Approving would ship an unguarded load-bearing invariant behind a green check that reads as fault-killing but is not: the precise "Hollow AI Test Suite" failure mode. This is a bounded, mechanical test-authoring fix, not an architecture change; REWORK (not ESCALATE) — no checkbox was unevaluable.

## Non-blocking note (do not gate on this; fix opportunistically during rework)
Shared analytics Zod schemas use `.passthrough()` rather than `.strict()`. The B-6 stable checklist prefers `.strict()` boundaries; here the schemas validate a **server-authored read response** (not an inbound client payload), and B-1 cites rule-5 forward-compat as the deliberate local convention — so passthrough is defensible on a response contract and is NOT a rejectable defect. Flagging for L-2 lens only.

---

```yaml
head_signoff:
  verdict: REWORK
  stage: B-6
  attempt: 1
  reviewers:
    isolation_invariant_code: PASS   # every query via getDb; no raw off-GUC / pool query
    isolation_negative_read_e2e: FAIL # test bypasses AnalyticsRepository (inline SQL) — not fault-killing
    f2_honest_no_vanity_metric: PASS  # gatePassRate/blockedRate over outreach.status; responseRate absent; div-by-zero guarded
    empty_state_rbac: PASS            # zero/null safe; @Roles admin+advisor fail-closed; /insights redirect-gated
    no_gold_plating: PASS             # no charts-lib / realtime / export / new dep
    read_only_no_audit_on_read: PASS  # zero writes in module
    hollow_test_gate: FAIL            # getDb path covered by NO test (unit mocks repo; e2e bypasses it)
  failed_checks:
    - "B-5/cross-firm-negative-read-e2e-not-fault-killing (re-implements SQL inline; never calls AnalyticsRepository)"
    - "B-5/hollow-test getDb(this.db) production path unverified at every layer"
  rationale: >
    Shipped analytics code is correct and would pass on its own — every aggregation
    is workspace-scoped via getDb, F2 is the honest gate-outcome metric, div-by-zero
    guarded, read-only, RBAC fail-closed, no gold-plating. Rejected because the wave's
    load-bearing verification does not exist: the isolation e2e claims to be
    fault-killing against a raw off-GUC query in AnalyticsRepository but never invokes
    the repository — it re-implements the SQL inline and merely re-proves Postgres RLS
    (already covered by wave-17). A getDb→raw regression would ship green. Bounded
    test-authoring fix; not an escalation.
  next_action: REWORK_B-5
  specialist: security-engineer (+ code-quality-pragmatist for hollow-test scope)
```

---
---

# Wave 18 — B-6 Review gate verdict (Phase 1, Attempt 2 — post-rework)

**Block:** B (Build) | **Wave topic:** M9 advisor-insights analytics | **Branch:** wave-18-advisor-insights
**Gate:** B-6 Review | **Verdict source:** head-builder (fresh spawn) | **Attempt:** 2
**HEAD:** e47c7f8be55f5a053d1b785f566be77c323cc0fb
**Rework commit under review:** 7748c3e — `test(analytics): B-6 rework cross-firm e2e through real AnalyticsService (was hollow)`

---

## VERDICT: APPROVED

The single Attempt-1 REWORK finding — the hollow cross-firm isolation e2e — is **CLOSED**. All other checks (PASS in Attempt 1) remain valid; the rework is test-only, so no production behaviour changed.

---

## Rework verification — Attempt-1 finding closes on all three axes

### Axis 1 — e2e now invokes the REAL AnalyticsService via ALS (not inline SQL) — CLOSED

`runServiceInAls(workspaceId)` (spec L627-665):
1. Checks out a `PoolClient`; `SET ROLE dealflow_app` (NOSUPERUSER NOBYPASSRLS → FORCE RLS applies);
   `set_config('app.workspace_id', workspaceId, false)`.
2. `drizzle(client, {schema})` → `gucHandle` (same pattern as `WorkspaceInterceptor`).
3. `new AnalyticsService(new AnalyticsRepository(gucHandle))` — **real service + real repository, unmocked.**
4. `service.getSummary()` runs inside `workspaceAls.run({db: gucHandle, workspaceId}, ...)`.

Traced to production code: `getDb(fallback) = workspaceAls.getStore()?.db ?? fallback`
(`workspace-context.ts` L55-57). Inside `workspaceAls.run` the store IS set → `getDb(this.db)`
resolves to `gucHandle` — the exact request-time path the interceptor executes. The repository's
four families (F1 L64, F2 L100, F3 L144/L153, F4 L199) all use `getDb(this.db)`. AMP-1/2/3 primary
assertions now flow through the real service; the previous inline re-implementation is gone (retained
only as a secondary WS_B-count=0 confirmation). Finding closed.

### Axis 2 — AMP-4 is genuinely fault-killing (auto-catches getDb→raw) — CLOSED

CALL A (`runServiceInAls(WS_A)` → gucHandle, WS_A rows only) vs CALL B (`AnalyticsService` on
`drizzle(pool)` singleton with NO `workspaceAls.run` → `getStore()` undefined → `getDb` returns the
raw singleton = CI superuser pool, BYPASSRLS → all-tenant rows). WS_B seeded with mandates, so
`noAlsTotal > alsTotal`; assertion `expect(noAlsTotalMandates).not.toBe(alsTotalMandates)`.
If a dev regresses `getDb(this.db)` → `this.db` in the repo, CALL A also hits the singleton → both
totals equalise → assertion FAILS. The inequality is over F1 `total = totalDraft + totalActive`
(`analytics.repository.ts` L79), the exact count the repo emits. Reasoning sound; the assertion is
load-bearing and catches the regression automatically — no manual red-then-revert required.

### Axis 3 — nothing else regressed — CONFIRMED

- Repo uses `getDb(this.db)` on every query (no raw off-GUC) — re-confirmed at HEAD.
- F2 honest: `gatePassRate` / `blockedRate` (compliance-gate lifecycle), NOT `responseRate`.
- Read-only: zero INSERT/UPDATE/DELETE → no audit-log obligation on a pure-read surface; invariant not bypassed.
- Rework is **test-only** (commit 7748c3e touches only `analytics-isolation.e2e-spec.ts`;
  service/repo/`workspace-context.ts` unchanged).
- Suite `describe.skipIf(shouldSkip)` on `TEST_DATABASE_URL`: skips locally (no local PG), runs
  real-DB in CI (`.github/workflows/ci.yml` provisions `TEST_DATABASE_URL`) — the C-1 authoritative run.
- typecheck 4/4; 790 api + 737 web + shared unit green (per B-5 deliverable) — unaffected by a test-only change.

All checks tickable from concrete artifacts. No ambiguity requiring ESCALATE.

---

```yaml
head_signoff:
  verdict: APPROVED
  stage: B-6
  attempt: 2
  reviewers:
    isolation_negative_read_e2e: PASS  # now runs real AnalyticsService under workspaceAls.run; getDb→gucHandle
    amp4_fault_killing: PASS           # ALS-scoped vs no-ALS singleton totals must differ; getDb→raw collapses them → RED
    isolation_invariant_code: PASS     # every query via getDb; no raw off-GUC (unchanged)
    f2_honest_no_vanity_metric: PASS   # gatePassRate/blockedRate; responseRate absent
    read_only_no_audit_on_read: PASS   # zero writes in module
    no_gold_plating: PASS              # no charts-lib / realtime / export / new dep
    rework_test_only: PASS             # 7748c3e touches only the e2e spec; production code untouched
  failed_checks: []
  rationale: >
    Attempt-1 REWORK finding CLOSED. The cross-firm isolation e2e no longer re-implements
    aggregation SQL inline — runServiceInAls instantiates the real AnalyticsService +
    AnalyticsRepository (unmocked) and runs getSummary() inside workspaceAls.run({db: gucHandle}),
    so getDb(this.db) resolves to the dealflow_app GUC-bound handle exactly as the interceptor does
    in production; AMP-1/2/3 primary assertions flow through the real service. AMP-4 is genuinely
    fault-killing: ALS-scoped (WS_A only) vs no-ALS singleton (all-tenant) totals must differ with
    WS_B seeded, and a getDb→raw regression collapses both to the singleton, equalises the totals,
    and fails the assertion automatically. Everything else still PASSES: repo uses getDb on every
    query, F2 reports honest gate-outcome rates, surface is read-only (no audit obligation), the
    rework is test-only, and the suite runs real-DB in CI (C-1 authoritative). Ship it.
  next_action: PROCEED_TO_PHASE_2_REVIEW
```

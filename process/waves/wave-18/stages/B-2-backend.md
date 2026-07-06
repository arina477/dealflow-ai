# Wave-18 B-2 — Backend: AnalyticsService + API

**Tasks:** a5ba8068 (aggregation service) / 9e05828b (API)
**Branch:** wave-18-advisor-insights

## Files authored

- `apps/api/src/modules/analytics/analytics.repository.ts`
- `apps/api/src/modules/analytics/analytics.service.ts`
- `apps/api/src/modules/analytics/analytics.controller.ts`
- `apps/api/src/modules/analytics/analytics.module.ts`
- `apps/api/src/modules/analytics/analytics.spec.ts`
- `apps/api/test/analytics-isolation.e2e-spec.ts`
- `apps/api/src/app.module.ts` — `AnalyticsModule` registered

## getDb-every-query confirmation (load-bearing invariant)

Every query in `AnalyticsRepository` uses `getDb(this.db)` — confirmed:

- `getMandateThroughput()` → `getDb(this.db).select(...).from(mandates).groupBy(...)`
- `getOutreachGateOutcomes()` → `getDb(this.db).select(...).from(outreach).groupBy(...)`
- `getAdvisorProductivity()` → two `getDb(this.db)` calls (mandates + pipeline sub-queries)
- `getMatchDisposition()` → `getDb(this.db).select(...).from(matchCandidates).groupBy(...)`

No raw `this.db` or `pool.query()` is used in any query path. The `this.db` field is injected as the fallback only for non-request bootstrap paths (per the `getDb` contract in `workspace-context.ts`).

## Cross-firm negative-read e2e (fault-killing, T-8)

**File:** `apps/api/test/analytics-isolation.e2e-spec.ts`

**Pattern:** wave-17 `workspace-isolation.e2e-spec.ts` — `SET ROLE dealflow_app` on a dedicated client from the superuser pool, then `SELECT set_config('app.workspace_id', $wsId, false)`.

**Test structure:**
- Seed workspace A: 3 draft + 2 active mandates, 1 send_eligible + 2 blocked outreach, 1 pipeline row, 4 match_candidates.
- Seed workspace B: 3 draft mandates, 1 send_eligible outreach, 1 pipeline row.
- Run all 4 analytics queries under workspace-A's GUC (dealflow_app + FORCE RLS).
- Assert workspace-A counts are present; workspace-B rows return 0 under WS_A GUC.

**Tests:**
- `AMP-1 (F1)`: WS_B mandate counts = 0 under WS_A GUC.
- `AMP-1 (F2)`: WS_B outreach counts = 0 under WS_A GUC.
- `AMP-1 (F3)`: WS_B pipeline rows absent under WS_A GUC; WS_B user not in results.
- `AMP-1 (F4)`: WS_B match_candidates = 0 under WS_A GUC.
- `AMP-2`: WS_A mandates > 0 (positive control).
- `AMP-3`: F2 gate-outcome rates are numerically correct.

**Fault-killing logic:** if any `AnalyticsRepository` query used `this.db` (no GUC), it would return WS_A + WS_B rows. The assertion `COUNT WHERE workspace_id = WS_B_ID = 0` would fail, catching the leak immediately.

**CI note:** requires `TEST_DATABASE_URL` pointing to a real Postgres instance. Skips cleanly when unset (same pattern as all other e2e suites). Runs over `dealflow_app` role (non-superuser, FORCE RLS enforced).

**WORM-safe teardown (T-4 rule 1):** No DELETE on `audit_log_entries`. All other seeded rows deleted in FK-safe order (pipeline → outreach → match_candidates → mandates → etc.) in `afterAll`.

**T-4 rule 2 (shared-DB scoped):** Assertions use `>= seeded count` for presence (not `= total table count`) to be safe on a shared DB with prior test runs. Negative assertions use `COUNT WHERE workspace_id = WS_B_ID` which is always exactly 0 under WS_A's GUC.

## Empty-state + RBAC unit tests

**File:** `apps/api/src/modules/analytics/analytics.spec.ts` (15 tests)

- A-1 through A-4: empty-state safety for all 4 families (0/null/[]).
- B-1 through B-3: F2 gate-outcome math (`gatePassRate` / `blockedRate`); naming contract (`responseRate` absent).
- D-1 through D-2: aggregation plumbing (`getSummary` delegates to all 4 repo methods).
- RBAC matrix: `advisor` → 200, `admin` → 200, `analyst` → 403, `compliance` → 403, anon → 401.
- Source verification: `@Roles()` sourced from `rolesForRoute('/analytics')` = `['admin', 'advisor']`.

## Typecheck

`pnpm -w typecheck` passes clean (4 tasks successful; `exactOptionalPropertyTypes: true`).

## Unit test results

`39 passed | 11 skipped (50 files)` — 790 tests pass; 61 skip (no TEST_DATABASE_URL).

## Deviations

None. Implementation exactly follows P-3 plan:
- On-the-fly aggregation (no materialized cache).
- Single summary endpoint GET /analytics (not per-family endpoints).
- advisor + admin RBAC (no analyst; compliance excluded).
- Per-advisor productivity uses application-side merge of 2 sub-queries (Drizzle lacks native FULL OUTER JOIN; two queries + Map merge is equivalent and simpler).

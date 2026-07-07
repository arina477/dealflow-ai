# Wave 19 — B-2 Backend (MatchFeedbackService + API)

**Tasks:** 5568ad44 (seed/service) + e206a56a (API) | **Commit:** ac303d6 | **Status:** done

## Files delivered

### Production code
- `apps/api/src/modules/match-feedback/match-feedback.repository.ts`
- `apps/api/src/modules/match-feedback/match-feedback.service.ts`
- `apps/api/src/modules/match-feedback/match-feedback.controller.ts`
- `apps/api/src/modules/match-feedback/match-feedback.module.ts`
- `apps/api/src/app.module.ts` — MatchFeedbackModule registered

### Tests
- `apps/api/src/modules/match-feedback/match-feedback.spec.ts` — 22 unit tests
- `apps/api/test/match-feedback-isolation.e2e-spec.ts` — G1 REAL-service cross-firm e2e (7 tests, real-DB skipped when TEST_DATABASE_URL unset)

## getDb on EVERY query (no raw off-GUC)

`MatchFeedbackRepository` contains two query methods:
1. `getBandCalibration()` — uses `getDb(this.db)` exclusively
2. `getDimensionLifts()` — uses `getDb(this.db)` exclusively

`this.db` (the injected singleton) is NEVER used directly in a query method. The pattern mirrors `AnalyticsRepository` exactly (wave-18). The module-level comment documents the isolation invariant.

## G1 — cross-firm e2e (REAL-service, fault-killing)

`apps/api/test/match-feedback-isolation.e2e-spec.ts` invokes the **REAL** `MatchFeedbackService` via `workspaceAls.run` — NOT re-implemented SQL:

```
runServiceInAls(workspaceId):
  1. pool.connect() → PoolClient
  2. SET ROLE dealflow_app (NOSUPERUSER NOBYPASSRLS — FORCE RLS applies)
  3. set_config('app.workspace_id', workspaceId, false)
  4. drizzle(client, { schema }) → gucHandle
  5. new MatchFeedbackRepository(gucHandle) + new MatchFeedbackService(repo)
  6. workspaceAls.run({ db: gucHandle, workspaceId }, () => service.getCalibration())
     → getDb(this.db) resolves to gucHandle inside callback
  7. RESET ROLE + RESET GUC + release
```

Test assertions:
- **MFC-1**: WS_A calibration `totalDecided` ≥ WS_A's seeded decided count; raw-SQL confirms WS_B decided rows = 0 under WS_A GUC
- **MFC-2**: Positive control — `totalDecided > 0`
- **MFC-3**: Band 51-75 `acceptRate` is a valid number; dimension lifts have 3 entries
- **MFC-4 (FAULT-KILLING)**: no-ALS call (singleton, superuser BYPASSRLS) yields `totalDecided` ≠ ALS-scoped call. If `getDb` is bypassed → both calls return all-tenant rows → totals collapse to same value → `expect(noAlsTotalDecided).not.toBe(alsTotalDecided)` fails → regression caught
- **MFC-5 (per-row exclusion)**: null-breakdown candidate confirmed NULL in DB; dimension lifts succeed without crash; acceptRate within valid bounds

## G2 — null-vs-zero convention

Applied in `MatchFeedbackRepository`:
```typescript
const acceptRate: number | null =
  decidedCount === 0 ? null : acceptedCount / decidedCount;
```
Both `getBandCalibration()` and `getDimensionLifts()` apply this guard. Unit tests B-1 and B-2 in `match-feedback.spec.ts` cover both paths.

## Karen watch-item — per-row exclusion for nullable score_breakdown

`getDimensionLifts()` fetches `scoreBreakdown` as the raw Drizzle nullable type. For each row:
```typescript
if (breakdown == null) continue;  // per-row exclusion
for (const dim of DIMENSIONS) {
  const rawVal = (breakdown as Record<string, unknown>)[dim];
  if (rawVal == null || typeof rawVal !== 'number') continue;  // per-row exclusion per dimension
  ...
}
```
No assume-non-null. No JSONB operator that could throw on null. Unit tests `per-row-C1` and `per-row-C2` cover the null-breakdown and decided-but-0-accepted cases. MFC-5 covers the real-DB path.

## RBAC

`MatchFeedbackController.getCalibration()`:
- `@Roles(...MATCH_FEEDBACK_ROLES)` where `MATCH_FEEDBACK_ROLES = rolesForRoute('/match-feedback')` = `['advisor', 'admin']`
- Fail-closed boot guard: throws if `rolesForRoute` returns `[]`
- Unit tests: advisor → ALLOW; admin → ALLOW; analyst → 403; compliance → 403; anon → 401

## Empty-state safety

`getCalibration()` with 0 decided candidates returns:
- `totalDecided: 0`
- `bands`: 4 entries, all `acceptRate: null` (G2 null path)
- `dimensionLifts`: 3 entries, all cohort `acceptRate: null`

Unit tests A-1 through A-4 cover this.

## Read-only

Zero writes. No scorer-retrain. No LLM/ML import anywhere in the module. No audit row appended.

## Test results

`pnpm --filter @dealflow/api test -- --run`:
- `match-feedback.spec.ts`: 22 tests PASS
- `match-feedback-isolation.e2e-spec.ts`: 7 tests SKIPPED (no TEST_DATABASE_URL — runs in CI)
- All 812 unit tests: PASS (0 failures)

## Typecheck

`pnpm -w typecheck`: CLEAN (4/4 packages).

## Deviations

None. All P-4 B-BLOCK OBLIGATIONS honored:
- [karen] per-row exclusion for nullable score_breakdown: DONE (getDimensionLifts per-row skip)
- [jenny G1] REAL-service cross-firm e2e via workspaceAls.run (not hollow SQL): DONE (MFC-1 through MFC-4 + fault-killing MFC-4)
- [jenny G2] null-vs-zero pinned at B-1 contract + enforced in B-2 repository: DONE
- workspace-scoped-getDb-calibration (no raw off-GUC): DONE (both repository methods use getDb exclusively)
- cross-firm-negative-read REAL (T-8, not hollow): DONE
- read-only-no-scorer-retrain (NO LLM/ML): DONE
- RBAC-scoped: DONE
- no-gold-plating: DONE (no charts-lib, no exports, no real-time, no ML)

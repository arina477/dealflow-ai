# Wave 18 — B-2 Backend
AnalyticsService + analytics.repository (4 workspace-scoped families via getDb on EVERY query — no raw off-GUC/pool) + AnalyticsController GET /analytics (@Roles advisor+admin, 403/401) + module registered. Commit ecf8d32.
- The cross-firm negative-read e2e (analytics-isolation.e2e-spec): 2 workspaces, as dealflow_app (SET ROLE + set_config app.workspace_id), WS_A analytics EXCLUDE WS_B (count WHERE workspace_id=B → 0 under A's GUC — fault-killing), positive control (A>0), F2 rate math, WORM-safe teardown, T-4 rule 2 scoped.
- 15/15 unit (empty-state div-by-zero-safe, RBAC advisor/admin allow + analyst/compliance 403 + anon 401, F2 gate-math, responseRate absent).
- Deviation: F3 per-advisor uses 2 sub-queries merged in app code (Drizzle lacks FULL OUTER JOIN) — equivalent.
```yaml
skipped: false
files_implemented: [apps/api/src/modules/analytics/* + analytics.repository, apps/api/test/analytics-isolation.e2e-spec.ts, analytics.spec.ts]
getDb_every_query: true
cross_firm_negative_read_test: analytics-isolation.e2e-spec (fault-killing, as dealflow_app)
deviations: [F3-two-subqueries-merged-equivalent]
```

## B-6 rework resolution

head-builder finding: `analytics-isolation.e2e-spec.ts` was hollow — it re-implemented aggregation SQL inline via `client.query()` instead of invoking the real `AnalyticsService`/`AnalyticsRepository`. This proved only Postgres RLS (already covered by wave-17) and would stay GREEN if `getDb(this.db)` were replaced with raw `this.db` in the repository.

Fix (commit 7748c3e, branch wave-18-advisor-insights):

- Introduced `runServiceInAls(workspaceId)` helper inside the suite: checks out a `PoolClient`, `SET ROLE dealflow_app`, `SELECT set_config('app.workspace_id', wsId, false)`, wraps in `drizzle(client, { schema })` → `gucHandle`, instantiates the real `AnalyticsRepository(gucHandle)` and `AnalyticsService(repo)` (no mocks), then calls `getSummary()` inside `workspaceAls.run({ db: gucHandle, workspaceId }, ...)` — identical to what `WorkspaceInterceptor` does per request.
- AMP-1 (F1/F2/F3/F4): primary assertion now calls `runServiceInAls(WS_A_ID)` and asserts on the real service's output. Raw-SQL `WHERE workspace_id = WS_B_ID → 0` kept as secondary confirmation.
- AMP-2: positive control — real service under WS_A GUC returns non-zero counts.
- AMP-3: F2 gate-outcome rates verified from real service output.
- AMP-4 (fault-killing — permanent in-test assertion): calls `getSummary()` outside `workspaceAls.run` (no ALS store → `getDb` returns singleton, superuser pool, BYPASSRLS, all-tenant rows). Asserts `noAlsTotal !== alsTotal`. If `getDb` is bypassed in the scoped path (raw `this.db` used), both calls return the same all-tenant total → assertion fails → regression caught automatically. No manual red-then-revert needed.
- Typecheck clean (`pnpm -w typecheck` 4/4 tasks passed). 790 unit tests passed, e2e correctly skipped (no `TEST_DATABASE_URL` in unit context).


# Wave 18 — V-1 Karen (deployed-state reality check)

**Reviewer:** Karen (fresh spawn, V-1 Verify)
**Method:** Verify the wave's LOAD-BEARING CLAIMS are TRUE in the DEPLOYED state — NOT the diff.
**Deployed:** LIVE @ `5c86cf5412dc21939ca3d3158d0203a08ce4d51a` (main green, CI run 28832010151).
  api `https://dealflow-api-production-66d4.up.railway.app` · web `…-a4f7`.
**Read:** P-3 plan, C-1/C-2 deliverables, B-6 + T-9 gate-verdicts.
**Working-tree provenance:** `git diff 5c86cf5 -- apps/api/src/modules/analytics apps/web/app/(app)/insights packages/shared/src/analytics.ts` = **EMPTY** → the source I read IS the deployed code (HEAD 3ddee46 is a `[skip ci]` doc-only commit on top of 5c86cf5; the analytics/web/shared tree is byte-identical to the deployed tip AND to the B-6-approved 277487e).

---

## VERDICT: APPROVE

All 7 load-bearing claims verified TRUE against the deployed state by direct artifact + live-endpoint inspection. 0 blocking findings. 1 info note (non-blocking).

---

## Claim-by-claim (each cites the claim + evidence)

### 1. Deploy serves 5c86cf5; app still dealflow_app; no stale Ghost-Green — TRUE
- **Claim (C-2):** `/health` → 200 `{status,db,version==5c86cf5}`; GIT_SHA corrected at C-2 so version reflects reality; `db:ok` ⇒ app runs as `dealflow_app` ([RLS-GUARD] up).
- **Evidence (LIVE):** `GET /health` → `200 {"status":"ok","db":"ok","version":"5c86cf5412dc21939ca3d3158d0203a08ce4d51a"}`. version == deployed tip (not the stale 591b3f8b the brief warned of), so the GIT_SHA `variableUpsert` fix at C-2 (`C-2-deploy-and-verify.md` L27-33) is confirmed effective, not merely claimed. `db:ok` ⇒ the non-superuser `dealflow_app` connection is live. No Health-Check-Mirage: version string == the exact deployed hash.

### 2. Files/functions @5c86cf5 — TRUE
- **Claim (P-3 / B-6):** `apps/api/src/modules/analytics/*` (AnalyticsService + repository using `getDb` on EVERY query, NO raw `this.db`/`pool.query` in aggregation methods) + controller (`@Roles` advisor+admin); `packages/shared/src/analytics.ts` (F2 `gatePassRate`/`blockedRate`, NO `responseRate`); `apps/web/app/(app)/insights/page.tsx`.
- **Evidence:**
  - `analytics.repository.ts` L64/L100/L144/L153/L199 — all 5 query methods (F1/F2/F3×2/F4) call `getDb(this.db)`. Grep for `this.db`/`pool.query`/`.query(` returns ONLY doc-comment lines (L7,13,15,57,137,193) — never a raw query. No `pool.query`, no `.query(`, no raw client in any query method.
  - `analytics.service.ts` L37-53 (`getSummary`) — no Drizzle handle; delegates to the repository via `Promise.all`; read-only.
  - `analytics.controller.ts` L64-66 — `@Get() @UseGuards(SessionGuard, RolesGuard) @Roles(...ANALYTICS_ROLES)`.
  - `packages/shared/src/analytics.ts` L61-74 — `outreachGateOutcomesSchema` fields `gatePassRate`/`blockedRate` (`.nullable()` div-by-zero-safe); no `responseRate` field.
  - `apps/web/app/(app)/insights/page.tsx` — present (Read-confirmed; L14 label "Compliance-gate pass rate / Blocked rate — NOT response rate").
  - All at the deployed tip (empty diff vs 5c86cf5).

### 3. Routes live (mounted, not 404) — TRUE
- **Claim (C-2):** anon `/analytics` → 401 (mounted+registered); web `/insights` → 307/200 (NOT 404).
- **Evidence (LIVE):** anon `GET /analytics` → **401**. Contrast control `GET /zzz-nonexistent` → **404** — proves the 401 is a mounted-route SessionGuard rejection, not a route-not-found. web `GET /insights` → **307** (login redirect; page registered on the new build).

### 4. Isolation e2e is REAL + ran (authoritative cross-firm proof) — TRUE
- **Claim (B-6 Attempt-2 / T-9 / C-1):** `analytics-isolation.e2e-spec` invokes the REAL `AnalyticsService` via `workspaceAls.run` (not re-implemented SQL) + AMP-4 fault-killing; C-1 says it RAN 7/7 (not skipped) as `dealflow_app`.
- **Evidence:**
  - The suite **dynamically imports the production classes** — L668-670 `await import('../src/db/workspace-context')` (`workspaceAls`), `'../src/modules/analytics/analytics.repository'` (`AnalyticsRepository`), `'../src/modules/analytics/analytics.service'` (`AnalyticsService`); re-imported at L898-899 for AMP-4. These are the shipped modules, NOT local re-implementations.
  - `runServiceInAls()` L683-693: `new AnalyticsRepository(gucHandle)` → `new AnalyticsService(repo)` → `service.getSummary()` inside `workspaceAls.run({ db: gucHandle, workspaceId }, …)` → production `getDb(this.db)` resolves to the `dealflow_app` GUC-bound handle exactly as WorkspaceInterceptor does. Primary assertions AMP-1/2/3 flow through the real service (L710-828).
  - **AMP-4 genuinely fault-killing** (L885-921): CALL A (`runServiceInAls(WS_A)`, WS_A-only) vs CALL B (`serviceNoAls.getSummary()` on the raw singleton, no `workspaceAls.run` → all-tenant rows). With WS_B seeded, `expect(noAlsTotalMandates).not.toBe(alsTotalMandates)` (L921) — a `getDb(this.db)→this.db` regression collapses CALL A onto the singleton, equalises totals, fails automatically. This is the exact hollow-test trap head-builder REWORKED at B-6 Attempt-1 and CLOSED at Attempt-2.
  - **RAN, not skipped:** C-1 run 28832010151 @5c86cf5 logged `✓ test/analytics-isolation.e2e-spec.ts (7 tests) 2101ms` — NOT `(7 tests | 7 skipped)` (`C-1-pr-ci-merge.md` L29,L49-56). headSha == origin/main; Turbo remote-cache disabled + cache-miss executed (no Ghost-Green). `describe.skipIf(shouldSkip)` on `TEST_DATABASE_URL` (L490); CI provisions it, so it ran real-DB as `dealflow_app`.

### 5. F2 honest (no vanity metric) — TRUE
- **Claim (P-3 / karen P-4 correction):** `responseRate`/"response rate" ABSENT from analytics code + UI (only in prohibiting comments / negative-test assertions); the metric is gate-outcomes over `outreach.status`.
- **Evidence:** Grep `responseRate|response rate|response-rate` across repo/service/controller/shared/UI returns ONLY prohibiting-comment lines: `page.tsx` L14 ("NOT response rate"), `analytics.ts` L11/L51 (naming contract / "NOT responseRate"), `repository.ts` L89/L94 (naming contract). ZERO executable/field occurrences. The live metric is `gatePassRate = send_eligible/total`, `blockedRate = blocked/total` over `outreach.status` (`repository.ts` L108-123), div-by-zero-guarded to `null`.

### 6. Read-only (no writes; audit chain intact) — TRUE
- **Claim (P-3 / B-6 / C-2):** analytics path has NO INSERT/UPDATE/DELETE/`AuditService.append`; `/compliance/audit-log/verify` → intact.
- **Evidence:** Grep `insert|update|delete|audit|.append` across repo/service/controller returns ONLY doc-comment negations (controller L22 "appends ZERO audit rows", repo L20 "ZERO writes", service L14/L35 "ZERO writes / appends ZERO audit rows"). No executable write op anywhere in the module. Controller is `@Get()`-only (no mutating verb). **LIVE** `/compliance/audit-log/verify` → **401** (auth gate, NOT 500) ⇒ the HMAC-SHA256 audit module booted intact; the read-only analytics deploy did not touch the chain.

### 7. RBAC (@Roles; advisor+admin; fail-closed) — TRUE
- **Claim (P-3 / B-6):** `@Roles` on the analytics controller; `ANALYTICS_ROLES = rolesForRoute('/analytics')` = advisor+admin; fail-closed if `[]`.
- **Evidence:** `analytics.controller.ts` L38 `const ANALYTICS_ROLES: Role[] = [...rolesForRoute('/analytics')]`; L40-45 **fail-closed boot-throw** if length 0 ("Refusing to boot rather than expose /analytics"); L66 `@Roles(...ANALYTICS_ROLES)`. `packages/shared/src/rbac.ts` L646-648 — roleRoutes entry `pattern:'/analytics', allowedRoles:['advisor','admin']`. `rolesForRoute()` (L712-731) returns `[]` for unmatched routes → drives the boot-throw. Live anon → 401 (SessionGuard fail-closed, Claim 3). analyst/compliance → 403 proven by `analytics.spec.ts` (15/15, per C-1/T-9).

---

## Non-blocking note (info only — do NOT gate)
- **Live-authed 200-with-4-families read deferred to a later prod-fixture pass.** A 2-firm cross-firm LIVE test is structurally impossible with one real prod workspace, and `test-accounts.md` is an unpopulated template this pre-first-prod-test wave (dev-seed creds against prod SuperTokens is the explicit anti-pattern). The AUTHORITATIVE cross-firm + 4-family + F2-gate-outcome + RBAC proof is the C-1 CI e2e (7/7 as `dealflow_app` under FORCE RLS + AMP-4 fault-killing) + `analytics.spec` (15/15), both green @5c86cf5. C-2 DID live-verify the RBAC boundary (anon /analytics 401 mounted, /insights 307). Karen concurs with T-9: ACCEPTABLE deferral, not a rework. The invariant this wave exists to protect (cross-firm isolation) is proven non-hollowly.

---

## Summary
- **Findings:** 0 Critical / 0 High / 0 Medium / 0 Low blocking; 1 Info (accepted deferral).
- **Every load-bearing claim TRUE in the deployed state.** No Done-Theater, no Ghost-Green, no hollow test on the load-bearing isolation invariant, no spec-vs-deployed drift, no stale GIT_SHA (corrected), no false-green.
- **Verdict: APPROVE.**

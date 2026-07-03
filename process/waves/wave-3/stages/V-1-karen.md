# V-1 Karen — Reality Verification (Wave 3: AppShell + role-aware dashboard + per-route RBAC)

**Reviewer:** Karen (source-claim reality check — NOT spec-semantics, which is jenny's lane).
**Scope:** Verify the wave's load-bearing CLAIMS are TRUE in the DEPLOYED state.
**Deployed hash:** `935b847` (live `/health` version field == `935b847`; matches C-2 deploy claim). Repo main @ `0e040d7` (T-9 journey regen only; no code delta vs 935b847).
**Method:** Evidence-only — file-on-disk (Read/grep), live HTTP (fresh cookie-jar users minted via `/auth/invite`+`/auth/signup`), code path trace. Did NOT trust C-2's self-report — re-ran the RBAC matrix independently.

## VERDICT: **APPROVE**

All 7 load-bearing claim-groups verified TRUE against deployed state. No Done-Theater found. Two MINOR observations logged (non-blocking, not defects).

---

## Findings (claim + evidence)

### Finding 1 — Files exist (CLAIM: TRUE) ✓
- `packages/shared/src/rbac.ts` (10969 bytes) — exports `roleRoutes`, `navItemsForRole`, `rolesForRoute`, `canAccess`, `isPublicRoute` (all present, verified by Read).
- `apps/api/src/modules/compliance/` — `compliance.controller.ts` (@Roles), `compliance.module.ts`, `compliance.service.ts` + specs. Registered in `apps/api/src/app.module.ts:7` (`imports: [HealthModule, AuthModule, ComplianceModule]`).
- `apps/api/src/modules/auth/guards/roles.guard.ts` — DB re-verify present (see Finding 3).
- `apps/web/app/(app)/` — `layout.tsx`, `page.tsx`, `_components/{AppShell,Sidebar,TopBar,NavItem}.tsx`, `_lib/assertRole.ts` all present.
- `apps/web/app/page.tsx` — **DELETED** (`ls` → No such file). Public wave-1 `/` superseded by authed `(app)/` index per P-4 remediation. ✓

### Finding 2 — rbac.ts is the SINGLE source (CLAIM: TRUE) ✓
- API compliance controller: `compliance.controller.ts:36,57` imports `rolesForRoute` from `@dealflow/shared`; `COMPLIANCE_SUMMARY_ROLES = [...rolesForRoute('/compliance/summary')]` — NOT hardcoded.
- Web Sidebar: `Sidebar.tsx:21,72` imports + uses `navItemsForRole(me.role)` — "No hardcoded nav list" (comment line 11, verified).
- Web AppShell: `AppShell.tsx:20,42` also uses `navItemsForRole`.
- Web assertRole: `assertRole.ts:23,35` imports + uses `canAccess`.
- Grep for hardcoded role sets in api/web (excl. rbac.ts + tests): only hits are (a) doc comments, and (b) `page.tsx:142,235` inline `me.role === 'compliance'||'admin'` / `'advisor'||'analyst'` — these gate DASHBOARD CONTENT SECTIONS (role-appropriate landing panels), NOT route access or nav visibility. See MINOR-1. No route/nav authorization is hardcoded.

### Finding 3 — DB-authoritative guard, the B-6 CRITICAL-1 fix (CLAIM: TRUE) ✓
- `roles.guard.ts:78` constructor-injects `AuthRepository`.
- `roles.guard.ts:115-118`: `session.getUserId()` → `authRepository.resolveRoleBySupertokensUserId(...)` and authorizes off that DB value, NOT the session claim (line 120: `!required.includes(role)`).
- `auth.repository.ts:119-127`: `resolveRoleBySupertokensUserId` runs a real Drizzle query — `select roles.name FROM users INNER JOIN roles ON users.roleId=roles.id WHERE users.supertokensUserId=?`. This is the app-DB row, the same source `/auth/me` uses. NOT the claim.
- **AuthModule EXPORTS AuthRepository (the DI boot fix):** `auth.module.ts:33` `exports: [SessionGuard, RolesGuard, AuthRepository]`. ComplianceModule imports AuthModule (`compliance.module.ts:17`) so RolesGuard can construct in that DI context. Both confirmed in code.
- Unit proof: `compliance.rbac.spec.ts:9-13,168-170` explicitly tests "DB wins over stale claim" — mock repo returns `dbRole`, asserts DB value decides even when claim differs.

### Finding 4 — RBAC LIVE (CLAIM: TRUE) ✓ — INDEPENDENTLY RE-RUN against deployed 935b847
Minted two FRESH unique users (cookie jar) via `POST /auth/invite` → `POST /auth/signup`, web Origin header:
- compliance user `karen-comp-1783096650@…` (signup 201, session cookie set, `/auth/me` role=compliance)
- advisor user `karen-adv-1783096650@…` (signup 201, session cookie)

| Actor | Request | Expected | Observed | |
|---|---|---|---|---|
| compliance | GET /compliance/summary | 200 | **200** `{"pendingCount":0,"items":[]}` | ✓ |
| advisor | GET /compliance/summary | 403 no leak | **403** `{"message":"Forbidden","statusCode":403}` (no resource data, no role info) | ✓ |
| unauth | GET /compliance/summary | 401 | **401** `{"message":"Unauthorized","statusCode":401}` | ✓ |

Correct in BOTH directions (compliance→200, advisor→403, not inverted). This is the wave's core claim — verified live, not inferred from C-2's report.

### Finding 5 — Allowlist / login NOT broken (CLAIM: TRUE) ✓ — live
- `/health` ungated → **200** `{"status":"ok","db":"ok","version":"935b847"}`.
- web-origin login (`POST /auth/signin`) correct pw → **`{"status":"OK",...}`** + session cookie.
- wrong pw → **`{"status":"WRONG_CREDENTIALS_ERROR"}`** (genuinely distinguishable — not a rubber-stamp).
- unauth web `/` → **307 → /login** (authed-`/` guard holds).
- web `/login` → **200** (renders).
- `isPublicRoute` (rbac.ts:210-220) allowlist = `/auth` + `/health` ONLY; `/` correctly NOT in allowlist (authed per P-4 remediation).

### Finding 6 — Deploy hash + AppShell-built-once (CLAIM: TRUE) ✓
- live `/health` version == `935b847` — deployed code IS the reviewed code (no health-mirage). Repo main `0e040d7` is a T-9 doc-only commit on top; no code drift.
- AppShell built ONCE: `(app)/layout.tsx:140` renders `<AppShell me={me} pathname={pathname}>` wrapping children once (comment line 138 "Render AppShell ONCE"). Chrome-dup grep: only `layout.tsx` imports AppShell; `page.tsx` imports NO chrome component (grep for Sidebar/TopBar/AppShell/NavItem imports in page.tsx = empty; the one match was a doc comment "renders inside <AppShell>"). No per-page chrome duplication.

### Finding 7 — Antipatterns checked (CLAIM: honest) ✓
- **fail-closed on empty @Roles is REAL:** `roles.guard.ts:96-98` — `if (required.length === 0) throw new ForbiddenException()`. Distinguished from `undefined` (no decorator → pass-through, line 89). Two-layer defence: also asserted at boot in `compliance.controller.ts:59-65` (throws if `rolesForRoute` resolves to []). Not a comment-only claim — both are executable.
- **nav ⊆ RBAC by construction:** `navItemsForRole` (rbac.ts:314-329) reads `entry.navItem.allowedRoles`; each `navItem.allowedRoles` references the SAME array literal as the route entry's `allowedRoles` (rbac.ts:65-203). No separate lookup table → cannot drift. Verified structurally.
- **DI boot fix honestly recorded:** C-2-deploy-and-verify.md documents the prior C-2 FAIL (api crash-loop, `UnknownDependenciesException`, RolesGuard couldn't resolve AuthRepository) and the fix (AuthModule exports AuthRepository at 935b847), with boot logs showing `ComplianceModule dependencies initialized` + `Nest application successfully started`. The failure was NOT hidden — it's recorded as a superseded FAIL with the root cause. Honest.

---

## MINOR observations (non-blocking, NOT defects)

- **MINOR-1 (Low):** `page.tsx:142,235` uses inline `me.role === ...` checks to decide which dashboard LANDING SECTIONS to render (role-appropriate empty states). This is content-shaping, not authorization — the route itself is `/` (all roles). It does not bypass or duplicate the RBAC source. If future waves add role-gated CONTENT, prefer deriving from `canAccess`/a shared helper to keep the single-source discipline. No action required this wave.
- **MINOR-2 (Low):** DB-authoritative role re-verify (Finding 3) could NOT be exercised end-to-end via a live role-downgrade because the app DB is on Railway (not reachable from this reviewer's `CLAUDOMAT_DB_URL`, which is the brain DB). Verified instead by: (a) code path (real Drizzle query off `users.role`, not claim), and (b) the `compliance.rbac.spec.ts` "DB wins over stale claim" unit test. The live advisor→403 confirms the query path executes (advisor's DB role was read and denied). Confidence: high. A future live downgrade smoke-test would fully close the loop.

---

## Summary
The wave delivers exactly what it claims: AppShell built once, role-aware nav from a single source, per-route RBAC LIVE and enforced (200/403/401 verified independently against deployed 935b847), DB-authoritative guard with the AuthModule export DI fix present in code and honestly recorded, allowlist + login intact. No fabricated greens, no hollow implementations, no wrong-problem drift. **APPROVE.**

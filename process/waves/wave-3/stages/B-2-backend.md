# Wave 3 — B-2 Backend (per-route RBAC enforcement)
Implemented by security-engineer. Branch wave-3-appshell-rbac. Commit `1cf4fba`.
## Files
apps/api/src/modules/compliance/{compliance.controller,compliance.service,compliance.module,compliance.service.spec,compliance.rbac.spec}.ts; app.module.ts (+ComplianceModule); roles.guard.ts (comment only); packages/shared/src/compliance.ts (+index) — the ComplianceSummaryResponse schema (B-1 gap, authored here).
## RBAC enforcement
- GET /compliance/summary guarded @UseGuards(SessionGuard, RolesGuard) + @Roles(...rolesForRoute('/compliance/summary')) → ['compliance','admin'] from rbac.ts (single source; test asserts equality). Returns {pendingCount:0, items:[]} (no feature content).
- **Allowlist preserved:** RolesGuard opt-in (no-ops without @Roles); no global guard; /auth/*, /health, /auth/me ungated — live login NOT regressed (2 allowlist tests: undecorated handler passes anon + all 4 roles).
- Per-role matrix TESTED: compliance→200, admin→200, advisor→403, analyst→403, unauth→401; deny body leaks no role/resource. Role from server-verified session claim only.
## Verify
`pnpm --filter @dealflow/api typecheck` clean; api tests 39 pass/1 skip; `biome check apps/api` 0 errors.
## Deviations
1. Authored packages/shared/src/compliance.ts (B-1 gap) — in scope.
2. **CARRIED to B-5:** B-1's packages/shared/src/rbac.ts + rbac.test.ts have pre-existing biome errors (useTemplate, noNonNullAssertion, formatting) — not in B-2's touched set; repo-wide biome (B-5) will catch → route to typescript-pro at B-5 lint.
3. Web-side assertRole helper = B-3 (uses shared canAccess/rolesForRoute + /auth/me role).
```yaml
skipped: false
specialists_spawned: [security-engineer]
files_implemented: [apps/api/src/modules/compliance/*, apps/api/src/app.module.ts, packages/shared/src/compliance.ts]
deviations: ["authored compliance.ts (B-1 gap)", "CARRY: rbac.ts biome errors -> B-5/typescript-pro", "web assertRole -> B-3"]
simplify_applied: true
commit: 1cf4fba

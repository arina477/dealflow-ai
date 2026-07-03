# Wave 3 — B-4 Wiring
- **Repo typecheck** (`pnpm -r typecheck`): PASS (shared+api+web) — no B-1↔B-2↔B-3 drift; rbac.ts contract consumed cleanly by api (@Roles) + web (nav/assertRole).
- **Repo build** (`pnpm -r build`): PASS. Next compiles; `/` served by (app) route-group index (authed dashboard); (app) layout wraps authed pages.
- **Routes:** API /compliance/summary registered (ComplianceModule in app.module); web (app) layout + / + retired /dashboard(redirect) + auth pages. Allowlist: /auth/*+/health ungated, / authed.
- **Env:** no new env vars this wave.
- **Carried to B-5:** B-1 rbac.ts biome errors (repo-wide lint will catch).
```yaml
typecheck_passed: true
build_passed: true
drift_defects: []
carried_to_b5: ["rbac.ts biome errors (B-1)"]
```

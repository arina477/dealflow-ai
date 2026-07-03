# Wave 4 — B-4 Wiring
- **Repo typecheck** (`pnpm -r typecheck`): PASS (shared+api+web) — B-1 audit contracts consumed cleanly by api (service/verifier/endpoint) + web (integrity view); shared dist rebuilt.
- **Repo build** (`pnpm -r build`): PASS. `/compliance/audit-log` route compiles (2.98kB). AuditModule + audit-log.controller registered (app.module + compliance.module).
- **Routes:** GET /compliance/audit-log/verify (RBAC compliance/admin); web /compliance/audit-log (compliance). Allowlist unchanged (/auth/*+/health public, / authed).
- **Env:** AUDIT_LOG_HMAC_KEY + _VERSION — keyring fail-fast at boot; real secret set at B-4/C-2 via platform (Railway). vitest dummy for tests.
- **Migration 0002:** applies at C-2 against app postgres (dealflow-postgres, has 0001).
```yaml
typecheck_passed: true
build_passed: true
drift_defects: []
env_todo: [AUDIT_LOG_HMAC_KEY (set real @ C-2)]
```

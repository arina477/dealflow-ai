# Wave 3 — T-2 Unit (Pattern A, CI-verified)
- CI `test` job green. 217 tests: @dealflow/shared 105 (rbac.ts: nav⊆RBAC all 4 roles, per-role matrix, route-pattern matching, normalization, isPublicRoute), apps/api 48+1skip (compliance RBAC matrix compliance/admin→allow advisor/analyst→deny + fail-closed empty-@Roles + DB-wins-over-stale-claim + di-boot ComplianceModule/AuthModule), apps/web 64 (AppShell per-role nav for 4 roles, auth-guard redirect, 5xx error-state).
- Coverage: every RBAC branch (allow/deny/fail-closed/DB-authoritative) + AppShell per-role + both boot regressions have real behavioral assertions. Not hollow.
```yaml
test_pattern: ci-verified
skipped: false
evidence: ["CI test job green; 217 tests across shared/api/web"]
findings: []
```

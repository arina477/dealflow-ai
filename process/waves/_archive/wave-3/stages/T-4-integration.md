# Wave 3 — T-4 Integration (Pattern A, CI-verified)
- No schema change this wave (RBAC reuses users.role + session claim). Integration surface = the RBAC guard→DB role re-verify + compliance route→guard→session/DB.
- Coverage: compliance.rbac.spec exercises guard→DB-role (mocked AuthRepository) per-role 403/200 + fail-closed + DB-authoritative; live at C-2 (compliance→200, advisor→403, unauth→401 against real Core + real app-DB). health e2e (real Postgres in CI) still green.
```yaml
test_pattern: ci-verified
skipped: false
boundaries_audited: [RolesGuard->DB role re-verify, compliance route->guard->session/DB]
ci_evidence: ["compliance RBAC matrix (unit, mocked DB role)", "C-2 live RBAC matrix (real Core+DB)"]
findings: []
```

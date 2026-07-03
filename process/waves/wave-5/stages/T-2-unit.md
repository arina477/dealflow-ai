# Wave 5 — T-2 Unit (Pattern A, CI-verified)
CI `test` green. 578 tests: shared 275 (GateVerdict/BlockReason discriminated-union, rules Zod, roleRoutes CRUD+nav, nav⊆RBAC), api 169(+1 skip) (**SoD compliance-only matrix — admin/advisor/analyst BLOCKED as approver, null-approver fail-closed, sender==approver blocked, revoked blocked**; non-bypass — all evaluators every call + audit-in-tx + rollback-on-audit-fail; invalid-ctx→throws; content-hash post-edit re-block; suppression exact+domain; disclaimer enforced; CRUD per-role RBAC + mutation-audited-in-tx + disclaimer-new-version + advisory-lock; **id-translation SuperTokens→app-users.id** regression), web 134 (settings 3-section + CRUD interactions + validation). Real behavioral assertions.
```yaml
test_pattern: ci-verified
skipped: false
evidence: ["CI test green; 578 tests; SoD-compliance-only matrix + id-translation regression"]
findings: []
```

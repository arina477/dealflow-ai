# Wave 3 — T-3 Contract (Pattern A, CI-verified)
- Contract surface: rbac.ts (roleRoutes single source of truth — roles per route + nav) + /compliance/summary response (compliance.ts Zod) + the wave-2 auth contracts (unchanged). Project-internal → Pattern A.
- Coverage: rbac.test 105 (roleRoutes completeness vs pinned matrix, rolesForRoute/canAccess per role, nav⊆RBAC by construction — THE load-bearing invariant contract-tested); /compliance/summary shape tested + live-verified (C-2 200 body {pendingCount,items}). No drift.
```yaml
test_pattern: ci-verified
skipped: false
contracts_audited: [roleRoutes, ComplianceSummaryResponse, nav⊆RBAC invariant]
findings: []
```

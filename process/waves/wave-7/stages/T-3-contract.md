# Wave 7 — T-3 Contract (Pattern A, CI-verified)
Contract surface: sourcing.ts (connectionCreateSchema + ConnectionCreateInput; DataSourceConnection; Company.connectionIds) + roleRoutes (/sourcing/connections analyst/admin) + audit (sourcing-connection-create). Project-internal → Pattern A. Coverage: sourcing.test + rbac.test (routes + nav⊆RBAC) + audit (additive). API↔web share the types (workspace consumes connectionIds/DataSourceConnection). No drift.
```yaml
test_pattern: ci-verified
skipped: false
contracts_audited: [connectionCreateSchema, roleRoutes /sourcing/connections, connectionIds return shape, auditActionEnum]
findings: []
```

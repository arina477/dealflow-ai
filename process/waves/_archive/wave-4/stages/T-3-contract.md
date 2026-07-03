# Wave 4 — T-3 Contract (Pattern A, CI-verified)
Contract surface: audit.ts (AuditVerifyResponse {ok,entriesChecked,firstBreakAt?,reason?}; entry shapes; GENESIS_PREV_HASH) + roleRoutes (/compliance/audit-log/verify ['compliance','admin']; /compliance/audit-log nav ['compliance']). Project-internal → Pattern A. Coverage: audit.test 36 + rbac.test (audit additions) — AuditVerifyResponse parse/reject, roleRoutes rows, nav⊆RBAC by construction, /compliance/settings untouched. API↔web share AuditVerifyResponse (endpoint returns / screen consumes). No drift.
```yaml
test_pattern: ci-verified
skipped: false
contracts_audited: [AuditVerifyResponse, roleRoutes audit-log entries, nav⊆RBAC]
findings: []
```

# Wave 27 — P-2 Spec (pointer) — CORRECTED (P-4 Phase-2 REWORK)
**Source of truth:** the REWORKED process/waves/wave-27/stages/P-3-plan.md + seed 0d2c5f08 tasks.description (the "P-2 SCOPE — REWORKED" tail). design_gap TRUE → D-block. SECURITY-SCOPE-TIGHTENED.
**claimed_task_ids:** [0d2c5f08, f331a51c]
## CORRECTED premise (the prior spec was factually inverted — all 3 Phase-2 reviewers REJECTED):
- audit_log_entries HAS FORCE RLS (workspace_isolation policy, 0014/0017) → export audit rows via getDb/RLS (PRIMARY guard, same as deal/pipeline). read_audit_chain_rls_exempt is FORBIDDEN in the export payload (boolean verify only).
- EXTEND the existing recordkeeping export (RecordkeepingService/Repository, POST /compliance/audit-log/export, RBAC compliance+admin) — NOT greenfield. New deltas: CSV serializer + deal/pipeline-activity scope + row-cap+EXPLICIT-truncation + firm-admin UI page.
## Binding SEC-1..10 (see P-3-plan.md): getDb-RLS-not-exempt / .strict-no-client-workspace-id / extend-not-rebuild / bounded+truncation-warning / CSV-injection-escape / firm-local-ordinal-mask-global-seq / RBAC-compliance+admin-fail-closed / fault-killing-export-isolation-e2e-as-dealflow_app / export-audit-log-scope-only / no-cross-firm-joins.
## Load-bearing: zero-cross-tenant-leak (via getDb/RLS — the fault-killing e2e proves firm A export = 0 firm B rows) + no-rls-exempt-in-payload + bounded+explicit-truncation + firm-local-ordinal. → D-block then T-8 Security. LIGHT posture. FLAGS: M10 later verticals deferred; M9 _TBD.

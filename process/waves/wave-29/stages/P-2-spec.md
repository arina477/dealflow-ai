# Wave 29 — P-2 Spec (pointer)
**Source of truth:** the records-view bundle tasks.description (d573e7bf + siblings) + this contract. design_gap assess at D-1. LAST M10 vertical.
**claimed_task_ids:** [d573e7bf, 6f86b594, 770ab1c4]
## AC (M10 records-VIEW — deal-activity browse, light, READ-ONLY):
1. **Deal-activity browse API:** a PAGINATED (browse-shaped limit/offset or cursor, page size ~25-50, NOT the 50k export cap), workspace-RLS-scoped (getDb), READ-ONLY (no audit row) GET of the firm's deal/pipeline activity, with basic filters (date-range, type). RBAC compliance/admin (mirror the export deal-scope), roleRoutes boot-fail-closed.
2. **RLS-isolation (crux):** firm A sees ZERO firm B deal-activity rows — a fault-killing test as dealflow_app (REAL service in workspaceAls, reuse the isolation harness). Reuse findDealRowsBounded's RLS pipeline→mandates join (paginated variant), never a raw/admin path.
3. **READ-ONLY (WORM-preserving):** the browse emits NO audit row + has NO mutation/deletion path (matching the existing audit-log browse).
4. **Browse UI:** reuse AuditLogTable — a deal-activity scope/tab on the compliance/audit-log page (or a light section) with filters + pagination controls. Read-only, RBAC-gated.
5. **Contracts:** shared-Zod deal-activity filter + pagination + row (.strict).
## Load-bearing: RLS-scoped-browse-isolation (firm A=0 firm B, as dealflow_app) + READ-ONLY (no audit-row/mutation) + paginated (not export cap) + RBAC-fail-closed + reuse-not-rebuild. → D-1 assess then P-4 (security assess) + T-8. UNIFICATION descoped. FLAGS: LAST M10 vertical → M10 closes at next N; M9 _TBD.

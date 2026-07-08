# Wave 29 — B-block review artifacts
**Wave topic:** M10 records-VIEW deal-activity browse — paginated RLS-scoped READ-ONLY deal-activity API + a scope/tab on compliance/audit-log (reuse AuditLogTable) + contract + tests. | **Block exit gate:** B-6 | **Status:** gate-passed
| Stage | Deliverable | Status | Notes |
|---|---|---|---|
| B-0 | (claim+branch) | done | schema SKIP; branch wave-29-records-view; D-SKIP |
| B-1 | stages/B-1-contracts.md | pending | shared-Zod deal-activity filter/pagination/row |
| B-2 | stages/B-2-backend.md | pending | paginated RLS-scoped deal-activity browse API + tests-first (770ab1c4) |
| B-3 | stages/B-3-frontend.md | pending | deal-activity scope/tab on compliance/audit-log (reuse AuditLogTable) |
| B-4/B-5/B-6 | ... | pending | |
## BINDING (from P-4; head-builder + T-8 police):
- Workspace-RLS-scoped deal-activity browse: reuse findDealRowsBounded's RLS pipeline→mandates join via getDb (NOT raw/admin); a PAGINATED (browse limit/offset or cursor, page size ~25-50, NOT the 50k EXPORT_ROW_CAP) DESC variant. Isolation test: firm A sees ZERO firm B deal rows, as dealflow_app (workspaceAls, reuse recordkeeping-export-isolation harness).
- READ-ONLY: NO audit row emitted on a browse (match listAsActor); NO mutation/deletion path.
- RBAC compliance/admin, roleRoutes boot-fail-closed (mirror the export deal-scope EXPORT_ALLOWED_ROLES); .strict rejects client workspace_id.
- REUSE-not-rebuild: extend the recordkeeping surface + findDealRowsBounded; reuse AuditLogTable for the UI. UNIFICATION descoped.
## LOAD-BEARING: RLS-browse-isolation (firm A=0 firm B as dealflow_app) + READ-ONLY (no audit-row/mutation) + paginated-not-export-cap. LAST M10 vertical.

## Block exit handoff
```yaml
build_block_status: complete
branch: wave-29-records-view
review_verdict: APPROVE (head-builder + /review ship — RLS-browse-isolation + READ-ONLY + paginated solid)
deliverable: [dealActivityBrowseFilterSchema/rbac route, findDealRowsPaginated (RLS-reuse, not export-cap) + listDealActivityAsActor (READ-ONLY) + GET /compliance/records/deal-activity (boot-fail-closed), recordkeeping-deal-activity-isolation.e2e (as dealflow_app), deal-activity scope/tab UI (reuse AuditLogTable)]
app_bundle_changed: true (api browse route + web scope/tab; NO migration → C-2 real deploy, no migration)
db_gated_tests: [recordkeeping-deal-activity-isolation.e2e (DA-ISO/RBAC/RO/PAGE)] — C-1 MUST confirm they RAN in CI (not skipped/ghost-green)
ci_yml_change: false
ready_for_ci: true
last_m10_vertical: true (M10 closes at next N-block)
```

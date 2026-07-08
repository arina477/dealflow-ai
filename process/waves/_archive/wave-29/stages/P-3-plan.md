# Wave 29 — P-3 Plan (M10 records-VIEW — deal-activity browse)
## Approach — the deal-activity BROWSE half (the audit-log browse already ships)
### Action 1 — Deliverables
1. **Deal-activity read API (d573e7bf):** a NEW browse-shaped GET (e.g. /compliance/records/deal-activity or a deal-scope on the recordkeeping list) — PAGINATED (limit/offset OR cursor; sane page size ~25-50; NOT the 50k export cap), workspace-RLS-scoped via getDb (a firm sees ONLY its own deal/pipeline activity — reuse findDealRowsBounded's RLS pipeline→mandates join but add a paginated browse variant, DESC by date, with basic filters [date-range, type]), READ-ONLY (no audit row emitted — matching the existing audit-log browse). RBAC compliance/admin (mirror the export deal-scope gate + the records-VIEW compliance framing; the /pipeline advisor lens is the product surface, this is the compliance records lens). roleRoutes boot-fail-closed.
2. **Browse UI (d573e7bf):** REUSE AuditLogTable — add a deal-activity scope/tab on the existing compliance/audit-log page (a scope toggle: Audit log | Deal activity) OR a light deal-activity section, with basic filters + pagination controls. READ-ONLY, RBAC-gated. (D-1 judges: a scope-toggle extension [likely, reuse AuditLogTable] vs a light new section.)
3. **Contracts (6f86b594):** shared-Zod deal-activity list filter (date-range, type, pagination limit/offset/cursor) + the row shape (.strict). Separate from the export cap contract.
4. **Tests (770ab1c4 — authored FIRST, tests-first):** RLS-isolation (firm A sees ZERO firm B deal-activity rows, REAL service as dealflow_app in workspaceAls — reuse the analytics/recordkeeping-export-isolation harness) + RBAC-deny (a non-permitted role → 403; boot-fail-closed) + READ-ONLY (the browse emits NO audit row + has no mutation path) + pagination (page size bounded; no unbounded load).
### Action 2 — Data model: NONE (reads existing deal/pipeline + mandates tables — RLS-covered). No migration.
### Action 3 — API: 1 new browse GET (deal-activity). Reuse the audit-log GET as-is.
### Action 4 — Deps: none.
## D-BLOCK: ASSESS at D-1 — if it's a scope/tab reusing AuditLogTable, a LIGHT D-block (a brief confirming the scope-toggle + the deal-activity columns) OR D-skip (pure reuse). If a genuinely new browse layout, D-1→D-2→D-3. D-1 judges.
## Plan (by B-stage)
**B-0 Schema:** SKIP (no new table).
**B-1 Contracts** (backend-developer): the shared-Zod deal-activity filter/pagination/row.
**B-2 Backend** (backend-developer): the paginated RLS-scoped deal-activity browse API + reuse findDealRowsBounded's RLS join (paginated variant, DESC, filters) + RBAC boot-fail-closed + the tests (770ab1c4 authored first): RLS-isolation-as-dealflow_app + RBAC-deny + read-only + pagination.
**B-3 Frontend** (nextjs-developer): the deal-activity browse (reuse AuditLogTable as a scope/tab on compliance/audit-log; basic filters + pagination), adopted design (if D-block ran). Tests.
**B-4/B-5/B-6:** head-builder polices the RLS-scoped-browse-isolation (as dealflow_app) + READ-ONLY + pagination-not-export-cap + RBAC + reuse-not-rebuild.
### Action 6 — Specialists: backend-developer (API+contract+tests) + nextjs-developer (UI). Serial.
### Action 8 — Self-consistency CLEAN. security-adjacent → P-4 assess (RLS-browse-isolation) + T-8.
```yaml
deps_new: []
schema_change: false
specialists: [backend-developer, nextjs-developer]
compliance_invariants: [deal-activity-browse-workspace-RLS-scoped (firm A=0 firm B, isolation as dealflow_app), READ-ONLY-no-audit-row-no-mutation, paginated-not-export-cap, RBAC-compliance-admin-fail-closed, reuse-findDealRowsBounded-RLS-join-not-raw]
hard_boundaries: "the deal-activity BROWSE half only (audit-log browse ships) — a PAGINATED (browse-shaped, NOT 50k export cap) workspace-RLS-scoped (getDb, firm A=0 firm B, isolation-as-dealflow_app) READ-ONLY (no audit row, no mutation) deal-activity GET + a browse UI reusing AuditLogTable + RBAC compliance/admin fail-closed. REUSE findDealRowsBounded's RLS join (paginated variant). UNIFICATION redesign DESCOPED. NO write/purge/export (export vertical exists). NO migration."
design_gap_flag: assess-at-D-1
self_consistency: clean
```

# Wave 29 — P-0 Frame
## Discover
- wave_number 29, M10 (in_progress, LIGHT posture). records-view bundle: seed d573e7bf (page + deal-activity read API) + 6f86b594 (contracts) + 770ab1c4 (RLS-isolation/RBAC-deny tests). VERTICAL 3 of 3 — the LAST M10 light vertical (M10 closes after it).
## Reframe
### problem-framer — PROCEED
Correctly EXTENDS the shipped audit-log browse (findFiltered) + the RLS-scoped deal query (findDealRowsBounded) — the deal-activity BROWSE endpoint is genuinely absent. Load-bearing (→ P-1/P-2/P-3):
- **REUSE-not-rebuild:** reuse findFiltered's browse shape + findDealRowsBounded's RLS pipeline→mandates join, but ADD a browse-shaped limit/offset/DESC PAGINATED variant — findDealRowsBounded is export-only (ASC, 50k cap, no pagination). Do NOT reuse EXPORT_ROW_CAP (50k) as the UI page size.
- **Workspace-RLS-scoping (crux):** the deal query reads via getDb/FORCE-RLS, joins only RLS-covered tenant tables — keep it there, never a raw/admin path. Blocking AC: firm A sees ZERO firm B pipeline rows, as dealflow_app.
- **Pagination:** browse paginates via a shared-Zod filter contract, separate from the export cap.
- **RBAC (P-2 decides):** pin the deal-activity lens — compliance/admin (mirror the export deal-scope gate + the records-VIEW framing) vs the existing /pipeline advisor/admin/analyst lens. Fail-closed roleRoutes boot assertion.
- **design_gap:** most naturally an EXTENSION (a deal-activity scope/tab reusing AuditLogTable) of the existing compliance/audit-log page, NOT a net-new page. D-1 judges D-block need (likely light or D-skip if a scope toggle on AuditLogTable).
- READ-ONLY (WORM) correct (no write, no audit row on reads).
### ceo-reviewer — PROCEED (HOLD-SCOPE)
records-VIEW is literally M10 ## Scope vertical (3) + meets the "retained records are viewable in-app" light-metric clause. extend-not-rebuild confirmed. M10-light closes MECHANICALLY at the next N-1 (attestation/named-regime founder-deferred, NOT part of the light metric). M9 _TBD + pile-up flagged.
### mvp-thinner — THIN (split (b): defer the page-UNIFICATION)
The audit-log browse already ships → the metric remainder is ONLY the deal-activity half. Keep: deal-activity RLS-scoped PAGINATED API + a browse UI + shared-Zod contract + RLS-isolation/RBAC/WORM tests. DEFER: the audit+deal PAGE-UNIFICATION redesign (a firm keeps its existing audit-log browse + gets a deal-activity browse; unifying into one Records page is later polish, NOT needed for the metric). Rich-filters already basic (nothing to thin). RLS/pagination/isolation NOT cuttable (security floor). Floor-proximity flag: residual ~1000-2300 LOC clears the 1500 single-spec floor on the upper band but is close — head-product confirms sizing.
### Disposition: PROCEED (mvp = deal-activity browse; unification DESCOPED)
Final framing → P-1/P-2/P-3:
1. **Deal-activity read API (part of d573e7bf):** a browse-shaped, PAGINATED (limit/offset or cursor + a sane page size, NOT the 50k export cap), workspace-RLS-scoped (getDb — a firm sees ONLY its own deal/pipeline activity), READ-ONLY GET (no audit row). RBAC per P-2 (compliance/admin, mirroring the export deal-scope). Reuse findDealRowsBounded's RLS join → add a paginated browse variant.
2. **Browse UI (d573e7bf):** a deal-activity records browse — reuse AuditLogTable (a scope/tab on the existing compliance/audit-log page, OR a light standalone section) with basic filters (date-range, type). Read-only, RBAC-gated. (D-1 judges: a scope-toggle extension [likely] vs a light new section.)
3. **Contracts (6f86b594):** shared-Zod deal-activity list filter + pagination + row shapes (.strict).
4. **Tests (770ab1c4, authored FIRST):** RLS-isolation (firm A sees 0 firm B deal rows, as dealflow_app) + RBAC-deny (non-permitted role → 403) + READ-ONLY (no mutation/audit-row).
## LOAD-BEARING (security-adjacent): workspace-RLS-scoped deal browse (firm A = 0 firm B rows, isolation test as dealflow_app) + READ-ONLY (no write/audit-row) + paginated (no unbounded load) + RBAC fail-closed. REUSE-not-rebuild (extend findFiltered/findDealRowsBounded). UNIFICATION descoped.
## design_gap_flag: ASSESS at D-1 (likely a scope/tab extension of the existing audit-log page reusing AuditLogTable → light D-block or D-skip; D-1 decides). 
## FLAGS: LAST M10 vertical → M10 closes at the next N-block (M10→M11 transition). M9 _TBD + pile-up. M10-light-complete — ceo notes it's mechanical (founder-deferred attestation is not part of the light metric).
claimed_task_ids: [d573e7bf-30e8-4eb2-9bba-2b1588f69578, 6f86b594, 770ab1c4]

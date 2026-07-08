verdict: PROCEED
verdict_source: problem-framer
matched_antipatterns: []
reasoning: |
  Symptom-vs-cause: the stated gap is the CAUSE, not a symptom. "Retained records" = audit-log + deal/pipeline
  activity (the export's two-scope model). The audit-log browse ships end-to-end (AuditLogTable → GET
  /compliance/audit-log → listAsActor → findFiltered; paginated, DESC, RLS-scoped via getDb, READ-ONLY, zero
  audit rows). The deal/pipeline browse is genuinely absent — findDealRowsBounded (repository.ts:367) exists
  but is EXPORT-shaped only (consumed solely by exportAsActor; ASC chain-order, 50k cap, no limit/offset
  page), and no GET deal-activity browse endpoint exists. Framing correctly EXTENDS the two proven patterns
  rather than rebuilding a parallel surface (wave-27 duplicate-surface lesson satisfied). READ-ONLY + RLS +
  pagination are all framed correctly. No antipattern matches.
proposed_reframe: |
  n/a
escalation_reason: |
  n/a
sibling_visible: false

# Framing verification (load-bearing concerns)

## 1. REUSE vs REBUILD — CLEAN (extend, not rebuild)
- Audit-log browse EXISTS: findFiltered (recordkeeping.repository.ts:188) — paginated (limit≤200 / offset),
  DESC by sequence_number, RLS via getDb, READ-ONLY.
- Deal/pipeline browse ABSENT: no GET /compliance/deal-activity (or equivalent). The only deal reader is
  findDealRowsBounded (repository.ts:367), which is export-only: ASC (chain traversal), cap 50k, no
  limit/offset. It is NOT a browse-shaped query.
- Correct framing: NEW paginated deal-activity browse variant, reusing findDealRowsBounded's RLS-scoped
  pipeline→mandates join + WHERE-builder, but adding limit/offset + DESC ordering (the browse shape). Do NOT
  fork findDealRowsBounded's export cap as a "page size" — that is a 50k unbounded UI load (see #4).

## 2. WORKSPACE-RLS-SCOPING — CLEAN, load-bearing (the crux)
- findDealRowsBounded runs via tx from getDb (FORCE-RLS connection), joins ONLY RLS-covered tenant tables
  (pipeline, mandates), no global-table joins (SEC-10 documented + enforced). Any new browse variant MUST
  read via getDb/RLS, never a raw/admin connection. The pipeline→mandates LEFT JOIN is already RLS-safe
  (mandates.workspace_id under FORCE RLS). No join escapes RLS in the reused query.
- MANDATE the fault-killing isolation test: firm A sees ZERO firm B pipeline rows, executed as dealflow_app
  (the RLS role — NOT the migration/superuser role). This is the wave-27 crux repeated; P-1/P-2 must carry it
  as a blocking AC.

## 3. READ-ONLY (WORM-preserving) — CLEAN
- Browse is read-only. listAsActor/findFiltered emit ZERO audit rows on the read path (invariant asserted in
  recordkeeping.spec.ts). New deal-activity browse MUST match: no mutation, no deletion, no audit row for a
  read. No write path in the framing.

## 4. PAGINATION / BOUNDS — CLEAN, load-bearing
- Audit browse paginates (limit default 50, max 200, offset). Deal-activity browse MUST paginate the SAME way
  (limit/offset + max page size via shared-Zod listFilterSchema-style contract). Antipattern to avoid:
  reusing EXPORT_ROW_CAP (50k) as the browse fetch → OOM/slow unbounded load. The export cap and the browse
  page size are DIFFERENT contracts; do not conflate.

## 5. RBAC — spec question, NOT a reframe (flag for P-2/P-3)
- Audit-log browse: compliance/admin/advisor (advisor = own-outreach, service-scoped).
- Export deal-scope: compliance/admin ONLY (EXPORT_ALLOWED_ROLES).
- A NEW /pipeline route already exists with advisor/admin/analyst RBAC (rbac.ts:303).
- Genuine question P-2 must pin: does the compliance deal-activity RECORDS-VIEW use the compliance lens
  (compliance/admin, mirroring the export's deal-scope gate) or the pipeline lens (advisor/admin/analyst)?
  Since the task anchors to "firm-admin / retained records / records-VIEW" (compliance framing), the compliance
  lens (compliance/admin, advisor own-scope only if included) is the natural default — but this is a spec
  decision, not a framing defect. Add the new route to the shared roleRoutes matrix with a fail-closed boot
  assertion (the established RBAC-drift-guard pattern).

## 6. DESIGN_GAP — flag for D-1
- Extension vs new page: an audit-log page already exists (apps/web/app/(app)/compliance/audit-log/page.tsx)
  and a compliance/export page exists. Records-VIEW is most naturally an EXTENSION (a deal-activity tab/scope
  on the existing records surface) reusing the AuditLogTable list pattern, NOT a net-new page. D-1 judges
  whether the D-block runs (a tab/section within an adopted page usually does not need a fresh design cycle)
  or the existing page extends. Lean: extension; D-block likely skippable if the AuditLogTable component is
  reused with a scope toggle.

## 7. LAST M10 VERTICAL — scope completes the light metric, no over-build
- After this ships, M10's 3 light verticals are done → M10 closes (records viewable in-app). Scope is exactly
  "browse+filter the deal/pipeline half of retained records" — read-only, paginated, RLS-scoped. No purge, no
  mutation, no export-format work (export already ships). Framing does not over-build; it closes the light
  metric. Sizing (single wave vs split) is P-1's call.

## Disposition
PROCEED. Framing is sound: EXTENDS proven audit-log browse + RLS-scoped deal query rather than rebuilding;
READ-ONLY / RLS / pagination all framed correctly. Load-bearing concerns to carry into P-1/P-2/P-3:
(1) reuse findFiltered browse pattern + findDealRowsBounded RLS join, add a browse-shaped (limit/offset/DESC)
variant — do NOT reuse the 50k export cap as a page size; (2) firm-A-sees-zero-firm-B isolation test as
dealflow_app (blocking AC); (3) pin the deal-activity RBAC lens (compliance vs pipeline) with a fail-closed
roleRoutes assertion.

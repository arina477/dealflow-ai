verdict: THIN
verdict_source: mvp-thinner
milestone_id: 033f97e0-bc25-48dd-bb5a-b2f2be5b056a
milestone_title: Advanced compliance & recordkeeping
milestone_class: product-feature
milestone_success_metric: |
  LIGHT posture (founder 2026-07-07): a firm admin can, on demand, export a complete
  workspace-scoped, integrity-verifiable record of the firm audit log + deal activity in
  a standard portable format (the export is itself audit-logged); retained records are
  viewable in-app and bounded by a configurable retention window. No formal regulator
  certification required at this stage; raise to a named-regime target only if the
  compliance classification is later raised.
mvp_critical_status: |
  1 of 3 milestone verticals still pending. Verticals (1) EXPORTS and (2) RETENTION are
  done (waves 27/28); this bundle is vertical (3) records VIEW — the last light vertical.
  The "viewable in-app" clause of the success metric is currently HALF-satisfied: the
  audit-log browse already ships (AuditLogTable -> GET /compliance/audit-log, live,
  RLS-scoped, READ-ONLY); the deal/pipeline-activity browse half is the unshipped remainder.

# THIN — proposed sibling split (candidate b: page unification deferred)
proposed_split:
  acs_to_keep:
    - ac: "AC-1 — deal/pipeline-activity RLS-scoped, paginated, filtered LIST read API (listDealActivityAsActor + repository read over pipeline+mandates via getDb/FORCE RLS; RBAC compliance/admin fail-closed; READ-ONLY, no AuditService.append; limit-capped <=200 + offset-paginated)"
      rationale: "Directly satisfies the unshipped deal half of 'retained records are viewable in-app' — the metric's deal-activity coverage is unsatisfiable without it (findDealRowsBounded is export-path-only). Cutting the RLS-scoping or pagination guts the tenant/usability floor."
    - ac: "AC-2 — a firm-admin browse UI for the deal/pipeline-activity records with a BASIC filter bar (type, actor, mandate, from/to date, pagination), design-system + WCAG 2.2"
      rationale: "Is the 'viewable in-app' surface for the deal half. mvp-critical. Note: filter scope is already basic (no multi-facet/saved-query depth proposed), so there is no filter-polish AC to thin — candidate (a) finds nothing to split."
    - ac: "AC-4 — shared-Zod records-view / deal-activity list filter contract (sibling 6f86b594; single source for API DTO + page props, .strict() rejects client workspace_id/firmId/tenant key per SEC-2)"
      rationale: "Load-bearing DTO both API and page consume + the workspace-key injection guard. mvp-critical; not thinnable."
    - ac: "AC-3 — deterministic RLS-isolation + RBAC-deny + WORM-intact tests, authored test-first (sibling 770ab1c4)"
      rationale: "Proves foreign-workspace admin sees zero records + RBAC fail-closed + verifyChain-ok-after-browse. Cutting it guts the security floor of a compliance-first milestone. mvp-critical; never thin."
  acs_to_split:
    - ac: "Page UNIFICATION — merging the (already-shipped) audit-log browse and the new deal-activity browse into ONE unified Records page under a record-type toggle/tabs + a single shared filter bar re-consuming the existing GET /compliance/audit-log read through the page's proxy pattern"
      rationale: "Traces to metric clause 'retained records are viewable in-app.' The audit half is ALREADY viewable in-app (AuditLogTable ships live); the metric's unshipped remainder is only the deal-activity half, which the kept ACs (standalone deal-activity browse page + API + contract + tests) fully satisfy. Unifying two already-independently-viewable surfaces under one toggle is a UX-cohesion redesign layered on a shipped surface — not new success-metric coverage. If absent, the metric is still satisfiable (both record types remain viewable, just on their two existing/new pages). Nice-to-have."
      sibling_task_seed:
        title: "Unify the audit-log + deal-activity browses into a single firm-admin Records page (record-type toggle + shared filter bar)"
        description: |
          The M10 records-VIEW vertical ships the deal/pipeline-activity browse as its own
          firm-admin page (this wave) alongside the already-live audit-log browse
          (AuditLogTable -> GET /compliance/audit-log). Both record types are then viewable
          in-app on their respective pages, satisfying the success metric's "viewable in-app"
          clause. This follow-up improves UX cohesion: tie BOTH record types under one
          unified Records page (apps/web/app/(app)/compliance/records) with a record-type
          toggle/tabs + a single shared filter bar (type, actor, mandate, from/to date,
          pagination) that re-consumes the existing audit-log read for the audit half and the
          new deal-activity list read for the deal half through the non-page-colliding proxy
          pattern already used by AuditLogTable.
          Acceptance sketch: one Records page renders both record types under a toggle/tabs;
          shared filter bar drives both reads; existing audit-log page either redirects into
          the unified view or is retired; NO new API, NO new migration, READ-ONLY preserved
          (no mutation/edit/delete/purge affordance); WCAG 2.2 + design-system tokens.
          Orchestrator INSERTs as tasks row: milestone_id = 033f97e0-bc25-48dd-bb5a-b2f2be5b056a,
          wave_id = NULL, parent_task_id = d573e7bf-30e8-4eb2-9bba-2b1588f69578.

over_cut_rationale: |
  n/a

ok_rationale: |
  n/a
floor_constraint_active: false
floor_constraint_detail: |
  FLOOR PROXIMITY FLAGGED (head-product weigh at merge). This bundle is single-spec
  (milestone sizing ~1,500-3,000 net LOC, single vertical), so the applicable floor is
  the single-spec > 1,500 LOC minimum. The kept set (deal-activity API [largest chunk] +
  standalone browse page + Zod contract + RLS/RBAC tests) is estimated ~1,250-2,550 LOC;
  the unification delta I propose to split (record-type toggle/tabs + re-wiring the
  existing audit-log read into a shared page + cross-shape filter-bar reconciliation) is
  a modest ~250-450 LOC UI slice. Residual after split therefore lands ~1,000-2,300 LOC —
  clears the 1,500 floor on the upper half of the band but could dip below it in the
  conservative case. The split is NOT floor-blocked (I am emitting THIN, not floor-OK),
  but head-product should confirm the deal-activity API+page+contract+tests estimate
  clears 1,500 before INSERTing the sibling; if it does not, keep unification in-wave to
  hold the floor (that call is head-product's, not mine).

sibling_visible: false

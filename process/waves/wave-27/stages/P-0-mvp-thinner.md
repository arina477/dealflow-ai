verdict: OK
verdict_source: mvp-thinner
milestone_id: 033f97e0-bc25-48dd-bb5a-b2f2be5b056a
milestone_title: M10 — Advanced compliance & recordkeeping (SOX/FINRA artifacts)
milestone_class: product-feature
milestone_success_metric: |
  LIGHT posture (founder 2026-07-07): a firm admin can, on demand, export a
  complete workspace-scoped, integrity-verifiable record of the firm audit log
  + deal activity in a standard portable format (the export is itself
  audit-logged); retained records are viewable in-app and bounded by a
  configurable retention window. No formal regulator certification required at
  this stage; raise to a named-regime target only if the compliance
  classification is later raised.
mvp_critical_status: |
  M10's export vertical (vertical 1 of 3) is unshipped — both wave-27 tasks are
  status='todo'. The metric's on-demand-export half maps 1:1 to this bundle;
  RETENTION (vertical 2) and records VIEW (vertical 3) are separate future
  bundles under the same milestone. No mvp-critical export scope is yet done.

# Trace test applied to every proposed AC dimension. The metric text is
# unusually prescriptive — it enumerates the export's required contents inline
# ("complete ... audit log + deal activity", "integrity-verifiable", "the export
# is itself audit-logged"), so most AC dimensions resolve to KEEP by literal
# quotation, not judgment.

ac_trace:
  - dimension: RBAC firm-admin gating + M8 RLS workspace-scoping (endpoint + page)
    trace: "Cut breaks 'workspace-scoped' in the metric AND guts the security floor (cross-workspace leakage). Floor."
    disposition: KEEP
  - dimension: audit-log export (CSV/JSON of audit_log_entries)
    trace: "Cut breaks 'record of the firm audit log'. Core."
    disposition: KEEP
  - dimension: deal/pipeline activity export
    trace: "Metric literally reads 'audit log + deal activity'. Absent it, metric NOT satisfiable. Core — NOT thinnable despite being the obvious first split candidate."
    disposition: KEEP
  - dimension: HMAC-chain integrity-verification (endpoint verifyChain + tamper-fail) and the UI integrity result
    trace: "Metric says 'integrity-verifiable'; the LIGHT metric names integrity explicitly. Cut guts the compliance wedge. Floor."
    disposition: KEEP
  - dimension: export action itself audit-logged
    trace: "Metric parenthetical: '(the export is itself audit-logged)'. Verbatim. Floor."
    disposition: KEEP
  - dimension: minimal firm-admin UI (format pick -> export -> download -> integrity result)
    trace: "Without a UI the export is API-only and not usable by a non-technical firm admin; the metric frames it as an admin who 'can export'. Core (the user-facing half of the on-demand-export criterion)."
    disposition: KEEP
  - dimension: BOTH CSV AND JSON in v1
    trace: "Metric says 'a standard portable format' (singular). A single format satisfies the metric; the second is nice-to-have — the ONLY genuinely thinnable AC in the bundle."
    disposition: THINNABLE-BUT-FLOOR-BLOCKED
  - dimension: date-range / filter controls
    trace: "Not proposed in either task's ACs. Nothing to thin. (Filters belong to vertical-3 records VIEW, correctly out of scope here.)"
    disposition: NOT-PROPOSED

ok_rationale: |
  Every AC in this bundle except one traces cleanly to the milestone's LIGHT
  success metric — most by literal quotation ("complete ... audit log + deal
  activity", "integrity-verifiable", "the export is itself audit-logged") or as
  the RBAC+RLS security floor. The single thinnable AC (shipping BOTH CSV and
  JSON when the metric only requires "a standard portable format") is refused on
  floor + coherence grounds (see floor_constraint_detail). This is already the
  minimum coherent vertical slice for the export half of the metric; no valuable
  peel-off exists. Note for head-product (not a THIN proposal): deal/pipeline
  activity is often the reflexive first split candidate here, but the metric
  enumerates it verbatim ("audit log + deal activity"), so it is mvp-critical and
  stays.
floor_constraint_active: true
floor_constraint_detail: |
  The one thinnable AC is the second export format (JSON), deferrable because the
  metric requires only "a standard portable format" (singular). It is NOT split
  out for two reasons:
  (1) Coherence: CSV and JSON share one serializer branching off a common
  row-projection over the same RLS-scoped query, HMAC-verify path, and
  audit-logging path. Splitting JSON into a sibling removes a single format
  branch, not a coherent surface — residual work (endpoint, RLS, integrity,
  audit-logging, UI) is unchanged, so the split yields near-zero LOC reduction
  and a redundant second wave that re-touches the same controller + serializer.
  (2) Floor: this is a 2-task vertical slice (endpoint + page) sized at/near the
  multi-spec floor already. Peeling one format branch would push residual wave
  LOC below the applicable floor per P-1-decompose § Minimum size floor without
  buying a smaller coherent milestone slice. Emitting OK rather than THIN per the
  mvp-thinner floor-awareness pre-check.

sibling_visible: false

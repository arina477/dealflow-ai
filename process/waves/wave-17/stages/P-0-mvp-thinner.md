verdict: OK
verdict_source: mvp-thinner
milestone_id: 9ed98c3c-8cb8-4736-8337-22dc0dae48d4
milestone_title: M8 — Pilot-partner workspace (data isolation)
milestone_class: product-feature
milestone_success_metric: |
  ## Success metric — "_TBD by founder_" — target: the design-partner firm
  operates in an isolated workspace with no cross-firm data visibility.
  (Quantitative target founder-deferred; the QUALITATIVE target — "no cross-firm
  data visibility" — is present, testable, and anchors the negative-read proof.
  Per product-decisions.md #359/#371, the scope-too-vague guard did NOT fire:
  ## Scope is richly enumerated with live ## References, so thinness analysis is
  valid against the qualitative isolation target.)
mvp_critical_status: |
  4 of 4 still pending (0db154ff, e45ba68c, 96026365, df2f3b2f all status='todo').
  This is M8's FIRST vertical — no isolation scope shipped yet.

# ---------------------------------------------------------------------------
# OK rationale — atomic isolation vertical; every AC traces to the metric floor
# ---------------------------------------------------------------------------
ok_rationale: |
  All four ACs are the smallest coherent subset that satisfies "no cross-firm
  data visibility." They form one indivisible vertical where thinning ANY piece
  breaks the mvp-critical claim — and for a confidentiality feature a
  half-isolation that leaks is strictly worse than none. Trace test per AC:
  - 0db154ff (workspaces anchor + workspace_id column + backfill): the load-bearing
    spine. Remove it and there is no column to scope on — the metric is
    unsatisfiable. mvp-critical. KEEP.
  - e45ba68c (deny-by-default Postgres RLS on every tenant-scoped table): the
    isolation MECHANISM. The column (0db154ff) is inert without it. Remove it and
    a single missed WHERE clause leaks another firm's non-public deal data — the
    metric fails. mvp-critical. KEEP.
  - 96026365 (per-request SET LOCAL workspace GUC propagation): RLS keys off a
    per-session GUC that nothing else sets. Without propagation, deny-by-default
    RLS either denies everything (breaks the app) or, if mis-defaulted, leaks.
    The policy is only as good as the setting that feeds it. mvp-critical. KEEP.
  - df2f3b2f (cross-tenant negative-read integration test): the PROOF. Without an
    adversarial negative read you cannot claim "no cross-firm data visibility" —
    you can only claim you wrote code intending it. This is the hard acceptance
    gate on the partner go-live (product-decisions.md #360/#362, BOARD guardrail).
    mvp-critical. KEEP.

  RLS-scope split considered and REJECTED (the one candidate thinness): could
  e45ba68c ship RLS on high-sensitivity tables now (mandates/deals) and defer
  low-sensitivity tables to a sibling? No — fails the trace test. In an M&A
  confidentiality context there is no low-sensitivity tenant-scoped table:
  companies, contacts, match_run/candidates, outreach, and pipeline/pipeline_events
  each reveal deal activity, counterparties, or the fact of a mandate. Any table
  left un-RLS'd is a cross-firm leak that breaks the absolute "no cross-firm data
  visibility" target. Worse, the seed (0db154ff) makes workspace_id NOT-NULL on ALL
  these tables and the negative-read test (df2f3b2f) asserts ZERO cross-workspace
  rows "across the tenant-scoped tables (mandates/companies/contacts/matches/
  outreach/pipeline)" — a table carrying the column but no RLS is a false-isolation
  surface the proof would (correctly) fail on. Splitting RLS coverage would ship a
  wave that CLAIMS isolation but leaks: an OVER-CUT outcome, the worst result for a
  confidentiality feature. No AC is nice-to-have; nothing to peel off.

  No cross-milestone concern: full multi-tenant SaaS + billing is correctly
  M11/H3 (todo), not smuggled into this wave. No new ACs proposed (that is
  ceo-reviewer's lane). Scope is well-classified as-is.

floor_constraint_active: false
floor_constraint_detail: |
  n/a — OK was reached on merit (atomic vertical), not because a floor blocked a
  THIN. For reference, no split was even a candidate, so the residual-LOC
  pre-check is moot; the bundle is estimated ~2,000–3,200 LOC / ≤~25 files
  (product-decisions.md #371), comfortably clearing the multi-spec floor.

sibling_visible: false

verdict: PROCEED
verdict_source: problem-framer
matched_antipatterns: []
sibling_visible: false
reasoning: |
  Framing is sound and every load-bearing claim verified against the shipped schema.
  Symptom-vs-cause: the real need ("advisors see their analytics") has a genuine causal
  root — the data for all 4 metric families is already live but has no read path; the
  proposed read-only-aggregation -> typed-API -> dashboard attacks that exact cause, no
  symptom-layer patching. Wrong-layer check clears: aggregation belongs in the service
  layer reached via the GUC-bound getDb handle precisely BECAUSE isolation is enforced at
  the DB RLS layer, so per-firm scoping is inherited for free. Sequencing verified — all 4
  source tables exist and are independent of the founder-gated CRM adapter, so analytics is
  buildable standalone. The M8 isolation check is correctly framed and load-bearing; the only
  bypass vector (raw-pool query outside the GUC / superuser connection) is already structurally
  guarded and is a T-8 test invariant, not a framing defect.

schema_verification: |
  All framing claims checked against apps/api/src/db/schema + migration 0014_workspace_isolation.sql:
  - mandates (mandate.ts:78, workspace_id NOT NULL), outreach (outreach.ts:350, workspace_id NOT NULL),
    pipeline + pipeline_events (pipeline.ts:146/340, workspace_id NOT NULL),
    match_candidates (matching.ts:233) with match_candidate_disposition enum accepted/rejected
    (matching.ts:76) — all 4 metric families are computable over EXISTING live data.
  - Migration 0014 STEP 5 puts all tenant tables under ENABLE + FORCE ROW LEVEL SECURITY, so a
    SELECT under the non-superuser dealflow_app role returns only the workspace's rows automatically.
  - getDb(this.db) (workspace-context.ts:55) is the established ALS/GUC-bound handle — the safe
    aggregation path. assertNonSuperuserConnection() (main.ts:32) fails boot loudly if connected
    as superuser/BYPASSRLS, closing the bypass vector at the infra layer.
  - No prior analytics/insights code exists — greenfield surface, no wrong-problem duplication.

proposed_reframe: |
  (not applicable — PROCEED)

notes_for_downstream:
  - "GUC NAMING DEFECT (P-2 must fix): seed prose says app.current_workspace_id; the actual
     GUC set by the interceptor is app.workspace_id (workspace.interceptor.ts:126 SELECT
     set_config('app.workspace_id',$1,false); confirmed in workspace-guc.spec.ts:134). Spec
     MUST specify app.workspace_id — using the prose name would ship a broken read (RLS
     predicate reads app.workspace_id, an aggregation setting a different GUC would return zero
     rows or, worse, unscoped rows if the fallback default leaks). Spec-accuracy, not a framing
     error, but it becomes an implementation bug if uncorrected."
  - "ISOLATION INVARIANT (T-8 must test): the load-bearing invariant is that EVERY aggregation
     read runs through getDb (GUC-bound) — never a raw pool.query outside the request GUC, never
     a superuser/BYPASSRLS path. T-8 must assert a firm sees ONLY its own analytics (negative-read
     proof: seed a 2nd workspace's rows, assert they never appear in firm-A aggregates). A
     cross-firm analytics leak would be the worst regression right after M8 shipped isolation."
  - "EDGE-CASE COMPLETENESS (P-2 / mvp-thinner lane, antipattern #3 watch): spec must enumerate
     the empty-state firm (zero mandates/outreach -> division-by-zero on response-rate / accept-rate
     ratios; define the 0/0 -> null-or-zero display contract) and the RBAC-denied read path
     (advisor/compliance role scope). Not a framing reframe — AC-completeness for the spec author."
  - "PERF-CACHE GUARD: if P-3 introduces a materialized-summary cache table, it MUST also carry
     workspace_id + FORCE RLS (or be populated only via the GUC-bound path) or it re-opens the
     exact cross-firm leak RLS closes on the base tables. Additive-only; rollback = drop it."

disposition: PROCEED

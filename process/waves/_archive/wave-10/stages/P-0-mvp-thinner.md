verdict: OK
verdict_source: mvp-thinner
milestone_id: d72b4510-0ddb-4cf6-b494-ccbaa64aa633
milestone_title: M5 — AI buyer-seller matching, ranked + rationale
milestone_class: product-feature
milestone_success_metric: |
  For a mandate with a buyer universe, the system returns a ranked buyer list with
  integer fit-scores (0-100) + explainable rationale per buyer; an advisor can
  accept/reject to build a shortlist that hands off to outreach.
mvp_critical_status: |
  0 of 3 M5 tasks done; this is the FIRST M5 bundle (deterministic half). The LLM
  rationale clause of the metric is explicitly deferred to a later gated bundle
  (wave-9-close BOARD carry-forwards a–f). Operative sub-metric for THIS bundle:
  "ranked buyer list with integer fit-scores + advisor accept/reject → shortlist →
  hands off to outreach." Every remaining AC traces to that sub-metric floor.

ok_rationale: |
  This 3-task bundle is already the smallest coherent subset satisfying the
  deterministic half of M5's success metric — every AC traces cleanly to it, and
  the one theoretically-splittable AC (the 'flag' disposition control) rides free
  on infrastructure that is mvp-critical regardless, so peeling it would add
  coordination cost without removing meaningful scope.

  Per-AC trace against the (verbatim) success metric:

  KEEP (mvp-critical):
  - Seed schema (match_run + match_candidates) + deterministic rule-based fit_score
    + ranked persist (47ed7ddd): IS the metric core — "a ranked buyer list with
    integer fit-scores (0-100)". Absent → metric unsatisfiable.
  - score-breakdown / component-provenance jsonb (part of seed): mvp-critical, NOT
    deferrable to a "score-only-first" sibling. In this LLM-free bundle the
    per-dimension breakdown is the SOLE explainability substrate — the page sibling's
    stated acceptance ("explainable from the deterministic components ALONE, no LLM
    rationale text") collapses without it, leaving unexplainable black-box integers.
    (problem-framer concurs: only sector + contact-completeness score against real M3
    data, so the breakdown is exactly where the discriminating rank is made legible;
    it is also the substrate the later LLM bundle reads.)
  - /matches-shortlist page (fb82d339): mvp-critical — the advisor must SEE the ranked
    list to accept/reject; absent, the metric's accept/reject clause is unreachable.
  - accept/reject disposition + build-shortlist roll-up (f74dce45): metric-named
    verbatim ("an advisor can accept/reject to build a shortlist").
  - ready-for-outreach handoff marker (f74dce45): metric-named ("hands off to
    outreach") — the M5/M6 milestone-bridge. A persisted status flip + accepted rows
    for M6 to consume is exactly the correct thin slice (actual outreach send is M6).

  CONSIDERED-FOR-SPLIT but KEPT (rides free on mvp-critical infra):
  - 'flag' disposition control (f74dce45): NOT named in the success metric
    (metric names only accept/reject). By the trace test, the metric IS satisfiable
    without a flag control → nominally splittable. NOT split because: the
    'flagged' enum value already lives in the seed's disposition column
    (pending/accepted/rejected/flagged) — the schema, the audited last-in-txn
    mutation path, the RBAC actor-id guard, and the shared-Zod disposition contract
    are all being built for accept/reject regardless. Peeling 'flag' removes only a
    UI toggle + one branch of an already-existing mutation (~40–80 LOC), so a sibling
    would add cross-task coordination cost exceeding the scope removed. Under
    "when in doubt, keep" and the mandate that this stage governs KIND-of-packed not
    size, flag is a legitimate ride-along, not gold-plating.

  Gold-plating scan (clean): disposition states are exactly the four the metric +
  handoff need; match_run lifecycle is bounded (pending/scored → shortlisted/
  ready_for_outreach); score dimensions are bounded to what M3 supports with
  graceful degradation on absent dimensions (no speculative dimension coverage).
  No AC builds depth on an unshipped surface (the page reads the seed's persisted
  state; the handoff extends the same UI) and none builds polish/extensibility
  ahead of demand — the LLM-rationale extensibility is correctly OUT (deferred
  bundle, not a this-bundle AC).

floor_constraint_active: false
floor_constraint_detail: |
  N/A. Floor did not drive this verdict. For completeness: bundle est. net
  ~2,800–4,200 LOC across 3 specs (multi-spec, floor = >2,500 LOC OR ≥6 specs).
  The only nominally-splittable AC (flag control) is ~40–80 LOC already resident on
  the accept/reject mutation path; residual after a hypothetical split (~2,760–4,160)
  stays above floor, so the floor is not the reason flag was kept — the ride-along
  argument is. This is a genuine OK, not a floor-blocked THIN.

sibling_visible: false

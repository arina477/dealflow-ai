verdict: PROCEED
verdict_source: problem-framer
matched_antipatterns: []
sibling_visible: false
symptom_vs_cause_check: |
  MANDATORY check — result: PASS (right causal insight, not a symptom-layer or vanity metric).
  The wave asks "is the deterministic fit_score actually predictive of advisor accept/reject?"
  That is the cause-layer question for a matching-feedback loop: it correlates the scorer's
  output (fit_score 0-100 + score_breakdown dims) against the ground-truth advisor signal
  (disposition). It is NOT a symptom-layer proxy (e.g. "count of accepts") and NOT an
  uncomputable vanity metric — both correlands are real, NOT NULL, and co-populated on every
  'scored'-run candidate row.
reasoning: |
  Every framing risk called out for this wave clears against the real code.

  COMPUTABILITY (the wave-18 karen lesson — an uncomputable vanity metric was caught there):
  All three correlands EXIST in apps/api/src/db/schema/matching.ts on the match_candidates table:
    - disposition — pgEnum ['pending','accepted','rejected','flagged'], NOT NULL default 'pending' (matching.ts:76-81, :270)
    - fit_score  — integer NOT NULL, CHECK 0-100 (matching.ts:253, :313)
    - score_breakdown — jsonb $type<ScoreBreakdown> with sectorMatch/contactCompleteness/tieBreak/total/notApplied (matching.ts:256-263)
  Because fit_score is NOT NULL and disposition is NOT NULL, every candidate in a 'scored'
  run carries BOTH a score AND a disposition — the correlation is over real, co-populated
  columns, not a metric that needs a column that does not exist. Computable. Not vanity.

  ISOLATION (post-M8/wave-18): The workspace-scoped framing is not only correct, it is the
  ALREADY-SHIPPED pattern. apps/api/src/modules/analytics/analytics.repository.ts already runs
  getDb(this.db) -> set_config('app.workspace_id', ...) -> FORCE RLS over match_candidates,
  including a getMatchDisposition() that groups match_candidates by disposition workspace-scoped
  (analytics.repository.ts:7-11, :190-222). MatchFeedbackService reuses a tested pattern; the
  "no cross-firm leak" framing is load-bearing and correctly stated.

  NO MODEL-RETRAIN SMUGGLE: The seed is read-only aggregation/display. The schema module carries
  an explicit hard boundary — "NO Anthropic/Claude/LLM import or call ... Scoring is pure
  deterministic" (matching.ts:41-45). Calibration DISPLAY of predictiveness does not touch the
  scorer; it does not retrain it. The decomposer's read-only scoping holds; no LLM/founder-gated
  work is hidden inside the vertical.

  TASK-LEVEL: (1) SEED 5568ad44 — sound; reuses wave-18 analytics repo pattern.
  (2) 69387b56 shared-Zod contracts — standard vertical layer, no framing issue.
  (3) e206a56a RBAC-scoped read API (advisor+admin) — read-only, matches the compliance-first
  RBAC posture; no SoD concern for a read surface. (4) 077974a2 /insights section — the /insights
  dashboard already exists (apps/web/app/(app)/insights/page.tsx from wave-18), so task 4 is a
  section-add reuse; design_gap is almost certainly FALSE (D-block likely skippable — P-1/D-1 to confirm).

  No antipattern in the catalog matches. Symptom-vs-cause passes. PROCEED.
notes_for_downstream: |
  - Milestone M9 success metric is _TBD. Not a framing defect (framing is sound regardless), but
    ceo-reviewer's ambition lens and P-2 acceptance-criteria authoring should pin a concrete,
    computable success metric so this does not ship as an unmeasurable insight tile.
  - Statistical honesty (advisory, for P-2 ACs not framing): with small n the accept-vs-fit_score
    correlation can be noisy. Recommend P-2 require an n-threshold / "insufficient data" empty-state
    so the calibration tile does not display a spurious correlation on a near-empty workspace. This
    is the demo-path/empty-state guard applied to a DISPLAY, not a REFRAME trigger.
  - design_gap for task 4 expected FALSE (reuse of existing /insights page) — flag for P-1.
  - Sizing (4 tasks, coupling) is out of scope here — deferred to P-1 per contract.
proposed_reframe: |
  (n/a — PROCEED)
escalation_reason: |
  (n/a — PROCEED)

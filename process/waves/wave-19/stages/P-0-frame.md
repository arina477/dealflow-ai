# Wave 19 — P-0 Frame

## Discover
- wave_db_id: f0a31804-41d0-48dc-9237-15590d173b4b (wave_number 19, milestone M9)
- Prior-work: M8 data-isolation + M9 analytics half (wave-18 /insights) shipped LIVE. This is M9's "matching feedback loop" thread — a near-clone of the wave-18 analytics vertical over shipped match_candidates data. The founder-gated CRM adapter (345dfbc6) stays deferred (decomposer founder-guard held).
- Roadmap milestone: M9 — Integrations & insight (in_progress, Class product-feature, T4). Success metric _TBD-by-founder (poll before M9 close — ceo-reviewer).
- Spec-contract short-circuit: no-prior-spec (decomposer prose) → full P-1..P-3.
- Product decisions: read-only calibration DISPLAY only — NO scorer-retrain/ML (that's LLM/founder-gated, deferred; the matching.ts "NO LLM" boundary). Credential-free.

## Reframe
### Original framing
Matching-feedback calibration vertical: (seed) MatchFeedbackService correlating match_candidates.disposition × fit_score × score_breakdown (sectorMatch/contactCompleteness/tieBreak) → calibration insight; shared contracts; RBAC API; /insights calibration section.

### problem-framer — PROCEED
disposition + fit_score + score_breakdown all EXIST + co-populated (NOT NULL) on match_candidates → the calibration correlation is COMPUTABLE (not a vanity metric — the wave-18 karen lesson applied + verified against matching.ts). Workspace-isolation reuses the shipped wave-18 getDb+GUC+FORCE-RLS pattern. Read-only DISPLAY, NO scorer-retrain smuggle (matching.ts "NO LLM" hard boundary). /insights exists → task-4 design_gap false. No antipattern; symptom-vs-cause passes ("does the score predict advisor accept/reject" is the right causal calibration insight, not vanity).

### ceo-reviewer — PROCEED (HOLD-SCOPE)
M9's single best buildable/credential-free slice; traces to the live AI-matching bet. Ambition calibrated: per-score-dimension acceptance-lift is IN the bundle → 9/10 actionable (does sectorMatch/contactCompleteness track acceptance?), NOT a 3/10 vanity chart; model-retrain correctly EXCLUDED (founder-gated). Isolation central (per-firm FORCE-RLS). Watch-item (P-4/milestone-close, not a wave-19 blocker): the M9 _TBD quantitative metric should be founder-polled before M9 is called done.

### mvp-thinner — OK (no split)
The only thinness surface (per-dimension lift, family 2 in the seed) is UNSAFE to peel: _TBD/unratified metric + score_breakdown data already live (wave-17) + per-dimension lift is a near-free same-join GROUP-BY (not gold-plating) + plausibly part of the "calibration" mvp-critical claim (cutting risks OVER-CUT). Same 4 factors that got the analogous wave-18 THIN rejected. The 4-task vertical is the minimum coherent slice. No THIN to mediate against ceo-reviewer.

### Disposition: PROCEED
All-PROCEED/OK, no split, no conflict (mvp-thinner OK → no split to mediate). Final framing → P-1: 4-task matching-feedback calibration vertical, ALL calibration dimensions kept (overall + per-dimension lift), workspace-scoped (getDb + app.workspace_id GUC, RLS-honoring — the wave-18 constraint; cross-firm calibration leak is the load-bearing regression guard, T-8), read-only DISPLAY (no scorer-retrain), no gold-plating (no charts-lib/real-time/export), computable over the real match_candidates columns. design_gap_flag: false (a section on the existing /insights page, reusing the wave-18 dashboard + design system). _TBD metric = founder-poll before M9 close.

claimed_task_ids: [5568ad44-3702-46d5-809a-40c1de0a2035 (seed), 69387b56-2366-4343-809d-3a6e75129753, e206a56a-b98a-4533-b31e-ba91fae6327e, 077974a2-9be9-4a29-a13e-6ac1d7b78e35]

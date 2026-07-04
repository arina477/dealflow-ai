# Wave 10 — P-0 Frame

## Discover
- wave_db_id: d09d928c-9f6b-4d3e-be6f-812a0f8956b8 (wave_number 10)
- Prior-work: reuses M4 buyer_universe + buyer_universe_candidates (submitted status = the ready-to-rank handoff; the score/rank columns M4 deliberately omitted [M4/M5 boundary] go on the NEW match_candidates), M3 companies.sector + contacts (score inputs), M4 mandate_buyer_criteria (score dims), M1 RolesGuard/getUserWithRole, M2 AuditService, wave-9 unsupportedDimensions graceful-degradation pattern. No prior wave built matching.
- Roadmap milestone: M5 "AI buyer-seller matching" (d72b4510…, in_progress, product-feature, T2, FLAGSHIP differentiator). wave.milestone_id backfilled. This bundle = the DETERMINISTIC half of M5's metric (ranked list + fit-scores + accept/reject shortlist; LLM rationale = later bundle).
- Spec-contract short-circuit: **no-prior-spec** (prose seeds) → full P-1..P-3.
- Product decisions: no Tier-3 THIS bundle (deterministic, ZERO LLM/SDK/spend). The LLM-spend Tier-3 is a LATER M5 bundle (BOARD-gated at wave-9 N-3). 
- Designs: matches-shortlist.html EXISTS → design_gap likely FALSE (D skips; confirm at P-1).

## Reframe
- **Original framing:** deterministic match spine — match_run (FK mandates + buyer_universe, one per submitted universe) + match_candidates (FK buyer_universe_candidates, integer fit_score 0-100, score-breakdown jsonb, disposition) + MatchingService (reads submitted buyer_universe → deterministic rule-based fit_score → ranked) + /matches-shortlist page + accept/reject/flag → shortlist → ready-for-outreach handoff. RBAC advisor-primary; audited; actor-id. NO LLM/BullMQ/rationale-text (later bundle).
- **problem-framer:** PROCEED — deterministic spine attacks the root cause (M4 tables verifiably carry no score column; scoring belongs on the new match_candidates); deterministic-first/LLM-deferred + M5/M6 boundaries correctly drawn + held; score-breakdown jsonb justified (explainability + later-LLM substrate, not premature). NOTE (→P-2/P-3): only sector + contact-completeness score against real M3 data (companies has no geo/size/deal_type) — the spec MUST specify weighting/tie-breaks so the ranking is meaningfully discriminating (not everything-scores-similar).
- **ceo-reviewer:** PROCEED (HOLD-SCOPE) — the correctly-sized load-bearing first slice of the FLAGSHIP M5 differentiator; deferring the LLM-rationale layer to its own gated wave is strategically + compliance-native correct (honors the wave-9-close BOARD ruling: SDK + spend + zero-retention-DPA + load-test gates); the score-breakdown gives real explainability → ~7/10 shippable base setting up 10/10 (NOT a hollow 3/10); match_run/score-breakdown = the LLM's low-rework substrate.
- **mvp-thinner:** OK — smallest coherent AC set for the deterministic half; schema + scoring + ranked-persist + score-breakdown (non-deferrable explainability substrate) + page + accept/reject/handoff all metric-traced + mvp-critical; the one nominally-splittable AC ('flag', not metric-named) rides free on the accept/reject path — splitting adds coordination cost without removing scope. No gold-plating.
- **Mediation:** none needed.
- **Sibling task IDs created:** none this stage (page/shortlist pre-split at N-2).
- **Disposition:** PROCEED (all 3 aligned).
- **Final framing:** ship the deterministic match spine (match_run/match_candidates + rule-based fit_score + ranked persist + score-breakdown) + /matches-shortlist page + accept/reject/flag + ready-for-outreach handoff. Carry problem-framer's weighting/tie-break note into P-2/P-3 (meaningful discrimination on thin M3 data). Police BOTH boundaries: deterministic-only (NO LLM/BullMQ/rationale/spend — later bundle) + M5/M6 (handoff to outreach, don't do outreach).

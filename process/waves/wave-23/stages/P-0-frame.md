# Wave 23 — P-0 Frame

## Discover
- wave_db_id: f199503b-6f20-4e19-83ab-8a2d5d814209 (wave_number 23, milestone M9). Seed 9e54cc11 + 3 siblings (seller-intent vertical). The LAST buildable credential-free M9 thread (analytics/calibration/outreach-log shipped; CRM blocked; #141 gated).
- Roadmap milestone: M9 — Integrations & insight (in_progress, Class product-feature). Success metric _TBD (NOW DUE — this is the last M9 vertical before M9 could close; poll flagged).
- Spec-contract: decomposer-authored rich seed → full P-1..P-3.

## Reframe
### Original framing
Deterministic read-derived per-mandate seller-intent score (0-100) + breakdown over outreach_activity/pipeline_events/match_candidates. Pure NO-LLM scorer (mirror matching.scorer.ts) + workspace-scoped service + shared-Zod + RBAC read API + /insights UI. Read-only.

### problem-framer — REFRAME (tieBreak fix)
Causally sound (computability + purity + RLS + no-ghost-dep confirmed against the schema). BUT the acceptance sketch surfaces `tieBreak` (a hash-of-mandate-id) in the USER-FACING breakdown AND folds it into the 0-100 score — repeating the wave-19 / PRODUCT-PRINCIPLES #1 noise-as-signal violation (a deterministic tiebreaker shown as if it's intent signal is misleading). **FIX: keep any tiebreak INTERNAL to query-layer ordering only — NEVER a scored or surfaced dimension.** The score + surfaced breakdown = the 3 REAL signals only.

### ceo-reviewer — SELECTIVE-EXPANSION (trend/direction)
The seed's value promise is "which mandates are HEATING UP vs COOLING" — a static 0-100 number doesn't deliver direction. **ADD a deterministic direction/trend indicator (heating | cooling | flat)** derived from the recency/velocity signals already in scope (a windowed delta of the same score, still pure/deterministic — windowed against a caller-supplied reference instant, NOT Date.now() inside the scorer). Near-zero extra inputs (reuses outreachEngagement recency + pipelineVelocity). NO-LLM boundary confirmed correct (a reproducible auditable rule-based score beats a black-box LLM guess for compliance-first; LLM path founder-gated anyway). Guard against weight-tuning/LLM-inference over-build. **M9 _TBD success-metric poll is now DUE** (before M9 closes).

### mvp-thinner — OK (no split; tieBreak-exclude)
_TBD metric unratified → no formal thinness trace (hard-rule OK+flag). The 3 real signals (outreachEngagement/pipelineVelocity/matchDisposition) are each load-bearing "why is this deal hot" evidence — splitting one is OVER-CUT-ward. tieBreak is a sort-stabilizer, not an intent signal → exclude from / non-evidence-label in the surfaced breakdown (agrees with problem-framer).

### Disposition: PROCEED (with the tieBreak-reframe + the trend-expansion)
Final framing → P-1:
1. **tieBreak: REMOVE from the score dimensions + the user-facing breakdown.** At most an internal deterministic query-ordering stabilizer (or drop). Surfaced breakdown = {outreachEngagement, pipelineVelocity, matchDisposition, total, notApplied} — the 3 REAL signals.
2. **ADD a deterministic direction/trend indicator (heating|cooling|flat)** — a windowed delta of the score, pure/deterministic (caller-supplied reference instant, NO Date.now() inside), reusing the recency/velocity signals. Keep MINIMAL (a direction enum + its windowed basis, NOT a full time-series subsystem). P-1/P-4 right-sizes.
3. Keep the 3 real signals; workspace-scoped read-only; NO-LLM/pure.

## LOAD-BEARING invariants:
- workspace-scoped-via-getDb (own-firm only, no cross-firm leak — the wave-18/19/20 pattern; scorer service reads mandates/outreach_activity/pipeline_events/match_candidates under RLS FORCE, fail-closed if GUC null)
- PURE + DETERMINISTIC (NO Anthropic/LLM/OpenAI/SDK/network/credential/randomness; NO Date.now() INSIDE the scorer — recency + the trend window use a caller-supplied reference instant or max-event-ts passed in; identical inputs → identical output — unit-testable)
- computable-over-real-columns (PRODUCT #1 — the score inputs exist in outreach_activity/pipeline_events/match_candidates; problem-framer confirmed)
- NO tieBreak-as-a-surfaced-signal (PRODUCT #1 / wave-19 lesson)
- structured-breakdown-not-prose; read-only (no mutations → no audit rows, like analytics); credential-free / no-ghost-dep-on-345dfbc6-or-#141
- empty-data boundary safe (mandate with 0 outreach / 0 pipeline events → a defined score/notApplied, no crash/div-by-zero)

## design_gap_flag: likely false (the /insights seller-intent surface reuses the analytics/calibration dashboard + card patterns) — P-1 confirms.
claimed_task_ids: [9e54cc11 (scorer+service seed), 1188e7da (contracts), 12947422 (RBAC API), 6840c25d (/insights UI)]
## FOUNDER FLAG (non-blocking, → digest + wave-23 N-block): M9 _TBD quantitative success metric poll is DUE before M9 closes (this is M9's last buildable vertical).

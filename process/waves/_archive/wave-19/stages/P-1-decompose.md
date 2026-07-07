# Wave 19 — P-1 Decompose (multi-spec: M9 matching-feedback calibration, 4 blocks)

## Maximum-rubric (err-high) — NO SPLIT
| Measure | Threshold | Estimate | Trips? |
|---|---|---|---|
| Files touched | >60 | ~15-25 (MatchFeedbackService + repo [workspace-scoped correlation queries] + shared Zod + API controller + /insights section + tests) | no |
| New primitives | >60 | ~7-10 | no |
| Net LOC | >5,000 | ~2,500-2,800 | no |
| Stage-4 working set | >350K | under | no |
→ no split.

## wave_type + floor
- claimed_task_ids.length = 4 → **multi-spec**
- floor >2,500 LOC OR >=6 specs: ~2,500-2,800 LOC (overall disposition×fit_score correlation + per-dimension lift [sectorMatch/contactCompleteness/tieBreak] + the shared contracts + RBAC API + /insights section + real-DB workspace-scoped tests + the cross-firm negative-read proof) → **floor MET by LOC**. **Verdict: PROCEED.**

## Bundle (claimed_task_ids = 4)
- SEED 5568ad44 — MatchFeedbackService: workspace-scoped calibration (disposition × fit_score × score_breakdown → is-the-score-predictive + per-dimension acceptance-lift)
- 69387b56 — shared-Zod match-feedback contracts
- e206a56a — RBAC-scoped match-feedback API (advisor+admin read)
- 077974a2 — /insights score-calibration section

## design_gap_flag
```yaml
design_gap_flag: false
missing_surfaces: []   # a SECTION on the existing wave-18 /insights dashboard, reusing the shipped design-system cards + the analytics page pattern — no net-new visual paradigm.
```

## Self-consistency
CLEAN. LOAD-BEARING: workspace-scoped-calibration-via-getDb (cross-firm-negative-read T-8 — a firm's calibration only over ITS matches), computable-over-real-columns (disposition/fit_score/score_breakdown — the wave-18 vanity-metric lesson), read-only (no scorer-retrain), RBAC-scoped, no-gold-plating. design_gap false.
```yaml
verdict: PROCEED
wave_type: multi-spec
claimed_task_ids: [5568ad44-3702-46d5-809a-40c1de0a2035, 69387b56-2366-4343-809d-3a6e75129753, e206a56a-b98a-4533-b31e-ba91fae6327e, 077974a2-9be9-4a29-a13e-6ac1d7b78e35]
floor_merge_attempt: 0
design_gap_flag: false

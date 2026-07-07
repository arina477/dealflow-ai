# Wave 23 — P-1 Decompose (multi-spec: M9 seller-intent, 4 blocks)
## Maximum-rubric (err-high) — NO SPLIT
| Measure | Threshold | Estimate | Trips? |
|---|---|---|---|
| Files touched | >60 | ~15-25 (scorer + service + repo [workspace-scoped per-mandate queries over 3 sources] + shared Zod + API controller + /insights UI + determinism/empty/cross-firm tests) | no |
| New primitives | >60 | ~8-12 (scorer, 3 signal fns + trend, service, API endpoint, UI surface) | no |
| Net LOC | >5,000 | ~2,800-3,600 | no |
| Stage-4 working set | >350K | under | no |
→ no split.
## wave_type multi-spec (4 tasks). floor >2,500 LOC OR >=6 specs → ~2,800-3,600 LOC → **floor MET**. Verdict: PROCEED.
## Bundle: SEED 9e54cc11 (scorer+service) + 1188e7da (contracts) + 12947422 (RBAC API) + 6840c25d (/insights UI).
## design_gap_flag
```yaml
design_gap_flag: false   # /insights seller-intent surface reuses the wave-18/19 analytics/calibration dashboard + card/table patterns. B-3 design-gap fallback if a genuine gap surfaces.
```
## Self-consistency CLEAN. LOAD-BEARING: workspace-scoped-getDb (cross-firm-negative-read T-8), pure-deterministic-no-LLM-no-Date.now-inside, computable-over-real-columns, NO-tieBreak-surfaced (PRODUCT #1), trend-direction-deterministic, read-only, empty-data-safe.
```yaml
verdict: PROCEED
wave_type: multi-spec
claimed_task_ids: [9e54cc11-982c-4785-83bc-40eec206a8cc, 1188e7da-a16b-4aff-961c-a26015ad880c, 12947422-ceda-4127-8cdc-fd54cfbb28db, 6840c25d-3b18-4637-87d6-753ee9f460db]
design_gap_flag: false

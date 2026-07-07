# Wave 21 — P-1 Decompose (single-spec: M9 process/DX hardening — (C) CI-e2e-authoritative)

## Maximum-rubric — NO SPLIT (docs/process wave)
| Measure | Threshold | Estimate | Trips? |
|---|---|---|---|
| Files touched | >60 | ~2-3 (a testing artifact + a checklist/task note; maybe a test-writing-principles reference) | no |
| New primitives | >60 | 0 (no code) | no |
| Net LOC | >5,000 | ~120-250 (a doc) | no |
| Stage-4 working set | >350K | under | no |
→ no split.

## wave_type + floor
- claimed_task_ids.length = 1 → **single-spec** (no minimum floor — floor is a multi-spec concern).
- **Verdict: PROCEED** (reframed to (C) only per P-0).

## Bundle (claimed_task_ids = 1)
- SEED 1d95cac0 — the process/DX hardening task, SCOPED to (C): the CI-e2e-authoritative testing artifact + close B/D/E-by-PRODUCT-#1.

## design_gap_flag
```yaml
design_gap_flag: false   # docs/process wave, no UI. D-block SKIP.
```
## Self-consistency: CLEAN. Single deliverable: the falsifiable CI-e2e-authoritative declaration (named invariants + deferral rationale + later-trigger) + a B/D/E-closed-by-principle note. No code, no migration, no UI.
```yaml
verdict: PROCEED
wave_type: single-spec
claimed_task_ids: [1d95cac0-b396-40b7-8904-be0fa42aa3ab]
design_gap_flag: false
d_block: skip

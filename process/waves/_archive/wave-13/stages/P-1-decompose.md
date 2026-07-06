# Wave 13 — P-1 Decompose

## Maximum size rubric — NO threshold trips
| Measure | Estimate | Threshold | Trip? |
|---|---|---|---|
| Files touched | ~22-30 (audit-recordkeeping service/repo/controller + export-package builder + shared contracts + web page + components + tests; reads existing M2 audit) | >60 | NO |
| New primitives | ~10-14 (recordkeeping read/verify/export service + routes + export-manifest builder + shared schemas + page) | >60 | NO |
| Estimated net LOC | ~2,800 (head-next; mvp-thinner confirmed full-scope clears floor) | >5,000 | NO |
| Stage-4 working set | ~130-170K | >350K | NO |

## Wave type
- claimed_task_ids.length = 3 (36a17c81 seed + 20c479db + 10ee0ec4) → **multi-spec**.

## Minimum floor (multi-spec: >2,500 LOC OR ≥6 specs)
- ~2,800 net LOC > 2,500 → **floor MET**. (mvp-thinner: peeling the export DEPTH [PDF/triple-format/multi-regulation] would drop to ~1,850 below floor → floor_constraint_active; therefore keep the coherent vertical whole with ONE deterministic export format — the scope-held ~2,800 clears the floor.)

## Verdict: **PROCEED** (no split, no merge)

## design_gap_flag: **false**
- /compliance/audit-log page (sibling 10ee0ec4) → design/audit-log-export.html EXISTS (641 lines): filters (5), integrity/verify (7), export/download (7), hash-chain (3), integrity badge (18). Covers the page surface. Seed + export-package are backend (no UI surface). B-block builds to the mockup. No new mockup-less surface (same as waves 11/12).

```yaml
wave_type: multi-spec
verdict: PROCEED
claimed_task_ids: [36a17c81, 20c479db, 10ee0ec4]
floor_merge_attempt: 0
design_gap_flag: false
missing_surfaces: []
scope_hold: [real-AuditVerifier-shape {ok,entriesChecked,firstBreakAt,reason}, one-deterministic-export-format-v1 (defer PDF/multi-format/multi-regulation/background-jobs)]
```

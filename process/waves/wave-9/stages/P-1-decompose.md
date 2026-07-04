# Wave 9 — P-1 Decompose

## Maximum size rubric (all under → no split)
| Measure | Threshold | Estimate | Trip? |
|---|---|---|---|
| Files touched | >60 | ~25-35 (schema+migration 0008, BuyerUniverseService, controller, repo, shared, page + components, enrich service, tests) | no |
| New primitives | >60 | ~15-20 (2 tables + 1 migration + BuyerUniverseService + assemble/filter/enrich/submit + 4-5 endpoints + Zod + page) | no |
| Net LOC | >5,000 | ~3,000-4,500 | no |
| Stage-4 working set | >350K | under (reuse-heavy: M3 companies + M4 criteria + M1 RBAC + M2 audit + existing design) | no |

## Wave type + floor
- **claimed_task_ids:** [92a8ff3f (spine: schema+assemble+filter), 394a60ba (/buyer-universe page), c907731f (enrich+flag+submit)] = 3 → **multi-spec**.
- **Floor (multi-spec):** >2,500 LOC OR ≥6 specs. ~3,000-4,500 > 2,500 → **PASS**.

## Verdict: PROCEED
No split (under max), no merge (above floor). Coherent vertical (assemble→filter→page→enrich→submit) closing M4 (all 3 reframers aligned).

## design_gap_flag
```yaml
design_gap_flag: false
missing_surfaces: []   # design/buyer-universe.html exists (adopted); mounts on the wave-8 mandate-detail D6 placeholder anchors → D-block SKIPS → next block B
```

## Carry-forward (M4/M5 boundary — P-2/P-3 guardrail)
NO fit-scoring / ranking / rationale / LLM in this bundle — assemble (from M3 companies) + criteria-filter (by M4 mandate_buyer_criteria) + enrich (from M3 contacts) + flag gaps + submit-to-matching (ready-to-rank handoff). Ranking is M5's flagship. Reuse M3 companies/contacts (candidate source — no new store) + M4 criteria (no new filter DSL). Additive schema only (no changes to mandate spine or M3 tables). getUserWithRole actor-id; audit last-in-txn; RBAC analyst-primary.

```yaml
wave_type: multi-spec
verdict: PROCEED
floor_merge_attempt: 0
design_gap_flag: false
claimed_task_ids: [92a8ff3f, 394a60ba, c907731f]
siblings_created: []
```

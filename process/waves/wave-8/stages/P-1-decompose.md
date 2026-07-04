# Wave 8 — P-1 Decompose

## Maximum size rubric (all under → no split)
| Measure | Threshold | Estimate | Trip? |
|---|---|---|---|
| Files touched | >60 | ~25-35 (schema+migration, MandateService, controller, repo, 2 shared, 3 pages + components, tests) | no |
| New primitives | >60 | ~15-20 (3 tables + 1 migration + MandateService + 3-4 endpoints + Zod schemas + 3 pages) | no |
| Net LOC | >5,000 | ~3,400-4,300 | no |
| Stage-4 working set | >350K | ~well under (reuse-heavy: M1 RBAC + M2 audit/compliance tables + existing designs) | no |

## Wave type + floor
- **claimed_task_ids:** [ba0edebf (seed: mandate spine + create/configure), c070ca23 (mandates-list), 50227055 (mandate-detail)] = 3 → **multi-spec**.
- **Floor (multi-spec):** >2,500 LOC OR ≥6 specs. ~3,400-4,300 LOC > 2,500 → **PASS**.

## Verdict: PROCEED
No split (under all max thresholds), no merge (above floor). Bundle = the coherent create/list/detail vertical (ceo-reviewer HOLD-SCOPE + mvp-thinner OK confirmed).

## design_gap_flag
```yaml
design_gap_flag: false
missing_surfaces: []   # design/mandate-new.html + design/mandates-list.html + design/mandate-detail.html all exist (adopted) → D-block SKIPS
```
All 3 UI surfaces (mandate-new create form, mandates-list, mandate-detail) have adopted mockups in design/. Backend (schema/service/API) is non-UI. → D-block skips; next block B.

## Carry-forward (from P-0 problem-framer's 3 design-layer flags → P-2/P-3 guardrails)
1. Schema: justify 3 separate tables vs JSONB-on-mandates (normalization call — buyer_criteria + compliance_profile as FK'd tables enables the later buyer-universe filter + M6 gate read; document at P-2/P-3).
2. Capture-without-enforce: the mandate-new UI must NOT imply the compliance profile is ENFORCED here (enforcement is M6) — copy/UX must frame it as "captured for later gate" (D/P-2 note).
3. buyer-criteria dimensions: keep to the core 4 (industry/geo/size/deal-type) aligned to M3 canonical fields — no speculative DSL.

```yaml
wave_type: multi-spec
verdict: PROCEED
floor_merge_attempt: 0
design_gap_flag: false
claimed_task_ids: [ba0edebf-8509-46b2-b69f-f5458ba400fd, c070ca23-0a93-4432-9390-d54d54159935, 50227055-22b6-4457-a694-dbecff7497c3]
siblings_created: []
```

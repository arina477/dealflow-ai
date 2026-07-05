# Wave 12 — P-1 Decompose

## Maximum size rubric (split when over) — NO threshold trips
| Measure | Estimate | Threshold | Trip? |
|---|---|---|---|
| Files touched | ~40-55 (2 schema + PipelineService + repo + 2 controllers + module + shared contracts + migration 0011 + board page + timeline components + tests) | >60 | NO |
| New primitives | ~14 (pipeline + pipeline_events tables + stage enum + PipelineService + repo + board/timeline API routes + board page + timeline panel + shared schemas) | >60 | NO |
| Estimated net LOC | ~3,200 (head-next estimate) | >5,000 | NO |
| Stage-4 working set | ~150-200K (3 task specs + M2 audit/RBAC reuse docs + agent briefs) | >350K | NO |

## Wave type
- claimed_task_ids.length = 3 (07989285 seed + d1940142 + 45b259e1) → **multi-spec**.

## Minimum floor (multi-spec: >2,500 LOC OR ≥6 specs)
- ~3,200 net LOC > 2,500 → **floor MET**. (mvp-thinner's THIN split was rejected at P-0 partly BECAUSE splitting would drop to ~2,400-2,500 AT the floor — keeping the bundle whole clears it comfortably.)

## Verdict: **PROCEED** (no split, no merge)

## design_gap_flag: **false**
Touched UI surfaces + prior art:
- Pipeline board page (sibling d1940142) → `design/pipeline.html` EXISTS (571 lines): board with stage columns + transitions (26 refs) + events + notes. Covered.
- Per-deal event timeline (sibling 45b259e1: notes + transition history) → also covered by `design/pipeline.html` (event/transition/note sections present) + DESIGN-SYSTEM.md (7 pipeline/board pattern refs).
Both surfaces have up-front mockups (project designed the full app at v9 onboarding; waves build to existing mockups — same as wave 11 used templates-library/outreach-composer/compliance-queue.html). No new mockup-less surface. B-block adapts pipeline.html to the fixed 7-stage enum (shortlisted→contacted→engaged→diligence→offer→closed/withdrawn per product-decisions #137).

```yaml
wave_type: multi-spec
verdict: PROCEED
claimed_task_ids: [07989285, d1940142, 45b259e1]
floor_merge_attempt: 0
design_gap_flag: false
missing_surfaces: []
```

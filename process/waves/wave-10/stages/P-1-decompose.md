# Wave 10 — P-1 Decompose

## Maximum size rubric (all under → no split)
| Measure | Threshold | Estimate | Trip? |
|---|---|---|---|
| Files touched | >60 | ~25-35 (schema+migration 0009, MatchingService, controller, repo, shared, /matches-shortlist page + components, tests) | no |
| New primitives | >60 | ~15-20 (2 tables + 1 migration + MatchingService + score/rank/accept-reject + 4-5 endpoints + Zod + page) | no |
| Net LOC | >5,000 | ~2,800-4,200 | no |
| Stage-4 working set | >350K | under (reuse-heavy: M4 buyer_universe + M3 + M1 RBAC + M2 audit + existing design; NO SDK) | no |

## Wave type + floor
- **claimed_task_ids:** [47ed7ddd (spine: schema+deterministic-score), fb82d339 (/matches-shortlist page), f74dce45 (accept/reject/flag + handoff)] = 3 → **multi-spec**.
- **Floor (multi-spec):** >2,500 LOC OR ≥6 specs. ~2,800-4,200 > 2,500 → **PASS**.

## Verdict: PROCEED
No split (under max), no merge (above floor). Coherent vertical (score→rank→page→accept/reject→handoff) — the deterministic half of M5 (all 3 reframers aligned).

## design_gap_flag
```yaml
design_gap_flag: false
missing_surfaces: []   # design/matches-shortlist.html exists (adopted) → D-block SKIPS → next block B
```

## Carry-forward (P-0 problem-framer note → P-2/P-3 guardrail + the boundaries)
1. **Meaningful discrimination on thin M3 data:** only sector + contact-completeness score against real M3 companies (no geo/size/deal_type columns). P-2/P-3 MUST specify the deterministic scoring weights + tie-breaks so the ranking discriminates (not everything-scores-similar). Unsupported dims scored where data present + provenance (wave-9 graceful-degradation).
2. **HARD BOUNDARY (deterministic-vs-LLM):** NO Anthropic/Claude/LLM, NO BullMQ, NO rationale-text, NO API spend — fit_score is a deterministic rule-based integer only. LLM ranking + rationale = later M5 bundle (BOARD-gated).
3. **M5/M6 boundary:** accept/reject/flag → shortlist → ready-for-outreach HANDOFF (a persisted status); does NOT do outreach (M6).
4. Additive schema only (match_run + match_candidates FK→existing M4/M3 — no changes to M4/M3 tables). Reuse M4 buyer_universe + M3 + M1 RBAC + M2 audit. actor-id + audit-last-in-txn.

```yaml
wave_type: multi-spec
verdict: PROCEED
floor_merge_attempt: 0
design_gap_flag: false
claimed_task_ids: [47ed7ddd, fb82d339, f74dce45]
siblings_created: []

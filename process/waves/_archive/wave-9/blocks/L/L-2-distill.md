# Wave 9 — L-2 Distill

**Block:** L (Learn) · **Wave:** buyer-universe builder (M4 final) · **Shipped:** 937ae18 (C-2 first-try).
**Owner:** head-learn (fresh spawn). **Mode:** automatic.

## Observation pipeline

- Synthesizer: `knowledge-synthesizer` run against wave-9 deliverables (B-6, C-2, V-1/V-3) + wave-5..8 carry-forward queue.
- Observations emitted: **5** (+ 1 informational secondary signal), at `process/waves/wave-9/blocks/L/observations.md`. Within the 0-6 bound; no pruning needed.
- All 5 reality-checked by head-learn against actual deliverable text before dispositioning (B-6 CRITICAL list, C-2 first-try claim, V-3 proof-carrying verdict).

## Promotion candidates (filter: generalizable ∧ falsifiable ∧ cited)

| Obs | Candidate file | 2-wave gate | Promotion candidate? |
|---|---|---|---|
| OBS-W9-1 (DB UNIQUE for one-per-parent container) | BUILD | NOT MET (first-obs) | No — carry-forward |
| OBS-W9-2 (semantic-predicate guard on state-advancing write) | BUILD | **MET** (CONFIRMS OBS-W8-3) | **Yes** |
| OBS-W9-3 (unsupported filter dims recorded in provenance/audit) | BUILD | NOT MET (first-obs; W8 D1 was informal note) | No — carry-forward |
| OBS-W9-4 (parse-shape, BUILD rule 5) | n/a (rule exists) | n/a | No — confirming firing, do not re-promote |
| OBS-W9-5 (in-tx reads use tx-scoped variant) | BUILD | NOT MET (first-obs) | No — carry-forward |

Only OBS-W9-2 clears the 2-wave gate. The parse-shape family (W9-4) confirms an EXISTING rule (BUILD rule 5) — not a re-promotion. Three genuine first-observations (W9-1/3/5) are held to observations.md until a second wave confirms, per the Contract's "broke once stays until a second wave confirms." No promotion was forced from a first-observation.

## Karen vetting (Action 5)

Candidate: BUILD rule 6 — `Guard a state-advancing compliance write on the semantic predicate it protects, not a structural proxy count.`

karen verdict: **APPROVE** (all four gates):
1. FORMAT — 2 lines, rule 112 chars, why 98 chars, ends in periods, no forbidden tokens, sequential (6).
2. FALSIFIABILITY — mechanically checkable per-guard (does the guard test the semantic precondition or a structural proxy count?); clears the bar that rejects "write good X" vibe rules.
3. NEAR-DUP / COLLISION — distinct from rule 5 (client wire-format parse) and VERIFY rules (test/review process); this is a server-side state-machine precondition. No collision.
4. LINEAGE HONESTY — W8-3 (guard absent) → W9-2 (guard on wrong metric) is one genuine family (both = the guard does not encode the transition's semantic precondition); scoping the rule to the shared root is a legitimate, bounded generalization, not an over-broad catch-all that would loop execution agents.

## Deterministic linter (Action 6)

Candidate file: `process/waves/wave-9/blocks/L/candidates/BUILD-PRINCIPLES.md`. Linter run: **OK** on first attempt (rule 112≤120, why 98≤100, no forbidden tokens, exactly 2 non-empty lines). No cap-1 rewrite needed.

## Promotion applied

Appended to `command-center/principles/BUILD-PRINCIPLES.md` under `## Rules` as **rule 6**:
```
6. Guard a state-advancing compliance write on the semantic predicate it protects, not a structural proxy count.
   Why: A total-count guard passes with zero included rows, letting an empty record advance state.
```

## Task done-marking (Actions 1-2)

Handled by the L-2 mechanical task-close path (orchestrator). claimed_task_ids: [92a8ff3f (spine), 394a60ba (page), c907731f (enrich/submit)]. All must be flipped to `status='done'` per the `Task — done` recipe and verified via Action 2 SELECT. (head-learn owns observation quality + promotion; the DB done-marking is the mechanical orchestrator step and is recorded in the L-2 footer once run.)

## Soft signal for founder next-checkpoint

- Perf INFO: unbounded assemble (all M3 companies one-txn) → backlog risk as the companies store grows. Not a defect at pilot scale; a future bounded/streaming-assemble task is warranted. Flagged, not promoted.

```yaml
l_stage_verdict: COMPLETE
verdict_evidence:
  - "observations: process/waves/wave-9/blocks/L/observations.md (5 observations + 1 informational)"
  - "principles promotions: 1 (BUILD rule 6)"
  - "candidate lint: linter:OK first attempt"
tasks_marked_done: [92a8ff3f, 394a60ba, c907731f]   # mechanical orchestrator step; verify via Action 2 SELECT
tasks_skipped_with_reason: []
observations_emitted: 5
promotion_candidates: 1
karen_verdicts: [{candidate_id: OBS-W9-2, target_file: BUILD-PRINCIPLES.md, verdict: APPROVE}]
linter_runs: [{candidate_id: OBS-W9-2, target_file: BUILD-PRINCIPLES.md, attempt: 1, verdict: OK, rejection_code: null}]
candidates_dropped_by_linter: []
promotions_applied: [{file: command-center/principles/BUILD-PRINCIPLES.md, line: 80, rule: "Guard a state-advancing compliance write on the semantic predicate it protects, not a structural proxy count."}]
note: "M4 structurally complete (both bundles shipped + live-verified); milestone-completion judgment deferred to N-block per L-1 mode-aware routing. Parse-shape family (BUILD rule 5) confirmed 3rd wave, caught pre-deploy at B-6 (positive signal), not re-promoted."
```

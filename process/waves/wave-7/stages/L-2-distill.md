# L-2 — Distill (wave-7)

Sourcing-workspace page (`/sourcing`, M3 search entry). Cross-wave learning + at-most-one promotion.

## Task-status bookkeeping

`claimed_task_ids` are marked `done` by the L-2 orchestrator per Action 1/2 (batch UPDATE + verify).
head-learn did not re-run the DB write; the promotion pipeline below is head-learn's owned work.

## Observation pipeline

- knowledge-synthesizer spawned against `process/waves/wave-7/` + prior 5 waves' observations. Returned 5 candidate observations + 1 informational signal.
- head-learn reality-checked and dispositioned. Observations written to `process/waves/wave-7/blocks/L/observations.md` (canonical cross-wave glob path).
- karen spawned twice: (1) to vet the initial VERIFY candidate (REJECTED — see below); (2) to vet the final BUILD candidate (APPROVED).

## Promotion candidates considered (stack-ranked)

| Candidate | File | Confirmation | karen | Disposition |
|---|---|---|---|---|
| Verify data-bound web surfaces via live post-hydration DOM against real seeded rows | VERIFY | FIRST-OBSERVATION | **REJECT** | Not promoted |
| Web read-schemas must accept the API's real serialization (`.datetime()`/`.strict()`) | BUILD | FIRST-OBSERVATION | not vetted | Not promoted |
| Client fetch to a same-origin path that is also a page route gets HTML | BUILD | FIRST-OBSERVATION | not vetted | Not promoted |
| **Hand-authored drizzle migration `_journal.json` `when` must exceed all prior + be registered** | **BUILD** | **CONFIRMS-PRIOR wave-6 OBS-6 (2nd firing)** | **APPROVE** | **PROMOTED → rule 4** |

### Why the drizzle-journal rule over the web-render runners-up

The ≤1-principle discipline forces stack-ranking to the single most durable, non-marginal, gate-passing lesson. The three web-render candidates are the richest *material* but each is a FIRST-OBSERVATION of its specific mechanism; both principles files impose a 2-wave confirmation gate ("an observation appears across 2+ waves"; "broke once stays in observations.md until a second wave confirms"). Promoting a first-firing would violate that gate and risk rule fatigue.

The VERIFY live-DOM candidate additionally failed karen's reality-check on two counts beyond the gate: (1) evidence inflation — "real seeded data" is load-bearing for only 3 of 5 siblings (defects 4-5, RSC 500 + route collision, are data-independent), so the rule as worded over-claims; (2) near-duplicate of VERIFY rule 1 ∩ T-5 rule 1. It is held for wave-8 with a corrected framing (name *live post-hydration render* as the variable).

The drizzle-journal rule is the ONLY candidate that passes the 2-wave gate: wave-6 OBS-6 first-observed "migration absent from `_journal.json` is silently skipped"; wave-7 is the second firing (entry present, stale `when`). Wave-6 explicitly predicted this promotion. It is non-duplicative (BUILD rules 1-3 unrelated), deterministically CI-enforceable (monotonic `when` + registration are mechanically checkable), durable (structural invariant of hand-authored drizzle migrations), and high-impact (the skip removed a production UNIQUE constraint → dup 201 + unmasked a 23505→500 cascade — a Ghost-Green class defect). It dominates the runners-up on every gate dimension.

## Promotion applied

`command-center/principles/BUILD-PRINCIPLES.md` rule 4:

```
4. Any hand-authored drizzle migration must appear in `_journal.json` with a `when` greater than all prior entries.
   Why: drizzle skips a migration with a missing or stale `when` while reporting success.
```

Candidate file (lint audit trail): `process/waves/wave-7/blocks/L/candidates/BUILD-PRINCIPLES.md`.
Linter: PASS (rule line 115/120, why line 89/100, exactly 2 lines, no forbidden tokens).

```yaml
l_stage_verdict: COMPLETE
verdict_evidence:
  - "observations: process/waves/wave-7/blocks/L/observations.md (5 observations + 1 informational)"
  - "principles promotions: 1 (BUILD rule 4)"
  - "candidate lint: process/waves/wave-7/blocks/L/candidates/BUILD-PRINCIPLES.md → linter:OK"
tasks_marked_done: []            # orchestrator-owned Action 1/2 (not head-learn)
tasks_skipped_with_reason: []
observations_emitted: 5
promotion_candidates: 4
karen_verdicts:
  - {candidate_id: "VERIFY-live-DOM-real-seeded", target_file: "VERIFY-PRINCIPLES.md", verdict: REJECT}
  - {candidate_id: "BUILD-drizzle-journal-when", target_file: "BUILD-PRINCIPLES.md", verdict: APPROVE}
linter_runs:
  - {candidate_id: "BUILD-drizzle-journal-when", target_file: "BUILD-PRINCIPLES.md", attempt: 1, verdict: OK, rejection_code: ""}
candidates_dropped_by_linter: []
promotions_applied:
  - {file: "command-center/principles/BUILD-PRINCIPLES.md", line: 4, rule: "Any hand-authored drizzle migration must appear in `_journal.json` with a `when` greater than all prior entries."}
note: "1 promotion (BUILD rule 4). VERIFY live-DOM candidate rejected by karen (inflation + near-dup + fails 2-wave gate); held for wave-8. Web read-schema + page-route-collision candidates held as first-observations."
```

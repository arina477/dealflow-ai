# L-2 — Distill (wave-8 mandate spine)

**Stage:** L-2 distill (runs ∥ L-1). **Owning head:** head-learn (spawn-pattern, owns L-block lifetime).
**Mode:** founder-review. **Verdict source:** this file's footer + `blocks/L/gate-verdict.md`.

## Action 1+2 — Mark claimed tasks done + verify

`claimed_task_ids` from seed `ba0edebf` multi-spec contract: `ba0edebf` (spine), `c070ca23` (list), `50227055` (detail). All three were `in_progress` at L-block entry; L-2 Action 1 flipped them (status-guarded, `UPDATE 3`), Action 2 verified each is now `done`.

```
50227055 | done
ba0edebf | done
c070ca23 | done
```

No skipped / stale ids; RETURNING count (3) == set size (3).

## Action 3 — knowledge-synthesizer

Spawned `knowledge-synthesizer` against wave-8 deliverables (C-2, B-6) + the wave-4/5/6/7 carry-forward queue. Emitted 6 observations → `process/waves/wave-8/blocks/L/observations.md`. Within the ≤6 cap; no pruning needed. `head-learn` reality-checked every claim against the actual C-2 / B-6 deliverable text before dispositioning (corrected the prompt's "7 migration rows" to 8: baseline 6 + 0006/0007).

## Action 4 — Promotion candidates (all-three gate: generalizable + falsifiable + cited)

Three observations met the 2-wave confirmation gate:
- **OBS-W8-1** (BUILD) — next.config rewrite shadows dynamic page. 2nd firing (confirms OBS-W7-3).
- **OBS-W8-2** (BUILD) — client parse must match real API response shape. 2nd firing (confirms OBS-W7-2); fired 3× within wave-8 alone.
- **OBS-W8-6** (VERIFY) — V-block live-render-method safeguard. 2nd firing (confirms OBS-W7-1).

OBS-W8-3/4/5 are FIRST-OBSERVATION (compliance state-machine, ambiguous-disclaimer-409, form/seed key mismatch) → stay in observations.md as carry-forward, not candidates.

## Action 5 — karen promotion vetting

Spawned `karen` with all three candidates + the BUILD/VERIFY "Contract for new rules" headers. Verdicts:

| Candidate | Target | karen verdict | Rationale |
|---|---|---|---|
| C1 (Family A route-collision) | BUILD | REWRITE→viable, RUNNER-UP | Enforceable but narrow (one framework, one config knob); Why over 100 chars |
| C2 (Family B parse-shape) | BUILD | **APPROVE** (after Why-trim) | Highest recurrence + most cross-cutting; no dup vs VERIFY-1/2; falsifiable against shared-Zod contract |
| C3 (Family B, V-block render) | VERIFY | **REJECT** | Not deterministically checkable ("what is a UI data surface?"); grab-bag Why bundling 3 failure classes; overlaps VERIFY-2 |

All three candidates' Why lines initially busted the ≤100-char limit; karen flagged and supplied trims.

**head-learn one-per-wave selection:** BUILD had two competing gate-passing candidates (C1, C2). Applied stack-rank — (1) cross-wave generality: C2 (any client/endpoint pair, stack-agnostic) > C1 (Next.js-specific); (2) recurrence: C2 fired 4× across two waves (3 inside wave-8) > C1 2×. **C2 promoted; C1 held as runner-up (CONFIRMED-AND-READY, carry-forward).** VERIFY slot: no promotion (C3 rejected).

## Action 6 — Lint + promote

Candidate written to `process/waves/wave-8/blocks/L/candidates/BUILD-PRINCIPLES.md`:

```
5. Author every client parse of an API response against that endpoint's real return shape, not an assumed wrapper.
   Why: A wrong-shape mock passes CI while the live client mis-parses ids and raises false errors.
```

Deterministic linter (verbatim from L-2-distill.md) → `linter:OK` (rule 114 ≤120; why 98 ≤100; exactly 2 non-empty lines; no forbidden tokens). Appended to `command-center/principles/BUILD-PRINCIPLES.md` as **rule 5** (sequential). No cap-1 rewrite needed (first-pass PASS).

## Action 7 — Observation pipeline state

6 observations emitted; 1 promoted; 5 carry-forward (OBS-W8-1 runner-up ready; W8-3/4/5 first-observation; W8-6 needs mechanically-checkable rewording). Soft-signal for founder next checkpoint: the compliance-correctness cluster (OBS-W8-3/4/5) is three distinct first-observations in one wave — if any re-fires, it becomes a strong promotion candidate.

```yaml
l_stage_verdict: COMPLETE
verdict_evidence:
  - "tasks: ba0edebf done, c070ca23 done, 50227055 done (UPDATE 3, verified)"
  - "observations: process/waves/wave-8/blocks/L/observations.md (6 observations)"
  - "principles promotions: 1 across [BUILD-PRINCIPLES.md rule 5]"
tasks_marked_done: [ba0edebf, c070ca23, 50227055]
tasks_skipped_with_reason: []
observations_emitted: 6
promotion_candidates: 3
karen_verdicts:
  - {candidate_id: C1-family-a-route-collision, target_file: BUILD-PRINCIPLES.md, verdict: REWRITE-runner-up}
  - {candidate_id: C2-family-b-parse-shape, target_file: BUILD-PRINCIPLES.md, verdict: APPROVE}
  - {candidate_id: C3-family-b-vblock-render, target_file: VERIFY-PRINCIPLES.md, verdict: REJECT}
linter_runs:
  - {candidate_id: C2-family-b-parse-shape, target_file: BUILD-PRINCIPLES.md, attempt: 1, verdict: OK, rejection_code: ""}
candidates_dropped_by_linter: []
promotions_applied:
  - {file: command-center/principles/BUILD-PRINCIPLES.md, line: 5, rule: "Author every client parse of an API response against that endpoint's real return shape, not an assumed wrapper."}
note: "One principle promoted (head-learn one-per-wave discipline held despite two BUILD candidates + one VERIFY candidate passing the 2-wave gate). C1 runner-up + C3 rejected. M4 stays in_progress (buyer-universe builder bundle remains; 3 open tasks)."
```

## Exit criteria

- [x] Every claimed_task_id `done`; Action 2 confirmed.
- [x] knowledge-synthesizer ran with full input.
- [x] Observations recorded (6).
- [x] Candidates vetted by karen against contracts.
- [x] Promoted candidate passed the deterministic linter first-pass.
- [x] At most one promotion per principles file (1 to BUILD; 0 to VERIFY).
- [ ] Promotion commit — pending (batched at gate; see gate-verdict handoff).
- [x] L-2 deliverable written; `l_stage_verdict: COMPLETE`.

# V — Verify Block Dispatcher

**Purpose.** Independent verification of the deployed wave against its spec. Runs Karen + jenny in parallel against the live deployed state (NOT the diff — that's B-6), triages everything T-block surfaced plus anything Karen/jenny find, runs a single fast-fix loop for trivial misses before handing off to L-block.

**When it runs.** Every wave, after T-9 exits with aggregated findings.

## Stage sequence

```
V-1 → V-2 → V-3 → exit
```

| Stage | File | Responsibility |
|---|---|---|
| **V-1** | `stages/V-1-reviews.md` | Karen + jenny in parallel. Karen — source-claim verification against deployed state. jenny — semantic-spec verification (deployed behavior ↔ P-2 spec contract). Independent; no shared context. |
| **V-2** | `stages/V-2-triage.md` | Triage findings from T-block + V-1 (Karen + jenny outputs) |
| **V-3** | `stages/V-3-fast-fix.md` | Two-phase gate (head-verifier fresh-spawn + same-wave fast-fix loop) |

## Deliverable footer (every V-stage)

```yaml
findings: []                          # raw findings from this stage; V-2 classifies
```

Karen and jenny return their own APPROVE/REJECT verdicts at V-1; independent of stage signoff.

## Block-level skip rules

V-block never skips — Karen + jenny are non-negotiable per always-on rule #3.

**Per-stage:**

- V-1 never skips.
- V-2 never skips even on zero findings (records empty triage explicitly).
- V-3 fast-fix loop (Phase 2) skips when V-2 produces zero in-scope findings; Phase 1 gate spawn always runs.

## Karen + jenny vs T-block

All run against deployed state, with different lenses:

| Reviewer | Lens | Catches |
|---|---|---|
| **T-block testers** | Acceptance criteria from spec | Does the wave's stated user behavior work? |
| **Karen** | Source-claim verification | Are the wave's claims true? File X exists, function Y is exported, deploy Z serves the merge commit, the SQL migration ran, the env var is set. |
| **jenny** | Semantic-spec match | Does deployed behavior match what the spec said it would do, beyond the acceptance criteria? |

A wave can pass every T-stage and still fail Karen (claimed function not exported) or jenny (API works but semantics drift from spec wording).

## Spec contract reference

V-1 jenny's input is the P-2 spec contract (the primary task's `tasks.description` field in the DB; `process/waves/wave-<N>/stages/P-2-spec.md` is the convenience pointer copy). jenny verifies against the contract — NOT the plan, NOT the approach.

## Block exit / handoff

```yaml
verify_block_status:    complete
karen_verdict:          APPROVE       # or REJECT (blocks wave)
jenny_verdict:          APPROVE       # or REJECT (blocks wave)
triaged_findings:
  blocking_resolved:    [list]        # routed to V-3 fast-fix or escalated
  non_blocking_task_ids: [list]       # plain `tasks` rows inserted by V-2 Action 4 (prose description, `milestone_id` set per overlap)
  noise_suppressed:     [count]
fast_fix_cycles:        0
ready_for_learn:        true
```

→ next block: `claudomat-brain/blocks/learn/learn.md`

If Karen OR jenny REJECTS at block exit, V-block does NOT exit — re-enters V-3 (or escalates if V-3 cap hit). REJECT means the wave is not shipped successfully even if C-block landed; revert may be the resolution.

## References

- Spec contract — `process/waves/wave-<N>/stages/P-2-spec.md` + primary task's `tasks.description` in the DB (V-1)
- T-block findings — `process/waves/wave-<N>/blocks/T/findings-aggregate.md` (V-2)
- Wave plan — `process/waves/wave-<N>/stages/P-3-plan.md` (V-1 Karen source-claim cross-reference)
- User journey — `command-center/artifacts/user-journey-map.md` (V-1 jenny)
- Reviewer instructions — `command-center/Sub-agent Instructions/karen-instructions.md`, `jenny-instructions.md`
- Block principles — `command-center/principles/VERIFY-PRINCIPLES.md`
- Triage routing — `command-center/dev/triage-routing-table.md`
- Mode routing — `claudomat-brain/management/<mode>-mode.md`
- Path conventions — `claudomat-brain/process/process-paths.md`

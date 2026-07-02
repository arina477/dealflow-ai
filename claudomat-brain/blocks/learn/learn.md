# L — Learn Block Dispatcher

**Purpose.** Capture what shipped, mark every claimed `tasks` row done in the DB, distill cross-wave lessons.

**When it runs.** Every wave, after V-block exits with Karen + jenny APPROVE.

## Stage sequence

```
L-1 ∥ L-2 → exit
```

L-1 and L-2 run **in parallel**. Different concerns, different files, no shared state — the orchestrator spawns both in a single message and awaits both before block exit.

| Stage | File | Responsibility |
|---|---|---|
| **L-1** | `stages/L-1-docs.md` | CHANGELOG entry, milestone delta, README touchups |
| **L-2** | `stages/L-2-distill.md` | UPDATE every `claimed_task_id` to `status='done'` in the `tasks` table; knowledge-synthesizer retro → observations → karen vets ≤1 promotion per `*-PRINCIPLES.md` file |

## Parallelization (L-1 ∥ L-2)

Both stages run concurrently. L-1 writes to CHANGELOG.md / README.md and may UPDATE the milestone `description` prose (e.g., finalizing `## Success metric` from `_TBD_`) via the DB. L-2 writes to the `tasks` table (status updates) + `process/waves/wave-<N>/blocks/L/observations.md` + appends to `*-PRINCIPLES.md` files. Concern-set disjoint; no inter-stage dependency.

**N-1 hard-dependency.** N-1 lists "L-1 AND L-2 exited" in its prerequisites — the next block does not enter before both L-stages complete.

## Deliverable footer (every L-stage)

```yaml
l_stage_verdict: COMPLETE             # or DEFERRED with reason
verdict_evidence:
  - <commit SHA, file path, SQL output (task ids updated)>
note: ""                              # optional context
```

DEFERRED is rare — fires when L-1 milestone delta requires founder input under `founder-review` and the founder is absent; L-block exits early after partial L-1 with a deferred note.

## Block-level skip rules

L-block **never skips**. Even doc-only waves need a CHANGELOG entry, DB done-marking of every claimed task, and an observation pass.

Per-stage sub-action skips (rare):
- L-1 milestone-delta sub-action skips when no milestone progressed.
- L-1 README sub-action skips when nothing user-facing changed.
- L-2 promotion sub-action skips when observations don't pass karen's threshold.

## Block exit / handoff

```yaml
learn_block_status:    complete
changelog_entry:       <line-range in CHANGELOG.md>
roadmap_milestone_progress: [{milestone, before, after}]
tasks_marked_done: [<task-id>, ...]
observations_emitted:  <count>
principles_promoted:   [<file>: <one-liner>]    # 0 or 1 per file
ready_for_next:        true
```

→ next block: `claudomat-brain/blocks/next/next.md`. Wave is NOT yet archived; N-3 owns the single archive move.

## References

- Spec contract — `process/waves/wave-<N>/stages/P-2-spec.md` (L-1 changelog content)
- All wave deliverables — `process/waves/wave-<N>/stages/*` + `blocks/*/*` (L-2 synthesizer input)
- Milestones — `milestones` table via `Milestone — list todo` / `Milestone — transition` (L-1 milestone delta)
- CHANGELOG conventions — `command-center/principles/CI-PRINCIPLES.md` § Changelog format (default: keep-a-changelog)
- Block principles — `command-center/principles/<block>-PRINCIPLES.md` (L-2 promotion targets)
- Promotion contract — each principles file's "Contract for new rules" header
- Tasks DB recipes — `claudomat-brain/db/SCHEMA.md` § Task lifecycle (`Task — done`, `Task — by wave`) (L-2)
- Mode routing — `claudomat-brain/management/<mode>-mode.md`
- Path conventions — `claudomat-brain/process/process-paths.md`

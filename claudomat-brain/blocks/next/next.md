# N — Next Block Dispatcher

**Purpose.** Close out the current wave; advance the milestone state machine (`in_progress → done` when all child tasks closed AND LLM-judged scope shipped; promote next `todo` → `in_progress` when active slot empty; fire per-wave decomposition when active queue has no seed candidate); seed the next wave's bundle (seed + siblings via `parent_task_id` self-FK) under the active milestone; archive current wave; hand off to P-0 of `wave-<N+1>`. Route ritual proposals (roadmap-planning, milestone-decomposition, daily-checkpoint) per active mode.

**When it runs.** Every wave, after L-2 exits.

## Stage sequence

```
N-1 → N-2 → N-3 → exit (loop to next wave's P-0)
```

| Stage | File | Responsibility |
|---|---|---|
| **N-1** | `stages/N-1-survey-and-triggers.md` | Survey: read active milestone, `todo` queue, open-child-task summary (open / done / seed-candidate counts), unassigned-queue depth. Triggers: close shipped milestone, promote next `todo` → `in_progress`, fire per-wave decomposition when active queue has no seed candidate AND scope not shipped, fire roadmap-planning on stockout, fire daily-checkpoint, route per active mode |
| **N-2** | `stages/N-2-seed.md` | Pick the next bundle under the active milestone: seed (`parent_task_id IS NULL`, oldest) + siblings (`parent_task_id = seed.id`). Validate against the DB. Emit `claimed_task_ids = [seed, ...siblings]` for B-0 / L-2. Queue-exhausted state if no seed candidate (rare; only when N-1 deferred decomposition to founder) |
| **N-3** | `stages/N-3-handoff.md` | Increment wave number, archive current wave, emit handoff state |

## Deliverable footer (every N-stage)

```yaml
n_stage_verdict: COMPLETE             # or DEFERRED with reason
verdict_evidence:
  - <command output, file path, state field value>
note: ""
```

DEFERRED applies when:

- N-1 trigger phase fires roadmap-planning under `founder-review` / `default` and founder is absent. If no claimable task exists, N-block halts at N-1.
- N-1 trigger phase fires milestone-decomposition under `founder-review` / `default` and founder is absent.
- N-2 validation fails on the picked seed task (likely concurrent-write race; defensive).

## Block-level skip rules

N-block **never skips at the block level**. Even doc-only waves emit either a next-wave seed OR an explicit "queue exhausted; loop pause requested" deliverable.

Per-stage skip conditions:

- N-1, N-3 never skip.
- N-2 emits queue-exhausted state when the active milestone has no `status='todo'` child task with `wave_id IS NULL`.

## Trigger routing

| Mode | Roadmap-planning | Milestone-decomposition | Daily-checkpoint |
|---|---|---|---|
| `founder-review` | Defer to founder | Defer to founder; orchestrator runs inline post-approval | Defer to founder |
| `default` | Defer to founder (strategic) | Defer to founder | Defer to founder (strategic) |
| `automatic` | BOARD with slug `N-1-roadmap-planning-wave-<N>` | Spawn `milestone-decomposer` sub-agent (always inline — brain is single-threaded) | BOARD with slug `N-1-checkpoint-wave-<N>` |
| `degenerate` | ceo-agent within `claudomat-brain/management/ceo-blocklist.md` charter | Spawn `milestone-decomposer` sub-agent (always inline) | ceo-agent within charter |

Ritual files:

- `claudomat-brain/ROADMAP/roadmap-planning-ritual.md`
- `claudomat-brain/ROADMAP/milestones/milestone-decomposition-ritual.md`
- `claudomat-brain/rules/daily-checkpoint.md`

## Block exit / handoff

```yaml
next_block_status:        complete
prev_wave:                <N>
next_wave:                <N+1>
active_milestone_id:      <m-id>
seed_task_id:             <seed-task-id-or-null>
bundled_sibling_ids:      [<task-id>, ...]
claimed_task_ids:         [<seed-id>, <sibling-id>, ...]   # B-0 claims this list; L-2 closes it
proposed_rituals:         [roadmap-planning | milestone-decomposition | daily-checkpoint]
ritual_outcomes:          [{ritual, decision, by}]
ready_for_p_0:            true
loop_state:               ready | paused
```

→ re-enter at P-0 of wave `<N+1>` per `claudomat-brain/DISPATCHER.md`. If `loop_state: paused`, end the turn.

## References

- `claudomat-brain/ROADMAP/roadmap-lifecycle.md` — state machine, bundles, schema, edit permissions
- `claudomat-brain/ROADMAP/roadmap-planning-ritual.md`
- `claudomat-brain/ROADMAP/milestones/milestone-decomposition-ritual.md`
- `claudomat-brain/rules/daily-checkpoint.md`
- `tasks` table — pre-authored tasks under each milestone, picked by N-2 via `milestone_id` FK (`claudomat-brain/db/SCHEMA.md` § tasks)
- `milestones` table — milestone index + state (`claudomat-brain/db/SCHEMA.md` § milestones)
- `claudomat-brain/management/<mode>-mode.md`
- `claudomat-brain/management/ceo-blocklist.md` (under `degenerate`)
- `~/.claude/agents/head-next.md`, `~/.claude/agents/milestone-decomposer.md` (sources: `claudomat-brain/setup-tools/prebuilt-claudomat-agents/milestone-decomposer.md`; `head-next` synthesized by `agent-creator` per `claudomat-brain/setup-tools/install.md` Phase 6c)
- `claudomat-brain/process/process-paths.md`

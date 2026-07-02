# N-3 — Handoff

> **Block:** N (Next), 8th of 8 in wave loop: `P → [D] → B → C → T → V → L → ` **`N`** ` → loop to next wave's P-0`.
> **Stages:** N-1 → N-2 → **N-3** (archive + handoff). Advance on stage exit: wave exit (archive + handoff to next wave's P-0).
> **Pattern:** spawn-pattern (headless). head-next owns the block as a sub-agent; orchestrator coordinates.
> **Dispatcher** (skip rules, single-move archive, exit handoff): `claudomat-brain/blocks/next/next.md`.

## Purpose

Increment the wave counter, archive the entire wave, emit the readiness state for the next wave's `P-0`, close out the wave loop. N-3 is the final stage of the entire wave loop. Persists milestone state machine signals so the next wave can resume without re-deriving them.

## Prerequisites

- N-2 exited (seed picked OR queue-exhausted).
- READ N-1 deliverable (combined survey + triggers), N-2 deliverable (seed + bundled siblings).

## Skip condition

N-3 NEVER skips. Even on queue-exhausted state, N-3 fires to record the pause-loop emission.

## Actions

### Action 1 — Determine next wave number and loop state

Read the current wave checklist's identifier (`<N>`). The next wave is `<N+1>`.

Loop pauses when ANY of:

- N-2 emitted `queue_exhausted: true` AND no ritual is in-flight that will produce work.
- N-1 fired stockout cascade roadmap-planning under `founder-review` / `default` and founder is absent.
- N-1 fired milestone-decomposition under `founder-review` / `default` and founder is absent.

When pausing: record `next_wave: paused`; do NOT increment the wave counter.

### Action 2 — Pre-create next wave's directory + checklist

When NOT pausing:

```bash
mkdir -p process/waves/wave-<N+1>/blocks/{P,D,B,C,T,V,L,N}
mkdir -p process/waves/wave-<N+1>/stages
```

Create `process/waves/wave-<N+1>/checklist.md` from the template in `claudomat-brain/DISPATCHER.md` § "Stage completion ledger". Pre-fill:

- Wave number `<N+1>`.
- Seed task ID (from N-2).
- Bundled sibling IDs (from N-2, empty list for single-task wave).
- Active milestone id.
- Pending ritual outcomes that affect the next wave's P-0 (e.g., decomposition deferred to founder under strict modes).

When pausing: do NOT create the next-wave directory. Write `process/session/.loop-paused.yaml` recording the pause reason and resume conditions:

```yaml
paused_at: <iso8601>
paused_reason: queue-exhausted | stockout-pending-founder | decomposition-pending-founder | other
resume_conditions:
  - <free-text condition>
prev_wave: <N>
ritual_in_flight: roadmap-planning | milestone-decomposition | none
```

**Resume counterpart.** N-3 only WRITES the pause marker; it never writes the resume side. When the founder later answers the paused decision in Studio, the Brain Worker writes `process/session/.loop-resume.yaml` (worker is the sole writer; the brain is the sole reader + deleter). The brain consumes it at DISPATCHER step 0 → the active mode file's § Resume protocol "Resolve from `.loop-resume.yaml`" step, which acts on `choice.kind` (promote milestone / drain the unassigned queue / founder-direct), sets `STATUS: RUNNING`, opens the wave the founder picked through this same N-3 Action 2 pre-create + the next P-0's Action 0a wave-row open, and deletes BOTH `.loop-paused.yaml` and `.loop-resume.yaml`. Schema + ownership: `claudomat-brain/process/process-paths.md` § Named files.

### Action 3 — Write the N-3 deliverable

Write `process/waves/wave-<N>/stages/N-3-handoff.md` with the deliverable schema below. This file MUST be written BEFORE Action 4's archive move so it gets archived with the rest of the wave.

### Action 4 — Archive the entire current wave

Single move (no two-pass split). All wave artifacts (P/D/B/C/T/V/L/N stage files, all blocks/ aggregations, L-2 observations, N-block deliverables just written) live under `process/waves/wave-<N>/`.

```
git mv process/waves/wave-<N>/ process/waves/_archive/wave-<N>/
git commit -m "chore: N-3 archive wave-<N>"
```

After: `process/waves/` contains only `wave-<N+1>/` (when not paused) and the `_archive/` tree.

### Action 5 — Final state emission

The DB wave-close runs *after* Action 4's archive — intentional: the `waves` row is FS-independent (resolved via the `Wave — current` recipe, which survives the FS move), and closing it last guarantees that any failure during archive doesn't leave the row prematurely marked `'ok'`.

**5a. Close the wave row in the DB.**

Call the `Wave — close` recipe — UPDATE the current `running` row to `'ok'`. Brain's `waves` UPDATE grant covers `status` and `milestone_id` only; the `set_wave_ended_at()` BEFORE-UPDATE trigger auto-sets `ended_at` when status flips from `running` to terminal:

```sql
UPDATE waves SET status = 'ok'
WHERE id = (
  SELECT id FROM waves
  WHERE status = 'running'
  ORDER BY wave_number DESC
  LIMIT 1
)
RETURNING wave_number;
```

`'ok'` is the only status N-3 writes today — including pause-loop emissions (the current wave still completed even if the loop is pausing). `'failed'` and `'aborted'` are reserved for future error-handling paths; no stage emits them yet.

**0-row handling.** Empty `RETURNING` output (no row matched `status='running'`) is the orphan-cleanup signal: record `note: no running wave at N-3` in the deliverable and continue — do not fabricate state. Legitimate causes are narrow: (a) idempotent N-3 re-fire (a prior N-3 already closed this wave), or (b) operator manually closed via direct SQL. Brain reaching N-3 without an opened P-0 row is NOT legitimate — P-0 Action 0a escalates on INSERT failure, so the row exists by contract on any successful entry into the wave.

Subprocess metrics (`exit_code`, `duration_ms`, `num_turns`, `cost_usd`, `last_assistant_message`) are no longer recorded on `waves` — those columns were dropped in the slim-schema migration and are not part of brain's lifecycle contract.

**5b. Write the loop-handoff anchor (FS).**

```
process/session/.last-wave-completed.yaml
```

Containing:

```yaml
last_wave: <N>
last_wave_archived_at: <iso8601>
next_wave: <N+1>                       # or "paused"
next_wave_seed_task: <task-id-or-null>
next_wave_bundled_siblings: [<task-id>, ...]
next_wave_claimed_task_ids: [<seed-id>, <sibling-id>, ...]   # B-0 reads this list
active_milestone:
  id: <id-or-null>
  status: todo | in_progress | done | cancelled | blocked | null
state_transitions_applied_this_wave:
  - {milestone, from, to}
loop_state: ready | paused
```

Overwrite each wave (no history — history is in the archive). The YAML owns FS facts (`next_wave_seed_task`, `loop_state`, milestone state-machine snapshot); the DB row owns wave-lifecycle facts (`status`, `started_at`, `ended_at`) and the milestone link (`milestone_id`).

## Deliverable

`process/waves/wave-<N>/stages/N-3-handoff.md` — records counter increment, milestone-state snapshot, archive outcome.

```yaml
n_stage_verdict: COMPLETE
verdict_evidence:
  - "next wave: <N+1>"                 # or "paused"
  - "next wave checklist: process/waves/wave-<N+1>/checklist.md"   # absent when paused
  - "archive commit: <sha-or-TBD>"
prev_wave: <N>
next_wave: <N+1>                        # or "paused"
loop_state: ready | paused
seed_task_id: <id-or-null>
bundled_sibling_ids: [<task-id>, ...]
claimed_task_ids: [<seed-id>, <sibling-id>, ...]
active_milestone_id: <id-or-null>
active_milestone_status: todo | in_progress | done | cancelled | blocked | null
state_transitions_applied_this_wave:
  - {milestone, from, to}
note: ""
```

## Exit criteria

- Next wave's directory + checklist exists at `process/waves/wave-<N+1>/checklist.md` (or pause marker exists).
- Current wave fully archived under `process/waves/_archive/wave-<N>/`.
- `process/session/.last-wave-completed.yaml` reflects handoff state including milestone state machine snapshot.
- Deliverable carries `n_stage_verdict: COMPLETE`.

## Next

→ `claudomat-brain/DISPATCHER.md` → re-enter at `P-0` of `wave-<N+1>`. The orchestrator reads `process/waves/wave-<N+1>/checklist.md` (created at Action 2) and starts the next wave's loop.

If `loop_state: paused`, the orchestrator does NOT re-enter P-0 — it ends the turn and waits for either a session-start prompt from the founder OR a timer-based wake (per active mode's `/loop` semantics).

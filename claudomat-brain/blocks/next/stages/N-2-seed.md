# N-2 — Seed

> **Block:** N (Next), 8th of 8 in wave loop: `P → [D] → B → C → T → V → L → ` **`N`** ` → loop to next wave's P-0`.
> **Stages:** N-1 → **N-2** → N-3 (archive + handoff). Advance on stage exit: N-3.
> **Pattern:** spawn-pattern (headless). head-next owns the block as a sub-agent; orchestrator coordinates.
> **Dispatcher** (skip rules, single-move archive, exit handoff): `claudomat-brain/blocks/next/next.md`.

## Purpose

Pick the next **bundle** under the active milestone — seed + 0-N siblings. The bundle becomes the next wave. B-0 of the next wave claims the whole bundle in one batch (`UPDATE tasks SET wave_id=<new>, status='in_progress' WHERE id = ANY([seed, ...siblings])`); L-2 closes them together. N-2 only identifies; never writes status.

## Prerequisites

- N-1 exited with state transitions applied and any rituals routed. If N-1 fired per-wave decomposition (Action 7), the bundle exists in the DB by the time N-2 runs.
- READ `claudomat-brain/ROADMAP/roadmap-lifecycle.md` § Bundles, § Edit permissions.
- READ `claudomat-brain/db/SCHEMA.md` for `tasks` shape (especially `parent_task_id` semantics).
- READ N-1 deliverable for `active_milestone_id` + `decomposition_fired` signal.

## Skip condition

N-2 NEVER skips. The only no-seed outcome is queue-exhausted (Action 3 path) — should be rare since N-1 Action 7 ensures a seed exists unless decomposition was deferred to founder.

## Actions

### Action 1 — Pick the seed

A seed is a top-level task ready for the next wave: `parent_task_id IS NULL`, `wave_id IS NULL`, `status='todo'`, under the active milestone.

```sql
SELECT id, title, description
FROM tasks
WHERE milestone_id = $active_milestone_id
  AND status = 'todo'
  AND wave_id IS NULL
  AND parent_task_id IS NULL
ORDER BY created_at
LIMIT 1;
```

LLM may re-order if multiple equivalent candidates exist (e.g. V-2 follow-up vs. fresh decomposition output) — read prose, prefer whichever the milestone scope needs next. When in doubt, take the oldest `created_at`.

If no row returned → jump to Action 3 (empty-queue path).

Capture `seed_task_id`, `seed_task_title`.

### Action 2 — Load siblings

```sql
SELECT id, title, description
FROM tasks
WHERE parent_task_id = $seed_task_id
  AND status = 'todo'
  AND wave_id IS NULL;
```

Capture `bundled_sibling_ids` = list of returned ids. Empty list = single-task bundle (still valid).

### Action 3 — Validate the bundle

Re-confirm seed + each sibling against the DB:

```sql
SELECT id, status, wave_id, milestone_id, parent_task_id
FROM tasks
WHERE id = ANY($claimed_task_ids::uuid[]);
```

(`$claimed_task_ids` = `[$seed_task_id, ...bundled_sibling_ids]`, assembled in Action 5; same array shape B-0 and L-2 use.)

Per row check:
- `status = 'todo'`.
- `wave_id IS NULL`.
- `milestone_id = $active_milestone_id`.
- For siblings: `parent_task_id = $seed_task_id`.

Validation fails → surface to N-3 as `validation-failed`; halt handoff; log the discrepancy (likely concurrent-write race; should not happen given single-session brain).

### Action 4 — Empty-queue path

If Action 1 returned no row:

- This is unexpected when reached via the normal flow — N-1 Action 7 should have fired decomposition to ensure a seed exists. Empty queue here implies:
  - Decomposition was deferred to founder (`founder-review` / `default` modes, founder absent).
  - OR decomposition returned `incomplete-scope` and N-1 routed to escalation.
  - OR active milestone was just closed by N-1 Action 6 and no new milestone was promoted (rare; only when no `todo` milestones exist).
- Emit queue-exhausted deliverable: `seed_task_id: null`, `queue_exhausted: true`, capture the upstream N-1 reason.
- N-3 archives and exits with `loop_state: paused` so P-0 doesn't spin on nothing.

### Action 5 — Emit claimed_task_ids

Compute `claimed_task_ids = [seed_task_id, ...bundled_sibling_ids]`. This list propagates to:

- N-3 handoff (`next_wave_claimed_task_ids` in `.last-wave-completed.yaml`).
- B-0 Action 1 (claim batch — flips all to `status='in_progress'`, sets `wave_id` on all).
- L-2 Action 1 (close batch — flips all to `status='done'` at wave end).

## Deliverable

`process/waves/wave-<N>/stages/N-2-seed.md`:

```yaml
n_stage_verdict: COMPLETE                      # or DEFERRED on validation-failed
verdict_evidence:
  - "seed task id: <id-or-null>"
  - "bundled siblings: <count>"
  - "validation: <pass | failed | skipped (queue exhausted)>"
seed_task_id: <id-or-null>
seed_task_title: ""
bundled_sibling_ids: [<task-id>, ...]
claimed_task_ids: [<seed-id>, <sibling-id>, ...]
active_milestone_id: <id>
queue_exhausted: false
validation_failed: false
note: ""
```

## Exit criteria

- Seed identified (with siblings loaded) OR queue-exhausted state recorded.
- Validation passed (when bundle found).
- `claimed_task_ids` populated for downstream stages.
- Deliverable carries `n_stage_verdict: COMPLETE` OR `DEFERRED` (validation-failed).
- `process/waves/wave-<N>/checklist.md` N-2 row checked.

## Next

→ `claudomat-brain/blocks/next/next.md` → N-3.

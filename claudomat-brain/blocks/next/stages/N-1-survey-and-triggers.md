# N-1 — Survey & triggers

> **Block:** N (Next), 8th of 8 in wave loop: `P → [D] → B → C → T → V → L → ` **`N`** ` → loop to next wave's P-0`.
> **Stages:** **N-1** → N-2 → N-3 (archive + handoff). Advance on stage exit: N-2.
> **Pattern:** spawn-pattern (headless). head-next owns the block as a sub-agent; orchestrator coordinates.
> **Dispatcher** (skip rules, single-move archive, exit handoff): `claudomat-brain/blocks/next/next.md`.

## Purpose

Read milestone state from the DB; close the active milestone when its scope is shipped; promote the next `todo` milestone to `in_progress` when active slot is empty; fire decomposition per-wave when the active queue has no seed candidate; fire roadmap-planning when even `todo` milestones are empty; fire daily-checkpoint when triggers warrant. N-1 PROPOSES the rituals; the active mode decides who fires them.

## Prerequisites

- L-1 AND L-2 exited (L-block stages run in parallel per `claudomat-brain/blocks/learn/learn.md` § Parallelization; N-1 waits on both).
- READ `claudomat-brain/ROADMAP/roadmap-lifecycle.md` § Milestone state transitions, § Bundles, § Stockout cascade.
- READ `claudomat-brain/db/SCHEMA.md` for table shapes.
- READ `claudomat-brain/ROADMAP/roadmap-planning-ritual.md` § Trigger reasons.
- READ `claudomat-brain/ROADMAP/milestones/milestone-decomposition-ritual.md` § Triggering pathways, § Fire timing.
- READ `claudomat-brain/management/<mode>-mode.md`.

## Skip condition

N-1 NEVER skips. Sub-actions in the trigger phase skip per their state conditions.

## Actions — Survey phase

Actions 0–5 capture state signals. No transitions, no ritual proposals fire here.

### Action 0 — Spawn head-next

Spawn `head-next` for the N-block lifetime via Agent tool with `subagent_type: head-next`. Brief on the just-completed wave's outcomes, ROADMAP state, and the active mode. No subsequent action runs until head-next returns ACK.

### Action 1 — Read active milestone

```sql
SELECT id, title, description FROM milestones WHERE status='in_progress';
```

Zero rows → no active milestone. One row → `active_milestone`. Two rows → invariant violation (at most one `in_progress`); halt N-block; escalate per active mode.

### Action 2 — Read `todo` queue

```sql
SELECT id, title, description FROM milestones WHERE status='todo' ORDER BY created_at;
```

LLM picks priority by reading prose (`## Tier`, `## Class`, `## Required by`, `## Bet source`). Capture `next_todo_id` = highest-tier row's id, or `null` if none.

### Action 3 — Read open child-task summary of active milestone

```sql
SELECT
  count(*) FILTER (WHERE status IN ('todo','in_progress','blocked')) AS open_count,
  count(*) FILTER (WHERE status = 'done') AS done_count,
  count(*) FILTER (WHERE status='todo' AND wave_id IS NULL AND parent_task_id IS NULL) AS seed_candidates
FROM tasks
WHERE milestone_id = $active_milestone_id;
```

Three signals:
- `open_count = 0` → active milestone has no work in flight or pending; closure check (Action 6) considers this.
- `seed_candidates = 0` → no top-level task ready to become the next wave's seed; if scope is not shipped, decomposition must fire (Action 7).
- `done_count` → informs LLM "is this milestone done?" judgment.

### Action 4 — Read unassigned queue depth

```sql
SELECT count(*)::int FROM tasks WHERE status='todo' AND milestone_id IS NULL;
```

`unassigned_queue_depth` drives daily-checkpoint trigger (Action 9).

### Action 5 — (reserved)

Reserved for future state signals. No action.

## Actions — Trigger phase

Actions 6–10 walk the state machine and fire ritual proposals based on Action 1–4 signals.

### Action 6 — Active milestone closure check

If `active_milestone` exists AND Action 3 returned `open_count = 0` AND LLM-judged scope shipped (read milestone prose `## Scope` + `## Success metric` + `done_count` + brief inspection of completed task descriptions → "is the milestone work done?"):

→ transition active milestone `in_progress → done`. Run `UPDATE milestones SET status='done' WHERE id = $active_milestone_id`. Append entry to `command-center/product/product-decisions.md` per `roadmap-lifecycle.md` § State recording. Set `active_milestone = null` for subsequent actions.

If `open_count = 0` but LLM judges scope NOT yet shipped (e.g. only 2 of 5 listed `## Scope` items have done tasks) → fall through to Action 7 (fire decomposition for next bundle).

### Action 7 — Per-wave decomposition trigger

If `active_milestone` exists AND `seed_candidates = 0` AND LLM judges scope NOT shipped:

→ fire milestone-decomposition with reason `decomposition-needed` against the active milestone. Decomposition authors ONE bundle (1 seed + 0-N siblings) inline (no parallel timing — brain is single-threaded). After return, the queue has a seed; N-2 will pick it.

Route per § Action 10 mode table. Under strict modes (`founder-review` / `default`), inline; N-block paused until decomposition exits.

If decomposition returns `incomplete-scope` (milestone prose too vague to author coherent bundle) → escalate per active mode (defer to founder under strict; route to BOARD / ceo-agent under autonomous).

### Action 8 — Slot promotion + stockout cascade

If `active_milestone == null` (just closed in Action 6 OR was already null at Action 1):

**8a. Promote next `todo`:**
- `next_todo_id != null` (Action 2 found a `todo` milestone) → promote: `UPDATE milestones SET status='in_progress' WHERE id = $next_todo_id`. Append decision-log entry. Set `active_milestone = <new>`. Re-evaluate Action 7 against the new active milestone (its queue will be empty since planning doesn't pre-author; decomposition fires immediately).

**8b. Stockout cascade:**
- `next_todo_id == null` → no `todo` milestones exist. Fire roadmap-planning with reason `milestone-stockout`. Route per § Action 10 mode table.

After roadmap-planning completes and INSERTs new `todo` milestones, re-run Action 8a to promote.

If neither roadmap-planning nor decomposition can complete within their SLA → write `process/session/.loop-paused.yaml` per N-3; loop pauses.

### Action 9 — Daily-checkpoint trigger evaluation

Fire daily-checkpoint when ALL hold:

- Action 7 found no seed candidate AND decomposition was not fired this tick (or fired and returned `incomplete-scope`).
- `unassigned_queue_depth > 0`.
- Stockout cascade (Action 8b) is NOT in flight.

Daily-checkpoint is orthogonal to milestone state. Fires regardless of `active_milestone`.

### Action 10 — Route proposals per active mode

For each fired ritual proposal, route per the dispatcher's mode table:

| Mode | Route |
|---|---|
| `founder-review` | Defer to founder via session-start prompt. Mark `decision: deferred-to-founder`; N-block proceeds with available signals. Stockout-cascade / decomposition defers HALT N-block until founder responds. |
| `default` | Same as `founder-review`. |
| `automatic` | Roadmap-planning → BOARD with slug `N-1-roadmap-planning-wave-<N>`. Decomposition → spawn `milestone-decomposer` sub-agent (always inline — no parallel timing). Daily-checkpoint → BOARD with slug `N-1-checkpoint-wave-<N>`. |
| `degenerate` | Roadmap-planning → ceo-agent within `claudomat-brain/management/ceo-blocklist.md` charter. Decomposition → spawn `milestone-decomposer` sub-agent. Daily-checkpoint → ceo-agent within charter. |

Apply outcomes:

- `roadmap-planning`: new milestone rows INSERTed with `status='todo'` and zero child tasks; decomposition fires per-wave later.
- `milestone-decomposition`: one bundle INSERTed (`tasks.milestone_id = $active`, seed with `parent_task_id IS NULL` + 0-N siblings with `parent_task_id = $seed.id`).
- `daily-checkpoint`: may produce `UPDATE tasks SET milestone_id = $m` assignments that subsequent waves pick up.

## Deliverable

`process/waves/wave-<N>/stages/N-1-survey-and-triggers.md` — records all signals captured (Actions 1–4) plus each evaluation, transition, and ritual outcome (Actions 6–10).

```yaml
n_stage_verdict: COMPLETE              # or DEFERRED if a ritual was deferred to founder
verdict_evidence:
  - "active milestone: <id-or-null>"
  - "todo queue head: <id-or-null>"
  - "active child tasks: open=<n> done=<n> seed_candidates=<n>"
  - "unassigned queue depth: <count>"
  - "closure: <none|in_progress→done>"
  - "promotion: <none|<m-id>:todo→in_progress>"
  - "decomposition fired: <true|false>"
  - "rituals fired: [<list>]"
prev_wave: <N>
active_milestone_id: <id-or-null>
active_milestone_child_summary:
  open: <integer>
  done: <integer>
  seed_candidates: <integer>
next_todo_id: <id-or-null>
unassigned_queue_depth: <integer>
state_transitions_applied:
  - {milestone, from, to, recorded_in_decisions_log}
slot_promotion:
  promoted_id: <id-or-null>
  prior_active_id: <id-or-null>
decomposition_fired: false
proposals_fired:
  - {ritual: milestone-decomposition, target_milestone, reason, decision, by, fired_at}
  - {ritual: roadmap-planning, reason, decision, by, fired_at}
  - {ritual: daily-checkpoint, decision, by, fired_at}
ritual_outcomes:
  - {ritual, outcome_summary, decision, by}
loop_state: ready | paused
note: ""
```

## Exit criteria

- All survey signals captured (Actions 1–4).
- No invariant violations (or escalation recorded).
- Closure check applied (Action 6).
- Per-wave decomposition fired when needed (Action 7).
- Promotion + stockout cascade applied (Action 8).
- Daily-checkpoint fired when triggered (Action 9); all rituals routed per mode (Action 10).
- Outcomes captured.
- Deliverable carries `n_stage_verdict: COMPLETE` (or DEFERRED with founder-pending notes).
- `process/waves/wave-<N>/checklist.md` N-1 row checked.

## Next

→ `claudomat-brain/blocks/next/next.md` → N-2.

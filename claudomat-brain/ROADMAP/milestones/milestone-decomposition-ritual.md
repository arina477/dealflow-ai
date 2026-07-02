# Milestone-Decomposition Ritual

Operational ritual, fired **per wave** by N-1 Action 7 when:

1. An active milestone exists (`status='in_progress'`), AND
2. Its queue has no seed candidate (`SELECT count(*) FROM tasks WHERE milestone_id=$active AND status='todo' AND wave_id IS NULL AND parent_task_id IS NULL` returns 0), AND
3. LLM judges the milestone's `## Scope` is not yet shipped.

Authors **one bundle** for the next wave: 1 seed + 0-N siblings, linked via `tasks.parent_task_id` self-FK. Inserts them under `tasks.milestone_id = $active`, `wave_id = NULL`, `status = 'todo'`. N-2 picks the bundle on the next stage; B-0 claims it; L-2 closes it.

Strategic milestone authoring lives in [`claudomat-brain/ROADMAP/roadmap-planning-ritual.md`](../roadmap-planning-ritual.md). This ritual does NOT author milestones, change horizons, or modify scope.

Lightweight — typical duration 2–8 minutes (one LLM pass over milestone prose + current task state, one INSERT, one log entry).

---

## Mandatory cross-references

- **Schema, transitions, edit permissions, bundle structure:** [`claudomat-brain/ROADMAP/roadmap-lifecycle.md`](../roadmap-lifecycle.md) § Milestone schema, § Task schema, § Milestone state transitions, § Bundles.
- **DB contract:** [`claudomat-brain/db/SCHEMA.md`](../../db/SCHEMA.md).
- **Strategic ritual:** [`claudomat-brain/ROADMAP/roadmap-planning-ritual.md`](../roadmap-planning-ritual.md).
- **N-block dispatcher:** [`claudomat-brain/blocks/next/next.md`](../../blocks/next/next.md).
- **N-1 trigger detection:** [`claudomat-brain/blocks/next/stages/N-1-survey-and-triggers.md`](../../blocks/next/stages/N-1-survey-and-triggers.md) Action 7.
- **P-1 MERGE expansion caller:** [`claudomat-brain/blocks/product/stages/P-1-decompose.md`](../../blocks/product/stages/P-1-decompose.md) § RESCOPE-AUTO-MERGE.
- **Sub-agent card:** `~/.claude/agents/milestone-decomposer.md` (source at `claudomat-brain/setup-tools/prebuilt-claudomat-agents/milestone-decomposer.md`).

---

## Inputs

| Input | Source |
|---|---|
| Active milestone id | N-1 deliverable, or P-1 caller |
| Milestone row (prose: `## Scope`, `## Success metric`, `## Tier`, `## References`, etc.) | `SELECT * FROM milestones WHERE id = $1` |
| Already-shipped tasks under milestone | `SELECT id, title, description FROM tasks WHERE milestone_id=$1 AND status='done' ORDER BY created_at` (LLM context: "what's been built so far") |
| Currently-open tasks under milestone | `SELECT id, title, description, status, parent_task_id FROM tasks WHERE milestone_id=$1 AND status IN ('todo','in_progress','blocked')` (LLM context: "what's pending — including V-2 follow-ups and any surplus siblings P-1 left for future waves") |
| Caller mode | `expand-current-bundle` (P-1 caller, with current seed id) OR `next-bundle` (default; N-1 caller) |
| Active mode | `process/session/.autonomous-session` |

---

## Outputs

| Output | Location |
|---|---|
| One bundle: seed + 0-N siblings | INSERT into `tasks` — seed first (`parent_task_id=NULL`), then siblings (`parent_task_id=$seed_id`). One transaction. |
| Decision-log entry | `command-center/product/product-decisions.md` (append-only) |

When caller mode is `expand-current-bundle`: skip seed INSERT; INSERT only new siblings under the supplied seed id.

---

## Fire timing

Always **inline**. Brain is single-threaded — no parallel sub-agent in background. The ritual runs synchronously within the calling stage (N-1 Action 7 or P-1 RESCOPE-AUTO-MERGE) and returns before the caller proceeds.

Strict modes (`founder-review` / `default`) defer to founder if the LLM emits `incomplete-scope`. Autonomous modes (`automatic` / `degenerate`) route the escalation to BOARD or ceo-agent per § Mode routing below.

---

## Triggering pathways

| Pathway | Detected by | Caller mode |
|---|---|---|
| Active milestone needs the next wave's bundle (no seed candidate, scope not shipped) | N-1 Survey & triggers Action 7 | `next-bundle` |
| P-1 RESCOPE-AUTO-MERGE — current wave is below floor, needs more scope | P-1 Decompose | `expand-current-bundle` (with current seed id) |
| Founder direct invoke | Session message | `next-bundle` |

---

## Process — 4 steps

### Step 1 — Input validation

Refuse to start unless ALL hold:

1. Active milestone exists: `SELECT 1 FROM milestones WHERE id = $active_milestone_id`.
2. Milestone is `status='in_progress'`. (Never decompose `todo` / `done` / `cancelled` / `blocked` milestones — promotion to `in_progress` is N-1's job; decomposition is for active.)
3. Milestone description prose has non-`_TBD_` `## Scope` and `## Success metric` sections (LLM-checks; required to author a coherent bundle).
4. Caller mode `next-bundle`: no seed candidate exists (`SELECT count(*) FROM tasks WHERE milestone_id=$active AND status='todo' AND wave_id IS NULL AND parent_task_id IS NULL` = 0). Caller mode `expand-current-bundle`: supplied seed exists and is `status='todo'`, `wave_id IS NULL`.

On failure: emit `validation-failed` with reason; no DB writes; surface to caller.

### Step 2 — LLM-author the bundle

Read milestone prose + already-shipped tasks + currently-open tasks. Produce:

- For `next-bundle` mode: ONE seed (title + prose description) + 0-N siblings (each: title + prose description).
- For `expand-current-bundle` mode: ONE or more siblings to append under the supplied seed id.

Each task description is prose: problem statement (1–2 sentences) + acceptance sketch (1–3 sentences) + relevant references (file paths, journey-map nodes, prior decisions when relevant).

**Sizing target.** The bundle should fit a wave's deterministic size rubric (per [`claudomat-brain/blocks/product/stages/P-1-decompose.md`](../../blocks/product/stages/P-1-decompose.md) § Maximum / Minimum rubric):
- Net LOC roughly 1,500–5,000.
- Files touched ≤ 60.
- 1 seed + 0-N siblings (typical: 0–3 siblings; bundles of 5+ are rare and usually indicate the wave should split).

If the LLM can't decide between two coherent next-bundle slices, it picks the one most aligned with the milestone's `## Scope` ordering. No formal DAG, no ordering metadata.

**Scope-too-vague guard:** if the prose can't anchor a coherent bundle (`## Success metric` reads `_TBD_`, `## Scope` is one line, no usable `## References`), emit `incomplete-scope` with the specific gap; surface to caller. Roadmap-planning will revisit and tighten the milestone prose.

### Step 3 — Atomic INSERT

```sql
-- next-bundle mode: seed + siblings
WITH seed AS (
  INSERT INTO tasks (title, description, status, milestone_id, wave_id, parent_task_id)
  VALUES ($1, $2, 'todo', $active_milestone_id, NULL, NULL)
  RETURNING id
)
INSERT INTO tasks (title, description, status, milestone_id, wave_id, parent_task_id)
SELECT unnest($3::text[]), unnest($4::text[]), 'todo', $active_milestone_id, NULL, seed.id
FROM seed;
```

```sql
-- expand-current-bundle mode: siblings only, attached to supplied seed
INSERT INTO tasks (title, description, status, milestone_id, wave_id, parent_task_id)
SELECT unnest($1::text[]), unnest($2::text[]), 'todo', $active_milestone_id, NULL, $supplied_seed_id;
```

One transaction. `id` / `created_at` / `updated_at` use column defaults. Brain MUST NOT pass `updated_at`.

If the INSERT fails (FK violation, CHECK constraint) → transaction rolls back; emit `validation-failed`; surface to caller.

### Step 4 — Recording

Append to `command-center/product/product-decisions.md`:

```
[YYYY-MM-DD] M<N> (<milestone title>): bundle authored — <N> tasks (<one-line slice description>)
- caller: <N-1-next-bundle | P-1-expand-current-bundle | founder-direct>
- decomposed by: <ritual | sub-agent task-id>
```

Under `degenerate` mode: also append to `process/session/updates/ceo-digest-<YYYY-MM-DD>.md`.

Commit `product-decisions.md`. Commit message: `chore(roadmap): bundle for <milestone-title> — <N> tasks`.

---

## Mode routing for escalation

Routine bundle authoring exits without escalation. Escalate per active mode when ANY:

- Step 1 validation fails for a reason the orchestrator can't fix inline (e.g. milestone description prose is `_TBD_` in load-bearing sections).
- Step 2 emits `incomplete-scope`.

| Mode | Route |
|---|---|
| `founder-review` / `default` | Defer to founder; ritual exits in `escalated` state; caller (N-1 / P-1) defers per its own DEFERRED handling. |
| `automatic` | Spawn BOARD with decision-slug `decompose-<m-id>-<caller-mode>` per `claudomat-brain/management/conflict-resolution.md`. Apply BOARD verdict. |
| `degenerate` | Invoke ceo-agent within `claudomat-brain/management/ceo-blocklist.md` charter. Apply verdict; append to ceo-digest. |

---

## Sub-agent invocation

Under `automatic` / `degenerate`: spawn via `Agent(subagent_type=milestone-decomposer)`. Brief on:

- Active milestone id.
- Caller mode (`next-bundle` / `expand-current-bundle`) + supplied seed id (when expanding).
- Active mode.

Sub-agent returns one of:

- `decomposition-complete` + the produced bundle summary (seed title + sibling titles + LOC estimate).
- `validation-failed` + reason.
- `incomplete-scope` + reason.
- `escalated` + the routing decision.

Caller consumes the return synchronously and proceeds.

Under `founder-review` / `default`: orchestrator runs the ritual inline (no sub-agent spawn). Sub-agent is preserved for context isolation under autonomous modes — the bundle-authoring prompt is its own concern and shouldn't pollute caller context.

---

## Failure modes

| Failure | Behavior |
|---|---|
| Input validation fails (Step 1) | Emit `validation-failed`; no writes; surface to caller. |
| Step 2 produces `incomplete-scope` | Emit; no writes; route per mode (typically defers back to roadmap-planning to tighten `## Scope` / `## Success metric`). |
| Step 3 FK or CHECK constraint violation | Transaction ROLLBACKs; emit `validation-failed`; surface. |
| Sub-agent timeout (autonomous modes) | Sub-agent emits `timeout`; caller treats as `validation-failed`; next N-1 retries. |

---

## Companion files

- [`claudomat-brain/ROADMAP/roadmap-lifecycle.md`](../roadmap-lifecycle.md) — schema, state machine, bundle structure, edit permissions.
- [`claudomat-brain/ROADMAP/roadmap-planning-ritual.md`](../roadmap-planning-ritual.md) — strategic ritual; produces empty milestones consumed here.
- [`claudomat-brain/db/SCHEMA.md`](../../db/SCHEMA.md) — DB contract.
- [`claudomat-brain/blocks/next/next.md`](../../blocks/next/next.md) — N-block dispatcher invoking this ritual at N-1.
- [`claudomat-brain/blocks/next/stages/N-1-survey-and-triggers.md`](../../blocks/next/stages/N-1-survey-and-triggers.md) Action 7 — detection.
- [`claudomat-brain/blocks/product/stages/P-1-decompose.md`](../../blocks/product/stages/P-1-decompose.md) — RESCOPE-AUTO-MERGE caller.
- `claudomat-brain/management/conflict-resolution.md` — BOARD routing under `automatic` mode.
- `claudomat-brain/management/ceo-blocklist.md` — ceo-agent charter under `degenerate` mode.

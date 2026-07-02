# V-2 — Triage

> **Block:** V (Verify), 6th of 8 in wave loop: `P → [D] → B → C → T → ` **`V`** ` → L → N`.
> **Stages:** V-1 → **V-2** → V-3 (gate / fast-fix loop). Advance on stage exit: V-3.
> **Pattern:** gate-only. head-verifier spawned at V-3 for verdict; reference card on demand at `~/.claude/agents/head-verifier.md`.
> **Dispatcher** (skip rules, fast-fix loop, gate semantics, exit handoff): `claudomat-brain/blocks/verify/verify.md`.

## Purpose

Classify every finding from T-block + V-1 (Karen + jenny outputs) into one of three buckets: blocking (V-3 fast-fix or B re-entry), non-blocking (`tasks` row INSERTed with `milestone_id` set when scope overlaps active milestone), noise (suppress with rationale). V-2 is the only stage that decides what blocks the wave from shipping.

## Prerequisites

- V-1 exited with Karen + jenny verdicts.
- READ `process/waves/wave-<N>/blocks/T/findings-aggregate.md` (T-block findings).
- READ `process/waves/wave-<N>/stages/V-1-karen.md` + `V-1-jenny.md` for raw findings.
- READ `command-center/dev/triage-routing-table.md` for classification rules.

## Skip condition

V-2 NEVER skips, even when zero findings exist — record explicit empty triage.

## Actions

### Action 1 — Aggregate inputs

Merge the master finding list:
1. T-block aggregate (`_findings-aggregate.md`).
2. Karen's V-1 findings.
3. jenny's V-1 findings.

Deduplicate: if T-6 layout and Karen V-1 describe the same off-token color, merge with both citations. Do NOT triple-count.

### Action 2 — Classify each finding

For each finding, apply the classification rubric:

| Bucket | Criteria |
|---|---|
| **Blocking** | Spec drift (jenny REJECT), critical Karen REJECT (fabricated claim), critical T-finding (acceptance criterion not met, security regression, broken auth flow, broken core journey). Wave cannot ship until resolved. |
| **Non-blocking** | Significant findings that don't violate spec but should be tracked: layout regression below threshold, perf within budget but degraded, coverage gap, Karen partial, jenny spec-gap. INSERT a plain `tasks` row (Action 4). |
| **Noise** | False positives, cosmetic micro-diffs, expected behavior surfaced as finding, prior-wave-known issues. Suppress with one-line rationale. |

Classification authority: orchestrator (Karen and jenny only report). Reclassified-as-noise findings: document the pattern in the deliverable for VERIFY-PRINCIPLES distillation.

Each non-blocking finding becomes a regular task row. Source citation (e.g., "T-6 layout regression", "Karen partial", "jenny spec-gap") goes in the task's prose description, not a structured tag.

### Action 3 — Route blocking findings

For each blocking finding, decide V-3 fast-fix candidacy. **Estimate is provisional** — V-3 enforces the 20 LOC threshold at execution and aborts to B re-entry if exceeded.

| Fast-fix candidate | Criteria |
|---|---|
| **Yes** | <20 LOC estimated, single file or tightly scoped, no schema change, no contract change. |
| **No (B re-entry)** | >20 LOC, schema/contract/architecture impact, multi-file refactor. |

Threshold is conservative — orchestrator may pull it DOWN (smaller fix still feels too risky) but NEVER UP. Pulling up is what V-3 cap-escalation is for. V-3 aborts at execution → record as "fast-fix mis-route"; pattern of mis-routes signals estimation drift.

### Action 4 — INSERT non-blocking findings as plain task rows

For each non-blocking finding, INSERT a `tasks` row:

```sql
INSERT INTO tasks (title, description, status, milestone_id, wave_id, parent_task_id)
VALUES (
  $finding_title,                          -- e.g. "Off-token color on settings panel header"
  $prose_description,                      -- problem statement + source citation + impact + suggested next step
  'todo',
  $milestone_id_or_null,                   -- active milestone's id when scope overlaps; else NULL (unassigned)
  (SELECT id FROM waves WHERE status = 'running' ORDER BY wave_number DESC LIMIT 1),  -- `Wave — current`: provenance for this finding
  NULL                                     -- top-level row; becomes a candidate seed for a future wave's bundle (N-2 picks it directly)
);
```

**`milestone_id` rule:** set to the active milestone's `id` when the finding's affected files / surfaces overlap the milestone's scope (LLM judgment from milestone's `## Scope` prose). Otherwise `NULL` — the row joins the unassigned queue for P-0 of a future wave to triage.

**`wave_id`** is always the current wave (preserves "which wave produced this" provenance).

**Description prose** carries everything humans need to triage: source (`V-1-karen` / `T-6-token-mismatch` / etc.), one-paragraph problem statement, observed vs expected, impact, suggested next step. No structured keys, no `tags:`, no `severity:`, no `urgency:` — the LLM judges priority by reading the prose when picking the next claimable task.

`id`, `status='todo'`, `created_at`, `updated_at` use column defaults; brain MUST NOT pass `updated_at` (trigger sets it).

### Action 5 — Record noise suppressions

Each suppressed finding gets a one-line rationale. Suppression patterns (3+ similar across waves) surface for VERIFY-PRINCIPLES promotion.

## Deliverable

`process/waves/wave-<N>/stages/V-2-triage.md` — full triage table, fast-fix queue, `tasks` row IDs created, noise log, plus YAML footer.

```yaml
findings_input_count: <n>
findings_blocking: [{id, source, summary, fast_fix_candidate}]
findings_non_blocking: [{id, source, summary, task_id, milestone_id}]   # milestone_id null = unassigned
findings_noise: [{id, source, summary, rationale}]
fast_fix_queue: [list of blocking findings routed to V-3]
b_block_re_entry_required: [list of blocking findings routed to B re-entry]
```

## Exit criteria

- Every finding from inputs classified into one of three buckets.
- Blocking findings routed to V-3 or B re-entry decision.
- Non-blocking findings INSERTed as plain `tasks` rows with prose descriptions and `milestone_id` set per overlap (else NULL).
- Noise suppressions documented.
- `process/waves/wave-<N>/checklist.md` V-2 row is checked.

## Next

- Fast-fix queue non-empty → `claudomat-brain/blocks/verify/verify.md` → V-3.
- Fast-fix queue empty AND no B re-entry needed → V-3 skips trivially; advance to L.
- B re-entry needed (any finding too big for V-3) → re-enter B-block at appropriate stage; V-block exit deferred until B + C + T cycle re-runs.

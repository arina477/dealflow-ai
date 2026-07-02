# P-1 — Decompose

> **Block:** P (Product), 1st of 8 in wave loop: **`P`** ` → [D] → B → C → T → V → L → N`.
> **Stages:** P-0 → **P-1** → P-2 → P-3 → P-4 (gate). Advance on stage exit: P-2.
> **Pattern:** gate-only. head-product spawned at P-4 for verdict; reference card on demand at `~/.claude/agents/head-product.md`.
> **Dispatcher** (skip rules, gate semantics, exit handoff): `claudomat-brain/blocks/product/product.md`.

## Purpose
Size the wave deterministically; emit `design_gap_flag`. Maximum threshold trips → split into first slice + sibling tasks. Below minimum floor → in-place repack via N-3; never defer. Repack cannot meet floor → escalate per active mode. Only the deterministic thresholds below justify split or merge — subjective "feels too big / small" does not.

## Prerequisites
- P-0 complete (`process/waves/wave-<N>/stages/P-0-frame.md` exists with disposition `PROCEED` or `RESCOPE-AUTO-SPLIT`)

## Maximum size rubric (split when over)

Any one threshold trips → `RESCOPE-AUTO-SPLIT`. OR-logic.

| Measure | Threshold | How to estimate |
|---|---|---|
| Files touched | > 60 | Count target files from task description + Explore pass if greenfield |
| New primitives | > 60 | Models + routes + services + migrations + SDKs + major components |
| Estimated net LOC | > 5,000 | Per-primitive rough estimate; err high |
| Stage 4 working set | > 350K tokens | Plan draft + SDK docs + per-agent briefs + working files |

## Wave type (set at P-1)

Determine wave type from N-2's `claimed_task_ids` count:

| Wave type | Trigger | P-2 spec template | P-4 Phase 2 reviewers |
|---|---|---|---|
| `single-spec` | `claimed_task_ids.length == 1` | Single narrative spec | Karen + jenny + Gemini (full set) |
| `multi-spec` | `claimed_task_ids.length >= 2` | Flat-list spec — each task gets its own self-contained block (ACs, contracts, edge cases, fix, tests) | Karen + jenny + Gemini (full set), each iterating per spec |

`wave_type` recorded in P-1 deliverable, propagated into P-2 spec contract; P-2 selects template by it. Reviewer set identical for both wave types.

## Minimum size floor (merge when under)

| Wave type | Floor — pass when |
|---|---|
| `single-spec` | estimated net LOC `> 1,500` |
| `multi-spec` | estimated net LOC `> 2,500` **OR** `claimed_task_ids.length >= 6` (whichever first) |

Below applicable floor → `RESCOPE-AUTO-MERGE`. No exemptions. Override-and-ship only via escalation path.

## Actions

### 1. Apply the maximum rubric
Estimate each maximum measure. Cite specific numbers. Any threshold trips → set verdict `RESCOPE-AUTO-SPLIT`, continue to step 2. Otherwise continue to step 1b.

### 1b. Determine wave_type and apply the minimum floor

Count `claimed_task_ids` (from N-2's bundle decision). Set `wave_type`:
- `claimed_task_ids.length == 1` → `wave_type: single-spec`
- `claimed_task_ids.length >= 2` → `wave_type: multi-spec`

Apply wave_type-specific floor:
- `single-spec`: estimated net LOC `> 1,500` → step 3. Otherwise → `RESCOPE-AUTO-MERGE`, continue to step 2b.
- `multi-spec`: estimated net LOC `> 2,500` **OR** `claimed_task_ids.length >= 6` → step 3. Otherwise → `RESCOPE-AUTO-MERGE`, continue to step 2b.

### 2. RESCOPE-AUTO-SPLIT protocol (only if maximum rubric trips)

The current wave's bundle (seed + siblings, set by N-2) is too big. Strategy: narrow `claimed_task_ids` to fit the cap; re-parent surplus siblings to NULL so they become candidate seeds for future waves.

Produce:
1. Which thresholds tripped (with estimated numbers).
2. A concrete split proposal — which tasks stay in this wave, which move out.
3. First-slice scope that fits under all four thresholds **AND above the applicable floor for its prospective wave_type** (single-spec: > 1,500 LOC; multi-spec: > 2,500 LOC OR ≥ 6 specs).

Orchestrator re-parents surplus siblings to NULL (they become top-level candidate seeds for future waves; N-2's seed-pick query naturally surfaces them):

```sql
UPDATE tasks
SET parent_task_id = NULL
WHERE id = ANY($surplus_sibling_ids::uuid[]);
```

Current wave's `claimed_task_ids` narrows to `[seed, ...retained_siblings]`. Surplus stays under the active milestone (`milestone_id` unchanged, `wave_id` was NULL, stays NULL); they're picked up by N-2 on a future wave.

If even the seed alone trips a threshold (unbreakable monolith) → escalate to founder / ceo-agent per active mode. Resolution path is typically founder authoring a new task with smaller scope and CANCELling the oversized seed.

If the proposed first slice would fall below the single-spec floor (1,500 LOC), do NOT split — route to step 2b's MERGE protocol with `split_inverted: true` flagged in the deliverable.

### 2b. RESCOPE-AUTO-MERGE protocol (only if minimum floor trips)

The current wave's bundle is below the size floor. Per-wave decomposition means there's no pre-authored pool to pull from — instead, re-invoke decomposition with caller mode `expand-current-bundle` to author additional siblings under the current seed.

1. **Call decomposition with hint `expand-current-bundle`.** Pass the current seed id + the gap (estimated current LOC vs floor). Decomposition reads milestone prose, picks an adjacent `## Scope` item not yet authored, and INSERTs 1–2 new siblings under the current seed (per [`milestone-decomposition-ritual.md`](../../../ROADMAP/milestones/milestone-decomposition-ritual.md) § Caller modes).
2. **Re-query siblings under the seed** to pick up the new rows:
   ```sql
   SELECT id, title, description
   FROM tasks
   WHERE parent_task_id = $seed_task_id AND wave_id IS NULL AND status='todo';
   ```
   All such rows (existing + freshly authored) join `claimed_task_ids`.
3. **Re-evaluate LOC.** If floor now met → verdict `PROCEED-AFTER-MERGE`, continue to step 3.
4. **Recursion guard.** P-1 calls decomposition at most ONCE per wave. If floor still unmet after one expansion → escalate per active mode. Resolution paths: (a) override-ship-anyway (logged in `product-decisions.md`); (b) cancel seed (`UPDATE tasks SET status='cancelled' WHERE id = $seed`); (c) hold-until-roadmap-planning (milestone-level consolidation review).

Floor-pack attempt counting is wave-local: P-1 deliverable records `floor_merge_attempt: <0|1>` in its FS YAML footer, not in the DB.

Mode routing for escalation:

| Mode | Route |
|---|---|
| `founder-review` / `default` | Founder via `AskUserQuestion` |
| `automatic` | BOARD with decision-slug `P-1-floor-merge-wave-<N>` |
| `degenerate` | ceo-agent within `ceo-blocklist.md` |

Escalation deliverable records: decomposition expansion result, reason floor still unmet, chosen path.

### 3. design_gap_flag (mandatory)

Walk every page / component / icon / flow the (sliced) wave will touch. For each, check `design/staging/` and `design/DESIGN-SYSTEM.md` for an existing mockup or token reference.

Emit:
```yaml
design_gap_flag: true | false
missing_surfaces:
  - <route-or-component>: <one-line purpose + prior art reference>
  - ...
```

`true` if any UI surface lacks a mockup. `false` if backend-only / infra-only / doc-only / pure bug-fix with no UI surface OR all touched UI surfaces already have mockups. **Never absent** — block dispatcher's handoff to D vs B depends on it.

## Deliverable
`process/waves/wave-<N>/stages/P-1-decompose.md` — one file with:
- Maximum-rubric estimates (all four measures)
- `wave_type` (`single-spec` | `multi-spec`) — derived from `claimed_task_ids.length`
- Minimum-floor estimate (net LOC) + applicable threshold for the wave_type
- Verdict (`PROCEED` / `RESCOPE-AUTO-SPLIT` / `RESCOPE-AUTO-MERGE` / `PROCEED-AFTER-MERGE` / `ESCALATED-FLOOR-UNMET`)
- Sibling task IDs created (if split) OR bundled-in task IDs (if merge)
- `floor_merge_attempt` count (FS-only; not stored in DB)
- `design_gap_flag` + `missing_surfaces` list

Also: update `process/waves/wave-<N>/blocks/P/review-artifacts.md` — mark P-1 row `done`, set `design_gap_flag` in "Block-specific context".

## Exit criteria
- Maximum-rubric estimates recorded with cited numbers
- Minimum-floor estimate recorded
- Verdict resolved to one of the five terminal states
- Siblings INSERTed as `tasks` rows (if split) OR bundled-in task IDs recorded (if merged)
- `floor_merge_attempt` recorded in the deliverable's YAML footer
- `design_gap_flag` emitted (true or false, never absent)
- `process/waves/wave-<N>/checklist.md` P-1 box ticked

## Next
→ `P-2 Spec` (`stages/P-2-spec.md`) — unless P-0 short-circuit returned `valid`, in which case skip to `P-3 Plan`

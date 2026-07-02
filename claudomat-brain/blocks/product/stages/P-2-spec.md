# P-2 — Spec

> **Block:** P (Product), 1st of 8 in wave loop: **`P`** ` → [D] → B → C → T → V → L → N`.
> **Stages:** P-0 → P-1 → **P-2** → P-3 → P-4 (gate). Advance on stage exit: P-3.
> **Pattern:** gate-only. head-product spawned at P-4 for verdict; reference card on demand at `~/.claude/agents/head-product.md`.
> **Dispatcher** (skip rules, gate semantics, exit handoff): `claudomat-brain/blocks/product/product.md`.

## Purpose
Author the wave's acceptance criteria and observable contracts. V — Verify gates against the spec, not the plan. Ambiguity surfaces as Karen / jenny rejections at P-4 or spec-rejected back-channel from V-2.

## Prerequisites
- P-1 complete (`process/waves/wave-<N>/stages/P-1-decompose.md` exists with `PROCEED` / `PROCEED-AFTER-MERGE` verdict, `design_gap_flag` set, `wave_type` set to `single-spec` or `multi-spec`)
- Task scope is the (possibly sliced / packed) wave from P-1

## Skip condition
P-0 short-circuit returned `valid` → skip this stage. Otherwise it runs.

## Wave-type-driven template selection

Read `wave_type` from P-1's deliverable.

| wave_type | Structure | Reviewer iteration at P-4 |
|---|---|---|
| `single-spec` | Single narrative spec | Once across the spec |
| `multi-spec` | Flat list of N self-contained spec blocks; each has its own ACs, contracts, edge cases | Per-spec block |

Multi-spec blocks are never merged into one narrative.

## Actions

For `single-spec` waves, run Actions 1–3 once on the seed task. For `multi-spec` waves, run Actions 1–3 once **per task in `claimed_task_ids`**, producing one spec block per task. Action 4 and Action 5 run once per wave regardless.

### 1. Acceptance criteria
For each user-visible behavior the (sub-)task delivers, write a falsifiable acceptance criterion. Avoid:
- Vague success language ("works correctly", "behaves intuitively")
- Internal implementation language ("uses X service", "calls Y endpoint") — those go in P-3
- Untestable assertions

Each criterion must be:
- Observable from outside (UI state, API response, DB row, log line)
- Tied to a user action or system event
- Stated in present-tense, deterministic terms

### 2. Observable contracts
For every interface this wave touches:
- **Types / Zod / TypeScript interfaces** — exact shape, including new fields and field renames
- **API contracts** — endpoint path, method, request schema, response schema, status codes, error envelopes
- **Data contracts** — DB schema deltas if relevant (DDL or migration intent)
- **SDK contracts** — if a third-party SDK is involved, name the methods + signatures the wave depends on

Reference existing files where the contract already lives (don't duplicate). For net-new contracts, draft the shape inline.

### 3. Edge cases + error states
List explicitly:
- Empty / null / zero / negative inputs
- Concurrent or out-of-order events
- Permission boundaries (anon / user / admin)
- Failure modes (network, third-party 5xx, partial writes)
- Each: expected behavior + how it surfaces to the user

### 4. Determine claimed task IDs

Read `process/waves/wave-<N>/stages/P-1-decompose.md` (P-1 deliverable) for the sibling-bundle list. The wave's spec contract claims:

- The primary task ID (the `next-claimable` task P-0 picked up).
- Plus every sibling task ID P-1 bundled into this wave under the size rubric.

Record the full list as `claimed_task_ids: [task-id-1, task-id-2, ...]`. Load-bearing for downstream blocks:

- **B-0** sets every claimed task to `in_progress` (CHECK-enforced enum value).
- **L-2** marks every claimed task `done` at wave close.
- **N-2** uses it to compute the next bundle decision (already-claimed tasks are excluded from `Task — next claimable` results).

If P-1 produced no siblings (single-task wave), the list contains exactly one ID — never empty.

### 5. Write the spec to the task's `description`

Write the spec contract into the primary task's `tasks.description` as a **fenced YAML block at the head of the description, followed by `---` separator, followed by prose body** (the spec-contract carve-out per [`claudomat-brain/db/SCHEMA.md`](../../../db/SCHEMA.md)). The primary task row already exists at this point (pre-authored by roadmap-planning, or pulled from the unassigned queue by P-0); use `UPDATE tasks SET description = … WHERE id = '<primary-task-id>'`, not INSERT.

For `single-spec` waves:

````markdown
```yaml
spec-id: wave-<N>-spec
wave_type: single-spec
claimed_task_ids: [<primary-task-id>]
acceptance-criteria:
  - <falsifiable statement>
  - ...
contracts:
  types:    [<files or inline>]
  api:      [<endpoint specs>]
  data:     [<schema deltas>]
  sdk:      [<sdk method dependencies>]
edge-cases:
  - <case>: <expected behavior>
  - ...
design_gap_flag: <true|false>     # carried from P-1
created-at: <ISO timestamp>
```
---

<prose body — problem statement, context, references, anything humans need to triage the row outside of a wave>
````

For `multi-spec` waves, the YAML block carries a flat list of self-contained spec blocks — each block has its own ACs / contracts / edge cases (no merged narrative):

````markdown
```yaml
spec-id: wave-<N>-spec
wave_type: multi-spec
claimed_task_ids: [<task-id-1>, <task-id-2>, ..., <task-id-N>]
design_gap_flag: <true|false>     # OR-logic across blocks; carried from P-1
created-at: <ISO timestamp>
specs:
  - task_id: <task-id-1>
    title: <task title>
    acceptance-criteria: [ ... ]
    contracts: { types: [...], api: [...], data: [...], sdk: [...] }
    edge-cases: [ ... ]
  - task_id: <task-id-2>
    title: <task title>
    acceptance-criteria: [ ... ]
    contracts: { ... }
    edge-cases: [ ... ]
  # ... one block per claimed task
```
---

<prose body>
````

The primary task's `tasks.description` IS the spec contract. Sibling tasks reference the primary via the `parent_task_id` FK (no backpointer text in description); P-0's spec-freshness check walks `parent_task_id` from a sibling up to the primary, then parses the primary's YAML head.

Multi-spec: each block is self-contained. P-4 reviewers iterate per-block. Contract is structurally `[Spec 1, …, Spec N]`, never merged.

## Deliverable
- The primary task's `tasks.description` updated with the YAML head + `---` + prose body.
- `process/waves/wave-<N>/stages/P-2-spec.md` — short pointer file referencing the `tasks` row id + a copy of acceptance criteria for ease of reference during P-3..P-4.

Also: update `process/waves/wave-<N>/blocks/P/review-artifacts.md` — mark P-2 row `done`, set `claimed_task_ids` in "Block-specific context".

## Exit criteria
- Acceptance criteria all falsifiable + observable
- All touched contracts named (types / API / data / SDK as relevant)
- Edge cases + error states enumerated
- `claimed_task_ids` populated with primary + every P-1 sibling (never empty)
- Spec contract written into the primary task's `tasks.description` as YAML head + `---` + prose; siblings linked via `parent_task_id` FK
- `process/waves/wave-<N>/checklist.md` P-2 box ticked

## Next
→ `P-3 Plan` (`stages/P-3-plan.md`)

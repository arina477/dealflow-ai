# B-2 — Backend

> **Block:** B (Build), 3rd of 8 in wave loop: `P → [D] → ` **`B`** ` → C → T → V → L → N`.
> **Stages:** B-0 → B-1 → **B-2** → B-3 → B-4 → B-5 → B-6 (gate). Advance on stage exit: B-3.
> **Pattern:** gate-only. head-builder spawned at B-6 for verdict; reference card on demand at `~/.claude/agents/head-builder.md`.
> **Dispatcher** (skip rules, parallelization, gate semantics, exit handoff): `claudomat-brain/blocks/build/build.md`.

## Purpose

Implement API routes, services, and business logic against the locked schema (B-0) and contracts (B-1). B-2 may parallelize across independent services within the wave, but cannot start before B-1 exits (default sequence) unless the fast-path was approved.

## Prerequisites

- B-1 exited (contracts committed or explicitly skipped).
- B-0 exited (branch + schema committed or schema explicitly skipped).
- READ `claudomat-brain/blocks/build/build.md` (block dispatcher).
- READ `process/waves/wave-<N>/stages/P-3-plan.md` § backend steps.
- READ `command-center/principles/BUILD-PRINCIPLES.md` + `command-center/principles/dev-principles.md`.
- READ `process/waves/wave-<N>/stages/B-1-contracts.md` to inherit the `fast_path_approved` flag — if `true`, this stage may run in parallel with B-3 (orchestrator spawns both; both must complete before B-4).
- VERIFY each backend specialist named in the plan exists in `command-center/AGENTS.md` and `process/session/.capability-sheet.md` (always-on rules #5 + #12).

## Skip condition

Skip B-2 only on pure-frontend waves (rare — most "frontend" waves still touch at least one API endpoint). Confirm by reading the plan; if any backend file is referenced, B-2 fires.

On skip: deliverable records the skip.

## Actions

### Action 1 — Spawn specialists

Per the plan's specialist routing, spawn each backend specialist (typically `backend-developer`, `node-specialist`, `python-pro`, `rails-expert`, etc. — never substitute silently). Each spawn:

1. First directive: reference `command-center/Sub-agent Instructions/<name>-instructions.md`.
2. Pass: the spec contract, the locked contract files from B-1, the schema state from B-0, the file-level plan steps for this specialist.
3. Require a "Deviation from plan" section in the agent's report.

**Parallelization.** Spawn multiple specialists in the same orchestrator message when their file scopes don't overlap (e.g., one specialist owns `services/orders/`, another owns `services/notifications/`). Sequence them when one's output is the other's input.

### Action 2 — Implement per plan

Each specialist implements its assigned files. Adherence to the plan is the contract — file targets, method names, and architectural decisions are not suggestions.

### Action 3 — Apply `/simplify`

Run `/simplify` on each touched file after implementation. Positive directive, not optional.

### Action 4 — Adjudicate deviations

Read every specialist's "Deviation from plan" section:
- **Allowed:** minor implementation choices within plan scope (e.g., choosing between two equivalent patterns, helper function extraction).
- **Must reject:** silent contradictions of plan file targets, method names, architectural decisions, or any P-4 gate finding.

Rejected deviations: specialist re-implements per plan. On technical error invoke `/investigate` per Iron Law.

## Deliverable

`process/waves/wave-<N>/stages/B-2-backend.md` — records specialists spawned, files implemented, deviation reports + adjudications, plus YAML footer.

```yaml
skipped: false
fast_path_active: false               # carried over from B-1's fast_path_approved
specialists_spawned: [list]
files_implemented: [list]
deviations: [{specialist, change, plan_said, why, adjudication}]
simplify_applied: true
```

## Exit criteria

- Every backend plan target implemented.
- Deviations adjudicated.
- `/simplify` applied.
- `process/waves/wave-<N>/checklist.md` B-2 row is checked.

## Next

→ `claudomat-brain/blocks/build/build.md` → B-3 (or B-4 if running fast-path with B-2 || B-3 already complete).

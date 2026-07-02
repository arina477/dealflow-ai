# B-3 — Frontend

> **Block:** B (Build), 3rd of 8 in wave loop: `P → [D] → ` **`B`** ` → C → T → V → L → N`.
> **Stages:** B-0 → B-1 → B-2 → **B-3** → B-4 → B-5 → B-6 (gate). Advance on stage exit: B-4.
> **Pattern:** gate-only. head-builder spawned at B-6 for verdict; reference card on demand at `~/.claude/agents/head-builder.md`.
> **Dispatcher** (skip rules, parallelization, gate semantics, exit handoff): `claudomat-brain/blocks/build/build.md`.

## Purpose

Implement UI components, state, and integration against the locked contracts (B-1) and the canonicalized designs (D-3, when applicable). B-3 may parallelize across independent pages within the wave, but cannot start before B-2 exits (default sequence) unless the fast-path was approved.

## Prerequisites

- B-2 exited (backend committed or explicitly skipped) — UNLESS fast-path is active per B-1's `fast_path_approved`, in which case B-3 may run in parallel with B-2.
- B-1 exited (contracts committed or explicitly skipped).
- D-block exited (when `design_gap_flag: true` was set on the spec contract).
- READ `process/waves/wave-<N>/stages/B-1-contracts.md` to inherit the `fast_path_approved` flag.
- READ `process/waves/wave-<N>/stages/P-3-plan.md` § frontend steps.
- READ `design/<feature>.html` for every UI surface this wave implements (canonicalized at D-3).
- READ `design/DESIGN-SYSTEM.md` (token reference).
- READ `command-center/principles/BUILD-PRINCIPLES.md` + `command-center/principles/dev-principles.md`.
- VERIFY each frontend specialist named in the plan exists in `command-center/AGENTS.md` and `process/session/.capability-sheet.md`.

## Skip condition

Skip B-3 on backend-only / infra-only / doc-only waves (no UI surface). Confirm by reading the plan; if any frontend file is referenced or any `design/<feature>.html` was canonicalized at D-3, B-3 fires.

On skip: deliverable records the skip.

## Actions

### Action 1 — Spawn specialists

Per the plan's specialist routing, spawn each frontend specialist (typically `frontend-developer`, `nextjs-developer`, `react-specialist`, `vue-expert`, etc.). Each spawn:

1. First directive: reference `command-center/Sub-agent Instructions/<name>-instructions.md`.
2. Pass: the canonicalized design path(s), the locked contract files from B-1, the backend service shapes from B-2, the file-level plan steps for this specialist.
3. Require a "Deviation from plan" section.

**Parallelization.** Spawn multiple specialists when page scopes don't overlap (e.g., one specialist owns `app/settings/`, another owns `app/orders/`). Sequence when one page imports a component the other authors.

### Action 2 — Implement per plan + design

Each specialist implements assigned files. Adherence to BOTH plan and design is the contract:
- **Plan adherence** — file targets, component names, architectural decisions.
- **Design adherence** — every visual primitive consumed from `design/DESIGN-SYSTEM.md` (no invented hex values, no fabricated tokens). Match the canonicalized `design/<feature>.html` structure.

If the design and the plan conflict, pause and route per the conflict's direction:

| Conflict direction | Defect class | Recovery |
|---|---|---|
| Plan references a UI surface NOT present in `design/<feature>.html` | **D-1 audit defect** — D-block missed a gap | Re-enter D-1 for the missing surface (per block dispatcher § "Design-gap fallback"). |
| Design includes a UI surface NOT mentioned in the plan | **P-3 plan-authoring defect** — plan missed a surface the design covers | Re-enter P-3 to extend the plan; B-3 then resumes against the updated plan. |
| Plan and design BOTH reference the same surface but disagree on shape (e.g., plan says button, design shows link) | **P-3 plan defect** — plan didn't honor the design at P-3 authoring time | Re-enter P-3 to reconcile (design wins at the surface level; plan adjusts file targets / component naming accordingly). |

Do NOT let the implementer improvise a resolution — inconsistency is the #1 drift vector.

### Action 3 — Apply `/simplify`

Run `/simplify` on each touched file after implementation.

### Action 4 — Adjudicate deviations

Same protocol as B-2: read every "Deviation from plan" section, accept minor, reject silent contradictions. On technical error invoke `/investigate`.

## Deliverable

`process/waves/wave-<N>/stages/B-3-frontend.md` — records specialists spawned, files implemented, design surfaces consumed, deviation reports + adjudications, plus YAML footer.

```yaml
skipped: false
fast_path_active: false               # carried over from B-1's fast_path_approved
specialists_spawned: [list]
files_implemented: [list]
designs_consumed: [list of design/<feature>.html paths]
deviations: [{specialist, change, plan_said, why, adjudication}]
simplify_applied: true
```

## Exit criteria

- Every frontend plan target implemented.
- Every UI surface matches canonicalized design.
- Deviations adjudicated.
- `/simplify` applied.
- `process/waves/wave-<N>/checklist.md` B-3 row is checked.

## Next

→ `claudomat-brain/blocks/build/build.md` → B-4.

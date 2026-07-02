# P-3 — Plan

> **Block:** P (Product), 1st of 8 in wave loop: **`P`** ` → [D] → B → C → T → V → L → N`.
> **Stages:** P-0 → P-1 → P-2 → **P-3** → P-4 (gate). Advance on stage exit: P-4.
> **Pattern:** gate-only. head-product spawned at P-4 for verdict; reference card on demand at `~/.claude/agents/head-product.md`.
> **Dispatcher** (skip rules, gate semantics, exit handoff): `claudomat-brain/blocks/product/product.md`.

## Purpose
Architecture deltas, data model, API surface, new deps (the *how* at system-design level), then file-level execution plan: which specialist, what order, what inputs. P-2 says *what*; P-3 says *how* and *who-does-what-where*. B-block reads this plan; head-builder enforces it.

## Prerequisites
- P-2 complete (spec contract in the primary task's `tasks.description`, or short-circuited as `valid` at P-0)
- `command-center/AGENTS.md` available (validates specialist routing in Action 6)

## Actions

### Action 1 — Architecture deltas
For each service / module / page the wave changes:
- **What's new / what changes / what's removed** — at architectural granularity (a service boundary, a state machine, a render path), not file-level
- **Why this approach over alternatives** — name 1-2 alternatives considered and why this one wins (avoid "the obvious choice" — name the trade-off)
- **Failure-domain impact** — does the change cross a service boundary? expand a transaction scope? change a permission check?

### Action 2 — Data model
If schema changes, declare:
- Added / renamed / removed columns + tables
- Migration strategy (online / offline, backfill required?)
- Index changes
- FK / unique constraint changes

For NoSQL or document stores: document shape changes + read-path impact.

### Action 3 — API contracts (concrete)
For every endpoint this wave adds or modifies:
- Path + method
- Request schema (link to types/Zod source)
- Response schema (success + error)
- Auth model (anon / authed / role-gated)
- Idempotency / retry semantics

### Action 4 — Dependency list
For each new third-party dep:
- Name + version pin
- Why this one (not alternative X)
- Bundle / runtime cost
- License compatibility

**New external SDK** → read `claudomat-brain/rules/external-sdk-integration-rules.md` and complete pre-build checklist BEFORE finalizing approach. Do not plan against assumed API surfaces — verify installed versions, method signatures, env-var contracts.

### Action 5 — File-level steps
For every file the wave touches, list:
- **Path** — exact file path
- **Operation** — create / modify / rename / delete
- **What changes** — one-line description
- **Specialist** — sub-agent name from `AGENTS.md` (or "orchestrator" for trivial edits)
- **Order constraint** — depends on file X being done first? part of a parallel batch?

Group by B-stage:
- **B-1 Schema** — DB migration files, ORM models
- **B-2 Contracts** — types / Zod / OpenAPI files
- **B-3 Backend** — routes, services, business logic
- **B-4 Frontend** — components, state, integration
- **B-5 Wiring** — env, route registration, type-check fixers

### Action 6 — Specialist routing (validate against AGENTS.md)
Every specialist must exist in `command-center/AGENTS.md`. Missing specialist → route through `claudomat-brain/setup-tools/agent-creator/agent-creator.md` BEFORE finalizing. Do not silently substitute.

### Action 7 — Parallelization map
Within each B-stage, list which files can run in parallel and which must serialize:
- Parallel batch: list of file paths handled by independent specialist calls
- Serial chain: ordered list (file A → file B → file C)

### Action 8 — Post-write consistency check
After authoring / revising, sweep:
1. Every P-2 acceptance criterion maps to ≥1 file-level step.
2. Every file-level step has a specialist.
3. No file appears in multiple parallel batches.
4. `design_gap_flag` is referenced (true or false).
5. Architecture deltas declared with explicit alternative trade-offs (Action 1).
6. Data + API contracts concrete — no "TBD" fields (Actions 2–3).
7. New deps justified (Action 4).
8. SDK pre-build checklist complete (if applicable).

Reconcile any contradiction before P-4.

## Deliverable
`process/waves/wave-<N>/stages/P-3-plan.md` — one file with two sections:

**Approach section:**
- Architecture deltas (per service / module)
- Data model changes (if any)
- API contracts (concrete, per endpoint)
- New deps list (with rationale)
- SDK pre-build checklist results (if applicable)

**Plan section:**
- File-level steps grouped by B-stage
- Specialist routing (validated)
- Parallelization map
- Self-consistency sweep results

Also: update `process/waves/wave-<N>/blocks/P/review-artifacts.md` — mark P-3 row `done`.

## Exit criteria
- Architecture deltas declared with explicit alternative trade-offs
- Data + API contracts concrete (no "TBD" fields)
- New deps justified
- SDK pre-build checklist complete (if applicable)
- Every file in scope has a step + specialist
- Every specialist exists in `AGENTS.md`
- Parallelization map drawn
- Self-consistency sweep clean
- `process/waves/wave-<N>/checklist.md` P-3 box ticked

## Next
→ `P-4 Gate` (`stages/P-4-gate.md`)

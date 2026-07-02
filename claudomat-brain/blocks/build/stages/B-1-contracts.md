# B-1 — Contracts

> **Block:** B (Build), 3rd of 8 in wave loop: `P → [D] → ` **`B`** ` → C → T → V → L → N`.
> **Stages:** B-0 → **B-1** → B-2 → B-3 → B-4 → B-5 → B-6 (gate). Advance on stage exit: B-2.
> **Pattern:** gate-only. head-builder spawned at B-6 for verdict; reference card on demand at `~/.claude/agents/head-builder.md`.
> **Dispatcher** (skip rules, parallelization, gate semantics, exit handoff): `claudomat-brain/blocks/build/build.md`.

## Purpose

Lock shared types, runtime validators, and API contracts before B-2 backend and B-3 frontend diverge. Second foundation gate of the B-block: contracts authored after B-2 starts will produce server↔client drift.

## Prerequisites

- B-0 exited (branch + schema committed or schema explicitly skipped).
- READ `process/waves/wave-<N>/stages/P-3-plan.md` § "API contracts" for contract deltas, and "B-1 Contracts" file-level steps.
- READ `command-center/principles/BUILD-PRINCIPLES.md` and any `contract-principles.md` if they exist.

## Skip condition

Skip B-1 when the approach declares no contract surface changes (no new API, no new SDK, no Zod schema changes, no shared-types file edits). Confirm by reading P-3 plan § "API contracts."

On skip: write the deliverable with `skipped: true`, note whether the **fast-path exception** applies (B-2 || B-3 in parallel — see block dispatcher); the head-builder gate at B-6 ratifies the fast-path approval if requested.

## Actions

### Action 1 — Author shared types / Zod schemas

Spawn the contract specialist named in `process/waves/wave-<N>/stages/P-3-plan.md` (typically `typescript-pro`, `api-designer`, or a backend specialist). The specialist:

1. Writes / updates shared type files (e.g., `packages/shared/src/types/<feature>.ts`).
2. Writes / updates runtime validators (e.g., Zod schemas) — both server and client consume the same source of truth.
3. Updates OpenAPI / GraphQL schema if the project uses one.
4. Reports any deviation from the plan.

### Action 2 — Update SDK contracts (conditional)

If the wave touches an external SDK or generates a client SDK:
1. Update the SDK's contract files per the approach.
2. Regenerate any auto-generated client code (e.g., `openapi-typescript`, `graphql-codegen`).
3. Verify generated artifacts are committed (not gitignored).

### Action 3 — Local typecheck (contract files in isolation)

Typecheck ONLY the contract files / packages — do NOT run repo-wide typecheck here. Repo-wide typecheck is B-4's job.

Examples:
- pnpm monorepo with shared package: `pnpm --filter @<scope>/shared typecheck`
- Single-tsconfig project: `tsc --noEmit -p packages/shared/tsconfig.json`
- Generated SDK package: typecheck the SDK package only.

The contract files must compile in isolation. Consumer breakage (B-2 routes, B-3 components referencing the new contract) is expected and not B-1's concern — those consumers are written in B-2/B-3 and validated repo-wide at B-4.

### Action 4 — Commit atomically

One commit per logical contract surface:
- Shared types + validators + OpenAPI/GraphQL deltas + regenerated SDK code in the same commit.
- Message: `feat(contracts): B-1 <slug> for wave-<N>`.

### Action 5 — Adjudicate technical errors

On technical error invoke `/investigate`. Specialist deviation reports adjudicated.

**Fast-path decision (if B-1 is a skip):** record explicit approve / deny for running B-2 || B-3 in parallel. Default: deny (sequence).

## Deliverable

`process/waves/wave-<N>/stages/B-1-contracts.md` — records contract files, generated SDK deltas, fast-path decision (if skip), deviation reports, plus YAML footer.

```yaml
skipped: false
contracts_authored: [list]
sdk_regenerated: false
fast_path_approved: false           # only meaningful when skipped: true
deviations: [list]
```

## Exit criteria

- Contracts committed atomically.
- Repo typecheck passes for contract files (consumer breakage allowed — that's B-2/B-3).
- `process/waves/wave-<N>/checklist.md` B-1 row is checked.

## Next

- Default → `claudomat-brain/blocks/build/build.md` → B-2 (then B-3 sequentially).
- Fast-path approved (B-1 skipped + head-builder approval) → B-2 and B-3 spawn in parallel; both must complete before B-4.

# B-4 — Wiring

> **Block:** B (Build), 3rd of 8 in wave loop: `P → [D] → ` **`B`** ` → C → T → V → L → N`.
> **Stages:** B-0 → B-1 → B-2 → B-3 → **B-4** → B-5 → B-6 (gate). Advance on stage exit: B-5.
> **Pattern:** gate-only. head-builder spawned at B-6 for verdict; reference card on demand at `~/.claude/agents/head-builder.md`.
> **Dispatcher** (skip rules, parallelization, gate semantics, exit handoff): `claudomat-brain/blocks/build/build.md`.

## Purpose

Catch B-2 ↔ B-3 drift before local verify. B-4 is the integration gate: end-to-end typecheck across the repo (server + client + shared), route registration, env wiring, import sanity.

## Prerequisites

- B-2 exited (backend committed).
- B-3 exited (frontend committed) — or B-3 was skipped explicitly.
- READ `process/waves/wave-<N>/stages/P-3-plan.md` § "Wiring" if the plan calls one out, otherwise infer from the cross-stage handoffs.

## Skip condition

B-4 does NOT skip even on backend-only or frontend-only waves — the integration check is the value. The only legitimate skip is when both B-2 AND B-3 are skipped (doc-only / infra-only with no code change), in which case B-4 trivially passes.

## Actions

### Action 1 — Repo-wide typecheck

Run the project's repo-wide typecheck (e.g., `pnpm typecheck` at the root). All packages, all files. Zero errors required.

If errors surface, they are by definition contract drift — B-1 contracts, B-2 backend, and B-3 frontend disagree about a type. Route per Iron Law:
1. Identify the drifting boundary (server emits X, client consumes Y).
2. Determine which side is wrong by reading the contract files committed at B-1.
3. Re-enter the failing stage (B-2 or B-3) for the affected files.
4. Log the drift in `process/waves/wave-<N>/stages/B-4-wiring.md` as a B-2 or B-3 defect.

### Action 2 — Route registration

If the wave added new API routes:
1. Verify each new backend route is registered in the project's router config (e.g., `app.use(...)`, file-system router, OpenAPI spec).
2. Verify the client's API caller knows about the new route (typed SDK, query hook, etc.).

If the wave added new frontend routes:
1. Verify the route is registered in the project's frontend router (e.g., `app/<route>/page.tsx`, `routes.ts`).
2. Verify navigation entries (sidebar, header, etc.) point to the new route per the design.

**B-4 verifies; it does not author.** Frontend route registration and navigation entry edits are B-3's responsibility. If either is missing at B-4, classify as a **B-3 defect** and re-enter B-3 for the missing surface — B-4 does NOT add the registration itself. Same applies to backend route registration as a B-2 defect.

### Action 3 — Env wiring

If B-0 added new env vars:
1. Verify they're consumed where the plan said they would be.
2. Verify `.env.example` has placeholders for all new vars.
3. Verify no new env var is accessed without a fallback or explicit error message.

### Action 4 — Import sanity

Quick grep for orphan imports (files imported that don't exist) and dead-code imports the new code may have left behind. Many projects' typecheck catches this — if yours does, this action collapses into Action 1.

### Action 5 — Adjudicate technical errors

On typecheck failure: do NOT fix directly — invoke `/investigate`, classify as B-2 or B-3 defect, re-enter that stage.

## Deliverable

`process/waves/wave-<N>/stages/B-4-wiring.md` — records typecheck outcome, routes registered, env wiring deltas, drift defects (if any), plus YAML footer.

```yaml
typecheck_passed: true
routes_registered: [list]
env_vars_wired: [list]
drift_defects: []                     # empty on clean exit; populated only if B-2/B-3 were re-entered
```

## Exit criteria

- Repo typecheck passes.
- All new routes registered on both sides.
- Env wiring verified.
- `process/waves/wave-<N>/checklist.md` B-4 row is checked.

## Next

→ `claudomat-brain/blocks/build/build.md` → B-5.

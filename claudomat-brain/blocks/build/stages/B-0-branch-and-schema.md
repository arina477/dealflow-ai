# B-0 — Branch & schema

> **Block:** B (Build), 3rd of 8 in wave loop: `P → [D] → ` **`B`** ` → C → T → V → L → N`.
> **Stages:** **B-0** → B-1 → B-2 → B-3 → B-4 → B-5 → B-6 (gate). Advance on stage exit: B-1.
> **Pattern:** gate-only. head-builder spawned at B-6 for verdict; reference card on demand at `~/.claude/agents/head-builder.md`.
> **Dispatcher** (skip rules, parallelization, gate semantics, exit handoff): `claudomat-brain/blocks/build/build.md`.

## Purpose

Establish the wave's working branch, sync the local environment, install new dependencies, and (when the approach calls for it) author DB migrations and ORM model changes. Foundation gate for the B-block — no contracts, no backend, no frontend can touch a column or relation B-0 hasn't materialized. Running B-1/B-2/B-3 against an unmigrated schema produces silent runtime failures.

B-0 is the only stage authorized to create branches and mutate `package.json` / lockfile / equivalent. The branch + env + dep portion always runs; the schema sub-actions skip when the approach declares no schema deltas.

## Prerequisites

- P-4 Gate exited with passing spec contract (and D-3 exited if `design_gap_flag: true`).
- READ `process/waves/wave-<N>/stages/P-3-plan.md` for the dep list, "Data model" section, and file-level migration steps.
- READ `command-center/principles/BUILD-PRINCIPLES.md` and any `schema-principles.md` if they exist.
- READ `claudomat-brain/management/<mode>-mode.md` for the active mode (pause / STATUS routing rules).

## Skip condition

Schema sub-actions (Actions 6–9) skip when the approach declares no schema/migration changes. Confirm by reading the plan's "Data model" section — if empty or "no changes," schema is a no-op for this wave. The branch / env / deps portion (Actions 0–5) always runs.

On schema-skip: deliverable records `schema_skipped: true`; advance to B-1.

## Actions

### Action 0 — Block entry: seed review-artifacts manifest

<!-- head-builder card may be consulted on demand at ~/.claude/agents/head-builder.md -->

Write `process/waves/wave-<N>/blocks/B/review-artifacts.md` using this schema:

```markdown
# Wave <N> — B-block review artifacts

**Block:** B (Build)
**Wave topic:** <one line>
**Block exit gate:** B-6
**Status:** in-progress

## Stage deliverables

| Stage | Deliverable file | Status | Notes |
|---|---|---|---|
| B-0 | process/waves/wave-<N>/stages/B-0-branch-and-schema.md | in-progress | seeded at B-0 Action 0; schema sub-actions may skip |
| B-1 | process/waves/wave-<N>/stages/B-1-contracts.md | pending | (skipped if no contract changes) |
| B-2 | process/waves/wave-<N>/stages/B-2-backend.md | pending | |
| B-3 | process/waves/wave-<N>/stages/B-3-frontend.md | pending | (skipped on backend-only waves) |
| B-4 | process/waves/wave-<N>/stages/B-4-wiring.md | pending | |
| B-5 | process/waves/wave-<N>/stages/B-5-verify.md | pending | |
| B-6 | process/waves/wave-<N>/stages/B-6-review.md | pending | |

## Block-specific context

- **Spec contract:** `tasks` row `<primary-task-id>` (DB); spec at process/waves/wave-<N>/stages/P-2-spec.md
- **Branch name:** <set at B-0 Action 3>
- **claimed_task_ids:** <list from P-2 spec contract>
- **New deps added this wave:** <list from B-0 Action 5>
- **New env vars added this wave:** <list from B-0 Action 4>
- **Schema changes this wave:** <none | migration files + ORM models from Actions 6–9>
- **B-1 fast-path approved:** <true/false; approve explicitly in B-1 skip deliverable>
- **Files implemented (cumulative):** <updated at B-2, B-3, B-4>
- **Deviations from plan logged this block:** <list, or "none">

## Open escalations carried into gate

<list, or "none">

## Gate verdict log

<appended by fresh head-builder spawn at B-6 Action 1; one entry per attempt>
```

### Action 1 — Claim tasks (DB)

For every task ID in the wave's **bundle** (`claimed_task_ids` = seed + 0-N siblings, set by N-2 and carried in the spec contract YAML head), flip status to `in_progress` and attach the wave. The current wave's UUID is resolved inline via the `Wave — current` recipe in [`claudomat-brain/db/SCHEMA.md`](../../../db/SCHEMA.md) — no separate SELECT, no cross-statement state hand-off:

```sql
UPDATE tasks
SET status = 'in_progress',
    wave_id = (
      SELECT id FROM waves
      WHERE status = 'running'
      ORDER BY wave_number DESC
      LIMIT 1
    )
WHERE id = ANY('{<seed-id>,<sibling-id-1>,<sibling-id-2>,...}'::uuid[])
  AND status = 'todo'
RETURNING id;
```

Run as one batch UPDATE; the bundle ships together (seed + siblings). No description mutation — there are no soft-locks to strip (N-2 doesn't write one in this model). If RETURNING contains fewer ids than were requested in the `ANY('{…}')` array, the missing ids were already in a non-`todo` status (cancelled, blocked, or done) — escalate per active mode rather than retrying. A fully-empty RETURNING means every requested id failed the `status='todo'` predicate; same escalation path.

`<N>` for Action 2's branch name is the integer in the working `process/waves/wave-<N>/` directory name (created at P-0 0b from the `wave_number` returned by P-0 0a's `INSERT ... RETURNING`) — no DB round-trip needed.

### Action 2 — Create the branch

Branch name convention: `wave-<N>-<short-slug>` where `<N>` is the `wave_number` from the working `process/waves/wave-<N>/` directory and `<short-slug>` is a 2–4 word kebab-case derivation of the spec contract's `scope-id`.

```
git checkout main
git pull --rebase
git checkout -b wave-<N>-<short-slug>
```

**Branch-already-exists handling.** If `git checkout -b` errors because the branch exists, do NOT delete reflexively — the orchestrator decides:

| Situation | Action |
|---|---|
| Existing branch is current wave's prior attempt and has unmerged work worth keeping | `git checkout <branch>` then `git rebase main`; record "resumed from existing branch" in deliverable. |
| Existing branch is current wave's prior attempt and is known-bad / abandoned | `git branch -D <branch>` (HOLD if uncertain), then re-create from main. |
| Existing branch belongs to a different wave (name collision) | Append a suffix (`-v2`) and re-create from main; do not touch the colliding branch. |

### Action 3 — Sync env

If `process/waves/wave-<N>/stages/P-3-plan.md` declares new env vars:
1. Add placeholders to `.env.example` (commit).
2. Generate values per always-on rule #4 (e.g., `openssl rand -base64 32` for secrets) — do not gate on the founder for routine secret generation.
3. Add real values to local `.env` (NEVER committed).

If existing env vars changed semantics, document the migration note in `process/waves/wave-<N>/stages/B-0-branch-and-schema.md`.

### Action 4 — Install new deps (conditional)

If the approach added deps:
1. Run the project's add-dep command (e.g., `pnpm add <pkg>`).
2. Commit lockfile + `package.json` change with message: `chore(deps): B-0 add <pkg> for wave-<N>`.

If the approach added an SDK, READ `claudomat-brain/rules/external-sdk-integration-rules.md` first and complete its pre-build checklist before installing.

If no new deps, skip this action and record the skip.

### Action 5 — Author the migration (skip per Skip condition)

Skip Actions 5–8 when no schema changes are declared. Otherwise spawn the schema specialist named in `process/waves/wave-<N>/stages/P-3-plan.md` (typically `database-administrator` or `postgres-pro`; verify via `command-center/AGENTS.md`). The specialist:

1. Writes the migration file per project conventions (e.g., `migrations/<timestamp>-<slug>.sql`, Drizzle schema delta, Alembic revision).
2. Updates the ORM model files referenced in the plan.
3. Includes both `up` and `down` paths where the project supports rollback.
4. Reports any deviation from the plan in a "Deviation from plan" section.

### Action 6 — Run the migration locally

1. Apply the migration against the local dev DB.
2. Verify schema matches the migration's stated end state (e.g., `\d <table>` in psql, `drizzle-kit pull`).
3. Verify ORM model files compile / typecheck.

### Action 7 — Backfill / data migration (conditional)

If the migration adds a NOT NULL column to an existing table or otherwise requires data backfill:
1. Author the backfill script per the approach.
2. Run it against the local dev DB.
3. Verify expected row count post-backfill.

If no backfill required, skip this action.

### Action 8 — Commit schema work atomically

One commit per logical migration:
- Migration file + ORM model source files + backfill script (if any) in the same commit.
- Message: `feat(schema): B-0 <slug> for wave-<N>`.

**ORM model files vs generated client artifacts.** "ORM model files" means source schema authored by the developer (e.g., `src/db/schema.ts`, SQLAlchemy model classes, ActiveRecord migrations). Generated client artifacts (e.g., `drizzle/` migration output, OpenAPI-generated SDKs) follow the project's existing gitignore conventions — commit only if the project commits them. Do NOT introduce a new convention here.

### Action 9 — Adjudicate technical errors

On technical error (migration fails, ORM doesn't compile), invoke `/investigate` per Iron Law — do NOT fix directly. Specialist deviation reports adjudicated (accept minor, reject silent contradictions).

## Deliverable

`process/waves/wave-<N>/stages/B-0-branch-and-schema.md` — records branch name, env deltas, dep additions + commit SHA, migration files, ORM model changes, backfill outcome, deviation reports, plus YAML footer.

```yaml
branch: wave-<N>-<slug>
deps_added: []
env_vars_added: []
schema_skipped: false
migrations: [list of migration file paths]      # populated when schema ran
orm_models_changed: [list]
backfill_ran: false
deviations: [list]
```

Also: update `process/waves/wave-<N>/blocks/B/review-artifacts.md` — mark B-0 row `done`, populate "Branch name", "New deps", "New env vars", "Schema changes this wave", "claimed_task_ids".

## Exit criteria

- Branch created and current.
- Env handled per Action 3.
- Deps installed and committed (or explicitly skipped).
- All `claimed_task_ids` `tasks` rows are in `status = 'in_progress'`.
- Schema actions ran cleanly (or skip recorded with reason).
- `process/waves/wave-<N>/checklist.md` B-0 row is checked.

## Next

→ `claudomat-brain/blocks/build/build.md` → B-1.

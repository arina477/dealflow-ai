# B — Build Block Dispatcher

**Purpose.** Implement the spec contract. Branch & schema → contracts → backend → frontend → wiring → verify → review.

**When it runs.** Every wave, after P (and after D when `design_gap_flag: true`). Requires P-4's passing spec contract and (if applicable) D-3's canonicalized designs.

## Stage sequence

```
B-0 → B-1 → B-2 → B-3 → B-4 → B-5 → B-6 → exit
```

| Stage | File | Responsibility | Hard dep |
|---|---|---|---|
| **B-0** | `stages/B-0-branch-and-schema.md` | New branch, env sync, dep install; DB migrations + ORM model changes when the approach calls for them — gates everything else | — |
| **B-1** | `stages/B-1-contracts.md` | Shared types / Zod / OpenAPI / SDK contracts — locks contract before B-2/B-3 diverge | B-0 |
| **B-2** | `stages/B-2-backend.md` | API routes, services, business logic (parallel across services) | B-0, B-1 |
| **B-3** | `stages/B-3-frontend.md` | UI components, state, integration (parallel across pages) | B-1, B-2 |
| **B-4** | `stages/B-4-wiring.md` | End-to-end type check, route registration, env wiring — catches B-2↔B-3 drift | B-2, B-3 |
| **B-5** | `stages/B-5-verify.md` | Local typecheck + lint + unit tests + dev-server smoke | B-4 |
| **B-6** | `stages/B-6-review.md` | Two-phase gate (head-builder fresh-spawn + `/review` skill) | B-5 |

Hard sequence: never run B-2 before B-1 exits, never run B-4 before both B-2 and B-3 exit. Frontend racing ahead of contracts is the #1 drift vector.

Skipped stage records `skipped: true` with reason.

## Block-level skip rules

The B-block never skips. Per-stage skips:

| Stage | Skip when |
|---|---|
| B-0 schema sub-actions | No schema/migration changes (branch + env + deps still always run) |
| B-1 Contracts | No contract surface changes (no new API, no new SDK, no Zod schema changes) |
| B-2 Backend | Pure-frontend wave (rare) |
| B-3 Frontend | Backend-only / infra-only / doc-only wave |

## Parallelization within a stage

Sub-agents may run in parallel when their file scopes don't overlap:
- B-2 spawning multiple `backend-developer` instances across independent services — OK.
- B-3 spawning multiple `frontend-developer` instances across independent pages — OK.
- B-2 and B-3 in parallel — NOT OK; B-3 depends on B-2's emitted services.

**Fast-path exception.** If B-1 is a no-op skip (zero contract changes), B-2 and B-3 may run in parallel within the wave's overall stage budget. Must be explicitly approved in writing in B-1's skip deliverable.

## Sub-agent spawning protocol

Every sub-agent spawned during the B-block:

1. **AGENTS.md check first** — if the target specialist isn't listed, route through `claudomat-brain/setup-tools/agent-creator/agent-creator.md`.
2. **Instruction file as first directive** — spawn prompt's first line references `command-center/Sub-agent Instructions/<name>-instructions.md`.
3. **Capability-sheet check** — verify in `process/session/.capability-sheet.md`.
4. **Deviation accountability** — sub-agents report any deviation from plan in a "Deviation from plan" section.

`/simplify` runs after every implementation on touched files.

## Commit hygiene — per-spec commits in multi-spec waves

For waves with `wave_type: multi-spec`:

- One spec block → one commit (or one tightly-scoped set of commits if implementation legitimately splits across B-0 schema + B-1 contracts + B-2 backend + B-3 frontend) referencing only that spec's `task_id`.
- Commit message format: `<type>(<scope>): <subject>`; body MUST cite the spec block's `task_id` (e.g., `task: 4.7` or `Refs: 4.7`).
- A commit touching files belonging to multiple spec blocks is forbidden. Split the commit, or flag the wave at B-6 as miscategorized.

For `wave_type: single-spec` waves, the existing per-stage commit cadence applies.

B-6 verifies commit-per-spec discipline (see `claudomat-brain/blocks/build/stages/B-6-review.md` § Action 6). Cross-spec commits yield REWORK at B-6.

## Design-gap fallback

If a B-stage implementer hits a design gap mid-execution ("no mockup for X / spec references visual not in `design/`"), D-1 audit failed:

1. Pause the implementer.
2. Re-enter D-block at D-1 for just that gap, run through D-3.
3. Implementer resumes with the canonicalized design.
4. Log the gap in `process/waves/wave-<N>/checklist.md` as a **D-1 defect**.

Do NOT let implementers improvise designs.

## Block exit / handoff

```yaml
build_block_status:    complete
branch:                <branch-name>
stages_run:            [B-0, B-1, ..., B-6]
stages_skipped:        [list with reasons]
review_verdict:        APPROVE         # /review skill outcome at B-6
deviations_logged:     [list]
last_commit_sha:       <sha>
ready_for_ci:          true
```

→ next block: `claudomat-brain/blocks/ci-cd/ci-cd.md`

## References

- Spec contract — `process/waves/wave-<N>/stages/P-2-spec.md` + primary task's `tasks.description` in the DB
- Plan (approach + file-level steps) — `process/waves/wave-<N>/stages/P-3-plan.md`
- Block principles — `command-center/principles/BUILD-PRINCIPLES.md`
- Cross-wave dev principles — `command-center/principles/dev-principles.md`
- Sub-agent workflow — `claudomat-brain/rules/sub-agent-invocation.md`, `command-center/AGENTS.md`
- External SDK pre-build — `claudomat-brain/rules/external-sdk-integration-rules.md`
- Mode routing — `claudomat-brain/management/<mode>-mode.md`
- Triage — `command-center/dev/triage-routing-table.md`
- Path conventions — `claudomat-brain/process/process-paths.md`

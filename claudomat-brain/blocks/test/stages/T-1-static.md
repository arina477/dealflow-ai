# T-1 — Static

> **Block:** T (Test), 5th of 8 in wave loop: `P → [D] → B → C → ` **`T`** ` → V → L → N`.
> **Stages:** **T-1** ∥ T-2 → T-3 → T-4 → T-5 → T-6 → T-7 → T-8 → T-9 (gate). After T-1 Action 0 completes, T-1 Actions 1–4 spawn concurrently with T-2 (per dispatcher § Parallelization). T-3 enters once both T-1 and T-2 exit.
> **Pattern:** gate-only. head-tester spawned at T-9 for verdict; reference card on demand at `~/.claude/agents/head-tester.md`.
> **Dispatcher** (skip rules, layered cascade, gate semantics, exit handoff): `claudomat-brain/blocks/test/test.md`.

## Purpose

Confirm typecheck + lint ran green on merge commit. Audit static-analysis coverage adequacy. T-1 does NOT re-execute typecheck/lint — that's CI's job at C-1. T-1 is the discipline file: what static checks the project enforces, where coverage is thin, what to improve.

## Pattern

**A — Verified-via-CI.**

## Prerequisites

- C-3 exited (merge commit deployed and healthy).
- READ `process/waves/wave-<N>/stages/C-1-pr-ci-merge.md` for CI evidence on the merge commit.

## Skip condition

T-1 does NOT skip. Doc-only waves run a markdown linter or equivalent.

## Actions

### Action 0 — Block entry: seed review-artifacts manifest

<!-- head-tester card may be consulted on demand at ~/.claude/agents/head-tester.md -->

**0b. Seed the T-block review-artifacts manifest.**

Write `process/waves/wave-<N>/blocks/T/review-artifacts.md`:

```markdown
# Wave <N> — T-block review artifacts

**Block:** T (Test)
**Wave topic:** <one line>
**Block exit gate:** T-9
**Status:** in-progress

## Stage deliverables

| Stage | Deliverable file | Pattern | Status | Notes |
|---|---|---|---|---|
| T-1 | process/waves/wave-<N>/stages/T-1-static.md | ci-verified | in-progress | seeded at T-1 Action 0 |
| T-2 | process/waves/wave-<N>/stages/T-2-unit.md | ci-verified | pending | (skip on doc-only) |
| T-3 | process/waves/wave-<N>/stages/T-3-contract.md | ci-verified-or-active | pending | (skip on no API/SDK changes) |
| T-4 | process/waves/wave-<N>/stages/T-4-integration.md | ci-verified-or-active | pending | (skip on no schema/service changes) |
| T-5 | process/waves/wave-<N>/stages/T-5-e2e.md | active | pending | (skip on no user-visible behavior) |
| T-6 | process/waves/wave-<N>/stages/T-6-layout.md | active | pending | (skip on non-UI wave) |
| T-7 | process/waves/wave-<N>/stages/T-7-perf.md | active | pending | (skip unless heavy wave) |
| T-8 | process/waves/wave-<N>/stages/T-8-security.md | active | pending | (skip unless auth/payments/sessions) |
| T-9 | process/waves/wave-<N>/stages/T-9-journey.md | active | pending | (block-exit gate stage) |

## Block-specific context

- **Wave topic:** <one line>
- **wave_type:** <set from spec contract — backend / ui / auth / heavy / infra / docs (multi-valued)>
- **Stages skipped (with reasons):** <list, populated as the block runs>
- **Cumulative findings count:** <0 at start; bumped by each T-stage>

## Findings aggregation

Findings written incrementally to `process/waves/wave-<N>/blocks/T/findings-aggregate.md`. Aggregate is the canonical V-2 input.

## Open escalations carried into gate

<list, or "none">

## Gate verdict log

<appended by fresh head-tester spawn at T-9 Action 1; one entry per attempt>
```

Also create empty findings aggregate file: `process/waves/wave-<N>/blocks/T/findings-aggregate.md` with header `# Wave <N> — T-block findings aggregate` and no entries yet.

### Action 1 — Confirm CI evidence

Read C-1's `verdict_evidence` — confirm lint job and typecheck job both ran green on the merge commit (single SHA captured at C-1's `final_commit_sha`; CI jobs run against that one commit).

If C-1's evidence is missing either job → C-1 defect. Re-enter C-1 to capture the missing job's verdict.

### Action 2 — Coverage audit

Audit whether the wave's new surface is covered by static analysis:

- Did the wave add files the linter rules cover? (e.g., new `.tsx` files in a project with ESLint configured for `.tsx`)
- Did the wave add types the typechecker can reason about? (e.g., new generic constraints, utility types)
- Are there `any` casts or `// @ts-expect-error` comments introduced by the wave silently bypassing the typechecker?

Grep the wave's diff for static-analysis bypasses:
```
git diff main..HEAD -- '*.ts' '*.tsx' \
  | grep -nE '@ts-expect-error|@ts-ignore|:\s*any($|[\s,;)]+)|as\s+any($|[\s,;)]+)|as\s+unknown\s+as'
```

Each bypass is a finding (not necessarily blocking). Multi-line patterns the regex misses are captured by Action 3 when spotted in review.

### Action 3 — Discipline note

Record any new static-analysis discipline observed:
- A new lint rule that should be added.
- A type pattern that escaped the type system (and how to tighten it).
- A `tsconfig` flag the wave touched and what it implies.

Notes feed `command-center/principles/test-layer-principles/T-1.md` at L-2 distillation.

### Action 4 — Mask-mode self-check

Review:
- C-1 evidence cites both lint and typecheck jobs on merge commit.
- Coverage audit ran the bypass grep.
- Findings concrete (cite file:line) with severity.

On HOLD: address cited reason and re-emit.

## Deliverable

`process/waves/wave-<N>/stages/T-1-static.md` — records C-1 evidence, bypass count, discipline notes, plus YAML footer:

```yaml
mask_mode_signoff: PASS
signoff_note: ""
test_pattern: ci-verified
evidence:
  - "C-1 lint job: <run-id> green"
  - "C-1 typecheck job: <run-id> green"
findings:
  - {severity, location, description}
ts_bypasses_in_wave_diff: 0
```

Update `process/waves/wave-<N>/blocks/T/review-artifacts.md` — mark T-1 row `done`. Append findings to `process/waves/wave-<N>/blocks/T/findings-aggregate.md`.

## Exit criteria

- C-1 evidence confirmed for both lint and typecheck.
- Bypass grep recorded in deliverable.
- Findings (if any) documented with file:line and aggregated.
- Deliverable carries `mask_mode_signoff: PASS`.
- `process/waves/wave-<N>/checklist.md` T-1 row checked.

## Next

→ `claudomat-brain/blocks/test/test.md` → T-3 (after T-2 also exits; per dispatcher § Parallelization).

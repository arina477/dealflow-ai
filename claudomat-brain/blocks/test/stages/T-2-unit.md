# T-2 — Unit

> **Block:** T (Test), 5th of 8 in wave loop: `P → [D] → B → C → ` **`T`** ` → V → L → N`.
> **Stages:** T-1 ∥ **T-2** → T-3 → T-4 → T-5 → T-6 → T-7 → T-8 → T-9 (gate). T-2 starts after T-1 Action 0 (manifest seed) completes; T-2's actions run concurrently with T-1's Actions 1–4 (per dispatcher § Parallelization). T-3 enters once both T-1 and T-2 exit.
> **Pattern:** gate-only. head-tester spawned at T-9 for verdict; reference card on demand at `~/.claude/agents/head-tester.md`.
> **Dispatcher** (skip rules, layered cascade, gate semantics, exit handoff): `claudomat-brain/blocks/test/test.md`.

## Purpose

Confirm pure-function + module unit tests ran green on merge commit. Audit unit-test coverage adequacy for the wave's new surface. T-2 does NOT re-execute — C-1 already did.

## Pattern

**A — Verified-via-CI.**

## Prerequisites

- T-1 Action 0 exited (block-entry manifest + empty findings-aggregate seeded). T-1's Actions 1–4 may still be in-flight; T-2 does NOT depend on them.
- READ `process/waves/wave-<N>/stages/C-1-pr-ci-merge.md` for CI evidence.
- READ `command-center/testing/test-writing-principles.md` for unit-test discipline.

## Skip condition

Skip when wave has no executable diff (doc-only waves with `wave_type: docs`). Deliverable records `skipped: true` with reason.

## Actions

### Action 1 — Confirm CI evidence

Read C-1's `verdict_evidence` — confirm unit-test job ran green on merge commit.

If project has no CI unit-test job (e.g., very early-stage), record `note: "no unit-test job in CI; T-2 ran tests locally"` and run the unit suite locally against `main` HEAD as substitute evidence.

### Action 2 — Coverage audit

For every module the wave touched (read `process/waves/wave-<N>/stages/B-2-backend.md` + `B-3-frontend.md` for file list), check whether new unit tests were added or existing tests cover the new surface:

- New pure function added → does a unit test exist for it?
- Existing function's behavior changed → does a unit test exercise the new behavior?
- New utility module → does it have its own test file?

Audit is qualitative — apply judgment per `command-center/testing/test-writing-principles.md` rather than chasing a coverage percentage. Coverage targets, when used, live in `command-center/principles/test-layer-principles/T-2.md`.

### Action 3 — Flake observation

Read C-1's `flake_rerun_succeeded` and `process/waves/wave-<N>/stages/B-5-verify.md`'s `flakes_documented`. Record new flakes — flakes are not blocking (per B-5) but accumulate as a coverage-quality signal head-tester promotes at L-2.

### Action 4 — Discipline note

Record unit-test discipline observed:
- A test pattern the wave used that should be canonical.
- A test boilerplate that should be extracted to a shared helper.
- A mocking pattern drifting (e.g., "don't mock the database" rule).

## Deliverable

`process/waves/wave-<N>/stages/T-2-unit.md` — records C-1 evidence, coverage audit, flake observations, discipline notes, plus YAML footer.

```yaml
test_pattern: ci-verified
skipped: false
evidence:
  - "C-1 unit-test job: <run-id> green, <test-count> tests"
modules_audited: [list]
new_flakes: []
findings:
  - {severity, module, description}
```

## Exit criteria

- C-1 evidence confirmed for unit-test job (or local substitute documented).
- Every modified module audited.
- Findings documented.
- `process/waves/wave-<N>/checklist.md` T-2 row checked.

## Next

→ `claudomat-brain/blocks/test/test.md` → T-3 (after T-1 also exits; per dispatcher § Parallelization).

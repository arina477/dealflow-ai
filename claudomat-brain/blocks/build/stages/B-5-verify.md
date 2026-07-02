# B-5 — Verify

> **Block:** B (Build), 3rd of 8 in wave loop: `P → [D] → ` **`B`** ` → C → T → V → L → N`.
> **Stages:** B-0 → B-1 → B-2 → B-3 → B-4 → **B-5** → B-6 (gate). Advance on stage exit: B-6.
> **Pattern:** gate-only. head-builder spawned at B-6 for verdict; reference card on demand at `~/.claude/agents/head-builder.md`.
> **Dispatcher** (skip rules, parallelization, gate semantics, exit handoff): `claudomat-brain/blocks/build/build.md`.

## Purpose

Local verification before push: lint, unit tests, build, dev-server smoke. B-5 is the last gate before B-6's `/review` skill — anything that fails here saves a CI round-trip at C-1. Repo typecheck is NOT re-run here — B-4 Wiring already ran it; the only mutation between B-4 and B-5 is lint auto-fix (Action 1), which can't introduce type errors in practice.

## Prerequisites

- B-4 exited (wiring + repo typecheck clean).

## Skip condition

B-5 does NOT skip. Even doc-only waves run lint and dev-server smoke (the docs may live in a static site that builds).

## Actions

### Action 1 — Lint with auto-fix

Run the project's linter with auto-fix on changed files. Examples:
- `biome check --write` (Biome)
- `eslint --fix` (ESLint)
- `ruff check --fix` (Python)

Commit any auto-fixed files: `chore(lint): B-5 auto-fix for wave-<N>`.

### Action 2 — Unit tests

Run the project's full unit test suite (e.g., `pnpm test`, `pytest`, `cargo test`).

- All tests pass: proceed.
- Any test fails: classify per Iron Law. Pre-existing flaky test → re-run once; if still flaky, document and proceed. New failure caused by this wave's changes → invoke `/investigate`, classify, re-enter the failing stage.

### Action 3 — Build (where applicable)

If the project has a build step (e.g., `pnpm build`, `cargo build --release`), run it. Successful build required.

**Build-without-env smoke (optional pre-flight).** When this wave adds third-party SDK construction at module-init time, temporarily move `.env.local` aside and re-run the build. Catches env-dependent build failures before pushing. CI remains the authoritative gate, but this saves a round-trip.

### Action 4 — Dev-server smoke

Start the dev server (e.g., `pnpm dev`) and exercise the wave's primary user flow once:
- Navigate to the new route(s) in a browser.
- Trigger the primary action(s).
- Verify no console errors, no 500 responses, no broken layout.

For headless/no-UI waves, the equivalent is hitting the new endpoint(s) with a curl smoke against the dev server.

If dev-server smoke fails: invoke `/investigate`, classify, re-enter the failing stage.

## Deliverable

`process/waves/wave-<N>/stages/B-5-verify.md` — records each check's outcome, plus YAML footer.

```yaml
lint_passed: true
unit_tests_passed: true
build_passed: true
dev_smoke_passed: true
flakes_documented: []
```

## Exit criteria

- All four checks (lint, unit, build, smoke) green. (Repo typecheck verified at B-4.)
- `process/waves/wave-<N>/checklist.md` B-5 row is checked.

## Next

→ `claudomat-brain/blocks/build/build.md` → B-6.

# T-4 — Integration

> **Block:** T (Test), 5th of 8 in wave loop: `P → [D] → B → C → ` **`T`** ` → V → L → N`.
> **Stages:** T-1 ∥ T-2 → T-3 ∥ **T-4** → T-5 → T-6 → T-7 → T-8 → T-9 (gate). T-4 runs concurrently with T-3 (per dispatcher § Parallelization — contract+integration band). T-5 enters once T-1, T-2, T-3, T-4 all exit.
> **Pattern:** gate-only. head-tester spawned at T-9 for verdict; reference card on demand at `~/.claude/agents/head-tester.md`.
> **Dispatcher** (skip rules, layered cascade, gate semantics, exit handoff): `claudomat-brain/blocks/test/test.md`.

## Purpose

Verify integration tests cover DB + service + API boundaries the wave introduced or modified. Bridges unit-test isolation (T-2) and end-to-end UI testing (T-5) — catches service-to-service drift, ORM-to-DB mismatches, and request-handler-to-business-logic boundaries.

## Pattern

**A — Verified-via-CI** when the project has an integration-test job. **B — Active-execution** when CI doesn't run integration tests (e.g., requires test DB the CI image doesn't provision).

## Prerequisites

- T-1 AND T-2 exited (fast-tier band; per dispatcher § Parallelization).
- READ `process/waves/wave-<N>/stages/B-0-branch-and-schema.md` for schema deltas.
- READ `process/waves/wave-<N>/stages/B-2-backend.md` for service boundaries.
- READ `process/waves/wave-<N>/stages/C-1-pr-ci-merge.md` for CI evidence (Pattern A).

## Skip condition

Skip when wave has no schema or service changes (B-0 schema phase AND B-2 both skipped). Deliverable records skip with reference.

## Actions

### Action 1 — Determine pattern

Inspect project's CI config (`.github/workflows/`, `.gitlab-ci.yml`, etc.) — does it run an integration-test job with a test DB attached? If yes → Pattern A. If no (or the job exists but skips integration tests in this branch), check for a local Pattern B harness.

**Missing-infrastructure path.** If neither CI nor a local test-DB harness exists:

1. Set `test_pattern: deferred` on deliverable.
2. Record coverage gap finding: "no integration-test infrastructure; service/schema boundaries unverified by automated tests."
3. Run Action 4's qualitative audit anyway — list every B-0-schema/B-2 boundary that *would* be covered by integration tests if the harness existed. Seed for the project's integration-test wiring.
4. Forward gap to L-2 distillation as a `T-4.md` principles candidate.
5. T-block continues with the deferred stage recorded.

Do NOT block the wave for project-scaffolding gaps. Tests of project maturity are V-2's job via the findings pipeline.

### Action 2 — Pattern A — Confirm CI evidence

Read C-1's `verdict_evidence` for the integration-test job. Verify it ran green on merge commit.

Coverage audit: for every service boundary the wave touched, confirm an integration test exercises it. "Service boundary" = anywhere the wave's code calls into a service/repo/handler that itself touches the DB or another service.

### Action 3 — Pattern B — Active execution

If CI doesn't cover integration:

1. Stand up the project's test DB locally (per `project.yaml: quick_start.db_setup` + `quick_start.install`).
2. Run the integration suite against the local test DB on the merge commit.
3. Capture the test runner's output as evidence.

Active execution under autonomous mode: if test setup takes >5 minutes, set up a `MONITOR:` task per `claudomat-brain/monitors/monitor-principles.md` and resume on next `/loop` tick.

### Action 4 — Coverage audit

Boundaries to verify:
- Migration applied at B-0 (schema phase) → integration test exercising a query against the new schema.
- New service introduced at B-2 → integration test calling the service from an API handler.
- New API route at B-2 → integration test invoking the route end-to-end (DB → service → handler → response).

Where `command-center/testing/test-writing-principles.md` declares an integration-test rule (e.g., "don't mock the database — hit a real test DB"), verify the wave's tests followed it.

## Deliverable

`process/waves/wave-<N>/stages/T-4-integration.md` — records pattern, CI/active evidence, boundary coverage trace, findings, plus YAML footer.

```yaml
test_pattern: ci-verified | active | deferred
skipped: false
boundaries_audited: [list]
ci_evidence: [...]                    # if Pattern A
active_run_output: ""                  # if Pattern B
infrastructure_gap_recorded: false    # true when test_pattern == deferred
findings:
  - {severity, boundary, description}
```

## Exit criteria

- Every B-0-schema/B-2 boundary traced to a passing integration test.
- Pattern decision documented.
- Findings recorded.
- `process/waves/wave-<N>/checklist.md` T-4 row checked.

## Next

→ `claudomat-brain/blocks/test/test.md` → T-5 (after T-3 also exits; per dispatcher § Parallelization).

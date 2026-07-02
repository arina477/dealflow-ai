# T-5 — E2E

> **Block:** T (Test), 5th of 8 in wave loop: `P → [D] → B → C → ` **`T`** ` → V → L → N`.
> **Stages:** T-1 → T-2 → T-3 → T-4 → **T-5** → T-6 → T-7 → T-8 → T-9 (gate). Advance on stage exit: T-6.
> **Pattern:** gate-only. head-tester spawned at T-9 for verdict; reference card on demand at `~/.claude/agents/head-tester.md`.
> **Dispatcher** (skip rules, layered cascade, gate semantics, exit handoff): `claudomat-brain/blocks/test/test.md`.

## Purpose

Run a Playwright tester swarm against the deployed wave's user-visible behavior. T-5 is the first active-execution stage and the most expensive — multiple testers in parallel exercising the full UI flow against prod state.

## Pattern

**B — Active-execution.**

## Prerequisites

- T-1 AND T-2 AND T-3 AND T-4 all exited (fast-tier and contract+integration bands run in parallel per dispatcher § Parallelization; T-5 waits on all four).
- C-2 exited (merge commit live in production).
- READ `process/waves/wave-<N>/stages/P-2-spec.md` for acceptance criteria — the test targets.
- READ `command-center/artifacts/user-journey-map.md` for affected user flows.
- READ `command-center/testing/test-writing-principles.md` § Live E2E (master discipline file).
- VERIFY test credentials configured in `project.yaml: test_users.local_dev[]` (labels + emails only; passwords for prod fixtures live in gitignored `command-center/testing/test-accounts.md`). If wave's scenarios require authenticated users AND credentials are absent / placeholder, do NOT spawn the swarm — record `test_pattern: blocked-on-credentials` with a critical finding routed to onboarding gap, and exit. Unauthenticated scenarios may still run (partial coverage); document.

## Skip condition

Skip when wave has no user-visible behavior changes — `wave_type: backend` only with no API surface that a user-facing feature consumes, OR `wave_type: docs` / `infra` with no UI delta. Deliverable records skip with wave_type reasoning.

## Actions

### Action 1 — Define test scenarios

For each acceptance criterion in `process/waves/wave-<N>/stages/P-2-spec.md`, derive a Playwright scenario:
- Entry route + auth state
- User actions (clicks, types, navigations)
- Expected observable outcomes (DOM state, URL, network response)

Each scenario maps 1:1 to an acceptance criterion. Scenarios that don't trace to a criterion are out of scope (defer to a future T-9 update).

### Action 2 — Spawn tester swarm

Spawn 3–5 `ui-comprehensive-tester` instances in parallel via the same orchestrator message (NEVER `browser_close` in a Playwright swarm — kills the MCP instance for sibling testers).

Each tester gets:
1. First-directive instruction file: `command-center/Sub-agent Instructions/ui-comprehensive-tester-instructions.md`
2. Production base URL (from `process/waves/wave-<N>/stages/C-2-deploy-and-verify.md`)
3. A subset of scenarios from Action 1 (testers don't share scenarios; partition cleanly)
4. Test credentials per `project.yaml: test_users.local_dev[]` (NEVER real user credentials; passwords are in gitignored `command-center/testing/test-accounts.md`)
5. Expected output: `process/waves/wave-<N>/stages/T-5-tester-<id>.md` per tester

### Action 3 — Aggregate results

Collect every tester's output. For each scenario, classify:
- **PASS** — observed outcomes match acceptance criterion.
- **FAIL** — observed outcomes diverge from criterion.
- **FLAKE** — passed once, failed once across re-runs (each tester runs each scenario at least twice).
- **BLOCKED** — tester couldn't complete scenario (fixture broken, auth flow drifted) — separate from FAIL.

**FLAKE handling.** FLAKE verdicts NOT blocking at T-5 exit. Each FLAKE recorded as a finding and forwarded to V-2 Triage with severity `medium`. When a scenario flaked across **3 or more waves** (check prior `process/waves/wave-*/stages/T-5-e2e.md` for the same `criterion_ref`), promote to **persistent flake** — emit a one-liner principle for `command-center/principles/test-layer-principles/T-5.md` at L-2 ("scenario X is structurally flaky; root cause and rewrite or accept as known"). Persistent-flake promotion is the only T-5 → principles path.

### Action 4 — Triage failures (Iron Law routing)

For each FAIL or BLOCKED scenario, do NOT fix directly:

1. Pull tester evidence (screenshots, console logs, network capture).
2. Classify per `command-center/dev/triage-routing-table.md`:
   - DOM mismatch → B-3 frontend defect.
   - Network 5xx during scenario → B-2 backend defect.
   - Auth flow broken → B-2 + likely T-8 finding.
   - Layout regression → T-6 will catch it; record as cross-stage finding.
3. Either:
   - **Critical (acceptance criterion not met)** → re-enter B-2 or B-3 fix-up cycle, then re-run T-5 for affected scenarios.
   - **Non-critical (edge case observed but criterion holds)** → record as finding for V-2 Triage; T-5 exits.

Iteration cap: **3 fix-up cycles**. Beyond → escalate per active mode.

## Deliverable

`process/waves/wave-<N>/stages/T-5-e2e.md` — aggregates per-tester reports, scenario verdict table, fix-up cycle log, plus YAML footer.

```yaml
test_pattern: active
skipped: false
testers_spawned: <count>
scenarios:
  - {id, criterion_ref, verdict, evidence_path}
flakes_observed: []
fix_up_cycles: 0
findings:
  - {severity, scenario, description}
```

## Exit criteria

- Every acceptance criterion has a verdict (PASS / FAIL routed to fix / explicitly accepted).
- No FAIL scenarios remain open (fixed or escalated).
- `process/waves/wave-<N>/checklist.md` T-5 row checked.

## Next

→ `claudomat-brain/blocks/test/test.md` → T-6.

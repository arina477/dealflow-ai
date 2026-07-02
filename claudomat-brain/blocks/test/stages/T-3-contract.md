# T-3 — Contract

> **Block:** T (Test), 5th of 8 in wave loop: `P → [D] → B → C → ` **`T`** ` → V → L → N`.
> **Stages:** T-1 ∥ T-2 → **T-3** ∥ T-4 → T-5 → T-6 → T-7 → T-8 → T-9 (gate). T-3 runs concurrently with T-4 (per dispatcher § Parallelization — contract+integration band). T-5 enters once T-1, T-2, T-3, T-4 all exit.
> **Pattern:** gate-only. head-tester spawned at T-9 for verdict; reference card on demand at `~/.claude/agents/head-tester.md`.
> **Dispatcher** (skip rules, layered cascade, gate semantics, exit handoff): `claudomat-brain/blocks/test/test.md`.

## Purpose

Verify API / SDK / shared-type contract tests cover the wave's contract surface (B-1 deliverable). Contract tests catch boundary drift between server emits and client consumes — the most expensive bug class because it surfaces only at runtime against real data.

## Pattern

**A — Verified-via-CI** when the project has a contract-test job in CI. **B — Active-execution** when contract tests must run against the deployed environment (e.g., real third-party SDK).

## Prerequisites

- T-1 AND T-2 exited (fast-tier band run in parallel per dispatcher § Parallelization; T-3 waits on both).
- READ `process/waves/wave-<N>/stages/B-1-contracts.md` for the contract surface this wave introduced or modified.
- READ `process/waves/wave-<N>/stages/C-1-pr-ci-merge.md` for CI evidence (Pattern A).

## Skip condition

Skip when wave has no API / SDK / contract surface changes (B-1 was skipped). Deliverable records skip with reference to B-1's skip.

## Actions

### Action 1 — Determine pattern

Read B-1's `contracts_authored` and `sdk_regenerated`:
- Project-internal contracts (Zod schemas, shared types, OpenAPI within repo) → Pattern A; CI contract-test job is authoritative.
- External SDK contracts (third-party API, payment provider, auth provider) → Pattern B; CI cannot probe live external endpoints reliably without flake risk.

A wave may have BOTH; run Action 2 for Pattern A surfaces and Action 3 for Pattern B surfaces.

**Missing-infrastructure path.** If Pattern A applies but project has NO contract-test job in CI (and no local harness), AND Pattern B doesn't apply (no external SDKs):

1. Set `test_pattern: deferred` on deliverable.
2. Record coverage gap finding: "no contract-test infrastructure; Zod schemas / shared types unverified by automated tests."
3. Run Action 4's qualitative audit anyway — does the wave's contract surface have ANY automated check (e.g., consumed by a unit test that round-trips data)? Document.
4. Forward gap to L-2 distillation as a `T-3.md` principles candidate.
5. T-block continues with the deferred stage recorded.

Mirrors T-4's missing-infrastructure path. Tests of project maturity are V-2's job (via findings pipeline), not blockers.

### Action 2 — Pattern A — Confirm CI evidence

Read C-1's `verdict_evidence` for the contract-test job. Verify it ran green on merge commit.

Coverage audit: for each contract authored at B-1, confirm at least one contract test exercises it (server emits → schema validates; client consumes → type satisfied).

### Action 3 — Pattern B — Active probe against deployed state

For each external SDK contract:

1. Spawn a probe (orchestrator-direct or test specialist) exercising the SDK's methods listed in `process/waves/wave-<N>/stages/P-2-spec.md` § contracts.
2. Probe runs against production (post-C-3 deploy) using project's test credentials only. NEVER real user credentials.
3. Record SDK's response shape and verify it matches the Zod schema / type definition the wave depends on.

If SDK's response shape drifted from what the wave expects → critical finding (SDK provider made a breaking change). Route per Iron Law: `/investigate`, classify, re-enter B-1 for contract update + B-2/B-3 for consumer update.

### Action 4 — Coverage audit

For every contract surface in B-1:
- Is there a contract test (Pattern A) or active probe (Pattern B) result?
- Does it cover the wave's specific new fields, not just the contract overall?
- Are negative cases covered (invalid input rejected, error envelopes respected)?

## Deliverable

`process/waves/wave-<N>/stages/T-3-contract.md` — records pattern decision, CI evidence + active probe results, coverage trace, findings, plus YAML footer.

```yaml
test_pattern: ci-verified | active | mixed | deferred
skipped: false
contracts_audited: [list from B-1]
ci_evidence: [...]                    # if Pattern A
active_probe_results: [...]            # if Pattern B
infrastructure_gap_recorded: false    # true when test_pattern == deferred
findings:
  - {severity, contract, description}
```

## Exit criteria

- Every B-1 contract surface traced to a passing test or probe.
- Pattern B probes recorded with response shapes for future drift detection.
- Findings documented.
- `process/waves/wave-<N>/checklist.md` T-3 row checked.

## Next

→ `claudomat-brain/blocks/test/test.md` → T-5 (after T-4 also exits; per dispatcher § Parallelization).

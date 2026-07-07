# Wave 22 — T-9 Journey gate verdict (head-tester, fresh spawn)

**Block:** T (Test) | **Stage:** T-9 Journey (block-exit gate) | **Wave:** 22 — M9 test-hygiene
**wave_type:** [test-hygiene] — deliverable IS a test-reliability fix; no product surface
**Task:** 02f4e6a1 | **Branch:** wave-22-audit-assertion-scope | **CI commit:** c168d3a
**Gatekeeper:** head-tester (fresh spawn) | **Mode:** automatic | **Date:** 2026-07-07

## Verdict: APPROVED

The wave scopes the 12 previously-unscoped audit assertions in
`apps/api/test/outreach-activity-rls.e2e-spec.ts` by `workspace_id` (enforcing promoted T-4
rule 2), fixing the wave-20 OAE-3-class flake. CI-verified green in shared CI Postgres. Every
T-9 exit obligation is tickable from a concrete artifact — a queryable CI-run read, a test-job
log grep, or a direct read of the committed source at the CI-verified SHA. No inference; no
green taken on faith.

## Gate checks (all PASS)

| # | Check | Result | Evidence |
|---|---|---|---|
| 1 | Flake fix is CI-verified + actually stable | PASS | Run **28850000460** (`conclusion=success`, `event=push`, `head_sha=c168d3a` == origin/main) — all 5 jobs green. Test-job log (job 85562717186): `✓ test/outreach-activity-rls.e2e-spec.ts (9 tests) 1400ms` — suite **RAN 9/9, not skipped**, on a **postgres:18** service container, in the same real shared CI Postgres alongside concurrent audit-writing suites (`api batch: 55 files / 921 tests passed`). This is the exact concurrency condition that produced the original OAE-3 flake, and the scoped assertions passed under it. |
| 2 | Fault-killing PRESERVED (KEY check) | PASS | **Verified against committed source at c168d3a, not summaries.** All 8 after-count assertions assert **exactly** `toBe(beforeCount + 1)` (lines 413/481/552/622) — zero `>=` / `toBeGreaterThan` / `toBeGreaterThanOrEqual` / vacuous. All 4 latest-action assertions assert the **exact verb** `toBe('outreach-activity-{create,update,status-transition,cancel}')` (420/487/558/628). No `.skip` / `.only` / `retry` weakening. The `WHERE workspace_id = $1` filter narrows the **counted population** (OAE_WS_A rows only), NOT the falsifiability: a missing / wrong / double audit append in this workspace still breaks the exact +1 delta and the exact verb. Reasoning spot-check holds. |
| 3 | No coverage gap / no regression | PASS | `git diff --name-only` = one file, test-only; zero product code, zero migration, zero contract. No new coverage obligation. The audit-mutation invariant (exact-append + exact-verb + global `verifyChain().ok`) is fully preserved — `verifyChain` calls untouched (correct: `workspace_id` is hash-excluded per wave-17, so whole-chain integrity verify must remain global). The change made existing coverage concurrency-robust; it removed nothing. |
| 4 | Implements promoted T-4 rule 2 | PASS | The fix IS the enforcement of the cited principle — assert only one's own scoped rows of a shared append-only hash-chain. The population-narrowing (`WHERE workspace_id = $1` bound to OAE_WS_A) is exactly what rule 2 prescribes; commit message + inline comments cite it. The wave is the rule made real. |

## Anti-pattern audit (explicitly cleared)

- **Weakening-disguised-as-flake-fix** (the dangerous wrong fix — relax `toBe(+1)`→`>=` to hide
  the flake, producing an always-pass that masks a genuine missing-audit-entry compliance
  defect): **NOT PRESENT.** Source-verified: exact `+1` and exact verb retained on every path.
- **CI blindness / fabricated green:** cleared — the green is a by-id CI-run read + a test-job
  log grep showing 9 executed tests (non-zero), on the exact merged SHA. Not a badge, not `exit 0`.
- **Silently-skipped suite:** cleared — `describe.skipIf(shouldSkip)` skips only locally
  (no `TEST_DATABASE_URL`); the CI run executed the suite (9 tests, 1400ms real time). Executed-test
  count is non-zero. (This is a backend audit-integration suite; the Playwright-Chrome-binary
  E2E/layout gate is N/A — no UI surface touched this wave.)

## Residual-flake-risk note (single-green sufficiency)

One green CI run is **sufficient evidence** for this specific fix, and here is the reasoning
rather than a rubber-stamp: the flake was a *deterministic* race (a concurrent worker's audit row
inflating a globally-scoped count), not a nondeterministic timing artifact. The fix removes the
race at its root by scoping the counted population to this workspace, so the failure mode is
structurally eliminated — not merely made less likely. A single pass under the reproducing
concurrency condition (real shared CI Postgres, 55 concurrent suites) therefore demonstrates the
root cause is gone. No residual flake risk to flag; no quarantine warranted. (Had the fix been a
retry/timeout tweak, one green would NOT suffice — but that is explicitly not what shipped.)

## T-9 block-scoped state

- `test_gate_results`: T-1 lint/typecheck green; T-2 outreach-activity-rls 9/9 green (scoped, fault-killing); T-3..T-7 N/A (test-only, no new code/API/UI/perf); T-8 audit-isolation invariant preserved + strengthened; T-9 APPROVED.
- `coverage_report`: unchanged obligation surface; audit-mutation invariant coverage preserved.
- `escalation_log`: empty.
- `findings_total`: 0.

---
```yaml
head_signoff:
  verdict: APPROVED
  stage: T-9
  reviewers: {}
  failed_checks: []
  rationale: >
    Single-file, test-only, CI-verified test-hygiene fix. The outreach-activity-rls e2e suite
    RAN 9/9 GREEN (not skipped) in the real shared CI Postgres (postgres:18, run 28850000460 @
    c168d3a) alongside concurrent audit-writing suites — the exact condition that caused the
    original OAE-3 flake — proving the workspace_id-scoped assertions are stable. Fault-killing is
    PRESERVED: verified against the committed source at c168d3a, every after-count asserts exact
    toBe(beforeCount + 1) and every latest-action asserts the exact verb, with no >=/vacuous
    weakening and no skip/retry; the WHERE workspace_id = $1 filter narrows the counted population,
    not the falsifiability, so a missing/wrong/double append in this workspace still fails. No
    coverage gap (test-only, no product code; audit-mutation invariant + global verifyChain
    preserved). The change is the direct enforcement of promoted T-4 rule 2. One green suffices
    because the flake was a deterministic race removed at its root, not a timing artifact. No
    fabricated green — every claim traces to a queryable CI read, a test-job log grep, or a direct
    source read on the exact merged SHA.
  next_action: PROCEED_TO_V-block
```

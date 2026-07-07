# C-1 — PR, CI & merge (wave-19 M9 match-calibration)

**Branch:** `wave-19-match-calibration`
**Merge model:** direct-push-to-main (PAT lacks PR:write / Workflows:write; CI fires on `push: branches:[main]`). No PR object created — squash-onto-main is the merge unit.
**B-6:** APPROVED (branch tip `3e2675a`, tree `b3bc4b73`).

## Ghost-Green guard (CI-PRINCIPLES rule 2 — wave-18 lesson)

- B-6 branch tip `3e2675a` carries `[skip ci]` → pushing it verbatim to main would fire NO CI run (phantom-skip).
- The `d606212..3e2675a` delta is deliverable `.md` files only — no code change; full match-feedback source tree present at HEAD.
- Action: squash-merged the wave-19 tree onto main with a **CI-triggering (non-`[skip ci]`) message**. Tree parity verified at every step (`write-tree` == branch `^{tree}`), so the pushed main tip carries the EXACT B-6-approved tree.
- **Verified a run FIRED for the exact pushed headSha** (not just that the push returned 200) via `gh run list --json headSha,databaseId,event`, then read the **queryable conclusion** via `gh run view --json conclusion` — not watch-exit.

## Push / CI history

| Attempt | main tip | tree | CI run (databaseId) | fired on headSha? | conclusion | note |
|---|---|---|---|---|---|---|
| 1 | `63d055d` | `b3bc4b73` (= `3e2675a`) | `28835918443` | YES (`63d055d`) | **failure** | `test` job RED — `match-feedback-isolation.e2e-spec.ts` crashed in `seedWorkspace` (SQLSTATE 22P02), all 7 tests SKIPPED. 4/5 green (lint/typecheck/audit/build). |
| 2 (fix-up 1) | `3cc58de` | `1e091447` (= `a09fa7b`) | `28836091590` | YES (`3cc58de`) | **success** | All 5 jobs GREEN; isolation e2e RAN (7 tests, 0 skipped) + PASSED. |

## Fix-up cycle 1 (Iron Law — classify + route, no direct fix)

- **Failure:** `error: invalid input syntax for type uuid: "00000019-mfi1-4000-8000-000000000001"` in `seedWorkspace` at `test/match-feedback-isolation.e2e-spec.ts:155` → `beforeAll` throw → suite `FAIL`, 7 tests SKIPPED. This is the exact anti-pattern (load-bearing isolation e2e silently skipped) the C-block gate exists to catch; NOT extrapolated to green.
- **Flake check:** `B-5 flakes_documented: []` → not a documented flake → skipped re-run, went straight to classify (Action 8 Step B). Correct: silently re-running unknown failures masks regressions.
- **Classification:** triage tag `testing` (test-fixture defect in `apps/api/test/`). Root cause: mnemonic UUID string literals with non-hex chars (`mfi1`/`st-a`/`st-b`) rejected by Postgres `string_to_uuid`.
- **Route:** `backend-developer` (owns `apps/api/test/` e2e fixture construction). Prompt was assertion-preserving: fix ONLY the malformed UUID literals; no source, no assertion, no ALS/GUC/SET-ROLE wiring change.
- **Fix commit:** `a09fa7b` on wave-19 branch — 5 literals corrected to valid 8-4-4-4-12 hex; WS_A/WS_B/user-A/user-B kept disjoint. Diff vs prior main tip = exactly the 5-line fixture change (verified). Typecheck clean in subagent; live-suite proof deferred to CI (authoritative runner).

## Isolation-proof evidence (from green run 28836091590 test-job log — direct quote, not inferred)

```
✓ test/match-feedback-isolation.e2e-spec.ts (7 tests) 1629ms
  ✓ MFC-1 (real service): totalDecided reflects WS_A decided candidates only; WS_B excluded  492ms
✓ src/modules/match-feedback/match-feedback.spec.ts (22 tests) 22ms
✓ test/analytics-isolation.e2e-spec.ts (7 tests)     (wave-18 isolation suite — still green)
✓ test/workspace-isolation.e2e-spec.ts (5 tests)     (wave-17 isolation suite — still green)
Test Files  52 passed (52)
     Tests  881 passed (881)          # ZERO skipped — contrast RED run's "7 skipped"
```

The cross-firm calibration-scoping proof (real MatchFeedbackService via workspaceAls.run + SET ROLE dealflow_app / FORCE RLS; WS_A excludes WS_B; MFC-4 fault-killing) RAN and PASSED. This is the authoritative isolation + RBAC proof for the wave.

```yaml
ci_stage_verdict: PASS
verdict_source: gh
verdict_evidence:
  - "gh run view 28836091590 --json conclusion => success on headSha 3cc58de (queryable, not watch-exit)"
  - "5/5 jobs green: lint, typecheck, test, audit, build"
  - "test-job log: match-feedback-isolation.e2e-spec.ts (7 tests) PASSED, 0 skipped; MFC-1 cross-firm exclusion ✓"
  - "match-feedback.spec.ts (22 tests, RBAC/empty-state/per-row) passed; analytics-isolation + workspace-isolation still green"
  - "pnpm audit --audit-level=high => exit 0 (audit job green)"
  - "merge (squash-to-main) commit: 3cc58de"
pr_number: null                       # direct-push-to-main model; no PR object (PAT lacks PR:write)
pr_url: null
branch: wave-19-match-calibration
required_checks: [lint, typecheck, test, audit, build]
optional_checks: []
fix_up_cycles: 1                      # UUID-fixture fix routed to backend-developer (a09fa7b)
final_commit_sha: 3cc58de             # green commit == deployed tip
merge_strategy: squash                # squash-onto-main (direct push)
merge_commit_sha: 3cc58de
rebase_cycles: 0
note: "Ghost-Green guard applied: B-6 tip 3e2675a is [skip ci]; squashed its tree onto main under a CI-triggering message; verified a real push-run FIRED on the exact headSha 3cc58de and read the queryable conclusion (not watch-exit). Attempt-1 (63d055d) RED — isolation e2e crashed in seedWorkspace on invalid-UUID fixtures (22P02), 7 tests skipped; per-SHA green was NOT extrapolated from the intermediate. Fix-up 1 (backend-developer, a09fa7b) corrected the fixture UUIDs only; attempt-2 (3cc58de) all-5-green with the isolation suite RAN+PASSED. Local main synced to 3cc58de."

head_signoff:
  verdict: APPROVED
  stage: C-1
  reviewers: {}
  failed_checks: []
  rationale: >
    All required checks green on the exact deployed headSha 3cc58de (queryable
    conclusion=success, not watch-exit or stale cache). The load-bearing
    match-feedback-isolation e2e suite RAN with all 7 tests and 0 skipped and
    PASSED — the cross-firm calibration-scoping proof (real service, SET ROLE
    dealflow_app FORCE RLS, WS_A excludes WS_B, MFC-4 fault-killing) is real,
    not fabricated. The attempt-1 RED (isolation suite silently skipped on a
    22P02 invalid-UUID fixture) was caught, classified as a testing-tag fixture
    defect, and routed to backend-developer per Iron Law rather than
    papered-over; the green verdict is per-SHA, not extrapolated from the
    intermediate. pnpm audit --audit-level=high exit 0. No secret in logs/diff.
    Additive-only, no migration, no role-switch. Local main synced.
  next_action: PROCEED_TO_C-2
```

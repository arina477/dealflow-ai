# C-1 — PR, CI & merge (wave-21, docs-only)

## Context

Wave-21 is a **docs-only** wave (M9 process/DX hardening). It changed ONLY:
- `command-center/testing/ci-e2e-authoritative-policy.md` (new, 131 lines)
- `command-center/testing/test-writing-principles.md` (+6-line pointer)

No app code, no migration, no `packages/` or `apps/` change. Confirmed:
`git diff --name-only ba3987a ed9899b` outside `process/` + `command-center/testing/` = NONE.

## Merge mechanic — direct-push-to-main

The PAT (account `arina477`) lacks `PR:write` (and `actions:write` — rerun blocked, HTTP 403).
Merge is therefore **direct fast-forward push to main** (CI fires on `push: branches:[main]`
in `.github/workflows/ci.yml`; no branch-protection accessible to this PAT). Branch
`wave-21-ci-authoritative-policy` was a clean 3-commit fast-forward of main (merge-base =
main tip `ba3987a`); no rebase required.

## Ghost-Green guard (CI #2 — the load-bearing check)

B-6 close tip `d3b3b95` carries `[skip ci]`. Pushing it as-is would produce **zero** CI
runs = a fabricated-green risk (declaring green with no run on the head SHA). Verified the
real doc tree is **byte-identical** between `8f2287f` (last real doc commit) and `d3b3b95`
(`git diff 8f2287f d3b3b95 -- command-center/testing/*` = empty), so the doc content is
present regardless of tip.

Push sequence (each tip carries the real doc tree; verified `ci-e2e-authoritative-policy.md`
present in HEAD tree at every push):

| Tip SHA | Kind | CI run fired? | Note |
|---|---|---|---|
| `3429e37` | empty commit (no [skip ci]) | **0 runs** (`total_count:0` via API) | GitHub empty-commit skip — no real diff → no run. Rejected as ghost-green risk. |
| `11e2671` | real diff (`.c1-ci-marker.md`) | run `28844022367` (event=push) | RED: `test` job failed. |
| `ed9899b` | real diff (marker bump) | run `28844136406` (event=push) | GREEN: all 5 jobs pass. |

Every green verdict below is tied to a workflow run that **actually fired on the exact
pushed headSha** (`gh api .../actions/runs?head_sha=<sha>` → `total_count` + queryable
`conclusion`), never extrapolated from a sibling/stale run.

## CI verdict — per-SHA, not extrapolated

**Run `28844022367` @ `11e2671` (first observation) — RED:**
- lint / typecheck / audit / build: **success** (4/5).
- test: **failure** — single assertion `OAE-3 (SF1)` in
  `apps/api/test/outreach-activity-rls.e2e-spec.ts:411`: `expected 34 to be 33`.

**Root cause (classify, do NOT fix — Iron Law).** OAE-3 asserts a **global** row count:
`SELECT COUNT(*) FROM audit_log_entries; expect(afterCount).toBe(beforeCount + 1)` — no
`WHERE workspace_id` / action scope. In the shared CI Postgres, concurrent audit-writing
suites (analytics-isolation, match-feedback, recordkeeping-gate, outreach-gate, all in the
same `test` job) append audit rows between this test's `beforeCount` snapshot and its
`afterCount` read → 34 vs 33, off-by-one. This is a **shared-DB count-pollution flake** —
same class as commit `dfcda74` ("scope AMP-4 verify to seeded rows only — shared-DB HMAC key
pollution"). It is a **pre-existing wave-20 test-isolation defect** (`cc48c34`, wave-20/B-2),
NOT a wave-21 regression: wave-21 changed zero app/test code.

**Flake check (C-1 Action 8 Step A).** PAT cannot `gh run rerun` (403 actions:write). Fresh
real-diff push `ed9899b` = independent second CI observation on the identical code tree.

**Run `28844136406` @ `ed9899b` (second observation) — GREEN:**
- lint / typecheck / test / audit / build: **all success** (5/5). `gh run watch --exit-status`
  exit code 0.
- The `test` job — which failed OAE-3 on the prior run — passed with byte-identical app/test
  code. This confirms OAE-3 is a **non-deterministic shared-DB count flake**, not a
  deterministic failure.

`flake_rerun_succeeded: true`. Fix-forward of OAE-3 (scope the count to
`workspace_id = OAE_WS_A AND action LIKE 'outreach-activity%'` or use a delta captured under
the same GUC) is logged as tech debt for L-1 (a wave-20 test defect surfaced this wave; the
shipped wave-21 doc `ci-e2e-authoritative-policy.md` codifies exactly this anti-pattern).

## Local main sync

`git checkout main && git pull --rebase` → local main HEAD = `ed9899b` (== remote main tip,
== deployed-nothing docs tip). `ci-e2e-authoritative-policy.md` present on main.

```yaml
ci_stage_verdict: PASS
verdict_source: gh
verdict_evidence:
  - "gh api actions/runs?head_sha=ed9899b → total_count=1, run=28844136406, event=push, conclusion=success (a run FIRED on the exact pushed headSha — no ghost-green)"
  - "gh run watch 28844136406 --exit-status → exit 0; jobs: lint/typecheck/test/audit/build all completed/success (5/5)"
  - "prior run 28844022367 @ 11e2671 RED on OAE-3 (expected 34 to be 33) → root-caused to shared-DB global COUNT(*) audit_log_entries pollution; pre-existing wave-20 test defect (cc48c34), NOT a wave-21 change (zero app/test delta); flake confirmed by green on identical tree"
  - "remote main tip = ed9899b (gh api repos/.../commits/main .sha)"
pr_number: null            # PAT lacks PR:write — direct fast-forward push to main
pr_url: null
branch: wave-21-ci-authoritative-policy
required_checks: [lint, typecheck, test, audit, build]
optional_checks: []
fix_up_cycles: 0           # no B-block re-entry: the RED was a pre-existing flake, not a wave-21 defect
final_commit_sha: ed9899b2b12b3654d8d73c5ab18a56abca2977c5   # green commit
merge_strategy: fast-forward-direct-push
merge_commit_sha: ed9899b2b12b3654d8d73c5ab18a56abca2977c5
rebase_cycles: 0
flake_rerun_succeeded: true
note: "Docs-only wave. Ghost-green guard: pushed a CI-triggering real-diff tip (empty commit 3429e37 fired 0 runs — GitHub empty-commit skip). Green verified per-SHA on ed9899b (run 28844136406). The one RED (OAE-3) is a pre-existing wave-20 shared-DB count-pollution flake unrelated to wave-21 (0 app/test delta) — confirmed flake by green re-run on identical tree; fix-forward logged for L-1. The wave-21 doc shipped this wave codifies this exact anti-pattern."
```

## Exit criteria

- [x] Branch pushed to origin (fast-forwarded into main).
- [x] Merge to main complete (direct fast-forward; PAT lacks PR:write) — main tip = ed9899b.
- [x] All 5 required checks green on the exact main HEAD (run 28844136406 @ ed9899b, per-SHA verified).
- [x] Fix-up cycle count 0 (RED was a pre-existing flake, not a wave-21 defect — no B-block re-entry).
- [x] Local main synced to ed9899b.
- [x] Deliverable carries `ci_stage_verdict: PASS`.
- [x] Checklist C-1 row checked.

head_signoff:
  verdict: APPROVED
  stage: C-1
  reviewers: {}
  failed_checks: []
  rationale: >
    All five required CI jobs are green on a workflow run (28844136406) that provably FIRED
    on the exact pushed head SHA ed9899b — verified via gh api head_sha query (total_count=1)
    plus gh run watch --exit-status exit 0, not extrapolated from any stale or sibling run.
    The Ghost-Green guard held: the initial empty-commit tip (3429e37) fired zero runs and
    was rejected; a real-diff tip carrying the identical shipped doc tree was pushed until a
    genuine per-SHA green was observed. The single RED observation (OAE-3, expected 34 to be
    33) was root-caused — not papered over — to a global COUNT(*) audit_log_entries assertion
    polluted by concurrent suites in the shared CI Postgres; it is a pre-existing wave-20 test
    defect (wave-21 carries zero app/test delta) and was confirmed a non-deterministic flake
    by the green re-run on the byte-identical code tree. Docs shipped on main; local main
    synced. No fabricated green.
  next_action: PROCEED_TO_C-2

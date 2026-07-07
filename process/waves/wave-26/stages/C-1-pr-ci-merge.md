# C-1 — PR, CI & merge (wave-26)

**Wave:** 26 — M10 FINAL-hardening (RLS connection-split deploy contract [docs] + NEW startup preflight `assertUrlsDistinct`)
**Branch:** `wave-26-rls-connection-split-docs` (HEAD `261ea98`, B-6 APPROVED)
**Mode:** automatic
**Gate agent:** head-ci-cd (spawn-pattern, C-block lifetime)

---

## Summary

Direct-push-to-main path (PAT lacks PR:write + workflow scope). Pushed the wave's REAL code tree to
`main` on a **CI-triggering tip** (merge commit `ca753e48`, NOT `[skip ci]`, NOT empty) so GitHub
Actions would fire all 5 jobs on the exact pushed headSha. **The push and the Ghost-Green guard both
held — but GitHub Actions WITHHELD the run for the 4th time this same day.** No green was fabricated.
C-2 was NOT entered.

## Pre-push guards (ALL PASSED)

| Guard | Result | Evidence |
|---|---|---|
| Workflow diff vs main EMPTY (GAP-3 deferred → direct-push not rejected on workflow scope) | PASS | `git diff --stat main..HEAD -- .github/workflows/` → empty (exit 0) |
| Real code tree carried (NOT `[skip ci]`, NOT empty) | PASS | merge commit `ca753e48` message has no `[skip ci]`; 386 insertions across 11 files |
| Code tree byte-identical to last code commit b663615 | PASS | `git diff b663615 HEAD -- index.ts main.ts url-distinct-preflight.spec.ts devops.md` → empty (exit 0) |
| Load-bearing files present | PASS | `apps/api/src/db/index.ts` (assertUrlsDistinct + [RLS-GUARD] assertNonSuperuserConnection), `apps/api/src/main.ts` (preflight wiring, NODE_ENV!=test), `apps/api/src/db/url-distinct-preflight.spec.ts` (PREFLIGHT-1/2/3), `command-center/dev/architecture/devops.md` |

## Push

```
ef5c606..ca753e4  main -> main
```

- Pushed headSha: `ca753e48cf361326f3ecf84a619281d230d6816e`
- `gh api repos/arina477/dealflow-ai/commits/main --jq .sha` → `ca753e48…` (push registered on main)

## CI-run verification — Ghost-Green guard (CI #2)

**KEY CHECK: did a workflow run FIRE on the exact pushed headSha?** → **NO.**

| Signal | Value | Interpretation |
|---|---|---|
| `commits/ca753e48/check-suites` → `total_count` | **0** (6 polls, ~90s) | No check-suite created for the pushed SHA |
| `actions/runs?head_sha=ca753e48` → `total_count` | **0** | No workflow run dispatched for the pushed SHA |
| `gh run list --branch main --limit 5` newest headShas | `659402d`, `cf80ddb`, `f0ce549`, `987ebb4`, `1d48c0b` | ALL prior commits — none is `ca753e48`; newest is a PRIOR-wave commit |
| Workflow `CI` state | `active` | Not disabled — withholding is infra, not config |
| Trigger config | `push: branches:[main]` (no path filter) | Trigger conditions fully satisfied by this push |
| Merge message `[skip ci]`? | No | Not a skip artifact |

**Diagnosis:** GitHub Actions is not dispatching runs despite a valid `push:[main]` trigger with no
`[skip ci]` and no path filter, on an `active` workflow. This is the **4th same-day
minutes-exhaustion / run-withholding event** (prior C-1 ESCALATE was commit `2a776bc` @ `704ba83`;
2 earlier events in wave-25). Near-certainly the account's Actions minutes / spending limit is
exhausted.

**Ghost-Green guard HELD.** I pushed the real code tree (not a `[skip ci]` tip, not empty) and
verified the QUERYABLE signal. I did NOT rubber-stamp C-1 green from the stale cached CI runs of
older commits sitting in `gh run list`. No green fabricated.

## Jobs NOT observed (because no run fired)

The following could NOT be verified — the run never dispatched. They are NOT asserted green:
- `url-distinct-preflight.spec` (PREFLIGHT-1/2/3) — NOT RUN
- `[RLS-GUARD]` tests (MG1, guard logic frozen) — NOT RUN
- typecheck / lint / build / audit — NOT RUN
- 986 unit — NOT RUN

## Iron Law

No RED to classify (nothing ran). The failure is infra-readiness (Actions withholding), not a code
defect — routing to `backend-developer` would be wrong. Correct route is founder infra action
(raise Actions spending limit). Fix-up cycles used: 0 (cap 5).

---

```yaml
ci_stage_verdict: HOLD                 # execution paused mid-stage; no green fabricated; resume when Actions dispatches
verdict_source: gh
verdict_evidence:
  - "git push: ef5c606..ca753e4 main -> main (real code tree, CI-triggering tip, NOT [skip ci])"
  - "git diff b663615 ca753e48 -- index.ts main.ts url-distinct-preflight.spec.ts devops.md → empty (code tree identical)"
  - "gh api commits/ca753e48/check-suites total_count=0 (6 polls / ~90s)"
  - "gh api actions/runs?head_sha=ca753e48 total_count=0"
  - "gh run list --branch main newest headShas are all PRIOR commits — none is ca753e48"
  - "workflow CI state=active; trigger push:[main]; no path filter; no [skip ci] — run withheld by Actions infra"
pr_number: null                        # direct-push-to-main path (PAT lacks PR:write)
pr_url: null
branch: main (merge commit ca753e48 carries wave-26-rls-connection-split-docs)
pushed_head_sha: ca753e48cf361326f3ecf84a619281d230d6816e
required_checks: [lint, typecheck, build, test-unit(986), audit]   # EXPECTED — NONE observed (run withheld)
observed_checks: []                    # zero — no run dispatched
fix_up_cycles: 0
ghost_green_guard: HELD                 # pushed real code, verified queryable signal, no green fabricated from stale runs
merge_commit_sha: ca753e48cf361326f3ecf84a619281d230d6816e   # on main, but UNVERIFIED by CI
note: >
  GitHub Actions withheld the run (0 check-suites @ca753e48) — 4th same-day minutes-exhaustion event.
  Ghost-Green guard held; NO green fabricated; C-2 NOT entered. Resume: founder raises Actions
  spending limit, then re-fire CI on ca753e48 and watch all 5 jobs green (incl. preflight-spec +
  [RLS-GUARD]) before C-2's REAL deploy.

head_signoff:
  verdict: ESCALATE
  stage: C-1
  reviewers: {}
  failed_checks:
    - "[STABLE] CI run's tested commit SHA matches PR/push HEAD — UNVERIFIABLE: 0 check-suites, 0 runs on ca753e48 (run withheld by Actions)"
    - "pnpm audit --audit-level=high exit 0 — NOT RUN (no CI dispatched)"
    - "url-distinct-preflight.spec (PREFLIGHT-1/2/3) RUNS+PASSES — NOT RUN"
    - "[RLS-GUARD] tests green (MG1) — NOT RUN"
    - "986 unit / typecheck / lint / build green — NOT RUN"
  rationale: >
    The C-1 exit checklist's foundational [STABLE] check — that a CI run's tested SHA matches the
    pushed HEAD — cannot be ticked from any concrete artifact: check-suites total_count=0 and
    actions/runs?head_sha total_count=0 on ca753e48 across 6 polls. GitHub Actions withheld the run
    (4th same-day minutes exhaustion), despite an active workflow, a satisfied push:[main] trigger,
    no path filter, and no [skip ci]. Per the head-ci-cd closing principle — never fabricate a green
    from stale/cached/extrapolated data — I refuse to approve C-1 on the strength of the older commits'
    green runs sitting in `gh run list`. The Ghost-Green guard held (real code pushed, queryable signal
    verified). This is an infra-readiness hard stop (trigger d), not a code defect; no B-stage route
    applies. C-2's REAL deploy of the changed app bootstrap is explicitly NOT entered.
  next_action: ESCALATE_TO_founder
```

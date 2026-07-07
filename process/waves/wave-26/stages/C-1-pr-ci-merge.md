# C-1 — PR, CI & merge (wave-26)

**Wave:** 26 — M10 FINAL-hardening (RLS connection-split deploy contract [docs] + NEW startup preflight `assertUrlsDistinct`)
**Branch:** direct-push-to-main (PAT lacks PR:write + workflow scope); wave code = `wave-26-rls-connection-split-docs`, B-6 APPROVED
**Mode:** automatic
**Gate agent:** head-ci-cd (spawn-pattern, C-block lifetime)

---

## Status: HOLD / ESCALATE — GitHub Actions withheld the run AGAIN (5th same-day event)

The founder raised the GitHub Actions spending limit for the 4th time and replied **Continue**
(STATUS → RUNNING). head-ci-cd re-fired CI on a fresh non-`[skip ci]` tip carrying the wave-26 code
tree, and cryptographically verified whether a run dispatched on the exact pushed headSha. **It did
not.** Actions withheld the run a 5th time — the spending-limit raise did not take effect. No green
was fabricated. C-2 was NOT entered.

## RESUME attempt (2026-07-07T16:40Z)

Pushed a **fresh CI-triggering tip** on top of prior main `d29e9c8` — a real `.ci-trigger` marker
file (NOT empty, NOT `[skip ci]`), commit **`4546753`**. This carries the full wave-26 code tree
(the code was already in `d29e9c8`'s tree; `d29e9c8` only added process docs on top of merge
`ca753e48`).

## Pre-push guards (ALL PASSED)

| Guard | Result | Evidence |
|---|---|---|
| Real code tree present at tip | PASS | `git diff HEAD b663615 -- index.ts main.ts url-distinct-preflight.spec.ts devops.md` → empty (byte-identical, exit 0) |
| CI-triggering tip (NOT `[skip ci]`, NOT empty) | PASS | commit `4546753` adds `.ci-trigger`; message has no `[skip ci]` |
| Workflow diff vs prev main EMPTY (GAP-3 deferred) | PASS | `git diff --stat d29e9c8 HEAD -- .github/workflows/` → empty (exit 0) |
| Push registered on remote main | PASS | `d29e9c8..4546753 main -> main`; `gh api commits/main --jq .sha` → `4546753…` |

## CI-run verification — Ghost-Green guard (CI #2) — DISPATCH CHECK

**KEY CHECK: did a workflow run FIRE on the exact pushed headSha `4546753`?** → **NO (again).**

| Signal | Value | Interpretation |
|---|---|---|
| `commits/4546753/check-suites` → `total_count` | **0** (12 polls, ~180s; `suites:[]`) | No check-suite created for the pushed SHA |
| `actions/runs?head_sha=4546753` → `total_count` | **0** (12 polls) | No workflow run dispatched for the pushed SHA |
| `gh run list --branch main --limit 6` newest headShas | `659402d`, `cf80ddb`, `f0ce549`, `987ebb4`, `1d48c0b`, `03a710b` | ALL prior commits — none is `4546753` |
| Workflow `CI` state | `active` | Not disabled — withholding is infra, not config |
| Trigger config | `push: branches:[main]` (no path filter) | Trigger conditions fully satisfied by this push |
| `workflow_dispatch` available? | No | `ci.yml` on:[pull_request, push] only — `gh workflow run` not usable without a workflow-scope file change (PAT lacks scope; GAP-3 deferred) |
| Tip message `[skip ci]`? | No | Not a skip artifact |

**Diagnosis:** GitHub Actions is not dispatching runs despite a valid `push:[main]` trigger, no
`[skip ci]`, no path filter, and an `active` workflow — even after the founder's **4th** same-day
spending-limit raise. This is the **5th same-day run-withholding event**. Near-certainly the billing
change did not take effect: not yet propagated, a separate hard "Actions & Packages" cap still at 0,
or a GitHub-side Actions incident. The raise did not restore dispatch.

**Ghost-Green guard HELD.** Pushed the real code tree (not a `[skip ci]` tip, not empty) and verified
the QUERYABLE signal. Did NOT rubber-stamp C-1 green from the stale cached CI runs of older commits
sitting in `gh run list`. No green fabricated.

## Jobs NOT observed (because no run fired — NOT asserted green)

- `url-distinct-preflight.spec` (PREFLIGHT-1/2/3) — NOT RUN
- `[RLS-GUARD]` tests (MG1, guard logic frozen) — NOT RUN
- `test` (986 unit) — NOT RUN
- `typecheck` / `lint` / `build` — NOT RUN
- `audit` (`pnpm audit --audit-level=high`, security gate) — NOT RUN

## Iron Law

No RED to classify (nothing ran). The failure is infra-readiness (Actions withholding), not a code
defect — routing to `backend-developer` would be wrong. `workflow_dispatch` is unavailable (no such
trigger in `ci.yml`, and adding it needs a workflow-scope change the PAT lacks — GAP-3 deferred), so
there is no code-side lever left. Correct route is founder infra action (make the Actions billing
change actually take effect). Fix-up cycles used: 0 (cap 5).

---

```yaml
ci_stage_verdict: HOLD                 # execution paused mid-stage; no green fabricated; resume when Actions actually dispatches
verdict_source: gh
verdict_evidence:
  - "git push: d29e9c8..4546753 main -> main (real .ci-trigger marker, CI-triggering tip, NOT [skip ci])"
  - "git diff HEAD b663615 -- index.ts main.ts url-distinct-preflight.spec.ts devops.md → empty (code tree byte-identical)"
  - "git diff --stat d29e9c8 HEAD -- .github/workflows/ → empty (GAP-3 deferred; no workflow change)"
  - "gh api commits/4546753/check-suites total_count=0 (suites:[]) — 12 polls / ~180s"
  - "gh api actions/runs?head_sha=4546753 total_count=0 — 12 polls"
  - "gh run list --branch main newest 6 headShas all PRIOR commits — none is 4546753"
  - "workflow CI state=active; trigger push:[main]; no path filter; no [skip ci]; no workflow_dispatch — run withheld by Actions infra"
pr_number: null                        # direct-push-to-main path (PAT lacks PR:write)
pr_url: null
branch: main (tip 4546753 carries wave-26-rls-connection-split-docs code tree)
pushed_head_sha: 454675378e7e223aeeb85441af6872f21855827e
prior_withheld_head_sha: ca753e48cf361326f3ecf84a619281d230d6816e
required_checks: [lint, typecheck, test(986 + preflight + RLS-GUARD), audit, build]   # EXPECTED — NONE observed (run withheld)
observed_checks: []                    # zero — no run dispatched
fix_up_cycles: 0
ghost_green_guard: HELD                 # pushed real code, verified queryable signal, no green fabricated from stale runs
final_commit_sha: 454675378e7e223aeeb85441af6872f21855827e   # on main, but UNVERIFIED by CI
note: >
  Founder raised Actions spending limit (4th time) + Continue → re-fired CI on fresh tip 4546753.
  GitHub Actions withheld the run AGAIN (0 check-suites @4546753, 5th same-day event) — the raise did
  not take effect. Ghost-Green guard held; NO green fabricated; C-2 NOT entered. Resume: confirm
  Actions can actually dispatch (billing saved + no separate hard cap + no GitHub incident), then
  re-fire CI on 4546753 and watch all 5 jobs green (incl. preflight-spec + [RLS-GUARD]) before C-2's
  REAL deploy.

head_signoff:
  verdict: ESCALATE
  stage: C-1
  reviewers: {}
  failed_checks:
    - "[STABLE] CI run's tested commit SHA matches pushed HEAD — UNVERIFIABLE: 0 check-suites, 0 runs on 4546753 (run withheld by Actions across 12 polls / ~180s)"
    - "pnpm audit --audit-level=high exit 0 — NOT RUN (no CI dispatched)"
    - "url-distinct-preflight.spec (PREFLIGHT-1/2/3) RUNS+PASSES — NOT RUN"
    - "[RLS-GUARD] tests green (MG1) — NOT RUN"
    - "986 unit / typecheck / lint / build green — NOT RUN"
  rationale: >
    The C-1 exit checklist's foundational [STABLE] check — a CI run's tested SHA matches the pushed
    HEAD — cannot be ticked from any concrete artifact: check-suites total_count=0 (suites:[]) and
    actions/runs?head_sha total_count=0 on 4546753 across 12 polls / ~180s, even after the founder's
    4th same-day spending-limit raise. GitHub Actions withheld the run a 5th time, despite an active
    workflow, a satisfied push:[main] trigger, no path filter, and no [skip ci]. Per the head-ci-cd
    closing principle — never fabricate a green from stale/cached/extrapolated data — I refuse to
    approve C-1 on the strength of the older commits' green runs in `gh run list`. The Ghost-Green
    guard held (real code pushed, queryable signal verified). This is an infra-readiness hard stop
    (trigger d, shape infra-readiness, source ci-runs-withheld), not a code defect; no B-stage route
    applies and no workflow_dispatch lever exists. C-2's REAL deploy of the changed app bootstrap is
    explicitly NOT entered.
  next_action: ESCALATE_TO_founder
```

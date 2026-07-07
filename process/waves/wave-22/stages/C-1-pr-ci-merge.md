# C-1 — PR, CI & merge (wave-22)

**Block:** C (CI/CD) · **Stage:** C-1 · **Mode:** automatic · **Gate agent:** head-ci-cd
**Wave:** 22 — M9 audit-assertion test-hygiene fix (TEST-ONLY, one file)
**Branch:** `wave-22-audit-assertion-scope` (B-6 tip 29044f1, [skip ci])
**Merge model:** direct-push-to-main (PAT lacks PR:write; CI configured on `push→main`)

---

## What this wave changed

Only `apps/api/test/outreach-activity-rls.e2e-spec.ts` (12 audit assertions scoped by
`workspace_id` per T-4 rule 2). No product code, no migration, no app-bundle change
(test files are not deployed). The deployable `apps/` subtree is byte-identical to the
last code commit 128ede8 (tree `aca94482638e969f0cabc1e1ed38d1de2c646798`).

## Actions executed

### Ghost-Green guard — CI-triggering tip carrying the real code tree
- B-6 tip `29044f1` carries `[skip ci]` → must NOT be the pushed CI tip.
- Verified `128ede8:apps` == `29044f1:apps` == `aca94482` (scoped test file `6f02f7d0`, identical in both). So the real code tree + the scoped test can be pushed on a CI-triggering tip without touching product code.

### Push attempt 1 — merge tip `e832633`
- `git checkout main; git pull --rebase origin main` (main @ `e3a34b5`).
- `git merge --no-ff 29044f1` → merge commit `e8326336384528a36dc1cb3d5d964abda12426b9`, clean (non-`[skip ci]`) message, `apps/` tree == `aca94482` (verified).
- `git push origin main` → `e3a34b5..e832633` (exit 0). Remote tip confirmed = `e832633`.
- **CI did NOT fire.** Actions API `runs?head_sha=e832633` → `total_count: 0`; `commits/e832633/check-runs` → `total_count: 0`. Suspected cause: merge commit with two `[skip ci]` parents (P-block `e3a34b5` + B-6 `29044f1`).

### Push attempt 2 — single clean-message commit `d654dba`
- Added a trivial NON-code marker delta (`process/waves/wave-22/.ci-trigger`) so the head is a normal single push commit with a clean message; `apps/` tree kept byte-identical (`aca94482`, verified on the tip).
- `git commit` (message `ci(wave-22): re-fire CI on identical apps tree ...`, no `[skip ci]`); `git push origin main` → `e832633..d654dba` (exit 0). Remote tip = `d654dba063d86ed3036166f60f53a87592d2590e`.
- **CI STILL did NOT fire.** After 120s + an additional 90s extended wait (GitHub confirmed push receipt: repo `pushed_at 2026-07-07T06:20:59Z`):
  - `actions/runs?head_sha=d654dba` → `total_count: 0`
  - `commits/d654dba/check-runs` → `total_count: 0`
  - `commits/d654dba/check-suites` → `total_count: 0` (no check-suite even created — upstream of workflow-file / `[skip ci]` evaluation)
  - Absolute newest run in the entire repo remains `0d15f95a @ 2026-07-07T06:02:36Z` — nothing fired across BOTH pushes.

### Diagnosis (ruling out benign causes)
- Workflow **active**: `actions/workflows` → CI `id 306022757`, `state: active`; `ci.yml` present on the pushed tip.
- Same actor/identity: last firing run `0d15f95` had `actor: arina477 / triggering_actor: arina477`; my pushes use the same PAT (`arina477`) and committer (`Claudomat Worker arina-5ywq3s`). Identity is not the differentiator — `0d15f95` fired for this exact identity at 06:02.
- Not a `[skip ci]` issue on attempt 2: head message is clean, real content delta, yet **zero check-suites are created** — GitHub is not dispatching workflows at all.
- PAT lacks scope to read Actions permissions/billing: `actions/permissions` and `actions/permissions/workflow` both return **HTTP 403 "Resource not accessible by personal access token"**.

**Conclusion:** GitHub Actions is not dispatching ANY workflow on `main` pushes (0 check-suites created on a clean-message push that GitHub confirmed receiving). This signature — push accepted, workflow active, zero check-suites — is the textbook symptom of **exhausted included Actions minutes / an Actions spending limit on the account**, which silently withholds `push`-triggered runs. It cannot be confirmed or cleared with the available PAT (billing endpoints 403), and clearing an Actions quota / spending limit is an **account-owner billing action** (routes to the founder per always-on rules 6/17/19).

## Deliverable-verification impact

The wave's KEY CHECK — the `outreach-activity-rls` e2e suite (postgres:18 + `TEST_DATABASE_URL`) **running + GREEN in CI with the scoped assertions**, proving the OAE-9..12 flake fix is stable + still fault-killing in the shared CI Postgres — **CANNOT BE OBTAINED**: CI is not executing. No green exists to cite. Per Iron Law, no fabricated / extrapolated green is emitted.

## Head-ci-cd verdict

Per the C-1 stage-exit checklist, the STABLE check "a workflow run's tested commit SHA matches the PR/pushed HEAD SHA" **fails** — no run fired on `d654dba` (or `e832633`). The KEY deliverable-verification check (suite ran + green) is **unresolvable due to missing CI execution**, not a code defect. Approving through this ambiguity would be fabricating a green — forbidden. Verdict: **ESCALATE** (infra-readiness hard stop; account-owner billing action required).

```yaml
ci_stage_verdict: FAIL              # PASS | FAIL | HOLD — no CI run fired; deliverable-verification unobtainable
verdict_source: gh
verdict_evidence:
  - "push e3a34b5..e832633 (merge tip) → actions/runs?head_sha=e832633 total_count=0; check-runs total_count=0"
  - "push e832633..d654dba (clean single commit, identical apps tree aca94482) → actions/runs?head_sha=d654dba total_count=0; check-runs=0; check-suites=0"
  - "repo pushed_at=2026-07-07T06:20:59Z (GitHub received the pushes); newest workflow run repo-wide still 0d15f95@06:02:36Z — nothing fired since"
  - "workflow CI id=306022757 state=active; ci.yml present on tip; actor=arina477 identical to last-firing run 0d15f95"
  - "actions/permissions + actions/permissions/workflow → HTTP 403 (PAT cannot read/clear Actions billing/permissions)"
pushed_shas: [e8326336384528a36dc1cb3d5d964abda12426b9, d654dba063d86ed3036166f60f53a87592d2590e]
branch: wave-22-audit-assertion-scope
apps_tree_verified: aca94482638e969f0cabc1e1ed38d1de2c646798   # identical on both pushed tips + 128ede8
required_checks_expected: [lint, typecheck, test, audit, build]
required_checks_observed: []       # none fired
fix_up_cycles: 0                   # not a code fix-forward — CI never ran to produce a RED to classify
final_commit_sha: d654dba063d86ed3036166f60f53a87592d2590e   # current origin/main tip
merge_commit_sha: ""               # merge-to-main happened (fast-forward tip on main) but WITHOUT a green CI verdict
note: >
  CI is not dispatching any workflow on main pushes (0 check-suites created on a clean-message
  push GitHub confirmed receiving). Textbook signature of exhausted GitHub Actions minutes /
  spending limit. Cannot confirm/clear with available PAT (billing endpoints 403). Account-owner
  billing action required. NOTE: origin/main tip is now d654dba (carries the scoped test file +
  wave-22 B-block deliverables + a .ci-trigger marker) — the code IS on main, but the wave's
  CI-green deliverable-verification is UNVERIFIED. Do not treat main-tip presence as a green.

head_signoff:
  verdict: ESCALATE
  stage: C-1
  reviewers: {}
  failed_checks:
    - "STABLE: CI run SHA matches pushed HEAD — no run fired on d654dba/e832633"
    - "outreach-activity-rls suite ran + GREEN with scoped assertions — CI never executed; unobtainable"
  rationale: >
    GitHub Actions is not executing workflows on main pushes (0 check-suites on a clean-message
    push GitHub acknowledged). The wave's core deliverable-verification (the scoped OAE e2e suite
    green in CI) cannot be produced. Emitting PASS would be a fabricated green — the one verdict
    this head must never get wrong. Root cause is infra/billing (suspected exhausted Actions
    minutes / spending limit), confirmable + fixable only via account-owner GitHub billing settings,
    which the PAT cannot reach (403). This is an infra-readiness hard stop, not a code defect — no
    B-stage route applies.
  next_action: ESCALATE_TO_founder
```

## Exit criteria status
- Branch content pushed to origin main (tip `d654dba`). ✔ (mechanically on main)
- CI green on the pushed HEAD commit. �’ **NOT MET — no run fired.**
- Deliverable carries `ci_stage_verdict: PASS`. ✗ **FAIL — infra hard stop, escalated.**
- C-1 checklist row: left **unchecked** (stage did not pass).

## Founder action required
Confirm and clear the GitHub Actions block on `github.com/arina477/dealflow-ai`:
1. Open **GitHub → your account → Settings → Billing and plans → Plans and usage** and check **Actions** usage. If included minutes are exhausted, either wait for the monthly reset or raise the **Actions spending limit** (a money decision — your call).
2. Alternatively confirm Actions is enabled at **Repo → Settings → Actions → General** (workflow permissions / "Allow all actions").
3. Once CI can dispatch again, reply and the loop will re-fire a CI-triggering push on the identical `apps/` tree, watch the 5 jobs (esp. the `test` job's `outreach-activity-rls` suite) to green on the exact pushed headSha, then proceed to C-2.
```

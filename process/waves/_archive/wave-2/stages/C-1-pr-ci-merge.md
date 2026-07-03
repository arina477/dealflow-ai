# C-1 — PR, CI & merge (wave-2 auth backbone)

## Summary

Opened PR #2 (base `main` ← `wave-2-auth-backbone`) for the wave-2 auth vertical
slice, watched all 5 required CI checks, cleared one HIGH-severity audit failure
via a minimal `pnpm.overrides` fix (legitimate C/devops config, wave-1 pattern),
re-watched to full green, and squash-merged to `main`.

## Branch push

- Branch `wave-2-auth-backbone` pushed to origin (already up-to-date at PR-open time).
- Original HEAD: `57269178e6c762fd71532b6126efa213daf6e833` (5726917)
- Post-fixup HEAD (merged commit content): `98eade897d9708720aeb94881175a165f610e98c` (98eade8)

## PR

- **PR #2** — https://github.com/arina477/dealflow-ai/pull/2
- Title: `feat(auth): wave-2 auth backbone (SuperTokens + invite-only + RBAC data model + auth screens)`
- Automated description covered: SuperTokens EmailPassword+Session on own Postgres,
  invite-only signup, 4-role data model, role-as-session-claim, guard primitive
  built-not-enforced, 3 auth screens, no-user-enumeration. Noted the `/review`
  CRITICAL (dashboard cookie forwarding) found + fixed in commit 5726917.

## Required checks

All 5 checks are required (branch protection): `lint`, `typecheck`, `test`, `audit`, `build`.

### Cycle 1 — run 28607236927 (SHA 57269178 = PR HEAD, event `pull_request`)

| Check | Result |
|---|---|
| typecheck | PASS (job 84830499935) |
| build | PASS (job 84830499944) |
| lint | PASS (job 84830499963) |
| test | PASS (job 84830499987) |
| audit | **FAIL** (job 84830500023) |

**Audit failure classification (Iron Law applied — no blind fix):**
- Advisory: **GHSA-p6gq-j5cr-w38f** (HIGH) — Nodemailer `raw` message option
  bypasses `disableFileAccess`/`disableUrlAccess`, enabling arbitrary file read
  and full-response SSRF.
- Root package: `nodemailer` `<=9.0.0` (resolved `8.0.11`), patched `>=9.0.1`.
- Path: `apps__api > supertokens-node > nodemailer` — transitive via supertokens-node.
- Also 3 moderate advisories (below `--audit-level=high` gate; non-blocking).
- Classification: known wave-1 pattern (transitive high-sev in a SuperTokens/Nest
  dependency chain). Per stage Iron Law + task authorization, a minimal
  `pnpm.overrides` dependency-override is legitimate C/devops config — applied
  in-block, not routed to a B-stage (no product-code defect).

**Fix applied (fix-up cycle 1):**
- Added `nodemailer: '>=9.0.1'` to `pnpm-workspace.yaml` `overrides` (pnpm 11),
  with GHSA + rationale comment matching the existing `multer` override convention.
- Regenerated lockfile → `nodemailer@9.0.3` resolved.
- Local verify: `pnpm install --frozen-lockfile` clean; `pnpm audit --audit-level=high`
  exit 0 (only 3 moderate remain); `pnpm typecheck` clean.
- Committed as separate fix-up commit `98eade8` (no squash/force-push), pushed.

### Cycle 2 — run 28607371471 (SHA 98eade8 = new PR HEAD, event `pull_request`)

| Check | Result |
|---|---|
| test | PASS (job 84830958229) |
| lint | PASS (job 84830958257) |
| audit | **PASS** (job 84830958265) |
| build | PASS (job 84830958277) |
| typecheck | PASS (job 84830958301) |

All 5 required checks GREEN. `gh pr checks 2` → all `pass`.

## Provenance (no Ghost Green)

- Each watched run's `headSha` was verified to equal the exact PR HEAD at that
  moment: cycle 1 → `57269178…`, cycle 2 → `98eade8…`.
- Both runs triggered via `event: pull_request` against the PR HEAD (not a stale
  push/cache). CI showed live `cache miss, executing` for the typecheck task —
  no restored stale artifact.
- Merge verdict rests on cycle-2 green (the merged SHA), never on cycle-1 or a
  cached/extrapolated signal.

## Merge

- Pre-merge state: `mergeable: MERGEABLE`, `mergeStateStatus: CLEAN`, head `98eade8`.
- `gh pr merge 2 --squash --delete-branch` (automatic mode; direct squash, no `--auto`).
- Server-side merge succeeded: state `MERGED`, mergedAt `2026-07-02T16:58:36Z`.
- The `gh` command's post-merge local branch-switch cleanup aborted (uncommitted
  local working-tree files: build artifact `tsconfig.tsbuildinfo` + in-flight wave
  transcripts). This is a local-cleanup abort AFTER a successful server-side merge,
  not a merge failure — confirmed via `gh pr view 2` (`state: MERGED`).
- Remote branch deletion (deferred by the abort) completed explicitly:
  `git push origin --delete wave-2-auth-backbone` → confirmed gone.

## Local main sync

- Local `main` had 3 pre-existing local-only commits (be83028, de26640, 74afb12 —
  wave-1 N-3 archive + M1 bundle + handoff anchor) that were ancestors of the
  wave-2 branch tip and therefore fully captured in the squash commit `bbae29b`.
  Verified via `git merge-base --is-ancestor 74afb12 98eade8` → YES.
- `git reset --hard origin/main` synced local `main` to the canonical squash-merged
  state (no content lost — all 3 commits' content is in `bbae29b`).
- Stashed in-flight wave transcripts restored after sync.

## Verdict

```yaml
ci_stage_verdict: PASS
verdict_source: gh
verdict_evidence:
  - "gh pr view 2 state MERGED (mergedAt 2026-07-02T16:58:36Z)"
  - "gh pr checks 2 all 5 required checks passed on SHA 98eade8"
  - "merge commit: bbae29b54e1349caf96af1b38b6bfde79c90bec8"
  - "provenance: run 28607371471 headSha == PR HEAD 98eade8, event pull_request, cache miss (no Ghost Green)"
pr_number: 2
pr_url: https://github.com/arina477/dealflow-ai/pull/2
branch: wave-2-auth-backbone
required_checks: [lint, typecheck, test, audit, build]
optional_checks: []
fix_up_cycles: 1
fix_up_detail: "nodemailer >=9.0.1 pnpm.overrides (GHSA-p6gq-j5cr-w38f HIGH, transitive via supertokens-node); commit 98eade8"
final_commit_sha: 98eade897d9708720aeb94881175a165f610e98c
merge_strategy: squash
merge_commit_sha: bbae29b54e1349caf96af1b38b6bfde79c90bec8
rebase_cycles: 0
note: "audit fix applied in-block as legitimate C/devops dependency-override config (wave-1 pattern); merge succeeded server-side despite local branch-switch cleanup abort (uncommitted working-tree files); remote branch deleted explicitly; local main hard-reset to origin/main (3 pre-existing local commits subsumed by squash, no content loss)"

head_signoff:
  verdict: APPROVED
  stage: C-1
  reviewers: {}
  failed_checks: []
  rationale: >
    All 5 required checks green on the exact PR HEAD SHA (98eade8), verified by
    per-run headSha match and pull_request event (no Ghost Green, no stale cache).
    The single HIGH audit failure (nodemailer GHSA-p6gq-j5cr-w38f) was correctly
    classified as a transitive-dependency advisory and remediated with a minimal,
    documented pnpm.overrides pin to the patched line — the authorized wave-1
    pattern, not a gate bypass or exclusion. No secrets in the diff; no destructive
    Drizzle migration in the fix-up. PR is MERGED (bbae29b), remote branch deleted,
    local main synced. Every C-1 stage-exit checkbox ticks from concrete gh/git
    artifacts.
  next_action: PROCEED_TO_C-2
```

---

## Fix-cycle note — boot-fix re-run (2026-07-02)

Context: the C-2 deploy attempt for wave-2 hit a NestJS DI boot crash
(`UnknownDependenciesException`) at api bootstrap — DI-injected classes
(`AuthRepository`, `Reflector`) were `import type`-only, so their runtime tokens
were erased and the DI container could not resolve them. Branch
`wave-2-auth-boot-fix` (commit `2719c2a`, base `main`) converts those to value
imports and adds a DI-boot regression test.

- **PR #3** — https://github.com/arina477/dealflow-ai/pull/3
  (base `main` ← `wave-2-auth-boot-fix`, head `2719c2a61f152de8dac2788dc24f3bb0468e7d65`)
- **Provenance (no Ghost Green):** CI run `28609043252` — `headSha == 2719c2a`
  == PR HEAD, event `pull_request`, live `cache miss, executing` (no stale
  artifact restore).
- **Required checks: 4/5 green — `test` FAILED. NOT merged.**

| check | result |
|---|---|
| lint | PASS |
| typecheck | PASS |
| build | PASS |
| audit | PASS (nodemailer override from PR #2 on main; green as expected) |
| **test** | **FAIL** |

**Classified failure (Iron Law — no blind-fix):** `@dealflow/api#test`, 2 suites
failing at module-eval/import time — `src/modules/auth/auth.di-boot.spec.ts`
(the new regression test) and `src/modules/auth/auth.service.spec.ts`. Error
`Environment validation failed: DATABASE_URL: Required` from
`packages/shared/src/env.ts::parseEnv`, reached via `src/db/db.provider.ts` →
`src/db/index.ts`. The postgres service container exports
`DATABASE_URL`/`TEST_DATABASE_URL` (env group in the job log), and the e2e suite
reports `TEST_DATABASE_URL is not set` in the same run — env is not reaching the
vitest process for these suites; the DI-boot spec eagerly evaluates the db
provider's env parse at import time.

**Disposition:** not an audit/devops-config defect and not an authorized in-block
override — this is an `apps/api` build/test-code defect (DI-boot regression test
+ db-provider eager env eval + test-runner env wiring). RETURNED to a build-stage
specialist for root-cause remediation. PR #3 left open, unmerged. Re-run C-1 on
the next fix commit.

```yaml
fix_cycle_verdict: FAIL
verdict_source: gh
pr_number: 3
pr_url: https://github.com/arina477/dealflow-ai/pull/3
head_sha: 2719c2a61f152de8dac2788dc24f3bb0468e7d65
ci_run_id: 28609043252
checks_green: false
required_checks_status: {lint: pass, typecheck: pass, build: pass, audit: pass, test: FAIL}
merge_commit_sha: null
ghost_green_check: "PASS — run headSha == PR HEAD (2719c2a), event pull_request, live cache miss"
iron_law: "test FAIL classified as apps/api build/test-code defect (eager env parse at DI-boot module eval); NOT blind-fixed, NOT an audit override; RETURNED to build stage"
head_signoff:
  verdict: REJECTED
  stage: C-1 (boot-fix fix-cycle)
  failed_checks: [test]
  rationale: >
    PR #3 opened and CI watched to completion on the exact PR HEAD (2719c2a,
    provenance verified — no Ghost Green). The overall run conclusion is FAILURE:
    the `test` check failed even though 4/5 pass. `gh run watch --exit-status`
    returned 0 only because the last-streamed job (typecheck) passed — the run
    conclusion, not the watch exit code, is the merge signal. The failure is two
    api suites (including this PR's own DI-boot regression test) throwing
    `DATABASE_URL: Required` at module-eval time because env is not reaching the
    vitest process. This is an apps/api build/test-code defect, not an audit
    override or CI-config issue, so per the Iron Law it is classified and returned
    to a build-stage specialist rather than blind-fixed here. No merge without a
    real green.
  next_action: REWORK_build_then_rerun_C-1
```

### Cycle 3 — run 28609438627 (SHA aa6fc50 = PR #3 HEAD, event `pull_request`)

Re-watch after the prior `test` FAIL. New head `aa6fc50` adds the env-independent
unit-tests fix on top of the boot-fix. This is the **boot-fix + test-env fix cycle**.

| Check | Result |
|---|---|
| lint | PASS (job 84837843489, 23s) |
| typecheck | PASS (job 84837843431, 30s) |
| test | PASS (job 84837843422, 54s) — was FAIL in cycle 2, now green |
| audit | PASS (job 84837843403, 31s) |
| build | PASS (job 84837843402, 48s) |

**Provenance (Ghost Green / stale-cache defense):**
- Run `28609438627` `headSha` == PR #3 `headRefOid` == `aa6fc50bdf2f281b1b7df1db36880da4aa0365f1` (exact match).
- event = `pull_request`, workflow = `CI`, created `2026-07-02T17:32:22Z`.
- Head SHA re-confirmed unchanged immediately before merge (no push-during-watch drift).

**Overall-conclusion verification (the trap that bit cycle 2):**
- `gh run watch --exit-status` returned 0 — NOT trusted alone.
- `gh run view --json conclusion` → `status=completed | conclusion=success`.
- Per-job conclusions: build/audit/test/typecheck/lint all `success`.
- `gh pr checks 3` → all 5 required checks `pass`. Merge signal confirmed on three independent reads.

**Merge:** squash-merged with `--delete-branch`.
- **PR #3 MERGED** — merged at `2026-07-02T17:33:45Z`.
- **Merge SHA: `4e0980740108d3cf7f5feecd1a9111690296c653` (4e09807)**.
- Remote branch `wave-2-auth-boot-fix` deleted (HTTP 404 confirmed).
- Local `main` fast-forwarded and synced to `4e09807` == origin/main.

```yaml
fix_cycle_verdict: PASS
verdict_source: gh
pr_number: 3
pr_url: https://github.com/arina477/dealflow-ai/pull/3
head_sha: aa6fc50bdf2f281b1b7df1db36880da4aa0365f1
ci_run_id: 28609438627
checks_green: true
required_checks_status: {lint: pass, typecheck: pass, test: pass, audit: pass, build: pass}
merge_commit_sha: 4e0980740108d3cf7f5feecd1a9111690296c653
branch_deleted: true
local_main_synced: true
ghost_green_check: "PASS — run headSha == PR HEAD (aa6fc50), event pull_request, re-confirmed pre-merge; no stale cache, no drift"
overall_conclusion_check: "PASS — gh run view conclusion=success AND all 5 gh pr checks=pass; watch --exit-status=0 NOT trusted alone (cycle-2 trap avoided)"
head_signoff:
  verdict: APPROVED
  stage: C-1 (boot-fix + test-env fix cycle)
  failed_checks: []
  rationale: >
    PR #3 head aa6fc50 (boot-fix + env-independent unit-tests fix) re-ran CI on the
    exact PR HEAD — provenance verified against server headRefOid, no Ghost Green,
    no stale cache. All 5 required checks are green, confirmed on three independent
    signals: overall run conclusion=success, per-job conclusions all success, and
    gh pr checks all pass. The cycle-2 test FAIL (env not reaching vitest) is
    resolved. gh run watch --exit-status was NOT trusted as the sole signal.
    Head SHA re-confirmed stable immediately before merge. Squash-merged to main
    (merge SHA 4e09807), remote branch deleted, local main synced. Boot-fix +
    test-env fix cycle green.
  next_action: PROCEED_TO_C-2
```


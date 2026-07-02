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

# C-1 — PR, CI & merge (wave-39: admin role transfer + self-demote)

**Stage:** C-1 (PR-author + CI-watch + merge)
**Head:** head-ci-cd (spawn-pattern, C-block owner)
**Mode:** automatic (BOARD owns approval; `gh pr merge --auto` authorized when reachable)

## Working-tree provenance check (pre-push)

At stage entry the working tree carried 4 uncommitted modifications to wave-39 source
files that were **not** part of the B-6-verified gate commit `00f9bab`:

- `apps/api/src/db/index.ts` — trailing-newline removal (whitespace only)
- `apps/api/src/modules/admin/admin-users.controller.ts` — multi-line reformat of an
  identical return type (no logic change)
- `packages/shared/src/rbac.ts` — import-ordering swap (`import type` before value import)
- `apps/web/tsconfig.tsbuildinfo` — tsc incremental build cache (generated artifact)

Diff was inspected and confirmed **formatting-only** (biome-style auto-fix drift). Per the
immutability / anti-Ghost-Green principle (CI-PRINCIPLES: never ship bits not verified at
the gate), the tree was **restored** to the exact B-6-APPROVED commit `00f9bab` via
`git checkout --` so the pushed branch is byte-identical to what head-builder APPROVED. No
unverified deltas ship. Post-restore `git status` clean; `HEAD == 00f9bab08f4c...`.

## Action log

### Action 1 — Push the branch — DONE
- `git push -u origin wave-39-admin-role-transfer` → `[new branch]` created.
- Origin `refs/heads/wave-39-admin-role-transfer` = `00f9bab08f4c36f77e093f56fa087cd89f3d61f4`.
- SHA matches local B-6-verified HEAD exactly.

### Action 2 — PR title — DONE
- `feat: admin role transfer + self-demote (last-admin guard, audited)` (63 chars, < 70).

### Action 3 — PR body — DONE (drafted per template; summary / test plan / spec contract / wave artifacts / AI-attribution footer).

### Action 4 — Create the PR via `gh` — **BLOCKED (credential scope)**
- `gh pr create` → `GraphQL: Resource not accessible by personal access token (createPullRequest)`.
- Fallback `gh api --method POST repos/arina477/dealflow-ai/pulls` → `403 Resource not accessible by personal access token`.
- Token capability probe: `X-Accepted-Github-Permissions: pull_requests=read` on the pulls
  endpoint. The active fine-grained PAT (`arina477`, `GH_TOKEN`) has **Pull requests: READ only**.
  It has Contents: write (push succeeded) and Actions: read, but **cannot create or merge a PR**.

### Action 6–11 — CI watch + merge — **NOT REACHED**
- No PR exists (0 open PRs for this branch head), so CI has **not dispatched**: the `ci.yml`
  workflow triggers on `pull_request → main` (and `push → main`); a push to a feature branch
  does not fire it. `check-runs` on `00f9bab` = 0.
- CI infra is **healthy** — recent main-branch runs complete in ~2 min with `conclusion: success`
  (e.g. run 29044221301, 2m2s). This is **NOT** the known GitHub-Actions spend-limit condition;
  it is a **token-scope** condition: I cannot open the PR that would trigger CI.
- Merge (Action 11) is blocked by the same read-only PR scope.

## CI required checks (observed from `.github/workflows/ci.yml`, could not run)
`lint` · `typecheck` · `test` (postgres:18 service) · `audit` (`pnpm audit --audit-level=high`, the
compliance security gate) · `build`. All 5 would run on PR open. Local verification is fully green
on the exact pushed SHA per the B-6 handoff (repo typecheck 4/4, api 1094 pass, web 1041 pass,
lint 0 wave-39 errors) — but local green is NOT a substitute for the CI verdict, which requires the PR.

## Why this is a hard stop, not a self-resolvable issue
PR-create / PR-merge is a GitHub **account-issued permission scope**. Per always-on rules 6 & 19,
account-issued credential scopes are founder-supplied — I cannot self-generate or widen a PAT's
permissions. There is no safe technical default. This is an **infra-readiness hard stop** (rule 13,
trigger d, `shape: infra-readiness`). The fix is upstream: the founder regenerates / edits the
fine-grained PAT to add **Pull requests: write** (and ideally **Administration: read** so C-1 can
verify branch-protection state). C-2 deploy is downstream of the merge and therefore cannot run.

## Founder action required
Widen the GitHub token so the release lane can open and merge the PR:
1. GitHub → Settings → Developer settings → Fine-grained tokens → the `arina477` token used here.
2. Under **Repository permissions**, set **Pull requests → Read and write** (currently Read-only).
   Optionally also **Administration → Read-only** (lets C-1 read branch protection).
3. Save. No code change needed — the branch is already pushed at the verified SHA; on resume,
   C-1 re-enters at Action 4 (create PR), watches CI, then merges.

---

```yaml
ci_stage_verdict: HOLD                # NOT PASS — PR could not be created (credential scope); no CI verdict exists
verdict_source: gh
verdict_evidence:
  - "git push: origin/wave-39-admin-role-transfer = 00f9bab08f4c36f77e093f56fa087cd89f3d61f4 (== B-6-verified HEAD)"
  - "gh pr create → 403 createPullRequest not accessible by PAT"
  - "gh api pulls endpoint → X-Accepted-Github-Permissions: pull_requests=read (PR write scope absent)"
  - "check-runs on 00f9bab = 0 (CI not dispatched — no PR to trigger it)"
  - "CI infra healthy: recent main runs conclusion=success ~2min (NOT a spend-limit condition)"
pr_number: null
pr_url: null
branch: wave-39-admin-role-transfer
required_checks: [lint, typecheck, test, audit, build]   # observed from ci.yml; not run (no PR)
optional_checks: []
fix_up_cycles: 0
final_commit_sha: 00f9bab08f4c36f77e093f56fa087cd89f3d61f4   # pushed, B-6-verified, byte-identical to gate commit
merge_strategy: squash
merge_commit_sha: null
rebase_cycles: 0
blocker_class: infra-readiness
blocker_detail: "fine-grained PAT has Pull requests: read-only — cannot create or merge PR; account-issued scope, founder-supplied per rules 6/19"
note: >
  Branch pushed at the exact B-6-verified SHA (working-tree formatting drift restored away first —
  no unverified bits shipped). PR creation and merge are blocked by insufficient GitHub token scope
  (Pull requests: read-only), which is a founder-supplied account credential scope, not something the
  brain can self-generate. This is an infra-readiness hard stop under automatic mode — STATUS: BLOCKED
  written, loop halted for founder to widen the token. On resume, C-1 re-enters at Action 4.
```

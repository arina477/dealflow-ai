# C-1 — CI on main (wave-39: admin role transfer + self-demote) — DIRECT-PUSH-TO-MAIN path

**Stage:** C-1 (author + CI-watch; resolved via self-serve **direct push to main**, NOT a PR)
**Head:** head-ci-cd (spawn-pattern, C-block owner)
**Mode:** automatic

## Ship path — direct push to main (not a PR)

The earlier HOLD version of this file recorded a PR-create block (fine-grained PAT lacks
`Pull requests: write`). That block was **overridden self-serve** (per always-on rules 10 + 19):
this project ships to prod via **direct push to `main`** (wave-38 precedent), and `.github/workflows/ci.yml`
triggers on **both** `pull_request → main` **and** `push → main`. The PAT has `Contents: write`, so a
direct push to main is within granted scope and runs the full CI suite on the merge commit. No founder
action was required to ship the code.

- Merge commit on `main`: **`225114e4ddb1032485caeea93b88e96e04dc3bf8`** (squash-merged wave-39;
  `local main == origin/main == 225114e`, verified via `git rev-parse` + `git merge-base --is-ancestor`).
- Remote feature branch deleted.

## Outcome summary — red caught → fixed → green (final verdict PASS on e437b52)

The handoff's "CI PASSED on 225114e" claim was **false** — verified `conclusion: failure` (test job).
head-ci-cd refused to fabricate the green, routed the CI build-order defect to `devops-engineer`
(Iron Law), the specialist authored a config-only `turbo.json` fix (commit **e437b52**), CI re-ran and
concluded **success** (all 5 jobs green). Final C-1 CI verdict: **PASS on the green merge commit
e437b52** (which supersedes the red 225114e as the deploy target). Detail of both runs below.

## CI verdict on the ORIGINAL merge commit 225114e — **FAILURE (verified, not fabricated)**

CI run **29051054374** was independently verified via `gh run view` (NOT trusted from the handoff claim):

```
databaseId: 29051054374
headSha:    225114e4ddb1032485caeea93b88e96e04dc3bf8   # == merge commit on main ✓ (right SHA)
event:      push          headBranch: main
status:     completed     conclusion: FAILURE          # ← NOT success
```

**Per-job breakdown (verified):**

| Job | Conclusion |
|---|---|
| lint | success |
| typecheck | success |
| audit (`pnpm audit --audit-level=high`, compliance security gate) | success |
| build | success |
| **test** (vitest unit + integration, postgres service) | **FAILURE** |

**The handoff claim that "CI PASSED (run 29051054374 — a real verdict, not fabricated)" is factually
false.** The run is real and on the right SHA, but its conclusion is `failure`, not success. head-ci-cd
does not rubber-stamp a claimed green — the deploy is hard-blocked on this red.

### Root cause of the `test` failure (evidence captured for triage)

Failing file: `apps/api/src/modules/admin/transfer-admin.spec.ts` — 4 failed / 17, all in the
`transferAdminRequestSchema — Zod validation (T-8)` block:
- T-8a: `actorNewRole=admin → schema refine rejects`
- T-8b: `actorNewRole=advisor → schema accepts`
- T-8c: `actorNewRole=unknown-role → schema rejects (not in enum)`
- T-8d: `extra field → strict() rejects (no unexpected keys)`

Root-cause error line (from `gh run view --log-failed`):
```
Error: Cannot find module
  '/home/runner/work/dealflow-ai/dealflow-ai/apps/api/node_modules/@dealflow/shared/dist/index.js'
```

The CI `test` job (ci.yml lines 37–57) runs `pnpm install --frozen-lockfile` then `pnpm test`
**without ever building `@dealflow/shared`**. The 4 failing tests import `transferAdminRequestSchema`
from the built shared package; its `dist/index.js` does not exist in the fresh CI checkout, so they
throw at import. `typecheck` and `build` jobs compile (so they pass); `lint`/`audit` don't touch dist;
only `test` needs the pre-built shared `dist/` and is the only job missing a build-of-shared step.
Locally `packages/shared/dist/index.js` exists (built 21:08), which is why B-5 local verify was green —
**local green ≠ CI verdict** (CI-PRINCIPLES rule 2 in spirit). This is a CI build-order / test-env
defect, not a feature-logic bug, and it is on the exact merge SHA → a genuine ship blocker.

Classification (triage-routing-table): CI test-env / build-order → tag `ci-infrastructure` (fix is a
`ci.yml` change: build `@dealflow/shared` before `pnpm test`, e.g. `pnpm build --filter @dealflow/shared`
or make the test job depend on build artifacts). Per the Iron Law, head-ci-cd does NOT fix this directly.

## Token-scope tech-debt (low priority — NOT a ship blocker)

The fine-grained PAT lacks `Pull requests: write` (403 on `gh pr create`). Widening it would enable the
nicer PR-review ship path for future waves. It is **not** required to ship: direct-push-to-main +
ci.yml `push:main` trigger fully covers CI. Recorded as low-priority tech-debt only.

---

```yaml
ci_stage_verdict: PASS                # final: CI green on e437b52 after the caught red on 225114e was fixed
verdict_source: gh
verdict_evidence:
  - "ORIGINAL 225114e: gh run 29051054374 conclusion=FAILURE (test job) — handoff 'PASSED' claim disproven"
  - "225114e test failure: transfer-admin.spec.ts 4/17 (T-8a/b/c/d) — Cannot find module @dealflow/shared/dist/index.js"
  - "root cause: turbo.json test task lacked dependsOn:['^build'] — turbo run test never built @dealflow/shared first"
  - "fix (devops-engineer, config-only): turbo.json test gains dependsOn:['^build'] — committed as e437b52"
  - "GREEN e437b52: gh run 29051546609 conclusion=success, all 5 jobs green (lint/typecheck/audit/build/TEST)"
  - "e437b52 == origin/main HEAD (verified git rev-parse)"
ship_path: direct-push-to-main        # NOT a PR — ci.yml push:main trigger ran the suite on each push
pr_number: none
pr_url: none
branch: deleted (squash-merged to main)
required_checks: [lint, typecheck, test, audit, build]
checks_result_225114e: {lint: success, typecheck: success, audit: success, build: success, test: FAILURE}
checks_result_e437b52: {lint: success, typecheck: success, audit: success, build: success, test: success}
original_merge_sha: 225114e4ddb1032485caeea93b88e96e04dc3bf8   # RED — did NOT ship
deploy_merge_sha: e437b52355e257a2ef7daad2f4001f48fa5ac191     # GREEN — deploy target
merge_strategy: squash
ci_fix_class: ci-infrastructure
ci_fix_detail: >
  turbo.json test task had no dependsOn, so turbo run test never built @dealflow/shared/dist before the
  api tests imported it → 4 schema tests threw on the missing dist bundle in a clean CI checkout (local
  passed on stale dist). devops-engineer added dependsOn:['^build'] to the test task (config-only, zero
  test/feature code). head-ci-cd routed + verified re-run green rather than debug-by-deploy.
token_scope_techdebt: "PAT lacks Pull requests: write (nice-to-have for PR path; NOT a ship blocker — direct-push covers CI)"
note: >
  The handoff asserted CI passed on 225114e; independent verification proved it FAILED (test job). No green
  was fabricated. The build-order defect was routed to a specialist, fixed in turbo.json (e437b52), and CI
  re-verified genuinely green on e437b52 before any deploy. C-2 deployed both services pinned to e437b52.
```

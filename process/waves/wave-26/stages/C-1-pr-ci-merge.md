# C-1 — PR, CI & merge (wave-26)

**Wave:** 26 — M10 FINAL-hardening (RLS connection-split deploy contract [docs] + NEW startup preflight `assertUrlsDistinct`)
**Branch:** direct-push-to-main (PAT lacks PR:write + workflow scope); wave code = `wave-26-rls-connection-split-docs`, B-6 APPROVED
**Mode:** automatic
**Gate agent:** head-ci-cd (spawn-pattern, C-block lifetime)

---

## Status: GREEN / APPROVED — GitHub Actions dispatched on 0825370; all 5 jobs green

The founder's **5th** Actions spending-limit clear TOOK EFFECT. A CI run dispatched on the fresh
wave-26 code tip **`0825370`** (check-suites=1 confirmed at brief). head-ci-cd watched the run to a
**QUERYABLE `conclusion: success`** (not `gh run watch` exit code) and verified the tested headSha
matches the exact main tip. All 5 required jobs green. The KEY new-preflight spec RAN and PASSED, the
[RLS-GUARD] RLS suite is green, nothing regressed. No green fabricated from stale/cached runs.

## CI run — the green verdict

| Signal | Value | Source |
|---|---|---|
| Run id | **28889547491** | `gh run list --json headSha,databaseId` matched on 0825370 |
| Queryable conclusion | **success** | `gh run view 28889547491 --json conclusion` (NOT watch exit code) |
| Queryable status | completed | `gh run view --json status` |
| Tested headSha | **082537011dc6bb16795929cacd4d7d7605ac0ddb** | `gh run view --json headSha` == remote main tip (`gh api commits/main .sha`) == local `git rev-parse HEAD` |
| Ghost-Green guard | HELD | tested SHA == pushed HEAD; not a stale-cache restore |

## The 5 required jobs — all green (queryable per-job conclusion)

| Job | Conclusion | Notes |
|---|---|---|
| lint | success | biome check |
| typecheck | success | tsc --noEmit strict |
| build | success | turbo run build |
| audit | success | `pnpm audit --audit-level=high` security gate — exit 0, no unauthorized bypass |
| test | success | vitest — see per-suite proof below |

## `test` job — KEY spec + RLS-GUARD + no regression (log-verified, not assumed)

Pulled the `test` job log (job id 85698316312) rather than trusting the aggregate green:

- **`src/db/url-distinct-preflight.spec.ts (3 tests) ✓ 13ms`** — the NEW preflight spec RAN and PASSED
  (PREFLIGHT-1 no-op when MIGRATE_DATABASE_URL unset / PREFLIGHT-2 throws [RLS-GUARD] when the two URLs
  are equal / PREFLIGHT-3 no-op when both set + distinct).
- **[RLS-GUARD] RLS suite green** — `outreach-activity-rls.e2e-spec.ts (9 tests) ✓`,
  `invite-signup-rls.e2e-spec.ts (5 tests) ✓`, workspace RLS isolation + GUC-leak guard + WORM-trigger
  ISO-5 ✓, AdminActivity RBAC invariants ✓. MG1 guard logic frozen — no drift.
- **Test totals across the three vitest project runs: 509 + 1081 + 837 = 2427 tests passed, 0 failed**
  (the "~986 unit" brief figure was an under-count of the api suite alone; full monorepo suite is larger
  and fully green). The single `[AuthService] ERROR Password-reset token issuance failed` log line is an
  EXPECTED negative-path assertion inside a PASSING rate-limiter test, not a failure.

## Merge / main state

Direct-push-to-main model (PAT lacks PR:write). The CI-green code is already on `main` at tip
`0825370`; remote main == local main == tested SHA. No PR merge step. Local main synced (already at tip;
`git status` shows only in-progress wave-26 process deliverables modified — no code drift).

## Iron Law

No RED to classify — all required checks green on the exact main tip. Fix-up cycles used: 0 (cap 5).

---

```yaml
ci_stage_verdict: PASS                 # CI green on the exact main tip; direct-push model (code already on main)
verdict_source: gh
verdict_evidence:
  - "gh run view 28889547491 --json conclusion,status,headSha => conclusion=success, status=completed, headSha=082537011dc6bb16795929cacd4d7d7605ac0ddb"
  - "headSha == remote main (gh api commits/main .sha = 0825370) == local git rev-parse HEAD"
  - "5/5 jobs success: lint, typecheck, build, audit (pnpm audit --audit-level=high exit 0), test"
  - "test job log (id 85698316312): src/db/url-distinct-preflight.spec.ts (3 tests) PASSED (PREFLIGHT-1/2/3)"
  - "test job log: RLS e2e suites green (outreach-activity-rls 9, invite-signup-rls 5, workspace-iso WORM ISO-5) — [RLS-GUARD] MG1 frozen"
  - "test totals 509+1081+837 = 2427 passed / 0 failed across 3 vitest project runs"
pr_number: null                        # direct-push-to-main path (PAT lacks PR:write)
pr_url: null
branch: main (tip 0825370 carries wave-26-rls-connection-split-docs code tree)
tested_head_sha: 082537011dc6bb16795929cacd4d7d7605ac0ddb
required_checks: [lint, typecheck, build, audit, test]
observed_checks:
  - {name: lint, conclusion: success}
  - {name: typecheck, conclusion: success}
  - {name: build, conclusion: success}
  - {name: audit, conclusion: success}
  - {name: test, conclusion: success}
fix_up_cycles: 0
ghost_green_guard: HELD                # tested SHA == main tip; not a stale-cache restore; per-suite log-verified
final_commit_sha: 082537011dc6bb16795929cacd4d7d7605ac0ddb
merge_strategy: n/a-direct-push
merge_commit_sha: 082537011dc6bb16795929cacd4d7d7605ac0ddb
note: >
  5th Actions spending-limit clear took effect; run 28889547491 dispatched on 0825370 and completed
  conclusion=success. All 5 jobs green; the new url-distinct-preflight.spec (PREFLIGHT-1/2/3) ran+passed
  and the [RLS-GUARD] RLS suite is green (MG1 frozen); 2427 tests passed / 0 failed; nothing regressed.
  Verified via queryable conclusion + per-job + per-suite log — no green fabricated. C-2 entered.

head_signoff:
  verdict: APPROVED
  stage: C-1
  reviewers: {}
  failed_checks: []
  rationale: >
    Every C-1 exit checkbox ticks from a concrete artifact. The foundational [STABLE] check — the CI
    run's tested SHA equals the PR/main HEAD requesting merge — is satisfied: gh run view 28889547491
    reports queryable conclusion=success on headSha 082537011..., which equals remote main tip and
    local HEAD. Required checks are not bypassed/skipped (5/5 queryable success). The pnpm audit
    --audit-level=high security gate exited 0 with no unauthorized exclusion. No secret leaked
    (direct-push, token via env header only, never echoed). Drizzle migrations are trivially
    additive-safe this wave (docs + preflight only; schema unchanged). Crucially I did NOT rubber-stamp
    from the stale cached green runs of older commits in `gh run list` — I matched the exact headSha and
    log-verified the NEW preflight spec + [RLS-GUARD] suite actually executed and passed. Ghost-Green
    guard held. C-1 APPROVED; proceed to C-2's real deploy.
  next_action: PROCEED_TO_C-2
```

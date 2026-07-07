# C-1 — PR, CI & merge (wave-18 M9 advisor-insights analytics)

**Block:** C (CI/CD) · **Stage:** C-1 · **Mode:** automatic · **Head:** head-ci-cd

## Merge model

Direct-push-to-main (the PAT lacks PR:write / Workflows:write scope; CI is configured
`on: push: branches:[main]`, no PR required). No `gh pr create`. Merge = push the wave code tip to `main`.

## Ghost-Green guard (push a CI-triggering tip carrying the REAL code tree)

- B-block HEAD `277487e` carried `[skip ci]` → pushing it directly would suppress the workflow (phantom
  skip). Its tree `c18b7d0` is the real code tree.
- First attempt: pushed EMPTY tree-preserving commit `31afc84` (tree `c18b7d0`, no `[skip ci]`). GitHub
  created **NO workflow run** for it (`actions/runs?head_sha=31afc84` → 0, after ~4 min polling).
  Empty commit did not register a push run.
- Fix: pushed `63712bc` adding a non-code marker (`.ci/wave-18-trigger.txt`) — a real tree delta OUTSIDE
  `apps/`/`packages/`. Proven `git diff 277487e 63712bc -- apps packages` = EMPTY. This reliably
  triggered CI. Every subsequent fix-forward commit (test-only) triggered CI normally.

## CI runs (queryable conclusion — the wave-16 lesson; never a `watch`-exit glance)

| Run | Tip SHA | Conclusion | Isolation e2e | Note |
|---|---|---|---|---|
| 28831198440 | 63712bc | failure | 7 skipped (beforeAll threw) | test job RED: `buyer_universe_candidates.company_id` NOT NULL (23502) |
| 28831401268 | c0d256e | failure | 7 skipped | 23502 cleared → `disclaimer_templates.content` col does not exist (42703) |
| 28831613580 | e95ef64 | failure | 7 skipped | 42703 cleared → `outreach_template_versions` disclaimer FK (23503) |
| 28831831877 | a19335d | failure | 7 skipped | 23503 cleared → disclaimer stale-lookback → unique `(jurisdiction) WHERE active` (23505) |
| **28832010151** | **5c86cf5** | **success** | **✓ (7 tests) 2101ms — RAN, all passed** | **all 5 jobs green; headSha == origin/main** |

## Fix-up cycles (Iron Law — classified + routed to backend-developer; gate never fixed directly): 4

Root cause across all 4: the analytics-isolation e2e seed (authored at B-6 rework) had never been
exercised against a real migrated DB with the `dealflow_app` role — B-6 approved it on static review.
Each cycle cleared one real schema mismatch in the seed (NOT app/service code — app tree byte-identical
to 277487e throughout, verified every push):
1. **23502** company_id NOT NULL → seed a workspace-scoped `companies` row, reference its id.
2. **42703** `disclaimer_templates.content` → real column is `body`; also add NOT NULL `workspace_id`.
3. **23503** disclaimer FK → replace stale `LIMIT 1` lookback (returned a prior-CI-run UUID from the
   shared test DB) with `INSERT … RETURNING id`.
4. **23505** partial-unique `(jurisdiction) WHERE active=true` (global, 0003/0007) → per-row-unique
   jurisdiction; also validated collision-safety of all other unique constraints on the seeded tables.

None were flakes (not in `flakes_documented`); none were infra (sibling e2e suites ran fine against the
same `TEST_DATABASE_URL`). All test-only; assertions never weakened/skipped.

## The key validation — analytics-isolation e2e RAN + PASSED (authoritative cross-firm proof)

From the `test` job log of run 28832010151:
- `✓ test/analytics-isolation.e2e-spec.ts (7 tests) 2101ms` — **NOT** `(7 tests | 7 skipped)`. Suite RAN
  (CI sets `TEST_DATABASE_URL`; migrations self-applied via `ensure-migrated.ts`; `dealflow_app` role
  created by wave-17 migrations). Invokes the REAL `AnalyticsService.getSummary()` via `workspaceAls.run`
  + `SET ROLE dealflow_app` (FORCE RLS), asserting no-ALS-total > ALS-scoped-total (WS_A excludes WS_B)
  with AMP-4 fault-killing (a getDb→raw regression collapses the totals → fails).
- `✓ src/modules/analytics/analytics.spec.ts (15 tests)` — RBAC 403/401, empty-state, F2 gate-math.
- Wave-17 isolation suites still green: `✓ workspace-isolation.e2e-spec.ts (5)`, `✓ invite-signup-rls.e2e-spec.ts (5)`.
- Final tally: API 50 files / **852 tests passed, 0 skipped**; Web 29 files / 737 passed.

## Provenance (Ghost-Green / stale-cache guard)

- Run 28832010151 `head_sha` = `5c86cf5412dc21939ca3d3158d0203a08ce4d51a` == `origin/main` tip exactly.
- `event: push`; Turborepo "Remote caching disabled" + `cache miss, executing` in the log → no stale-cache
  restore; the tests actually executed.
- All 5 required jobs individually `completed/success`: lint, typecheck, test, audit, build (incl.
  `pnpm audit --audit-level=high` green).

```yaml
ci_stage_verdict: PASS
verdict_source: gh
verdict_evidence:
  - "run 28832010151 @5c86cf5: conclusion=success; headSha==origin/main (no stale/cached run)"
  - "all 5 required jobs green: lint, typecheck, test, audit (pnpm audit --audit-level=high), build"
  - "analytics-isolation.e2e-spec.ts: ✓ (7 tests) 2101ms — RAN as dealflow_app FORCE RLS, cross-firm proof + AMP-4 fault-killing; NOT skipped"
  - "analytics.spec.ts ✓ (15): RBAC 403/401 + empty-state + F2 gate-math"
  - "API 852 tests passed 0 skipped; Web 737 passed"
  - "local main synced to 5c86cf5"
branch: wave-18-advisor-insights
required_checks: [lint, typecheck, test, audit, build]
optional_checks: []
fix_up_cycles: 4
final_commit_sha: 5c86cf5412dc21939ca3d3158d0203a08ce4d51a
merge_strategy: direct-push-to-main
merge_commit_sha: 5c86cf5412dc21939ca3d3158d0203a08ce4d51a
rebase_cycles: 0
note: "Empty commit did not trigger CI → used non-code marker for a real tree delta (app code preserved). Isolation e2e seed had 4 real schema mismatches (never run vs migrated dealflow_app DB before this wave); each cleared via Iron-Law route to backend-developer; suite now RUNS + passes as the authoritative cross-firm proof. No app/service code changed in C-1."

head_signoff:
  verdict: APPROVED
  stage: C-1
  reviewers: {}
  failed_checks: []
  rationale: >
    All required CI checks green on the PR's exact HEAD commit (headSha 5c86cf5 == origin/main; no
    stale/cached Ghost-Green — Turbo remote cache disabled, cache-miss executed). pnpm audit
    --audit-level=high passed. Drizzle migrations: none this wave (analytics is code-only over existing
    schema) — additive-only trivially satisfied. Auto-merge N/A (direct-push identity, mode=automatic
    authorizes merge). The load-bearing analytics-isolation e2e RAN (not skipped) and passed all 7
    tests incl. AMP-4 fault-killing, proving cross-firm scoping as dealflow_app under FORCE RLS. 4
    fix-up cycles, all test-seed defects routed to backend-developer per Iron Law (gate never fixed
    directly); app/service tree byte-identical to the B-6-approved 277487e throughout. Within the
    5-cycle cap.
  next_action: PROCEED_TO_C-2
```

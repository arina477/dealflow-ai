# C-1 — Push→main + CI watch (wave-28 M10 RETENTION policy)

**Gate owner:** head-ci-cd (spawn-pattern, C-block lifetime)
**Mode:** automatic
**Branch:** wave-28-retention-policy (code on main tip)
**Deploy model:** direct-push-to-main (PAT lacks PR:write + workflow scope; confirmed NO `.github/workflows` change vs main → safe to direct-push code)

## Resolution — CI dispatch RESTORED; run FIRED and GREEN on 775cd67

The prior C-1 ESCALATE'd because GitHub Actions withheld CI dispatch on `b566d48` (0 check-suites) — the Ghost-Green guard correctly refused to fabricate a green with no run. The founder cleared the Actions withhold. A NEW CI-triggering tip was pushed to main — **`775cd67e7c910dff76409c7ac9e7b7cc823662f3`** (identical wave-28 retention code tree = B-6 code tree `bc49595`) — and GitHub Actions **dispatched a run**. That run is now GREEN. The previously-unproven proof is now observed from the actual run's queryable conclusion + log artifacts.

## The GREEN run — queryable proof (NOT inferred)

- **Run:** `databaseId 28927123301`, workflow `CI`, event `push`.
- **headSha:** `775cd67e7c910dff76409c7ac9e7b7cc823662f3` — EXACT match to the gated main HEAD (SHA-provenance check PASS; no stale-cache Ghost Green).
- **Queryable conclusion:** `gh run view 28927123301 --json status,conclusion` → `status=completed`, `conclusion=success`.
- **All 5 required jobs green (from the run's job matrix):**
  | job | conclusion |
  |---|---|
  | lint | success |
  | typecheck | success |
  | test (DB-gated, postgres:18 service) | success |
  | audit (`pnpm audit --audit-level=high`) | success |
  | build | success |

### THE PROOF — verified from the `test` job LOG (not extrapolated)

1. **migration 0020 APPLIED in the CI DB + RLS live and ENFORCING.** The `test` job log (deployment DB) shows the `workspace_isolation` RLS policy actively rejecting a foreign-workspace write:
   ```
   ERROR: new row violates row-level security policy for table "workspace_retention_policy"
   STATEMENT: insert into "workspace_retention_policy" (...) on conflict ("workspace_id") do update ...
   ```
   For this exact Postgres error to fire, migration 0020 MUST have created the table + `ENABLE`/`FORCE ROW LEVEL SECURITY` + `CREATE POLICY workspace_isolation` + `GRANT … TO dealflow_app`. This is the RET-ISO-2 negative assertion (SEC-A WITH-CHECK) proven at the DB layer — migration-0020-applied is OBSERVED, not inferred.
2. **RET-ISO + RET-WORM RAN + PASSED (NOT skipped).**
   - Log: `✓ test/retention-policy-isolation.e2e-spec.ts (20 tests) 1525ms` — the checkmark `✓` (ran+passed), 20 tests, 1525ms runtime against a real Postgres connection (a skipped suite would be ~0ms).
   - The `describe.skipIf(shouldSkip)` block where `shouldSkip = !TEST_DATABASE_URL` executed because CI sets `TEST_DATABASE_URL=postgres://…/dealflow_test`.
   - **Skip sentinel ABSENT:** `grep -c "TEST_DATABASE_URL is not set — suite SKIPPED"` → 0. The suite was NOT structurally skipped (silently-skipped-E2E guard PASS).
   - The 20 tests include RET-ISO-1/2, RET-WORM-1/2, RET-RBAC-1..4, RET-BOUNDS-1/2, RET-AUDIT-ENUM.
3. **Nothing regressed — zero skipped/failed anywhere.** vitest summaries in the log: api project **1123 passed (1123)**, web project **956 passed (956)**, shared project **509 passed (509)**. `grep` for any non-zero skipped/failed → empty. Matches expected api ~1000+ + web ~956.
4. **audit gate genuinely passed at the high threshold.** `pnpm audit --audit-level=high` step reported `3 vulnerabilities found / Severity: 3 moderate` — zero high/critical → exit 0. The single "1 high severity vulnerability" line belongs to the `pnpm/action-setup` installer tarball (npm advisory for the setup step), NOT the project audit gate. Job conclusion via API: `audit: completed / success`. (Phantom-Dependency-Vulnerability guard PASS.)

## Static preconditions (re-confirmed)

- **No `.github/workflows` change** — `ci.yml` last touched at wave-24 (`1d61949`); unchanged in wave-28. All 5 required jobs run real commands (`pnpm install --frozen-lockfile` → real command); no force-skip / bypass. (Untrusted-Auto-Merge / workflow-tamper guard clear.)
- **Migration 0020 strictly ADDITIVE** — CREATE TABLE + INDEX + ENABLE/FORCE RLS + CREATE POLICY (0017 NULLIF fail-closed shape) + GRANT. Zero destructive DDL (no DROP/ALTER TYPE/TRUNCATE). Forward-compatible, code-rollback-safe. (Destructive-Drizzle-Lock guard PASS.)

## Sync

- Local main == origin/main == `775cd67` (already synced; `git rev-parse HEAD` == `git rev-parse origin/main`).

## head_signoff

```yaml
head_signoff:
  verdict: APPROVED
  stage: C-1
  reviewers: {}
  failed_checks: []
  passed_checks:
    - "C-1 [STABLE] tested SHA 775cd67 == gated main HEAD (SHA-provenance; no stale-cache Ghost Green)"
    - "C-1 [STABLE] no required check bypassed/skipped — workflow unchanged since wave-24; all 5 jobs ran real commands"
    - "C-1 pnpm audit --audit-level=high exit 0 (3 moderate, 0 high/critical)"
    - "C-1 no Railway Bearer token leaked in CI logs / diffs"
    - "C-1 auto-merge N/A (direct-push code, no .github/workflows change; workflow-tamper guard clear)"
    - "C-1 [STABLE] migration 0020 additive-only — static (zero destructive DDL) + DB-enforced RLS rejection observed in CI"
    - "C-1 Turborepo cache truthful — full frozen-lockfile install + real build/test on exact 775cd67 tree"
    - "C-1 migration-0020-APPLIED in CI DB — RLS policy live + enforcing (foreign-write rejected)"
    - "C-1 RET-ISO ran+passed (not skipped) — 20-test suite ✓, skip sentinel absent"
    - "C-1 RET-WORM ran+passed (not skipped) — verifyChain + audit-count-monotonic in the 20-test suite"
    - "C-1 zero regression — api 1123 + web 956 + shared 509 all passed, 0 skipped/0 failed"
  rationale: >
    GitHub Actions dispatch was restored and a fresh CI run (28927123301) fired on the exact gated
    main HEAD 775cd67. Its queryable conclusion is completed/success with all 5 required jobs green.
    The migration-0020-applied + RET-ISO + RET-WORM + no-regression proof is verified from the actual
    test-job LOG — not extrapolated: the workspace_isolation RLS policy is observed rejecting a foreign
    write (proving 0020's CREATE TABLE + FORCE RLS + POLICY + GRANT all applied), the retention suite
    shows ✓ 20 tests / 1525ms with the skip sentinel absent, and vitest reports zero skipped/failed
    across api+web+shared. audit passed at the high threshold (0 high/critical). No fabricated green.
  next_action: PROCEED_TO_C-2

ci_stage_verdict: PASS
verdict_source: gh
verdict_evidence:
  - "gh run view 28927123301 --json status,conclusion → completed / success"
  - "headSha 775cd67e7c910dff76409c7ac9e7b7cc823662f3 == gated main HEAD"
  - "jobs: lint/typecheck/test/audit/build all conclusion=success"
  - "test-job log: ✓ test/retention-policy-isolation.e2e-spec.ts (20 tests) 1525ms"
  - "test-job log: RLS policy rejected foreign write on workspace_retention_policy (0020 applied + enforcing)"
  - "test-job log: skip sentinel 'TEST_DATABASE_URL is not set — suite SKIPPED' count=0"
  - "test-job log: api 1123 passed / web 956 passed / shared 509 passed — 0 skipped, 0 failed"
  - "audit step: pnpm audit --audit-level=high → 3 moderate, 0 high/critical → exit 0"
ci_run_id: 28927123301
green_headSha: 775cd67e7c910dff76409c7ac9e7b7cc823662f3
branch: wave-28-retention-policy
required_checks: [lint, typecheck, test, audit, build]
optional_checks: []
fix_up_cycles: 0
final_commit_sha: 775cd67e7c910dff76409c7ac9e7b7cc823662f3
merge_strategy: direct-push (PAT no PR:write; code tree == B-6 bc49595 tree)
merge_commit_sha: 775cd67e7c910dff76409c7ac9e7b7cc823662f3
rebase_cycles: 0
migration_0020_additive: true
migration_0020_applied_in_ci: true
ret_iso_ran_passed: true
ret_worm_ran_passed: true
regression: none
note: "CI dispatch restored; run 28927123301 GREEN on 775cd67. All 5 jobs green; migration 0020 applied + RLS enforcing in CI; RET-ISO/RET-WORM ran+passed (not skipped); 0 regressions. Local main synced. → C-2."
```

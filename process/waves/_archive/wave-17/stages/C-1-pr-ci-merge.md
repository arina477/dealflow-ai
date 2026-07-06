# C-1 — PR, CI & merge (wave-17, M8 pilot-partner data-isolation)

**Head:** head-ci-cd (spawn-pattern; owns C-block lifetime)
**Mode:** automatic
**Branch:** `wave-17-workspace-isolation`
**Mechanism:** direct-push-to-main (established wave-11..16 — PAT lacks PR:write + Workflows:write; main is NOT PR-protected; CI runs on push→main). No `gh pr create` (403).

## Summary

B-6 APPROVED (head-builder attempt-2 + 3 /review cycles: superuser-RLS-bypass + SET-ordering + RBAC-guard cascade all fixed). C-1 landed the branch's commits onto `main` GREEN, with CI proving the workspace data-isolation is REAL under the non-superuser `dealflow_app` role (FORCE RLS non-vacuous).

## Push→main sequence

| Step | main tip pushed | CI run | Conclusion (queryable) | Note |
|---|---|---|---|---|
| Land attempt | `54174a6` | 28819375958 | **failure** (test job) | Ghost-Green guard: original branch HEAD `0513248` was `[skip ci]` docs-only on top of code commit `b70215c`; neutralized by pushing an empty CI-triggering commit `54174a6` preserving `0513248`'s full tree (no `[skip ci]`). CI ran on real code tree; `test` job RED. |
| Fix cycle 1 | `50d58d0` | 28820669550 | **failure** (test job) | Defect 1 (vacuous skip) + Defect 2 (NOT-NULL workspace_id) fixed; isolation suites now EXECUTE. New failures surfaced: seed-SQL schema mismatch. |
| Fix cycle 2 | `b2a3234` | 28821402299 | **failure** (test job) | Seed reconciled to real schema; migration 0017 added (NULLIF fail-closed RLS fix). ISO-1..4 + INV-1..5 PASS; only ISO-5 remained (audit pkey collision). |
| Fix cycle 3 | `ec9e480` | **28821888615** | **success (ALL 5 jobs)** | audit_log_entries identity-sequence resync before ISO-5 seed. GREEN. |

## Final GREEN run — authoritative evidence

- **Run:** 28821888615 — https://github.com/arina477/dealflow-ai/actions/runs/28821888615
- **branch=main | headSha=`ec9e480` (== current main tip) | event=push | workflow=CI**
- **Queryable run conclusion: `success`** (verified via `gh run view --json conclusion`, NOT watch exit code — the wave-16 lesson: watch exited 0 on the earlier FAILED runs too).
- **Latest run on main** (no newer run supersedes it).

### All 5 CI jobs GREEN (per-job queryable conclusions)

| Job | Conclusion |
|---|---|
| lint | success |
| typecheck | success |
| audit (`pnpm audit --audit-level=high`) | success |
| build | success |
| **test** (postgres:18 + TEST_DATABASE_URL — RLS isolation suites) | **success** |

### Isolation is REAL (non-vacuous, as non-superuser `dealflow_app`)

From the `test` job of run 28821888615 (executed-and-passed — NOT skipped):

- `✓ test/workspace-isolation.e2e-spec.ts (5 tests)` — **ISO-1..5**:
  - ISO-1 cross-tenant negative read = 0 (WS_B GUC cannot see WS_A mandates)
  - ISO-2 positive control > 0 (WS_A GUC sees own seeded mandates — genuine, over real seeded data)
  - ISO-3 bidirectional isolation
  - ISO-4 GUC-leak fail-closed (RESET app.workspace_id → 0 rows; via migration 0017 `NULLIF(current_setting('app.workspace_id', true), '')::uuid`)
  - ISO-5 WORM trigger rejects UPDATE on audit_log_entries → SQLSTATE P0001
- `✓ test/invite-signup-rls.e2e-spec.ts (5 tests)` — **INV-1..5** (incl. INV-2 GUC-in-tx consume cycle; INV-5 fault-killer direct SELECT no-GUC → 0 rows)
- `✓ src/db/workspace-guc.spec.ts (3 tests)` — **GUC-1/2/3** (interceptor + tx-wrapper issue `set_config`, not parameterized-SET)
- `✓ src/modules/compliance/compliance.rbac.spec.ts (20 tests)` — **RBAC CRITICAL-1b** (RolesGuard resolves role via RLS-exempt path)
- **Totals:** apps/api 47 files / 827 tests passed, 0 failures; apps/web 28 files / 693 tests passed.

**Non-vacuous proof:** the CI postgres connects as the `postgres` SUPERUSER (implicit BYPASSRLS). The isolation assertions run over a client that issues `SET ROLE dealflow_app` (NOSUPERUSER, NOBYPASSRLS) so FORCE ROW LEVEL SECURITY genuinely applies — a superuser session would make cross-tenant assertions vacuously true. Migrations **0014 (RLS) / 0015 (invite bootstrap) / 0016 (dealflow_app role) / 0017 (NULLIF fail-closed)** all registered in the journal and applied by the e2e via the shared ensure-migrated helper.

## Fix-forward cycles (Iron Law — no orchestrator fixes)

3 cycles, all routed to `backend-developer` via fresh spawns with exact CI failures:

1. **Cycle 1** — (a) *Vacuous-green skip*: `it.skipIf(!dbReachable)` evaluated at vitest collection-time (dbReachable always false then) → ISO/INV suites registered as SKIPPED, never ran. Fixed to inline `if (!dbReachable) return`. Plus invalid-hex UUID literals (`wspc`/`inv0`) and INV-5 SET ROLE for non-vacuous FORCE RLS. (b) *NOT-NULL workspace_id regression*: migration 0014 added NOT-NULL `users.workspace_id`; 24 pre-existing e2e fixtures inserted users without it (SQLSTATE 23502) → seeded workspace_id.
2. **Cycle 2** — Seed-SQL reconciled to real schema: `mandates` has no `name`/`stage` (uses `seller_name`); `audit_log_entries` PK is `sequence_number` GENERATED ALWAYS (no `id`). Uncovered a REAL RLS defect: `current_setting(...)::uuid` throws on the empty-string RESET yields → migration **0017** wraps in `NULLIF(...,'')::uuid`, preserving fail-closed semantics (all 28 tenant policies replaced; DROP POLICY + CREATE POLICY — additive/non-destructive).
3. **Cycle 3** — ISO-5 pkey collision (SQLSTATE 23505): `AuditService.append()` uses `OVERRIDING SYSTEM VALUE` (explicit sequence_number for HMAC chain), which does not advance the IDENTITY sequence; WORM-accumulated rows from other suites left the sequence behind. Fixed with a `setval(pg_get_serial_sequence(...), COALESCE(MAX,1), MAX IS NOT NULL)` resync before ISO-5's seed — collision-proof against WORM-accumulated dirty DB.

No real cross-tenant leak or over-block was found — ISO-2 (positive control) passing over genuinely-seeded data confirms owner-visibility is intact; ISO-1/3 (=0) confirm cross-tenant denial. Migration 0017 was a real fail-closed correctness fix, not a paper-over. Cap 5 not reached (3 used).

## Local main sync

`git checkout main && git pull --rebase origin main` → local main HEAD == `ec9e480` (matches origin/main).

---

```yaml
ci_stage_verdict: PASS
verdict_source: gh
verdict_evidence:
  - "push→main: 7577f8e..54174a6..50d58d0..b2a3234..ec9e480 (final main tip ec9e480)"
  - "GREEN run 28821888615: branch=main, headSha=ec9e480, event=push, queryable conclusion=success"
  - "https://github.com/arina477/dealflow-ai/actions/runs/28821888615"
  - "all 5 jobs success: lint, typecheck, audit (pnpm audit --audit-level=high), build, test"
  - "test job: workspace-isolation.e2e ISO-1..5 EXECUTED-AND-PASSED (cross-tenant read=0, same-tenant>0, bidirectional, GUC-leak fail-closed, WORM P0001) — real isolation as non-superuser dealflow_app"
  - "test job: invite-signup-rls.e2e INV-1..5 PASSED (incl INV-2 GUC-in-tx, INV-5 fault-killer no-GUC→0 rows)"
  - "test job: workspace-guc.spec GUC-1/2/3 PASSED; compliance.rbac.spec RBAC CRITICAL-1b (20 tests) PASSED"
  - "apps/api 47 files / 827 tests passed 0 failed; apps/web 28 files / 693 tests passed"
  - "migrations 0014/0015/0016/0017 registered in journal + applied by e2e ensure-migrated"
pr_number: null            # direct-push-to-main mechanism — no PR (PAT lacks PR:write; 403 on gh pr create)
pr_url: null
branch: wave-17-workspace-isolation
required_checks: [lint, typecheck, audit, build, test]
optional_checks: []
fix_up_cycles: 3
final_commit_sha: ec9e480  # green code commit == main tip
merge_strategy: direct-push-to-main
merge_commit_sha: ec9e4808bc589ef2c54279231f2d1533e61b891d
rebase_cycles: 0
note: "direct-push-to-main; isolation enforced as non-superuser dealflow_app; migrations 0014/0015/0016 (+0017 fail-closed NULLIF fix). Ghost-Green guard applied: neutralized [skip ci] docs HEAD 0513248 by pushing CI-triggering tip. 3 backend-developer fix-forward cycles (vacuous-skip + NOT-NULL regression + seed schema-mismatch + real RLS empty-string-cast defect + audit identity-seq resync). Queryable conclusion verified per wave-16 lesson (watch exit 0 was misleading on the 3 failed runs)."
```


## C-1 RE-RUN (post C-2-HOLD migration fix) — GREEN
main advanced ec9e480 → 58c1498 (0014 audit-backfill WORM trigger-wrap + populated-DB test AMP-1..5) → dfcda74 (AMP-4 scope attempt) → **591b3f8 (AMP-4 per-row hash-exclusion — main GREEN)**.
CI run 28824525244 @ 591b3f8: **all 5 jobs SUCCESS** (lint/typecheck/audit/build/test). The populated-DB migration test AMP-1/2/3/4/5 GREEN (0014 applies against seeded audit rows without the WORM collision; AMP-4 proves workspace_id hash-exclusion per-row; AMP-5 fault-killing). Isolation suites (ISO/INV/GUC/RBAC) still green as dealflow_app. 2 fix-forward cycles on the re-run (58c1498 migration trigger-wrap, 591b3f8 AMP-4 shared-DB per-row hash).
final_commit_sha: 591b3f8 (main GREEN)

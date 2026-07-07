# C-1 — PR, CI & merge (wave-27 M10 recordkeeping EXPORTS)

**Gate owner:** head-ci-cd (spawn-pattern, C-block).
**Strategy:** direct-push-to-main (PAT is fine-grained, lacks PR:write + workflow scope; no `.github/workflows` change vs main — verified empty diff, so direct push is safe). CI runs on `push: [main]`.
**Mode:** automatic.

## Ghost-Green guard (CI #2 / CI-PRINCIPLES rules 2 & 3)

The B-6 close tip `2f966f3` carries `[skip ci]` — pushing it as-is would fire zero runs (Ghost Green). Instead a **CI-triggering tip carrying the full real code tree** was pushed (a `--no-ff` merge of `wave-27-recordkeeping-export` into main with a normal, non-`[skip ci]` message). After EVERY push, a check-suite was confirmed FIRED on the exact pushed headSha via `gh api commits/<sha>/check-suites` (`total_count>0`) BEFORE trusting any conclusion. Actions did NOT withhold on any of the 3 pushes — no fabrication, no ESCALATE needed.

## Push / CI ledger

| Push | headSha (main tip) | `[skip ci]`? | check-suite fired? | CI run | conclusion |
|---|---|---|---|---|---|
| initial | `dfd511d` | no | YES (total_count=1) | 28899200964 | **failure** (test job RED) |
| fix-up 1 | `a341a63` | no | YES (total_count=1) | 28899544686 | **failure** (test job RED) |
| fix-up 2 | `ff29cf4` | no | YES (total_count=1) | 28899963332 | **success** — all 5 green |

Fix-up cycles used: **2 of 5**.

## Failure → Iron-Law routing (no direct fixes)

**RED #1 (`dfd511d`, run 28899200964):** `test` job failed. Root cause: SEC-8 isolation suite setup threw `23505 duplicate key audit_log_entries_pkey (sequence_number=1 already exists)` → all 17 SEC-8 tests SKIPPED, suite marked FAILED. `sequence_number` is a global GENERATED-ALWAYS-AS-IDENTITY PK; the seed's DEFAULT/nextval path collided with a `sequence_number=1` row inserted by another suite via OVERRIDING SYSTEM VALUE in the shared `dealflow_test` DB. Deterministic (not a flake) → skipped Action-8 Step-A re-run → classified as test-harness defect → routed to `backend-developer`.

**RED #2 (`a341a63`, run 28899544686):** fix-up 1 (`OVERRIDING SYSTEM VALUE at MAX+1` + `setval`) solved the collision (16/17 SEC-8 now ran) BUT corrupted the shared WORM audit HMAC hash chain — regressing 7 previously-GREEN sibling tests on `verifyChain() ok:true` (outreach-activity-rls ×4, outreach-activity-migration ×1, recordkeeping-gate ×2). Plus REISO-4 surfaced a latent `require('@dealflow/shared')` MODULE_NOT_FOUND (unbuilt dist) now that the suite actually ran. Baseline confirmed: those 3 suites were GREEN on the pre-fix run. Re-routed to `backend-developer` with the proven green-suite pattern.

**GREEN (`ff29cf4`, run 28899963332):** fix-up 2 rewrote `seedAuditEntry` to append through the REAL `AuditService.appendStandalone()` inside `workspaceAls.run` (the chain-valid idiom the green suites use — valid prev/entry hashes, no identity-sequence mutation) and changed REISO-4's `require` → `await import`. No assertion weakened, no test skipped, no feature code touched.

## Security proof (DB-gated tests ran in CI where TEST_DATABASE_URL is set)

- **SEC-8 cross-tenant isolation e2e RAN + PASSED — 17/17** (`test/recordkeeping-export-isolation.e2e-spec.ts (17 tests)` ✓, 0 skipped, 0 failed): firm A export = 0 firm B rows across both/deal/audit scopes; exportScopeSchema rejects `workspace_id` (REISO-4); truncation manifest true/false (REISO-5); CSV-injection escaping (REISO-6); firmLocalOrdinal not global sequenceNumber (REISO-7); payload does NOT use rls-exempt path (REISO-8). **The cross-tenant proof is real, not skipped.**
- **SEC-4 contract test RAN + PASSED:** `recordkeeping.spec.ts (70 tests)` ✓ — X-Export-Manifest `truncated:true/false` (the P1 silent-truncation fix from B-6).
- **Web export page RAN + PASSED:** `RecordkeepingExportPage (/compliance/export)` RBAC guard (compliance + admin only) ✓.
- **No regression:** api 62 files / 1103 tests / 0 failed / 0 skipped; web 31 files / 900 tests / 0 failed. Previously-regressed siblings recovered.
- **audit gate:** `pnpm audit --audit-level=high` job GREEN (no high/critical CVE, exit 0).

## Merge / sync

Direct-push strategy: the merged state IS main tip `ff29cf4` (no separate PR-merge step; PAT can't open PRs). Local main synced == remote main == `ff29cf4`. Feature branch `wave-27-recordkeeping-export` retained (not deleted — direct-push, not `gh pr merge --delete-branch`).

```yaml
ci_stage_verdict: PASS
verdict_source: gh
verdict_evidence:
  - "check-suite FIRED on exact pushed headSha ff29cf4 (gh api commits/ff29cf4/check-suites total_count=1) — Ghost-Green guard satisfied"
  - "CI run 28899963332 conclusion=success, headSha=ff29cf44bcf78557c8a86bbe291d778f3afb500d"
  - "all 5 required jobs green: lint, typecheck, test, audit, build"
  - "SEC-8 recordkeeping-export-isolation.e2e-spec.ts (17 tests) RAN+PASSED, 0 skipped — cross-tenant isolation proof"
  - "SEC-4 recordkeeping.spec.ts (70 tests) PASSED — X-Export-Manifest truncated contract"
  - "no regression: api 1103/1103, web 900/900; regressed siblings recovered"
  - "merged state = main tip ff29cf4 (direct-push; PAT lacks PR:write)"
strategy: direct-push-to-main
workflow_change_vs_main: none            # verified empty .github/workflows diff — direct push safe
required_checks: [lint, typecheck, test, audit, build]
optional_checks: []
fix_up_cycles: 2                          # cap 5
routed_to: backend-developer (x2 — test-harness seed defect, not feature code; Iron Law honored)
green_run_id: 28899963332
final_commit_sha: ff29cf44bcf78557c8a86bbe291d778f3afb500d
merge_strategy: direct-push (squash N/A — PAT can't open PRs)
merge_commit_sha: ff29cf44bcf78557c8a86bbe291d778f3afb500d
rebase_cycles: 0
branch: wave-27-recordkeeping-export
local_main_synced: true
note: "Ghost-Green guard held on all 3 pushes; Actions dispatched every time (no withholding this wave). Two RED->route->fix cycles, both genuine test-harness defects caught by CI (seed PK collision, then WORM chain-break regression). No green fabricated."

head_signoff:
  verdict: APPROVED
  stage: C-1
  reviewers: {}
  failed_checks: []
  rationale: >
    Every C-1 stage-exit checkbox ticks from concrete artifacts. Ghost-Green guard: a check-suite
    fired on the EXACT pushed headSha ff29cf4 (total_count=1) before any conclusion was trusted; the
    tip is a real code-bearing commit, not [skip ci], not empty. Authoritative queryable conclusion
    (not the watch exit) is success across all 5 required jobs. The pnpm audit high-severity gate is
    green (exit 0). No workflow file changed vs main, so direct-push-to-main carries no untrusted-
    workflow risk. The load-bearing security proof is verified directly from the CI log, not inferred:
    the SEC-8 cross-tenant isolation e2e RAN and PASSED 17/17 (0 skipped), the SEC-4 X-Export-Manifest
    truncation contract passed (70/70), the web RBAC page passed, and the two RED runs were genuine
    test-harness defects routed to backend-developer under the Iron Law (never fixed directly) — the
    second of which I caught as a WORM hash-chain-break regression by baselining sibling suites that
    were green pre-fix. No stale cache, no fabricated green.
  next_action: PROCEED_TO_C-2
```

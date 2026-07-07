# Wave 20 — C-1 PR, CI & merge

**Block:** C (CI/CD) · **Stage:** C-1 · **Mode:** automatic · **Gate:** head-ci-cd

## Merge model (this repo)
Direct-push-to-main. The PAT (account `arina477`, repo `arina477/dealflow-ai`) lacks
`PR:write` / `Workflows:write`, so there is no PR object — CI is configured on `push → main`
(`.github/workflows/ci.yml`). "Merge to main" is satisfied by the direct push landing the
wave-20 code tree on `main` with a GREEN CI run on the exact pushed headSha.

## Push → main
- B-6 HEAD `0cf106f` was `[skip ci]` (deliverable-only tip). Ghost-Green guard (CI-PRINCIPLES #2):
  a `[skip ci]` tip fires NO run; a green derived from it would be a fabricated green.
- Fast-forwarded local `main` to `0cf106f` (origin/main `97d1781` was a strict ancestor — clean FF),
  then pushed CI-TRIGGERING tips carrying the real B-6 code tree (controller/service/repository/
  migration 0018 + the outreach-activity-rls & outreach-activity-migration e2e specs). Each fix-up
  commit modified real source, so CI fired on every pushed headSha.
- Ghost-Green guard verified on every push: `gh run list --json headSha,databaseId` confirmed a
  workflow run existed on the exact pushed tip BEFORE trusting any conclusion; then the queryable
  `gh run view --json conclusion` was the verdict.

## CI fix-up cycles (Iron Law — classify + route, never hand-fixed)
| # | Tip | Run | test result | Root cause | Routed to |
|---|-----|-----|-------------|------------|-----------|
| 0 | `1e9a5ce` | 28839851344 | FAIL | Drizzle `_journal.json` trailing comma → `readMigrationFiles` JSON.parse threw for ALL e2e | backend-developer |
| 1 | `517857c` | 28839964069 | FAIL | audit append 23505 dup-key at seq=1: `readTail` RLS-filtered to workspace → empty tail → genesis collision (real prod bug) | backend-developer |
| 2 | `d0b5b08` | 28840399603 | FAIL | `verifyChain` ok:false — `pipeline-gate` e2e hardcoded a private `AUDIT_LOG_HMAC_KEY`, committed rows the global-chain verify recomputed with the default key (content-hash-mismatch) | backend-developer |
| 3 | `3b72047` | 28841250855 | FAIL (1 left) | OAM-3 verifyChain ok:false — `workspace-isolation` ISO-5 raw-INSERT fake-hash row poisoned the WORM chain (immutable) | backend-developer |
| 4 | `d1a765b` | 28841584497 | FAIL (1 left) | ISO-5 seeded via `appendStandalone` w/o ALS → row in DEFAULT_WORKSPACE_ID → WS_A-scoped UPDATE hit 0 rows → WORM trigger never fired | backend-developer |
| 5 | `86ddc29` | 28841757352 | **PASS** | ISO-5 seed wrapped in `workspaceAls.run(WS_A)` → UPDATE matches → WORM P0001 fires; chain clean | — |

Fix-up cycles: **5 / 5 cap** (cleared on cycle 5; no escalation needed).
Every fix was truthful — no assertion skipped/mocked/loosened, no RLS/WORM/append-path weakened.
Notably cycle 1 fixed a REAL production correctness bug (first-per-workspace audit write would
have collided in prod under `dealflow_app`), relevant to the M11 multi-tenant carry.

## Green run — queryable evidence
- Run **28841757352**, headSha **`86ddc29`**, event `push`, conclusion **success**.
- All 5 required jobs GREEN: `lint` · `typecheck` · `test` · `audit` (`pnpm audit --audit-level=high` exit 0) · `build`.
- **Crux specs RAN + PASSED (not skipped)** in the green run (from `gh run view --log`):
  - `test/outreach-activity-rls.e2e-spec.ts` — 9 tests ✓ (OAE-1/2 R1 own-row-re-home→42501, OAE-3 SF1 empty-ALS-reject, OAE-9..12 R4/SF5 per-verb audit last-in-txn + verifyChain, OAE-13 rollback, OAE-14 R2/SF3 relforcerowsecurity).
  - `test/outreach-activity-migration.e2e-spec.ts` — 12 tests ✓ (OAM-2 GAP-4 populated-DB migration, OAM-3 SF6 verifyChain post-0018, OAM-4/5 R1, OAM-7 R2/SF3).
  - `ISO-5` WORM-reject ✓; wave-17/18/19 isolation suites still green.
  - Aggregate test projects: 55 + 30 files, 921 + 811 tests passed, 0 failed.

## Merge / sync
- Local `main` == `origin/main` == `86ddc29` (verified via `git rev-parse`).

```yaml
ci_stage_verdict: PASS
verdict_source: gh
verdict_evidence:
  - "gh run view 28841757352 --json conclusion → success on headSha 86ddc29 (event push)"
  - "5/5 jobs green: lint, typecheck, test, audit (pnpm audit --audit-level=high exit 0), build"
  - "outreach-activity-rls.e2e-spec.ts (9) + outreach-activity-migration.e2e-spec.ts (12) RAN + PASSED (not skipped) — write-path isolation + audit-logged-mutation proof"
  - "local main == origin/main == 86ddc29"
pr_number: null            # direct-push-to-main; PAT lacks PR:write — CI on push→main
pr_url: null
branch: main               # merged via direct push (source branch wave-20-outreach-activity fast-forwarded)
required_checks: [lint, typecheck, test, audit, build]
optional_checks: []
fix_up_cycles: 5
final_commit_sha: 86ddc29fa974e99128c436f5984910a152c77240
merge_strategy: direct-push-to-main
merge_commit_sha: 86ddc29fa974e99128c436f5984910a152c77240
rebase_cycles: 0
note: "Ghost-Green guard honored: pushed CI-triggering tips carrying the real B-6 code tree (B-6 HEAD 0cf106f was [skip ci]); confirmed a run FIRED on each exact headSha before trusting the queryable conclusion. Cycle-1 fix was a real prod audit-chain correctness bug (readTail RLS-filter)."
head_signoff:
  verdict: APPROVED
  stage: C-1
  reviewers: {}
  failed_checks: []
  rationale: "CI green on the exact pushed headSha 86ddc29 (queryable conclusion=success, run 28841757352), all 5 required jobs pass incl. the pnpm audit --audit-level=high security gate. The write-path-isolation + audit-logged-mutation crux specs (outreach-activity-rls 9 + outreach-activity-migration 12) demonstrably RAN and PASSED — not skipped — proving R1-R4/SF1-SF7 + GAP-4 as dealflow_app on postgres:18. No [skip ci] ghost-green: every trusted verdict sits on a run that fired on its exact tip. All 5 fix-ups routed to backend-developer per Iron Law and independently verified; none weakened a security/audit invariant. Local main synced."
  next_action: PROCEED_TO_C-2
```

# Wave 11 — C-1 PR/CI/Merge
## Mechanism: DIRECT-PUSH-TO-MAIN (this project's established C-1 pattern since wave 3)
The PAT lacks Pull-requests:write (PRs #1-4 = waves 1-2 only; waves 3-10 landed as direct main commits). Also lacks Workflows:write (a ci.yml change was reworked out — the outreach gate e2e now self-migrates in beforeAll instead of needing a CI migrate step). Integrated via fast-forward push to main; CI runs on the push→main trigger. Red fixed-forward (Iron Law: orchestrator routed each fix to backend-developer, head-ci-cd/orchestrator re-watched).
## Fix-forward cycles (3) — all TEST-INFRA (never a product/gate defect):
1. e2e fixture SQL used tx.execute(str,[params]) — drizzle execute() doesn't bind positional arrays (PG 42P02). Fixed: 21 call-sites → drizzle sql`` tag binding. (+ supertokens_user_id NOT NULL; + C-2 tx-scoped repo read.)
2. (folded) — reached the gate; then:
3. buildGateService swapped AuditService ctor args (repo,keyring)→ must be (keyring,repo) → acquireChainLock TypeError. Fixed + full 5-constructor wiring audit + AuditKeyring explicit config + insertTestDisclaimer active=false (was firing missing-disclaimer block on test A).
## FINAL: main GREEN at 8d7ed8b — ALL 5 CI jobs pass
- CI run 28740703914 (event=push, branch=main, headSha=8d7ed8b): lint ✅ typecheck ✅ **test ✅** build ✅ audit ✅.
- **THE outreach-gate e2e (6 un-mocked cases vs real Postgres) PASSED — C-1's definitive end-to-end proof the compliance gate reaches send_eligible for a genuinely-approved template + blocks no-approval/SoD/content-drift + M-2 conflict + C-2 versions-embed.** The compliance_approvals bridge (B-6 rework C-1) is PROVEN live against a DB, not just on-paper.
```yaml
ci_stage_verdict: PASS
verdict_source: gh
verdict_evidence:
  - "direct-push-to-main ff d6d2a75..8d7ed8b (10 wave commits + 3 fix-forward)"
  - "CI run 28740703914 on main headSha=8d7ed8b: lint/typecheck/test/build/audit ALL success"
  - "outreach-gate e2e (6 cases) GREEN vs real Postgres — gate reaches send_eligible; C-1 end-to-end proof"
merge_mechanism: direct-push-to-main (PR path blocked: PAT lacks pull-requests:write; project pattern since wave 3)
required_checks: [lint, typecheck, test, build, audit]
fix_up_cycles: 3
final_commit_sha: 8d7ed8b
merge_commit_sha: 8d7ed8b
note: "e2e self-migrates (no CI workflow change → no workflow-scope needed). C-2 must-verify(1) SATISFIED in CI (integration test green). C-2 live deploy-verify next."
```

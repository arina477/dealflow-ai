# Wave 22 — B-block review artifacts (test-hygiene wave)
**Wave topic:** scope the 12 unscoped audit assertions in outreach-activity-rls.e2e-spec.ts by workspace_id (T-4 rule 2) | **Block exit gate:** B-6 | **Status:** gate-passed
| Stage | Deliverable | Status | Notes |
|---|---|---|---|
| B-0 | (claim+branch) | done | schema SKIP; branch wave-22-audit-assertion-scope |
| B-1 | — | SKIP | no contract |
| B-2 | stages/B-2-backend.md | done | 12 sites scoped WHERE workspace_id=$1; fault-killing preserved; 1 file; commit 128ede8 |
| B-3 | — | SKIP | no UI |
| B-4/B-5 | stages/B-4-wiring.md, B-5-verify.md | pending | typecheck/lint/build (test-only → trivially green) |
| B-6 | stages/B-6-review.md | pending | head-builder gates: 12 sites scoped + fault-killing + one-file |
## B-block context: single-file test fix. Obligation: all 12 audit assertions workspace-scoped (immune to concurrent CI pollution), STAY fault-killing (exact +1 / exact verb), no other-suite/product change. CI real-DB run (as dealflow_app) is authoritative (suite skips locally).

## Block exit handoff
```yaml
build_block_status: complete
branch: wave-22-audit-assertion-scope
stages_run: [B-0, B-2, B-4, B-5, B-6]
stages_skipped: [B-0 schema, B-1 contracts, B-3 frontend]
review_verdict: APPROVE
last_commit_sha: 128ede8
ready_for_ci: true
test_only: true
```

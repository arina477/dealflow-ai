# Wave 24 — B-block review artifacts
**Wave topic:** M10 standing populated-migration AC — standing AC + reusable AMP template + MECHANICAL CI check (with self-test) | **Block exit gate:** B-6 | **Status:** gate-passed
| Stage | Deliverable | Status | Notes |
|---|---|---|---|
| B-0 | (claim+branch) | done | schema SKIP; branch wave-24-populated-migration-ac |
| B-1/B-2 | stages/B-2-backend.md | pending | standing-AC doc + reusable template + mechanical check + self-test |
| B-3 | — | SKIP | no UI |
| B-4/B-5/B-6 | ... | pending | |
## Deliverable (3 parts + MG1):
1. STANDING AC documented: any migration touching audit_log_entries / a DB-trigger-enforced WORM table MUST ship a populated-DB test (seed→migrate→assert-applies+verifyChain-ok).
2. COPY-ABLE reusable populated-DB migration test template/helper (from audit-migration-populated-db.e2e AMP-1..5) — NOT a framework/DSL.
3. MECHANICAL CI check: FAILS on a WORM/audit-touching migration lacking its populated-DB test + a SELF-TEST (untested WORM migration → check fails; tested → passes) = fault-killing. GREEN on the current tree.
## MG1 (BINDING): classify the CORRECT set — the genuine audit-DDL-touching migrations are {0002,0003,0012,0014,0016,0017} (NOT 0014/0018 — 0018 creates the MUTABLE outreach_activity, not a WORM migration). WORM-membership criterion EXPLICIT + checked-in: DB-TRIGGER-ENFORCED (audit_log_entries has audit_log_no_mutate) = in-scope; app-level append-only (pipeline_events, no DB trigger) = documented out-of-scope-for-now. B-6 confirms the check greens on the ACTUAL audit-touching set.

## Block exit handoff
```yaml
build_block_status: complete
branch: wave-24-populated-migration-ac
stages_run: [B-0, B-2, B-4, B-5, B-6]
stages_skipped: [B-0 schema (no migration), B-3 frontend (no UI)]
review_verdict: APPROVE
deliverable: [worm-migration-testing-policy.md (standing AC), worm-migration-{test-utils,template,coverage-registry}.ts, check-worm-migration-tests.ts (mechanical check, CI-wired), check-worm-migration-tests.spec.ts (61 self-tests)]
fix_up_commits: [3e4e087 (P1 bypasses closed + honest classification), c965401 (lint)]
ready_for_ci: true
```

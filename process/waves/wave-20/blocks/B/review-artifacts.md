# Wave 20 — B-block review artifacts
**Block:** B (Build) | **Wave topic:** M9 outreach-activity tracker (table+migration + service + contracts + API + /outreach panel) — FIRST mutable M9 write surface | **Block exit gate:** B-6 | **Status:** gate-passed
## Stage deliverables
| Stage | Deliverable | Status | Notes |
|---|---|---|---|
| B-0 | stages/B-0-branch-and-schema.md | pending | REAL migration (new table + 2 enums + FORCE RLS FOR-ALL policy) + migration test FIRST |
| B-1 | stages/B-1-contracts.md | pending | shared outreach-activity Zod + rbac |
| B-2 | stages/B-2-backend.md | pending | service (getDb CRUD + audit-logged) + API + write-path negative tests |
| B-3 | stages/B-3-frontend.md | pending | /outreach panel (form + list) |
| B-4 | stages/B-4-wiring.md | pending | |
| B-5 | stages/B-5-verify.md | pending | |
| B-6 | stages/B-6-review.md | pending | |
## Block-specific context
- Spec: seed d45c73b5 (DB, incl R1-R4 + SF1-SF7). Branch: wave-20-outreach-activity
- claimed_task_ids: [d45c73b5 (table+migration), 5c12ac3a (service), c3776cac (contracts), b2acf4ce (API+/outreach panel)]
- Schema: REAL additive migration (new outreach_activity table + 2 enums + FORCE RLS FOR-ALL USING-only policy + dealflow_app GRANT) — schema_skipped: FALSE
- **P-4 B-BLOCK OBLIGATIONS (BINDING — head-builder polices at B-6):**
  - R1 own-row-re-home UPDATE write-check (GUC=A, own row, SET workspace_id=B → reject 42501) + INSERT explicit-B → reject (as dealflow_app). The naive "UPDATE with B id" is vacuous.
  - R2/SF3 FORCE positive-control (assert relrowsecurity AND relforcerowsecurity as dealflow_app).
  - R3/SF4 ALL-4-FK tenancy (outreachId/matchCandidateId/pipelineId/mandateId resolve under getDb → firm-B target reject) + createdBy server-derived-only (never client).
  - R4/SF5 per-verb audit last-in-txn (create/update/status-transition/cancel each append + rollback-on-audit-fail test + verifyChain ok).
  - **SF1 [HIGH] NO DEFAULT_WORKSPACE_ID INSERT fallback — derive workspace_id from getWorkspaceId() + THROW-on-null (or column DEFAULT from GUC); test: empty-ALS create() → REJECTED, row NOT in default workspace.**
  - SF6 GAP-4 populated-migration test also asserts verifyChain ok post-migration.
  - SF7 credential-free: channel values are pure labels, no downstream dispatch/webhook/queue.
  - FOR-ALL USING-only policy matched to the 28 tenant tables (NO literal WITH CHECK, NO FOR SELECT). Distinct enum names.
## Gate verdict log
<appended by head-builder at B-6>

## Block exit handoff
```yaml
build_block_status: complete
branch: wave-20-outreach-activity
stages_run: [B-0, B-1, B-2, B-3, B-4, B-5, B-6]
stages_skipped: []
review_verdict: APPROVE
obligations_verified: [R1, R2, R3, R4, SF1, SF3, SF4, SF5, SF6, SF7, FOR-ALL-USING-only]
last_commit_sha: 1632da4
ready_for_ci: true
```

# Wave 23 — B-block review artifacts
**Block:** B (Build) | **Wave topic:** M9 seller-intent vertical (pure scorer + service + contracts + RBAC API + /insights UI) | **Block exit gate:** B-6 | **Status:** in-progress
| Stage | Deliverable | Status | Notes |
|---|---|---|---|
| B-0 | stages/B-0-branch-and-schema.md | done | schema SKIP (read-only aggregation); branch wave-23-seller-intent |
| B-1 | stages/B-1-contracts.md | done | shared-Zod + RBAC map; NO tieBreak (SI1); commit d7ae070 |
| B-2 | stages/B-2-backend.md | done | pure scorer + workspace-scoped service + RBAC API + 26 unit tests pass; commit 8c27c7c |
| B-3 | stages/B-3-frontend.md | pending | /insights seller-intent surface |
| B-4/B-5/B-6 | ... | pending | |
## claimed_task_ids: [9e54cc11 (scorer+service), 1188e7da (contracts), 12947422 (RBAC API), 6840c25d (/insights UI)]
## P-4 B-BLOCK OBLIGATIONS (BINDING — head-builder polices at B-6):
- SI1 author off the ACCEPTANCE-CRITERIA (not the stale prose that still lists tieBreak) → NO tieBreak in the score/breakdown/contract; a test ASSERTS tieBreak absent. Order-stabilize in query/service by (created_at,id) only.
- SI2 pin the trend WINDOW LENGTH + the flat-vs-heating/cooling EPSILON as fixed deterministic constants + unit-test (delta<epsilon → flat).
- SI3 confirm+document the referenceInstant derivation (workspace max-event-ts → dormant reads cooling); boundary-test (0/1 event → defined direction, no crash).
- SI4 log the wave-23 decomposer decision in product-decisions.md before N-3.
## LOAD-BEARING: workspace-scoped-getDb (cross-firm-negative-read T-8 REAL as dealflow_app via workspaceAls.run, NOT re-impl SQL) | pure-deterministic (NO LLM/SDK/network/credential/randomness; NO Date.now() INSIDE scorer — referenceInstant passed in) | computable-over-real-columns (outreach_activity planned/completed/cancelled, pipeline_events, match_candidates.disposition) | NO-tieBreak-surfaced (PRODUCT #1) | read-only (no audit rows) | empty-data-safe | RBAC advisor+admin.

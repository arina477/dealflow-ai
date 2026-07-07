# Wave 19 — B-block review artifacts
**Block:** B (Build) | **Wave topic:** M9 matching-feedback calibration (aggregation + contracts + API + /insights section) | **Block exit gate:** B-6 | **Status:** in-progress
## Stage deliverables
| Stage | Deliverable | Status | Notes |
|---|---|---|---|
| B-0 | stages/B-0-branch-and-schema.md | done | schema SKIPPED (read aggregation over shipped match_candidates) |
| B-1 | stages/B-1-contracts.md | done | shared match-feedback Zod (null-vs-zero G2) + rbac; commit 764c51c |
| B-2 | stages/B-2-backend.md | done | MatchFeedbackService (workspace-scoped getDb) + API + REAL-service cross-firm e2e (G1); commit ac303d6 |
| B-3 | stages/B-3-frontend.md | pending | /insights calibration section |
| B-4 | stages/B-4-wiring.md | pending | |
| B-5 | stages/B-5-verify.md | pending | |
| B-6 | stages/B-6-review.md | pending | |
## Block-specific context
- Spec: seed 5568ad44 (DB). Branch: wave-19-match-calibration
- claimed_task_ids: [5568ad44 (seed), 69387b56, e206a56a, 077974a2]
- Schema: NONE (read over match_candidates) — schema_skipped: true
- **P-4 B-BLOCK OBLIGATIONS (MUST honor):** [karen] score_breakdown schema-nullable → per-dimension-lift query applies the per-row exclusion (skip rows missing a dimension, no assume-non-null). [jenny G1] the cross-firm negative-read is a FIRST-CLASS test through the REAL MatchFeedbackService via workspaceAls.run as dealflow_app (2 workspaces, A excludes B) — NOT re-implemented SQL (the wave-18 B-6 hollow-test lesson). [jenny G2] pin null-vs-zero at B-1 contract (0 decided → null "n/a"; decided-but-0-accepted → 0 "0%"; honest, no misleading metric).
- **LOAD-BEARING:** workspace-scoped-getDb-calibration (no raw off-GUC — cross-firm leak undoes M8/wave-18), cross-firm-negative-read REAL (T-8, not hollow), computable-over-real-columns, read-only-no-scorer-retrain (NO LLM/ML), RBAC-scoped, no-gold-plating.
## Gate verdict log
<appended by head-builder at B-6>

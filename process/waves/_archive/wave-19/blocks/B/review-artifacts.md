# Wave 19 — B-block review artifacts
**Block:** B (Build) | **Wave topic:** M9 matching-feedback calibration (aggregation + contracts + API + /insights section) | **Block exit gate:** B-6 | **Status:** gate-passed
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
**B-6 (head-builder, Attempt 1): APPROVED** → PROCEED_TO_C-1. G1 cross-firm e2e REAL+fault-killing (unmocked MatchFeedbackService via workspaceAls.run as dealflow_app; MFC-4 kills getDb→raw regression); getDb on every query; karen per-row exclusion for null score_breakdown proven (MFC-5); G2 null-vs-zero pinned in shared Zod + honest UI (non-conflation asserted); read-only/no-LLM/no-audit-write; RBAC advisor+admin; no gold-plating. Typecheck 4/4; api 812 + web 767 unit green; commit-per-spec (764c51c/ac303d6/3e66359). Full verdict: blocks/B/gate-verdict.md. The wave-18 hollow-test lesson held. failed_checks: [].

## Block exit handoff
```yaml
build_block_status: complete
branch: wave-19-match-calibration
stages_run: [B-0, B-1, B-2, B-3, B-4, B-5, B-6]
stages_skipped: [B-0 schema (read aggregation, no migration)]
review_verdict: APPROVE
fix_up_commits: [6f95607 tieBreak-drop, 83dddda small-sample-caveat+UI, jsdoc-cleanup]
ready_for_ci: true
```

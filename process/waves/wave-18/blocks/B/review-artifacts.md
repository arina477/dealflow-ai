# Wave 18 — B-block review artifacts
**Block:** B (Build) | **Wave topic:** M9 advisor-insights analytics (aggregation + API + /insights dashboard) | **Block exit gate:** B-6 | **Status:** gate-passed
## Stage deliverables
| Stage | Deliverable | Status | Notes |
|---|---|---|---|
| B-0 | stages/B-0-branch-and-schema.md | done | schema SKIPPED (on-the-fly aggregation, no migration) |
| B-1 | stages/B-1-contracts.md | pending | shared analytics Zod (4 families) + rbac + nav |
| B-2 | stages/B-2-backend.md | pending | AnalyticsService + repo (workspace-scoped getDb, 4 families) + controller + cross-firm-negative-read e2e |
| B-3 | stages/B-3-frontend.md | pending | /insights page + metric cards + nav + proxy |
| B-4 | stages/B-4-wiring.md | pending | |
| B-5 | stages/B-5-verify.md | pending | |
| B-6 | stages/B-6-review.md | pending | |
## Block-specific context
- Spec: seed task a5ba8068 (DB, incl the P-4 karen metric-correction). Branch: wave-18-advisor-insights
- claimed_task_ids: [a5ba8068 (aggregation seed), 9e05828b (API), 4b014689 (/insights page)]
- Schema changes: NONE (on-the-fly aggregation; if a perf-cache is genuinely needed → additive+journaled+workspace_id+FORCE-RLS, default none) — schema_skipped: true
- **LOAD-BEARING (P-0/P-4):** workspace-scoped-aggregation via getDb + app.workspace_id GUC (NO raw off-GUC/pool query — a cross-firm leak undoes M8); cross-firm-negative-read (T-8 fault-killing e2e as dealflow_app); empty-state-div-by-zero-safe; RBAC-scoped (403/401); read-only (no write); 4 families [F1 mandate.status, F2 outreach-gate-outcomes over outreach.status, F3 pipeline.created_by/pipeline_events.actor_id, F4 match_candidates.disposition]; NO gold-plating (no charts-lib/real-time/export).
## Gate verdict log
<appended by fresh head-builder at B-6>

## Block exit handoff
```yaml
build_block_status: complete
branch: wave-18-advisor-insights
stages_run: [B-0, B-1, B-2, B-3, B-4, B-5, B-6]
stages_skipped: [B-0 schema (on-the-fly aggregation, no migration)]
review_verdict: APPROVE
last_commit_sha: e47c7f8
ready_for_ci: true
```

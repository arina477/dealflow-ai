# Wave 17 — B-block review artifacts
**Block:** B (Build) | **Wave topic:** M8 pilot-partner data-isolation (workspaces + workspace_id RLS + request-scoped connection propagation + cross-tenant negative-read proof) | **Block exit gate:** B-6 | **Status:** in-progress
## Stage deliverables
| Stage | Deliverable | Status | Notes |
|---|---|---|---|
| B-0 | stages/B-0-branch-and-schema.md | done | SCHEMA RUNS (RLS migration 0014 — the crux) |
| B-1 | stages/B-1-contracts.md | pending | shared workspace type + workspace_id in drizzle schemas |
| B-2 | stages/B-2-backend.md | pending | request-scoped dedicated-connection propagation + resolver + verifier-exempt + negative-read e2e |
| B-3 | stages/B-3-frontend.md | pending | SKIP (design_gap_flag false, no new UI) |
| B-4 | stages/B-4-wiring.md | pending | |
| B-5 | stages/B-5-verify.md | pending | |
| B-6 | stages/B-6-review.md | pending | |
## Block-specific context
- Spec: seed task 0db154ff (DB, w/ P-4 SECURITY REWORK addendum). Branch: wave-17-workspace-isolation
- claimed_task_ids: [0db154ff, e45ba68c, 96026365, df2f3b2f]
- Schema changes: migration 0014 (workspaces + workspace_id x~29 tables + backfill + RLS ENABLE/FORCE/deny-default + 2 SECURITY DEFINER fns) — journaled
- **P-4 B-2 CARRIES (advisory, from the security-auditor iteration-2):** [a] per-request handle-binding = AsyncLocalStorage or request-scoped chain (~41 repos inject the DB singleton — naive Scope.REQUEST won't re-bind); [b] server-derived st_user_id into resolve_user_workspace (never client-supplied); [c] prefer surgical RESET app.workspace_id over DISCARD ALL; [d] label global-verify vs scoped-projection in the export manifest
- SECURITY-SCOPE-TIGHTENED. LOAD-BEARING: FORCE-RLS+owner-connection-test, dedicated-connection+RESET-no-leak, resolver-RLS-exempt, integrity-global-vs-projection-scoped, WORM-blocks-reattribution-test, backfill-before-NOT-NULL, audit_log-hash-exclude, migration-0014-journaled
## Gate verdict log
- **B-6 Attempt 1 (head-builder, HEAD b58a630): REWORK → REWORK_B-2, route backend-developer.** CRITICAL D1: production GUC-set paths (workspace.interceptor.ts:101, auth.repository.ts:314) use `SET app.workspace_id = $1` (parameterized utility statement) → PostgreSQL 42P02 at runtime (confirmed postgres-pro). Interceptor swallows → GUC never set → all authenticated tenant reads = 0 rows; runInTransactionWithWorkspace throws → all invite signups fail. e2e helpers hide it via literal-interpolation reimplementation; INV-2 (bind form) will fail C-1. Fix: `SELECT set_config('app.workspace_id',$1,false)` + coverage of the shipped path. All other load-bearing checks PASS (FORCE-RLS x28, fail-closed policy, both SECURITY-DEFINER resolvers, integrity-vs-projection, WORM-reattribution ISO-5, backfill-before-NOT-NULL, 0014+0015 journaled). Verdict: process/waves/wave-17/blocks/B/gate-verdict.md

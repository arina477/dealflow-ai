# Wave 17 — B-6 Review
## Phase 1 head-builder: APPROVED (Attempt 2)
Attempt 1 REWORK: parameterized `SET app.workspace_id = $1` (SQLSTATE 42P02) in both prod GUC paths, hidden by a literal-interpolation test helper → interceptor swallowed it (empty app) + invite-signup threw. Attempt 2 APPROVED: set_config both paths + fail-closed re-throw + fault-killing GUC-1/2/3 (head-builder injected the regression to confirm they fail). Everything else PASS (FORCE RLS x28, both SECURITY DEFINER resolvers, integrity-vs-visibility, WORM-reattribution ISO-5, journaled 0014+0015).
## Phase 2 /review (adversarial): 3 fix-up cycles → CLEAN
- **Round 1 (4 findings, 2 P0):** #2 app/CI connect as postgres SUPERUSER → BYPASSRLS → all isolation UNENFORCED + every e2e assertion VACUOUS (the crux); #1 set_config(is_local=true) as a standalone query OUTSIDE the tx → GUC discarded before Drizzle's BEGIN → invite-signup bricks; #3 sourcing 4 tenant reads on singleton this.db (no GUC) → 0-row brick; #4 getWorkspaceId()??DEFAULT empty-string fallback. → rework2 (b247d24 migration 0016 dealflow_app NOSUPERUSER role + e2e SET ROLE dealflow_app non-vacuous + startup [RLS-GUARD] assertion; f7cdb70 GUC-inside-tx; 90c1b67 sourcing getDb + fail-closed).
- **Round 2 (1 new P0):** the mandatory non-superuser role EXPOSED that NestJS runs GUARDS BEFORE INTERCEPTORS → RolesGuard + resolveRole read users pre-GUC → RLS-gated → 403-everything under dealflow_app. → rework3 (b70215c: RolesGuard + resolveRole resolve role via RLS-exempt resolve_user_workspace; fault-killing CRITICAL-1b test; grep confirms no other pre-interceptor RLS-gated read).
- **Round 3: CLEAN** — round-2 P0 closed with regression-killing test; exhaustive sweep found no remaining pre-GUC/pre-auth/background RLS-gated tenant read; every pre-interceptor path routes through a SECURITY DEFINER RLS-exempt fn. Recommendation: SHIP.
## Commit-discipline (multi-spec): PASS — every claimed task_id has ≥1 commit; the rework fix-ups cite their tasks.
## C-2 HAND-OFF (non-deferrable): Railway prod DATABASE_URL must connect as dealflow_app (NOT postgres) — the startup [RLS-GUARD] assertion fails-closed at boot otherwise; migration 0016 creates the role. Without this, prod has NO isolation.
```yaml
phase1_head_builder_verdict: APPROVED   # attempt 2
phase2_review_invocations: 3
findings_critical: []   # all closed
findings_high: []       # all closed
fix_up_commits: [023ace7 (attempt-1 set_config), b247d24, f7cdb70, 90c1b67 (rework2), b70215c (rework3)]
final_verdict: APPROVE
c2_handoff: "Railway DATABASE_URL must be dealflow_app (non-superuser) — [RLS-GUARD] fails-closed otherwise; migration 0016 creates it"
```

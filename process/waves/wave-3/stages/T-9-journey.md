# Wave 3 — T-9 Journey (Test block-exit gate)
## Phase 1 — head-tester: APPROVED (fresh spawn a6453cf94033bd007). RBAC enforcement genuinely tested + LIVE-verified (unit DB-role matrix + C-2 live compliance→200/advisor→403/unauth→401); compliance-first invariants covered (403 no-leak, fail-closed empty-@Roles, DB-authoritative role, allowlist login-safe, nav⊆RBAC); real-browser 7/7 (role-aware nav differs per role, login lands in-app, unauth redirects); 2 low findings non-blocking. Verdict: process/waves/wave-3/blocks/T/gate-verdict.md.
## Phase 2 — journey (UI wave → regen)
Crawl via T-5 Playwright (7/7) against live. Journey map updated + committed:
- Row 4 `/` Dashboard = LIVE (AppShell §10 built once + role-aware dashboard shell; authed, unauth→/login).
- Per-route RBAC ENFORCED (roleRoutes single source → nav + @Roles; nav⊆RBAC); allowlist /auth/*+/health.
- Added enforced-RBAC exemplar `GET /compliance/summary` (compliance, admin).
- Live matrix noted (compliance 200/advisor 403/unauth 401). Rows 5-20 role→route pinned in roleRoutes (contract; pages M3+).
- Cross-wave regression: wave-1/2 auth routes unaffected (login still works — regression-tested).
```yaml
phase1_head_tester_verdict: APPROVED
test_pattern: active
journey_regen_skipped: false
crawl_routes_visited: 3   # / (dashboard), /login, /compliance (via E2E + C-2 matrix)
regen_diff: {routes_live: ["/ AppShell dashboard", "/compliance/summary RBAC exemplar"], rbac: enforced}
scenarios_run: 7   # T-5 all PASS
regressions_critical: 0
journey_map_commit: latest
findings: []
```

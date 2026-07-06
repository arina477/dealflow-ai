# Wave 17 — T-block review artifacts
**Wave topic:** M8 pilot-partner data-isolation (workspaces + FORCE RLS x27 + request-scoped GUC connection + cross-tenant negative-read proof)
**wave_type:** [backend, RLS/multi-tenancy, auth] — SECURITY-SCOPE-TIGHTENED
**Block exit gate:** T-9
| Stage | Layer | Pattern | Status | Notes |
|---|---|---|---|---|
| T-1 | static | A (CI) | done | CI 28824525244 lint+typecheck green @591b3f8 |
| T-2 | unit | A (CI) | done | api 829 + shared + web; GUC-1/2/3 (interceptor+tx-wrapper issue set_config not param-SET, fault-killing) |
| T-3 | contract | A (CI) | done | shared workspace types + resolver contract; audit hash-input excludes workspace_id |
| T-4 | integration | A (CI) | done | REAL vs CI Postgres AS non-superuser dealflow_app (FORCE RLS non-vacuous): ISO-1..5 (cross-tenant=0 + same-tenant>0 + WORM-reattribution + no-GUC-leak), INV-1..5 (invite-signup under RLS + GUC-in-tx + fault-killing), RBAC CRITICAL-1b (guard resolves role RLS-exempt, not 403-for-all), AMP-1..5 (populated-DB migration: 0014 applies against seeded audit rows w/ WORM trigger-wrap, per-row hash-exclusion, fault-killing) |
| T-5 | e2e | B (active) | done | C-2 live @591b3f8 as dealflow_app: reads return 50 rows (not 0-bricked), RBAC 200 (not 403-all), invite-signup bootstrap works |
| T-6 | layout | — | skipped | no UI (design_gap_flag false, backend/RLS/infra only) |
| T-7 | perf | — | skipped | not heavy |
| T-8 | security | B (active) | done | CI real-DB isolation as non-superuser (the crux — FORCE RLS enforced not bypassed) + C-2 live [RLS-GUARD] boot-assertion PASSED (runtime is non-superuser) + audit ok:true 328 rows + secret-grep clean (dealflow_app pw Railway-env-only) |
| T-9 | journey | B (active) | pending | journey (isolation is transparent — no new UI) + head-tester gate |

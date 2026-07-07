# Wave 18 — T-block review artifacts
**Wave topic:** M9 advisor-insights analytics (aggregation + API + /insights dashboard); read-only, workspace-scoped
**wave_type:** [backend, ui, analytics] — isolation-respect hard invariant (not auth/payment scope-tightened)
**Block exit gate:** T-9
| Stage | Layer | Pattern | Status | Notes |
|---|---|---|---|---|
| T-1 | static | A (CI) | done | CI 28832010151 lint+typecheck @5c86cf5 |
| T-2 | unit | A (CI) | done | api 852 + web 737 + shared; analytics.spec 15/15 (F2 gate-math, empty-state, RBAC) |
| T-3 | contract | A (CI) | done | shared analytics.ts 4-family (F2=gatePassRate/blockedRate, null-when-0, NO responseRate) + rbac |
| T-4 | integration | A (CI) | done | analytics-isolation.e2e 7/7 REAL vs CI Postgres AS dealflow_app: AMP-1..4 invoke the REAL AnalyticsService via workspaceAls.run — WS_A analytics EXCLUDE WS_B; AMP-4 FAULT-KILLING (getDb→raw collapses totals → fails); WORM-safe teardown; T-4 rule-2 scoped |
| T-5 | e2e | B (active) | done | C-2 live @5c86cf5: /analytics anon 401 (mounted, fail-closed), /insights 307, regression smoke (no 404/500). LIVE AUTHED 4-family check deferred (no prod advisor fixtures) — authoritative proof is the T-4 CI e2e 7/7 as dealflow_app + analytics.spec 15/15 |
| T-6 | layout | B (active) | done | web insights page.test 23 (F2 labels honest gate-pass/blocked, null→n-a, empty/error states, RBAC-gate, F3 table); design-system reuse (no new mockup) |
| T-7 | perf | — | skipped | 6 fixed grouped queries, no N+1 |
| T-8 | security | B (active) | done | cross-firm-negative-read (T-4 fault-killing as dealflow_app — analytics of A never include B, the post-M8 invariant) + RBAC fail-closed (403/401) + read-only (no write) + C-2 audit ok:true + secret-grep clean |
| T-9 | journey | B (active) | pending | journey (+/insights + /analytics) + head-tester gate |

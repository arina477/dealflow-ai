# Wave 23 — T-block review artifacts
**Wave topic:** M9 seller-intent vertical (pure deterministic scorer + workspace-scoped service + RBAC API + /insights UI) — LIVE @6c22919
**wave_type:** [backend, ui, analytics] — pure-determinism + workspace-isolation hard invariants
**Block exit gate:** T-9
| Stage | Layer | Pattern | Status | Notes |
|---|---|---|---|---|
| T-1 | static | A (CI) | done | CI 28858565829 lint+typecheck @6c22919 GREEN |
| T-2 | unit | A (CI) | done | scorer.spec 26/26 (determinism/epsilon/empty-data/no-tieBreak[SI1]/no-Date.now); api 950 pass |
| T-3 | contract | A (CI) | done | shared seller-intent.ts (score+breakdown[3 signals+total+notApplied]+direction; NO tieBreak — SI1) + rbac |
| T-4 | integration | A (CI) | done | seller-intent-isolation.e2e 3/3 REAL SellerIntentService via ALS as dealflow_app: SIT-1 WS_A appears/WS_B absent (cross-firm scoping), SIT-3 fail-closed throw (fault-killing); NOT re-impl SQL |
| T-5 | e2e | B (active) | done | C-2 live @6c22919: /seller-intent anon 401 (mounted, fail-closed), /insights 307, audit-verify 401. Authed per-mandate score deferred (no prod fixtures) — CI e2e + scorer.spec authoritative |
| T-6 | layout | B (active) | done | web /insights seller-intent section tests (score+direction heating/cooling/flat+3-signal breakdown, sorted desc; NO tieBreak rendered [SI1]; notApplied→'—'; empty/error; RBAC); design-system reuse |
| T-7 | perf | — | skipped | batch fetch (Q1→ids→IN), no N+1; O(n2) sort accepted-debt firm-scale |
| T-8 | security | B (active) | done | cross-firm-negative-read (T-4 SIT-1/SIT-3 as dealflow_app) + PURE-deterministic-NO-LLM (no Date.now-inside, no Anthropic/OpenAI/SDK — scorer.spec asserts) + read-only (no writes/audit — verify 401) + RBAC fail-closed (403/401) + NO-tieBreak-surfaced (SI1) + secret-grep clean |
| T-9 | journey | B (active) | pending | journey (+/insights seller-intent + /seller-intent) + head-tester gate |

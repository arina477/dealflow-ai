# Wave 19 — T-block review artifacts
**Wave topic:** M9 matching-feedback calibration (read-only, workspace-scoped) — LIVE @3cc58de
**wave_type:** [backend, ui, analytics] — isolation-respect hard invariant (inherited from tested M8/wave-18)
**Block exit gate:** T-9
| Stage | Layer | Pattern | Status | Notes |
|---|---|---|---|---|
| T-1 | static | A (CI) | done | CI 28836091590 lint+typecheck @3cc58de |
| T-2 | unit | A (CI) | done | api 881 (match-feedback.spec 22: F2-band-math, empty-state null path, per-row-exclusion, RBAC) + web 773 (calibration section 24: small-sample caveat, tieBreak-absent, n/a-vs-0%) |
| T-3 | contract | A (CI) | done | shared match-feedback.ts (2-dimension lift [tieBreak-noise dropped], G2 acceptRate number|null) + rbac |
| T-4 | integration | A (CI) | done | match-feedback-isolation.e2e 7/7 REAL MatchFeedbackService via ALS as dealflow_app: MFC-1..4 WS_A calibration EXCLUDES WS_B; MFC-4 FAULT-KILLING (getDb→raw collapses → fails); WORM-safe teardown; T-4 rule-2 scoped |
| T-5 | e2e | B (active) | done | C-2 live @3cc58de: /match-feedback anon 401 (mounted, fail-closed), /insights 307, audit-verify 401 (chain intact). LIVE AUTHED calibration deferred (no prod advisor fixtures) — authoritative proof is the T-4 CI e2e 7/7 as dealflow_app + match-feedback.spec 22 |
| T-6 | layout | B (active) | done | web calibration section 24 tests (small-sample n=X caveat, null→n/a-not-0%, tieBreak-row-gone, empty/error states, RBAC-gate); design-system reuse (no new mockup) |
| T-7 | perf | — | skipped | 2 fixed grouped queries, JS aggregation, no N+1 |
| T-8 | security | B (active) | done | cross-firm-calibration-negative-read (T-4 fault-killing as dealflow_app — A's calibration never includes B, post-M8 invariant) + RBAC fail-closed (403/401) + read-only (no write, audit intact) + metric-honesty (tieBreak-noise-dropped, small-sample-caveat — CODE-OF-CONDUCT) + secret-grep clean |
| T-9 | journey | B (active) | pending | journey (+/insights calibration section, +/match-feedback) + head-tester gate |

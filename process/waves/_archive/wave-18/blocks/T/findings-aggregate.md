# Wave 18 — T-block findings aggregate (V-2 input)
| # | Severity | Stage | Description |
|---|---|---|---|
| 1 | P2/INFO | B-6/review | F2 rate-math validated by the e2e AMP-3 (runs in CI w/ TEST_DATABASE_URL), not a repo-unmocked unit — coverage nuance, CI-covered |
| 2 | INFO | C-2 | live AUTHED 4-family check deferred (no prod advisor fixtures) — CI e2e 7/7 + analytics.spec 15/15 is the authoritative proof; a T-5/founder-onboarding live-authed pass could confirm in-app later |
## Security substance — PROVEN:
- Cross-firm analytics isolation (the post-M8 load-bearing invariant): analytics-isolation.e2e 7/7 REAL AnalyticsService via ALS as dealflow_app — WS_A excludes WS_B; AMP-4 fault-killing (getDb→raw caught).
- Every aggregation query via getDb (no raw off-GUC) — /review-confirmed on all 6 queries.
- F2 honest (gate-outcomes not vanity response-rate — karen caught pre-build); div-by-zero guarded.
- RBAC fail-closed (advisor+admin 200, analyst/compliance 403, anon 401) DB-authoritative.
- Read-only (no write/no audit row on a read) — C-2 audit ok:true.
findings_total: 2 (0 crit/high/med, 0 low, 2 info/P2-accepted)

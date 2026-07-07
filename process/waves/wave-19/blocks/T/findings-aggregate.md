# Wave 19 — T-block findings aggregate (V-2 input)
| # | Severity | Stage | Description |
|---|---|---|---|
| 1 | INFO | C-2 | live AUTHED calibration check deferred (no prod advisor fixtures) — CI match-feedback-isolation e2e 7/7 + match-feedback.spec 22 authoritative; same as wave-18 (tracked by process task 1d95cac0) |
## Security substance — PROVEN:
- Cross-firm calibration isolation (post-M8): match-feedback-isolation.e2e 7/7 REAL MatchFeedbackService via ALS as dealflow_app — WS_A calibration excludes WS_B; MFC-4 fault-killing (getDb→raw caught).
- Every calibration query via getDb (no raw off-GUC) — /review-confirmed.
- Metric HONESTY (CODE-OF-CONDUCT): tieBreak (structural noise, hash-of-id) dropped from the lift; small-sample caveat (decidedCount<5 → n-shown/muted, not confident 100% on n=1); G2 null→n/a (not 0%).
- RBAC fail-closed (advisor+admin 200, analyst/compliance 403, anon 401); read-only (no write, audit chain intact); per-row-exclusion for nullable score_breakdown.
findings_total: 1 (0 crit/high/med/low, 1 info)

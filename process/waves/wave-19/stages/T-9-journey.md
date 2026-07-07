# Wave 19 — T-9 Journey (gate + journey)
**Gate:** APPROVED (head-tester). verdict → blocks/T/gate-verdict.md. next_action: PROCEED_TO_V.
## Journey delta (M9 calibration, LIVE @3cc58de) — canonical user-journey-map.md UPDATED (wave-18 GAP-A lesson applied)
- **/insights calibration section** (NEW) — read-only match-score calibration (accept-rate by fit_score band + per-dimension lift sectorMatch/contactCompleteness), workspace-scoped, RBAC advisor+admin, honest metrics.
- **GET /match-feedback** (NEW) — shared-Zod calibration API, RBAC-scoped, workspace-scoped via getDb + FORCE RLS. Read-only.
## Security-invariant coverage (PROVEN — CI real-DB as dealflow_app + C-2 live)
cross-firm-calibration-isolation (match-feedback-isolation.e2e 7/7 REAL MatchFeedbackService via ALS, MFC-4 fault-killing, non-skipped) | every-query-via-getDb | metric-honesty (tieBreak-noise-dropped + small-sample-caveat + null→n/a — CODE-OF-CONDUCT) | RBAC-fail-closed (200/403/401) | read-only (audit intact) | per-row-exclusion-nullable-score_breakdown.

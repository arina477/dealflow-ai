# Wave 29 — T-block findings aggregate (V-2 input)
| # | Severity | Stage | Description |
|---|---|---|---|
| 1 | INFO | C | 1 honest RED→fix cycle (test asserted 403-by-message-string vs the service's genuine ForbiddenException; fixed to assert-by-type) — gate discipline worked |
| 2 | INFO→N | M10 | LAST M10 light vertical shipped → M10's 3 light verticals all done → M10 CLOSES at the next N-block (M10→M11 transition) |
| 3 | INFO | /review | 2 non-blocking: CI-provisions-DB-for-DA-ISO (confirmed RAN); optional service-boundary .strict re-parse |
## Substance: records-VIEW deal-activity browse LIVE @8526999. RLS-browse-isolation (firm A=0 firm B as dealflow_app) + READ-ONLY (no audit-row) + advisor-RBAC (API boot-fail-closed real gate) PROVEN (DA-ISO/RBAC/RO 14 tests in CI). Reuse-not-rebuild (findDealRowsPaginated reuses RLS join; DealActivityTable mirrors AuditLogTable).
findings_total: 3 (0 crit/high, 3 info)

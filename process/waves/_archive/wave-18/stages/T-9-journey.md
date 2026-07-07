# Wave 18 — T-9 Journey (gate + journey)
**Gate:** APPROVED (head-tester). verdict → blocks/T/gate-verdict.md. next_action: PROCEED_TO_V.
## Journey delta (M9 analytics, LIVE @5c86cf5)
- **/insights** (NEW) — read-only advisor analytics dashboard (metric cards: mandate throughput, outreach compliance-gate outcomes, advisor productivity, match disposition), workspace-scoped (own-firm only), RBAC-gated (advisor+admin), design-system cards (no charts-lib/real-time/export).
- **GET /analytics** (NEW) — shared-Zod 4-family analytics API, RBAC-scoped (advisor+admin 200 / analyst+compliance 403 / anon 401), workspace-scoped via getDb + FORCE RLS. Read-only.
- Admin nav: /insights entry (bar-chart-2, server-role-gated).
## Security-invariant coverage (PROVEN — CI real-DB as dealflow_app + C-2 live)
cross-firm-analytics-isolation (analytics-isolation.e2e 7/7 REAL AnalyticsService via ALS, AMP-4 fault-killing getDb→raw) | every-query-via-getDb (no raw off-GUC) | F2-honest-gate-outcomes (not vanity response-rate) | RBAC-fail-closed (200/403/401) | read-only (no write, audit ok:true) | empty-state-div-by-zero-safe.

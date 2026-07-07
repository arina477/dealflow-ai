# Wave 27 — T-block findings aggregate (V-2 input)
| # | Severity | Stage | Description |
|---|---|---|---|
| 1 | INFO | C | 2 honest RED→route→fix cycles (SEC-8 global-seq PK collision; first-fix WORM-chain corruption caught by baselining → re-routed to appendStandalone) — gate discipline worked |
| 2 | INFO->N | M10 | NEXT M10 vertical = RETENTION policy (then records-view) — the exports vertical shipped; M10 metric partially met (on-demand-export half) |
| 3 | INFO | prod-smoke | no prod-fixture creds → CI-e2e-authoritative for the export isolation (SEC-8 17/17 on the deployed hash); perimeter verified (unauthed→401) |
## Substance: the recordkeeping EXPORT (CSV+deal/pipeline+cap/truncation+firm-local-ordinal, RLS-scoped) is LIVE @ff29cf4. P-4 tightened gate caught the inverted-RLS-premise + duplicate-surface + side-channel (→SEC-1..10); B-6 caught the SEC-4 silent-truncation P1 (→fixed); cross-tenant isolation SOLID (SEC-8 17/17 as dealflow_app).
findings_total: 3 (0 crit/high, 3 info)

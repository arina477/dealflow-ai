# Wave 28 — T-block findings aggregate (V-2 input)
| # | Severity | Stage | Description |
|---|---|---|---|
| 1 | INFO | B-6 | _journal.json `when` timestamps non-monotonic at tail (pre-existing; Drizzle orders by idx → no impact) |
| 2 | INFO->N | M10 | NEXT M10 vertical = records-VIEW (vertical 3, last) — exports+retention shipped |
| 3 | INFO | C | ~6th Actions dispatch-withhold this session (cleared) → STRONG permanent-limit-raise recommendation |
## Substance: RETENTION policy LIVE @775cd67 (migration 0020 applied to prod, RLS enforcing). P-4 tightened caught RLS-on-new-table + WORM-preservation → SEC-A/B/C; B-6 + /review confirmed solid (explicit RLS+FORCE, isolation as dealflow_app, foreign-write-rejected, no-purge-control, verifyChain-ok-after-change). CROSS-TENANT config isolation + WORM-preservation PROVEN (RET-ISO/RET-WORM 20 tests in CI).
findings_total: 3 (0 crit/high, 3 info)

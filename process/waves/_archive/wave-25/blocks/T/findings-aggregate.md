# Wave 25 — T-block findings aggregate (V-2 input)
| # | Severity | Stage | Description |
|---|---|---|---|
| 1 | INFO | B-6 | idx-19 migration `when` timestamp numerically out-of-order (Drizzle migrates by array index, not timestamp -> ordering correct; cosmetic) |
| 2 | INFO->N | ceo/head-learn | M10 recordkeeping-decomposition DUE (wave-26 TRIPWIRE: 1 buildable M10 candidate left [1a1c5855]; if wave-26 only debt/hardening + recordkeeping still unfired -> BOARD-escalate + refuse 3rd hardening seed) + M9+M10 _TBD metric polls |
| 3 | INFO | C | 3rd Actions-billing exhaustion this session (founder-cleared each time) -> recommend a permanent spending-limit raise (founder-decision doc) |
## Substance: SEC-1..11 all honored + HARDENED (B-6 caught 3 prod defects [unjournaled migration, unverified atomicity, email-keying-to-IP] + 4 P2s [body-cap, sweeper, fail-open-narrow]; all fixed). LIVE @987ebb4; rate-limit 429 VERIFIED IN PROD (req 6 -> 429+Retry-After). DB-gated SEC-1-DB/SEC-4-DB ran+passed in CI.
findings_total: 3 (0 crit/high, 3 info)

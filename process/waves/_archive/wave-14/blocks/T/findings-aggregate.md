# Wave 14 — T-block findings aggregate (V-2 input)
| # | Severity | Stage | Description |
|---|---|---|---|
| 1 | LOW | T-8/L1 | mandate_id tamper is silent to verifyChain BY DESIGN (metadata column, not tamper-evident) — documented in command-center/dev/architecture/audit-mandate-attribution.md (auditor note: separate control if mandate-attribution integrity is required). |
| 2 | LOW | T-9 | journey-map hygiene: remap row-15/F10 to the shipped /compliance-queue + add a /compliance/oversight row (jenny P-4 note). |
| 3 | INFO | T-5 | full live compose→gate→mandate-attributed-write smoke not assembled (needs whole owned mandate chain); proven at C-1 real-DB e2e (9 tests, mandate_id isolation). |
## Compliance substance — PROVEN:
- Hash-chain-safety (additive mandate_id column, verifyChain intact): C-2 LIVE {ok:true,310} after 0012 + unit HMAC-recompute proof + e2e.
- Mandate_id-column isolation (incl shared-template-version): CI recordkeeping-gate e2e 9/9 REAL → DEV-2 LIFTED.
- Gate no-regression (allow/block unchanged): C-2 live + compliance-gate.spec + outreach-gate.e2e green.
- Oversight read-only + distinct + advisor-blocked: C-2 deployed HTML grep.
findings_total: 3 (0 critical, 0 high, 0 medium, 2 low, 1 info)

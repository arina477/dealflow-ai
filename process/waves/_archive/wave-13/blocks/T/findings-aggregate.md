# Wave 13 — T-block findings aggregate (V-2 input)
| # | Severity | Stage | Description |
|---|---|---|---|
| 1 | MEDIUM | T-4 | DEV-2 (head-builder + /review): the mandate-scope DERIVATION SQL (the load-bearing compliance-correctness piece — 8 per-resource_type branches) is only UNIT-tested (mocked repo); a real-SQL multi-producer capture bug wouldn't be caught. /review verified it structurally (correct joins/casts/no-double-count/injection-safe); C-2 verified read/verify/export LIVE (309→310 export delta). Residual: no real-DB test asserting a mandate export captures ALL mandate-derivable producers (outreach+pipeline+mandate events) + correctly EXCLUDES gate-evaluate (per the documented H1 limitation). Recommend a recordkeeping mandate-derivation e2e (reuse the wave-12 race-safe shared migrate helper). |
| 2 | LOW | cross-wave | Deployed test-cred registry (invite→signup workaround) — carry-forward (waves 11/12). |
| 3 | INFO | followon | Producer-side gate mandate-attribution (H1 root cause) — non-blocking follow-on (process/session/updates/followon-gate-mandate-attribution.md). |
## Compliance substance — PROVEN:
- Export appends exactly one export_generated last-in-txn: C-2 LIVE (verify 309→310 delta) + unit.
- Hash-chain integrity verify (real AuditVerifier over live 309-entry chain): C-2 LIVE {ok:true,entriesChecked:309}.
- Read-only-zero-audit + advisor-no-export (403 server) + M2-validation (400): C-2 LIVE + unit.
- Mandate-derivation SQL: /review structural-verified + unit; real-DB multi-producer capture = DEV-2 finding.
findings_total: 3 (0 critical, 0 high, 1 medium, 1 low, 1 info)

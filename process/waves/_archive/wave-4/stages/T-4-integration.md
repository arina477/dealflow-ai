# Wave 4 — T-4 Integration (Pattern A, CI-verified + LIVE C-2)
Integration surface: append service→DB (tx-composable, advisory-lock, IDENTITY seq) + verifier→DB (chain walk) + migration 0002 (table+grant+trigger). Coverage: audit.service/verifier specs (append chains, verifier detection incl. pg-format-roundtrip); **LIVE at C-2** — 3 real entries appended via AuditService HMAC path → verify ok:true entriesChecked:3 (real timestamptz round-trip); immutability UPDATE/DELETE/TRUNCATE rejected live; migration 0002 applied to app postgres (audit_log_entries + grants + triggers confirmed). health e2e (real PG in CI) green.
```yaml
test_pattern: ci-verified
skipped: false
boundaries_audited: [append->DB, verifier->DB, migration 0002 apply, immutability triggers]
live_c2_evidence: ["appended-chain verify ok:true entriesChecked:3", "UPDATE/DELETE/TRUNCATE rejected", "migration applied"]
findings: []

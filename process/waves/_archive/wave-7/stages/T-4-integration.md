# Wave 7 — T-4 Integration (Pattern A, CI-verified + LIVE C-2)
Integration surface: connection create/list→DB (audited); reuse wave-6 GET /sourcing/companies (canonical search + connectionIds) + POST /sync; migration 0005 (UNIQUE display_name). Coverage: sourcing specs; **LIVE at C-2** — connection-create 201 + dup-409 (UNIQUE + DrizzleQueryError.cause.code) + unknown-providerKey-400 + audited (entriesChecked 38→40); ≥2-source real badges (connectionIds populated, not '—'); search; migration 0005 applied (6 rows + constraint — after the journal-timestamp fix). health e2e green.
```yaml
test_pattern: ci-verified
skipped: false
boundaries_audited: [connection create/list->DB+audit, reuse ETL/sync/companies, migration 0005]
live_c2_evidence: ["create 201/dup 409/bad-key 400/audited", "≥2-source real badges connectionIds", "0005 applied 6 rows+UNIQUE"]
findings: []

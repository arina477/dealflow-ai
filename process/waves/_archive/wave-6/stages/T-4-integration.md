# Wave 6 — T-4 Integration (Pattern A, CI-verified + LIVE C-2)
Integration surface: adapter→ETL(staging upsert)→dedupe engine(raw→canonical)→provenance; migration 0004 (7 tables + partial-uniques); dedupe-resolve→audit. Coverage: dedupe/ETL/repository specs; **LIVE at C-2** — sync 201 (ingested 5); cross-source acme.com→1 canonical + 2 company_provenance + contact_provenance; NO false-positive (4 domains=4 companies); idempotent re-sync (0 ingested/5 updated, no pile-up); RBAC live; migration 0004 applied to app postgres (7 tables + indexes). health e2e green.
```yaml
test_pattern: ci-verified
skipped: false
boundaries_audited: [adapter->ETL->dedupe->canonical, migration 0004, dedupe-resolve->audit]
live_c2_evidence: ["sync 201 ingested 5", "cross-source 1 canonical + 2 provenance + contact_provenance", "NO false-positive merge", "idempotent re-sync no pile-up"]
findings: []

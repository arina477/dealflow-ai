# Wave 15 — T-4-integration
Pattern A/active. admin-concurrency.e2e 8/8 REAL vs CI Postgres — CONC-1 write-skew guard (advisory-lock, 2 concurrent last-admin → exactly one succeeds, ≥1 remains; fault-killing vs count-FOR-UPDATE) + SEC-1/2/3/4 credential-never-leaks (audit/hash/error/read) + AES-GCM round-trip; migration 0013 applied.

```yaml
test_pattern: ci-verified-and-active
findings: []
```

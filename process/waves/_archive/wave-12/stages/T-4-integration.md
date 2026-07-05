# Wave 12 — T-4-integration
Pattern A (CI-verified). CI run 28749460752 test job green — the pipeline-gate.e2e-spec (4 un-mocked real-Postgres tests) PASSED:
- enroll audit-throw → real db.transaction() ROLLBACK → zero orphan pipeline/pipeline_events rows
- addNote audit-throw → zero orphan note events (exactly-one-or-none)
- happy-path: enroll+transition+note → exactly 1 event each + audit_log_entries increments by exactly 1 per action (audit-last-in-txn)
- idempotent 2nd enroll → 409 (real partial-unique)
Definitive proof the audit-last-in-txn compliance invariant holds against a REAL DB. Co-exists with wave-11 outreach-gate e2e (race-safe shared migrate + disjoint namespaces).

```yaml
test_pattern: ci-verified
evidence: ["CI 28749460752: pipeline-gate.e2e 4/4 green vs real Postgres (audit-rollback proven)"]
findings: []
```

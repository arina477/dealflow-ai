# Wave 4 — T-2 Unit (Pattern A, CI-verified)
CI `test` green. 349 tests: shared 164 (audit.ts AuditVerifyResponse/entry shapes; rbac audit-log route+nav, nav⊆RBAC all roles), api 90(+1 skip) (audit.hash golden-vector [serialization-order stability], keyring boot-fail-fast+no-leak, verifier detection matrix [content-tamper/prev-link-break/sequence-gap at firstBreakAt+reason; empty vacuous ok; **pg-format-roundtrip regression** proving created_at fix], append chains genesis+N, endpoint per-role RBAC compliance/admin 200 advisor/analyst 403 anon 401 stale-claim 403), web 95 (integrity view 3-states, persistent-non-dismissible broken, verify-now transitions, per-role redirect). Real behavioral assertions, not hollow.
```yaml
test_pattern: ci-verified
skipped: false
evidence: ["CI test green; 349 tests; pg-roundtrip regression encodes the /review CRITICAL fix"]
findings: []
```

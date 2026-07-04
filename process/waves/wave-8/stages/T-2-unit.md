# Wave 8 — T-2 Unit (Pattern A, CI-verified)
CI test green. ~1115 tests: shared 440 (mandate Zod: create derives-not-inputs disclaimer, requires 3 acks, read-schema passthrough + input strict; rbac /mandates + jurisdictions; audit actions), api 361(+1 skip) (mandate.spec 62 + di-boot 5: one-txn 3-table + rollback; audit-last-in-txn; actor=app users.id via getUserWithRole; derive-disclaimer [valid→FK, no-match→400, ambiguous→409]; 3-acks-required→400; active-lock 409; GET /mandates/jurisdictions RBAC + route-order; DrizzleError-unwrap), web 307 (list+filter+empty; create 3-sections+3-acks+jurisdiction-from-prop+flat-response-redirect+/mandates-data path; detail SSR-hydrate+deferred-placeholders+analyst-read-only). Real assertions.
```yaml
test_pattern: ci-verified
skipped: false
findings: []
```

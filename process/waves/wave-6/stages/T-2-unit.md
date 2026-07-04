# Wave 6 — T-2 Unit (Pattern A, CI-verified)
CI `test` green. 829 tests: shared 390 (sourcing DataSourceAdapter/entity Zod, roleRoutes /sourcing, nav⊆RBAC), api 260(+1 skip) (**dedupe engine: cross-source 1-canonical+2-provenance, idempotent, no-false-positive [Acme Co≠Acme Inc], ambiguous→candidate, contact_provenance, candidate-path-idempotent [test g], name+domain-conflict→review**; ETL idempotent upsert; fixture cross-source dups; endpoint RBAC analyst/admin 200/201 advisor/compliance 403 anon 401; dedupe-resolve audited + actor-id-translated + atomic single-winner; **SourcingModule di-boot** [the import-type regression]), web 179 (companies list/filter/dedupe-review). Real assertions.
```yaml
test_pattern: ci-verified
skipped: false
evidence: ["CI test green; 829 tests; dedupe correctness (cross-source/no-false-positive/contact-provenance) + di-boot regression"]
findings: []
```

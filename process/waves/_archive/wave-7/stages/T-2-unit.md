# Wave 7 — T-2 Unit (Pattern A, CI-verified)
CI `test` green. ~928 tests: shared 415 (connectionCreateSchema, roleRoutes /sourcing/connections, nav⊆RBAC), api 302(+1 skip) (connection-create RBAC analyst/admin 201 advisor/compliance 403 anon 401; **actor-id-translated** [app users.id via getUserWithRole]; **audited in-tx**; **providerKey validated→400** [unknown]; **dup display_name→409** [DrizzleQueryError.cause.code-shape mock — the real-boundary regression]; listCompanies returns **connectionIds** [badges]), web 214 (workspace render, search, ≥2-source facet [mock ≥2 conns→2 sources], sync-trigger, connection-create, Review-Import→companies). Real assertions.
```yaml
test_pattern: ci-verified
skipped: false
evidence: ["CI test green; ~928 tests; connection-create audit/actor-id + providerKey-400 + dup-409(DrizzleQueryError shape) + connectionIds-badges + di-boot"]
findings: []
```

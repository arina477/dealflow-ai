# Wave 6 — T-3 Contract (Pattern A, CI-verified)
Contract surface: sourcing.ts (DataSourceAdapter interface, NormalizedSourceRecord, Company/Contact/DedupeCandidate/CompanyProvenance/ContactProvenance, SyncSummary, DedupeResolveInput) + roleRoutes (/sourcing/* analyst/admin; NAV_SOURCING) + auditActionEnum (sourcing-dedupe-resolve). Project-internal → Pattern A. Coverage: sourcing.test 74 + rbac (sourcing routes, repoint /companies→/sourcing/companies, nav⊆RBAC) + audit (additive). API↔web share the entity types. No drift.
```yaml
test_pattern: ci-verified
skipped: false
contracts_audited: [DataSourceAdapter, entity Zod, roleRoutes /sourcing, auditActionEnum]
findings: []
```

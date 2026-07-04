# Wave 6 — B-1 Contracts
typescript-pro. Commit `e44a5fd`. Branch wave-6-deal-sourcing.
- **sourcing.ts:** NormalizedSourceRecord (+NormalizedContact), DataSourceAdapter interface (providerKey + fetchCompanies→NormalizedSourceRecord[]), entity types (Company, Contact, DataSourceConnection, CompanyProvenance, **ContactProvenance**, DedupeCandidate[status], SyncSummary, DedupeResolveInput, CompaniesListFilter) + Zod schemas.
- **audit.ts:** +sourcing-dedupe-resolve (additive-safe, appended after wave-5 values; serialization stable).
- **rbac.ts:** /companies REPOINTED → /sourcing/companies (analyst); +/sourcing/companies/:id, +/sourcing/connections/:id/sync (analyst,admin), +/sourcing/dedupe-candidates/:id/resolve (analyst,admin). NAV_SOURCING unchanged. /compliance/* + /auth/* UNTOUCHED. rbac.test UPDATED (broken /companies assertion fixed).
- nav⊆RBAC preserved (new API routes no nav).
- Tests: 390 (74 sourcing + 42 audit + 188 rbac + others). typecheck + biome clean.
```yaml
skipped: false
contracts_authored: [sourcing.ts, audit.ts(ext), rbac.ts(mod + test), index.ts]
commit: e44a5fd
nav_subset_rbac: preserved
audit_additive_safe: true
deviations: []
```

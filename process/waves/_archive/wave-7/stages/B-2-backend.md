# Wave 7 — B-2 Backend (connection create/list + companies source-filter)
backend-developer. Commit `f4098f1`.
- **POST /sourcing/connections (create — AC-SEED):** RBAC analyst/admin (@Roles + module-load assertion); connectionCreateSchema; creates data_source_connections row, created_by = **app users.id via getUserWithRole** (NOT raw ST id — wave-5 lesson); **AUDITED** (sourcing-connection-create, in-tx rollback-on-fail). Returns DataSourceConnection.
- **GET /sourcing/connections (list):** RBAC analyst/admin; rows + per-connection companyCount (the ≥2-source facet signal).
- **companies source-filter:** CompaniesListFilter.source (UUID→connection via company_provenance) confirmed present (no change).
- RBAC matrix: analyst/admin 201/200, advisor/compliance 403, anon 401. Reuse wave-6 (ETL/dedupe/sync UNTOUCHED). No new schema/secret.
## Verify
typecheck clean; biome 0 err; tests: shared 415 + api 291(+1 skip). connection-create RBAC + audited + actor-id-translated + create-then-list ≥2.
```yaml
skipped: false
specialists_spawned: [backend-developer]
commit: f4098f1
actor_id_translated: true
audited: true
reuse_no_reimplement: true
```

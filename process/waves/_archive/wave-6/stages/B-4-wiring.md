# Wave 6 — B-4 Wiring
- **Repo typecheck** (`pnpm -r typecheck`): PASS (shared+api+web) — B-1 contracts consumed by api (adapter/ETL/dedupe/CRUD) + web (screen); shared dist rebuilt.
- **Repo build** (`pnpm -r build`): PASS. /sourcing/companies + /sourcing/companies/[id] compile. SourcingModule + endpoints registered.
- **Routes:** POST /sourcing/connections/:id/sync + GET /sourcing/companies(+/:id) + POST /sourcing/dedupe-candidates/:id/resolve; web /sourcing/companies + same-origin /sourcing proxy.
- **Env:** none new. **Migration 0004:** REGISTERED in drizzle journal (299e7c1 fix) → applies at C-2.
```yaml
typecheck_passed: true
build_passed: true
drift_defects: []
migration_journal_ok: true
```

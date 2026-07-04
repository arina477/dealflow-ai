# Wave 6 — B-2 Backend (schema + dedupe engine + adapter/ETL/sync/CRUD)
## Part 1 — schema + dedupe engine (postgres-pro, commits f6071e7 + 299e7c1 migration-fix)
apps/api/src/db/schema/sourcing.ts (7 tables) + migration 0004_wandering_harry_osborn (+down); dedupe.engine.ts + 31 tests.
- 7 tables: data_source_connections (provider_key→env, NO secret col), raw_companies (UNIQUE(connection_id,source_record_id) staging), companies (+ partial-unique normalized_domain WHERE not null — DB dedup backstop), contacts, company_provenance (UNIQUE(company_id,raw_company_id)), **contact_provenance** (UNIQUE(contact_id,raw_company_id) — principle-3 preserved), dedupe_candidates (status enum). Additive; NO immutability trigger (mutable).
- **Dedupe engine PROVEN:** normalize (domain/name/email); match priority (exact domain→merge, exact name→merge, token-overlap→candidate, no-match→new); cross-source (same domain 2 connections→1 canonical + 2 company_provenance); idempotent re-run (ON CONFLICT); ambiguous→dedupe_candidate(pending) not auto-merge; contact merge by normalized_email; contact_provenance written (principle-3 lineage). 31 tests.
- **Migration-fix (299e7c1):** postgres-pro's hand-written 0004 wasn't in the drizzle journal → drizzle-kit generate re-registered it (journal+snapshot) + re-appended the partial-unique + down. Would've silently failed at C-2 otherwise.
## Part 2 — adapter/ETL/sync/CRUD (backend-developer, commit 43fe212)
apps/api/src/modules/sourcing/{adapters/{fixture.adapter,adapter.registry},fixtures/companies.fixture.json,ingestion.service,sourcing.repository,sourcing.service,sourcing.controller,sourcing.module}.ts + 36 tests; app.module wiring.
- **Fixture adapter** (JSON, no new dep) with CROSS-SOURCE DUPS (grata-001 + grata-005 → acme.com); adapter registry (provider_key→adapter).
- **ETL** idempotent (onConflictDoUpdate by connection_id+source_record_id; re-sync updates not dups); writes staging ONLY; then invokes dedupe promoteStaging. SyncSummary {ingested,updated}.
- **Endpoints:** POST /sourcing/connections/:id/sync + GET /sourcing/companies(+/:id) + POST /sourcing/dedupe-candidates/:id/resolve. RBAC analyst/admin 200/201, advisor/compliance 403, anon 401 (module-load non-empty assertion + wave-3 guard).
- **Dedupe-resolve AUDITED** (M2 AuditService.append, action sourcing-dedupe-resolve, IN-TX rollback-on-audit-fail); **actor id-TRANSLATED** via getUserWithRole (app users.id, NOT raw SuperTokens id — the wave-5 actor-id-FK lesson applied + regression-tested). ETL/auto-merge NOT audited (mechanical).
## Verify
typecheck clean; biome 0 err (11 pre-existing warnings); api tests 247 pass/1 skip.
```yaml
skipped: false
specialists_spawned: [postgres-pro, backend-developer]
commits: [f6071e7, 299e7c1, 43fe212]
dedupe_proven: {cross_source: true, idempotent: true, ambiguous_to_candidate: true, contact_provenance: true}
migration_journal_registered: true
actor_id_translated: true
deviations: ["ingested/updated via per-record pre-check (not xmax)", "fixture per-record existence check (MVP scale)"]
simplify_applied: true
```

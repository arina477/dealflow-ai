# Wave 7 — P-3 Plan (single-spec, reuse-heavy page wave)

## Approach
**Δ1 — Sourcing-workspace page (the front door).** New server component `apps/web/app/(app)/sourcing/page.tsx` REPLACING the current `/sourcing` redirect-to-companies (the wave-6 redirect stub) with the actual workspace, per design/sourcing-workspace.html. In the wave-3 (app) AppShell; `assertRole('/sourcing', me.role)` analyst/admin (NAV_SOURCING already points here). SSR-fetches the connected sources + an initial company result set (cookie-forwarded). Alternative rejected: a new /sourcing/workspace route — no, /sourcing IS the workspace entry (nav already lands there); keep /sourcing/companies as the deep companies screen (linked from the workspace). Client components: SearchBar + SourceFacet (filter by connection) + ResultsMatrix (company rows + source/provenance badges) + DetailDrawer + a per-connection "Sync now" trigger.
**Δ2 — Canonical-universe search endpoint.** Reuse/extend the wave-6 GET /sourcing/companies (it already lists+filters canonical companies) — add name/domain/source-connection filters if not present (the wave-6 CompaniesListFilter already has name/domain; add a connection/source filter param). RBAC analyst/admin (existing). Server-side filter over canonical `companies`/`contacts` (the deduped universe, 1 row per company) — NOT client dedup, NOT raw staging. Add GET /sourcing/connections (list connected data_source_connections for the source-facet + the ≥2-source view) if not already exposed.
**Δ3 — Trigger ingestion (reuse wave-6).** The workspace's "Sync now" per connection calls the EXISTING wave-6 POST /sourcing/connections/:id/sync (idempotent ETL → dedupe → canonical) via apiFetch (rid:'anti-csrf'); shows the SyncSummary {ingested, updated}; refreshes the results (the newly-deduped companies appear). Does NOT re-implement ETL/dedupe — pure reuse. Hand-off link to /sourcing/companies for cleaning (the wave-6 review queue).
**Δ4 — ≥2-source view on fixtures.** Seed/allow ≥2 fixture connections (the M3 "≥2 sources" metric); the source facet + per-source counts render across them. The real 2nd provider is the deferred adapter — the UI is provider-agnostic (works on any connection).

- Data model: NONE (reuses wave-6 tables). API: extend GET /sourcing/companies filters (+source/connection) + GET /sourcing/connections (list); reuse POST /sync. Deps: none new (fixture; real adapter deferred). No new secret.

## Plan (file steps)
- B-1 contracts: extend @dealflow/shared sourcing.ts SearchFilter/CompaniesListFilter (+ connectionId/source filter) if needed; roleRoutes — /sourcing already analyst (confirm the workspace page route + GET /sourcing/connections pattern present, add if missing). (typescript-pro if contract change; else skip-lite.)
- B-2 backend: extend sourcing.controller/repository — GET /sourcing/companies (+source filter), GET /sourcing/connections (list). Reuse POST /sync. (backend-developer.)
- B-3 frontend: apps/web/app/(app)/sourcing/page.tsx (workspace, replaces redirect) + _components/{SearchBar,SourceFacet,ResultsMatrix,DetailDrawer,SyncTrigger}.tsx per sourcing-workspace.html; apiFetch(rid) on the sync trigger; next.config.ts /sourcing/connections proxy if new. (nextjs-developer.)
- B-4 wiring, B-5 verify (incl. a ≥2-fixture-connection results test), B-6 review.
- Specialists: typescript-pro (if contract change), backend-developer, nextjs-developer. Validated in AGENTS.md.

## Self-consistency sweep: CLEAN
Every AC → ≥1 step: workspace page (Δ1/B-3); canonical search (Δ2/B-2); ≥2-source view (Δ4); trigger-sync reuse (Δ3); RBAC analyst + nav⊆RBAC (B-1/B-3); apiFetch+proxy (B-3). design_gap false. No new SDK/schema/secret. Deferred (345dfbc6 real adapter, b9141490 modal) correctly out.

```yaml
deps_new: []
schema_change: false
new_secret: false
specialists: [typescript-pro, backend-developer, nextjs-developer]
reuse: [wave-6 ETL/sync/dedupe/companies, M1 RBAC/AppShell, wave-5 apiFetch/proxy]
self_consistency: clean

---

## P-4 remediation (jenny Phase-2 — enforceable seeding + 2 low notes; doc-level)
1. **Δ0 — connection create endpoint (AC-SEED, the ≥2-source enabler):** B-2 (backend-developer) adds **POST /sourcing/connections** (RBAC analyst/admin; body {providerKey, displayName, config?}; AUDITED via M2 AuditService, actor=app users.id via getUserWithRole) + GET /sourcing/connections (list). This creates the ≥2 fixture connections the ≥2-source view needs (no create path existed — karen MEDIUM). B-5 + C-2 verify the facet against REAL created rows (not test-only inserts). roleRoutes: add POST/GET /sourcing/connections (analyst/admin) at B-1; next.config.ts /sourcing/connections proxy at B-3.
2. **Δ-note badges:** B-3 renders source badges from the actual data_source_connections rows (fixture-named), NOT literal PitchBook/Crunchbase from the design mock.
3. **Δ-note CTA:** B-3 repoints the design's Review-and-Import CTA to the /sourcing/companies hand-off (no dead deferred-modal CTA).

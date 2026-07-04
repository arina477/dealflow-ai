# Wave 6 — P-3 Plan

**Wave topic:** Deal-sourcing data spine (M3 first bundle) — data_source_connections + pluggable adapter + staging/canonical schema; idempotent ETL/sync; deterministic dedupe (raw→canonical + provenance + review queue + cross-source); companies-contacts screen.
**wave_type:** multi-spec (4 blocks). **design_gap_flag:** false (design/companies-contacts.html exists; D-block skipped).
**Source of truth:** spec contract in `tasks.description` of seed `ff378a95` (4 blocks). This file is the *how* + *who-does-what-where*; B-block reads it, head-builder enforces it.

**External-SDK status — CONFIRMED NO NEW EXTERNAL SDK THIS WAVE.** The vendor-integration surface is delivered as a typed `DataSourceAdapter` interface + a **FIXTURE adapter** reading a bundled dataset. No third-party provider SDK (Grata / Cyndx / etc.) is installed, imported, or called this wave. Therefore `external-sdk-integration-rules.md` pre-build checklist is **N/A this wave** (no assumed-API-surface risk). Real provider SDKs are explicitly **deferred to a later M3 bundle** — that later bundle will run the external-sdk-integration-rules research process + likely a `MONITOR:` provisioning task; the whole point of shipping the adapter interface now is to isolate that future vendor swap to one class. CSV parsing (if the fixture is CSV) uses a **Node built-in / zero-dep** path (see Deps) — not a new external dependency.

---

# APPROACH SECTION

## Action 1 — Architecture deltas

The wave adds ONE new backend module (`sourcing`) spanning schema → adapter → ETL → dedupe → API, plus ONE new frontend route group under `(app)/sourcing`. It touches NO existing table and NO existing service; the only edits to existing files are additive: the shared `rbac.ts` `roleRoutes` matrix (repoint + extend the already-present `/sourcing` + `/companies` placeholder entries) and the schema barrel `index.ts` re-export.

### Delta 1 — Two-tier data model: staging (`raw_companies`) vs canonical (`companies`/`contacts`)

**What's new.** A source-of-record **staging** tier (`raw_companies`, append/upsert, one row per (connection, source_record_id)) strictly separated from a **canonical** tier (`companies` + `contacts`, the deduped truth), linked by `company_provenance` lineage rows and mediated by a `dedupe_candidates` review queue.

**Why this approach over alternatives.**
- *Alternative A — single `companies` table, upsert-in-place on ingest (no staging).* Rejected: loses raw source lineage (can't answer "which source said what"), makes cross-source dedup lossy (second source overwrites first), and makes re-ingest destructive. The compliance posture of this product (provenance is a first-class requirement per `databases.md` reusability principle 3) demands the raw record survive independently of the canonical merge.
- *Alternative B — merge-on-write (dedupe inside the ETL, no staging tier).* Rejected: couples two distinct correctness concerns (idempotent ingest vs. deterministic entity-resolution) into one transaction, making each harder to test and re-run. The spec explicitly mandates "ETL writes ONLY staging; dedupe owns raw→canonical." Two-tier keeps ingest idempotency (upsert by natural key) and dedupe idempotency (promote-if-absent) independently verifiable.
- **Chosen: two-tier with explicit provenance join + review queue.** Trade-off accepted: two write paths and a promotion step (more moving parts) in exchange for non-destructive re-runnability, traceable lineage, and a human review path for uncertain merges — all mvp-critical per the P-0 reframe (metric = "deduped … with provenance … clean").

**Failure-domain impact.** New tables only; no existing transaction scope expands. The dedupe promotion runs in its own transaction per raw batch. No new permission check crosses an existing boundary — RBAC reuses the M1 `RolesGuard` + `roleRoutes` single source. The `company_provenance` non-null-on-ingest invariant (databases.md principle 3) is enforced at the schema (`.notNull()`) + service layer.

### Delta 2 — `DataSourceAdapter` interface + fixture adapter (vendor-swap isolation)

**What's new.** A typed contract `DataSourceAdapter.fetchCompanies(connection) => Promise<NormalizedSourceRecord[]>` in `@dealflow/shared`, and a `FixtureDataSourceAdapter` implementation reading a bundled dataset. An `AdapterRegistry` resolves `provider_key → adapter instance`.

**Why this approach over alternatives.**
- *Alternative A — code directly against a real provider (Grata/Cyndx) now.* Rejected by P-0 (ceo-reviewer HOLD-SCOPE + no-new-SDK guardrail): premature vendor lock, provisioning dependency, and API-surface risk before the spine's own correctness is proven. The metric doesn't need a real provider — it needs a *deduped, provenance-tracked universe*, which a fixture exercises fully.
- *Alternative B — no interface, just a fixture loader function.* Rejected: the whole point is to isolate the eventual vendor swap to one class. The interface is cheap insurance; without it, the later real-provider bundle re-touches ETL + dedupe.
- **Chosen: interface + fixture impl + registry.** Trade-off: one extra abstraction layer now, justified because the P-0 frame de-risked it as "not premature abstraction" (the second implementation — a real provider — is a known, scheduled follow-on, so the abstraction has a concrete second consumer).

**Fixture MUST contain cross-source duplicates** (P-0 watch-item, block-3 AC): the bundled dataset carries two connections whose records include the SAME normalized domain, so the cross-source merge path is exercised (not happy-path green). This is a *data* requirement on the fixture file, asserted by a dedicated dedupe test.

**Secrets.** Provider credentials are resolved from Railway env by `provider_key` at runtime (`process.env[<derived key>]`). The DB stores only the `provider_key` name — NEVER a secret value. The fixture adapter needs no secret; the interface's secret-resolution contract (env-by-key) is established now so real adapters inherit it. A test/grep asserts no secret column exists on `data_source_connections`.

**Failure-domain impact.** `provider_key` with no matching env credential → connection surfaces as unusable cleanly (not a crash) — handled in the adapter registry / ETL entry, returns an error sync outcome.

### Delta 3 — ETL service + on-demand `SourceSyncJob` (synchronous, no queue)

**What's new.** An `EtlService` that for an enabled connection runs `adapter.fetchCompanies → normalize → UPSERT raw_companies` (idempotent by `(connection_id, source_record_id)`), writing ONLY staging. A `SourceSyncJob` (a service method, not a background worker) triggered on-demand by `POST /sourcing/connections/:id/sync`, returning `{ ingested, updated }`.

**Why synchronous / no queue.**
- *Alternative — background worker + queue (BullMQ / pg-boss / Graphile Worker) now.* Rejected as over-engineering for the MVP: the spec says on-demand (NOT scheduled), the fixture adapter returns near-instantly, and there is no scheduling or long-running-fetch requirement this wave. `databases.md` open-item #6 explicitly defers the background-job tech decision. Adding a queue now would introduce infra (Redis / a jobs table) with no MVP payoff.
- **Chosen: synchronous on-demand service call.** Trade-off / deferred concern noted: a *real* provider sync could be slow or rate-limited; if/when a real adapter lands (later M3 bundle), the sync should move to an async/queued path (return `202 + sync_run id`, poll for status). The schema is already queue-agnostic (a future `sync_runs` history table — deferred this wave; the sync summary is returned inline for now, not persisted, since the mvp screen doesn't yet show sync history). **Do NOT add a queue this wave.**

**Failure-domain impact.** Adapter fetch failure → sync fails cleanly with an error outcome; because staging is the only write target and dedupe is a separate step, a failed sync cannot corrupt the canonical tier (no partial-canonical writes). Empty source → `{ ingested: 0, updated: 0 }`, no error.

### Delta 4 — Dedupe engine (the hard correctness piece)

**What's new.** A `DedupeService` that promotes `raw_companies` (staging) → canonical `companies` + `contacts`, deterministically (no ML), preserving provenance, handling cross-source merges, and routing ambiguous matches to `dedupe_candidates`.

**Run model — dedupe is a SEPARATE service run AFTER sync, not part of sync.** The sync endpoint writes staging only; dedupe is invoked as its own step (this wave: invoked at the end of the sync request, in a distinct transaction, so a sync also refreshes the canonical universe — but the two concerns stay separately-testable service methods; the dedupe method is independently callable and independently idempotent). Rationale: keeps ingest-idempotency and promote-idempotency independently verifiable (Delta 1 alternative-B rationale), and lets a future re-run of dedupe over unchanged staging be a proven no-op.

**Match rule (deterministic, documented).**
1. **Normalization.** `domain` → lowercase, strip `www.`, strip protocol/path, trim. `name` → lowercase, trim, collapse whitespace, strip common corporate suffixes (inc/llc/ltd/corp/co) + punctuation. `email` → lowercase, trim.
2. **Match key + rule.** Primary match on **normalized domain** (strongest signal). A raw record whose normalized domain equals an existing canonical company's normalized domain is an **auto-merge** (deterministic, high-confidence) → merge into that canonical, do NOT create a duplicate. If no domain match, fall back to **normalized-name** exact match: exact normalized-name match with corroborating signal is auto-merge; a name-only *partial/fuzzy* match (below the auto-merge threshold — e.g. token-overlap match without domain agreement) is **ambiguous** → write a `dedupe_candidates` row (status `pending`), do NOT auto-merge. A raw record matching nothing → create a new canonical company + contacts.
3. **Auto-merge threshold.** Documented as: exact normalized-domain match OR exact normalized-name match ⇒ auto-merge; anything weaker (partial name token overlap, name match with conflicting domain) ⇒ review queue. No probabilistic scoring/ML — the score stored on `dedupe_candidates` is a deterministic rule-derived confidence label, for human context only.
4. **Raw with no domain.** Falls to name-normalized matching; if name is also weak/empty → new canonical (documented edge behavior). No silent drop.

**Merge semantics + field-win (tie-breaking).** On merge into an existing canonical: canonical keeps its identity (id stable); missing canonical fields are backfilled from the raw record; conflicting fields keep the canonical's current value (first-writer-wins for canonical stability) UNLESS the raw record is more complete for a null canonical field. Contacts are merged by normalized email (same email → same contact; new email → new contact under the same company). Every contributing raw record writes a `company_provenance` row (canonical_company_id ← raw_company_id + connection_id + ingested_at + which fields it contributed).

**Cross-source dedup (load-bearing).** The SAME normalized domain arriving from TWO connections (different `source_record_id`s) resolves to ONE canonical company with `company_provenance` rows from BOTH raw records/sources. This is the primary correctness test; fixtures carry the cross-source dup.

**Idempotency.** Re-running dedupe over the same staging creates NO duplicate canonical rows and NO duplicate provenance rows: promotion is promote-if-absent, keyed on the normalized match key for canonical and on `(canonical_company_id, raw_company_id)` uniqueness for provenance. A re-run is a proven no-op.

**Failure-domain impact.** Dedupe writes canonical + provenance in a transaction per promotion batch; a mid-batch failure rolls back that batch's canonical/provenance writes (staging untouched, so re-run recovers). A **material merge resolution MAY be audited** (Delta 6).

### Delta 5 — Companies-contacts screen (`(app)/sourcing/companies`)

**What's new.** A route-group page under the existing wave-3 `(app)` AppShell at `/sourcing/companies` (RBAC **analyst** per journey row 13, + admin for the resolve/edit API surface), rendering the canonical companies+contacts per `design/companies-contacts.html` with view + filter (name/domain/source). "Clean actions": the pending `dedupe_candidates` surface for review — resolve (merge into matched canonical | reject/keep-separate) via `POST /sourcing/dedupe-candidates/:id/resolve`; edit a canonical record.

**Why this route shape over alternatives.**
- The shared `roleRoutes` already carries placeholder entries `/sourcing` (analyst, nav item present, icon `database`, group `workspace`) and `/companies` (analyst, no nav). *Alternative — keep the bare `/companies` route.* Rejected for route-namespace consistency with the spec's canonical `/sourcing/companies` + the sibling API routes (`/sourcing/connections/:id/sync`, `/sourcing/dedupe-candidates/:id/resolve`). **Chosen: consolidate the placeholder `/companies` onto `/sourcing/companies`** (repoint the existing entry's pattern; keep analyst; keep the existing `/sourcing` nav item as the sidebar entry pointing at `/sourcing`). Add `/sourcing/companies/:id`, `/sourcing/connections/:id/sync`, `/sourcing/dedupe-candidates/:id/resolve`. Trade-off: one existing placeholder pattern string changes (additive-safe — no page consumed `/companies` yet; verified: no `(app)/companies` route dir exists).

**nav⊆RBAC.** The `/sourcing` nav item (`allowedRoles: ['analyst']`) references the same literal as its route entry — invariant holds by construction (rbac.ts navItemsForRole contract). The `/sourcing/companies` page RBAC = analyst (nav points at `/sourcing` which lands the analyst on the companies screen). No admin nav item added (keep nav journey-faithful, per the audit-log precedent); admin reaches the resolve/edit APIs via allowedRoles on those route entries, no nav.

**Failure-domain impact.** Non-permitted role → route + API denied by the reused `RolesGuard` (403) with fail-closed-empty-`@Roles()` boot assertion (the wave-5 controller exemplar). Resolve/edit mutations update canonical + provenance + candidate status in a transaction.

### Delta 6 — Audit (M2 AuditService) for material sourcing mutations — judged

Per the reuse note ("material data mutations MAY be audited — judge which"): the **dedupe-candidate resolution** (a human merge/reject decision that changes the canonical universe) is a material, human-attributable mutation and **IS audited** via `AuditService.append(input, tx)` in the SAME transaction as the resolve write (the wave-5 rules.service pattern — audit-append failure rolls back the mutation). A new audit action `sourcing-dedupe-resolve` is added to the shared `auditActionEnum` (additive; serialization order preserved — appended after existing values). **NOT audited this wave:** ETL upserts to staging (machine ingest, high-volume, not a compliance decision), auto-merges (deterministic machine promotion, not a human decision), and canonical field edits (judged non-compliance-material at MVP; can be added later). Rationale: audit the human judgment calls that alter the deduped truth, not the mechanical pipeline steps — keeps the append chain meaningful and low-noise.

## Action 2 — Data model

New Drizzle schema file `apps/api/src/db/schema/data-source-connections.ts` (matches the databases.md module→file convention; the module was pre-declared there). Six tables. Migration `0004_*` (drizzle-kit generate) — **strictly additive** (no existing table touched), with a hand-appended raw-SQL section for the partial/functional indexes drizzle-kit cannot emit (following the 0002/0003 hand-append precedent) + a symmetric `.down.sql` dropping ONLY the new objects.

**Tables (7 — incl. contact_provenance per Delta 0):**

1. **`data_source_connections`** — `id uuid PK default gen_random_uuid()`, `provider_key text NOT NULL` (Railway-env credential *name*, never a secret value), `display_name text NOT NULL`, `enabled boolean NOT NULL default true`, `config jsonb NOT NULL default '{}'` (non-secret: field mappings/filters), `created_by uuid` (FK→users.id ON DELETE SET NULL), `created_at timestamptz NOT NULL default now()`. **NO secret column** (asserted by test/grep).
2. **`raw_companies`** (staging) — `id uuid PK`, `connection_id uuid NOT NULL` (FK→data_source_connections.id), `source_record_id text NOT NULL` (provider's id), `name text`, `domain text`, `raw jsonb NOT NULL` (full source payload), contact fields captured in `raw` (contacts normalized into canonical `contacts` at dedupe), `ingested_at timestamptz NOT NULL default now()`. **UNIQUE(connection_id, source_record_id)** — idempotent upsert key.
3. **`companies`** (canonical) — `id uuid PK`, `name text NOT NULL`, `domain text`, `normalized_domain text` (persisted match key), `normalized_name text` (persisted match key), `sector text`, `status text NOT NULL default 'active'` (active/archived — soft-delete via status per convention), `created_at`, `updated_at timestamptz` (`.$onUpdateFn`).
4. **`contacts`** (canonical) — `id uuid PK`, `company_id uuid NOT NULL` (FK→companies.id), `name text`, `email text`, `normalized_email text`, `title text`, `created_at`, `updated_at`.
5. **`company_provenance`** — `id uuid PK`, `company_id uuid NOT NULL` (FK→companies.id), `raw_company_id uuid NOT NULL` (FK→raw_companies.id), `connection_id uuid NOT NULL` (FK→data_source_connections.id), `contributed_fields jsonb`, `ingested_at timestamptz NOT NULL default now()`. **NOT NULL on lineage cols** (databases.md principle 3). **UNIQUE(company_id, raw_company_id)** — idempotency backstop (a raw record contributes to a canonical at most once).
6. **`dedupe_candidates`** — `id uuid PK`, `raw_company_id uuid NOT NULL` (FK→raw_companies.id), `matched_company_id uuid` (FK→companies.id, nullable), `score real` (rule-derived confidence label), `reason text`, `status` pgEnum `dedupe_candidate_status` [`pending`|`merged`|`rejected`] NOT NULL default `pending`, `resolved_by uuid` (FK→users.id SET NULL), `created_at`, `resolved_at timestamptz`.

**Migration strategy.** Additive-only, online (no backfill — new tables start empty; the seed at `apps/api/src/db/seed.ts` may add the fixture connections but content-authoring is per this wave). Down drops the 7 tables (incl. contact_provenance) (FK-dependency order: dedupe_candidates → company_provenance → contacts → companies → raw_companies → data_source_connections) + the enum type + the hand-appended indexes, symmetric with forward.

**Indexes.**
- `raw_companies`: UNIQUE(connection_id, source_record_id) [upsert]; index on `normalized_domain` [dedupe match scan]; index on `connection_id`.
- `companies`: index on `normalized_domain` [dedupe match — the load-bearing lookup]; index on `normalized_name`; index on `status` + name/domain [screen filters].
- `contacts`: index on `company_id`; index on `normalized_email` [contact merge].
- `company_provenance`: UNIQUE(company_id, raw_company_id) [idempotency]; index on `company_id`.
- `dedupe_candidates`: index on `status` [review-queue list]; index on `matched_company_id`.

**FK/unique summary.** All new-table→new-table FKs; `created_by`/`resolved_by`→users.id ON DELETE SET NULL (convention — row survives author deletion). Two idempotency-critical UNIQUEs: `raw_companies(connection_id, source_record_id)` and `company_provenance(company_id, raw_company_id)`.

## Action 3 — API contracts (concrete)

All endpoints under NestJS `sourcing` module controllers. All: `@UseGuards(SessionGuard, RolesGuard)` + `@Roles(...rolesForRoute('<path>'))` (sourced from shared matrix, fail-closed-empty at boot — the wave-5 controller exemplar). Actor identity from server-verified session translated via `AuthRepository.getUserWithRole()` (never client body). Request bodies parsed against shared Zod schemas (400 on ZodError).

### `POST /sourcing/connections/:id/sync`
- **Auth:** analyst, admin (`rolesForRoute('/sourcing/connections/:id/sync')`).
- **Request:** no body (or empty). `:id` = connection id.
- **Response 200:** `{ ingested: number, updated: number }` (sync summary; also triggers a dedupe pass over new staging). Shared Zod `syncSummarySchema`.
- **Errors:** 404 unknown/disabled connection; 400 provider_key has no matching env credential (surfaced cleanly); 401 anon; 403 wrong role.
- **Idempotency/retry:** idempotent by construction — staging upsert by `(connection_id, source_record_id)`; a re-sync updates in place (reflected in `updated`), never duplicates. Safe to retry.

### `GET /sourcing/companies` (list + filter) and `GET /sourcing/companies/:id`
- **Auth:** analyst (`rolesForRoute('/sourcing/companies')`).
- **Request (list):** query params `?q=<name/domain>&source=<connection_id>&status=<active|archived>` (all optional). `:id` variant = one canonical company + its contacts + provenance + any pending candidates targeting it.
- **Response 200 (list):** `{ companies: Company[] }` (each with contact count + source count for the table). `:id`: `{ company: Company, contacts: Contact[], provenance: Provenance[], pendingCandidates: DedupeCandidate[] }`. Shared Zod schemas.
- **Errors:** 401 anon; 403 non-analyst; 404 unknown id.
- **Idempotency:** GET (safe, no state change).

### `POST /sourcing/dedupe-candidates/:id/resolve`
- **Auth:** analyst, admin (`rolesForRoute('/sourcing/dedupe-candidates/:id/resolve')`).
- **Request:** `{ action: 'merge' | 'reject' }` (shared Zod `dedupeResolveSchema`). `merge` → promote/merge the raw into `matched_company_id` (canonical + provenance updated); `reject` → keep-separate (candidate closed; raw may become its own canonical or stay unpromoted per rule — documented).
- **Response 200:** `{ candidateId, status: 'merged' | 'rejected', companyId? }`.
- **Errors:** 404 unknown/already-resolved candidate; 400 invalid action; 401/403.
- **Idempotency:** resolving an already-resolved candidate → 404/409 (no double-apply). **Audited** (AuditService.append action `sourcing-dedupe-resolve` in the same tx — rolls back on audit failure).

## Action 4 — Dependency list

**NO new third-party runtime dependency.** Confirmed:
- **Data-source provider SDK:** none — fixture adapter (Delta 2). Real SDKs deferred to a later M3 bundle (external-sdk-integration-rules applies THEN, not now).
- **CSV parsing (if fixture is CSV):** use a **zero-dep** path — either a bundled `.json` fixture (preferred — no parser at all, just `import`/`readFileSync` + `JSON.parse`) or, if CSV, a minimal hand-rolled split (fixture is a controlled, well-formed file we author, so a full CSV lib is unwarranted) OR Node's built-in `node:util`/stream — NOT a new npm dep like `csv-parse`/`papaparse`. **Decision: bundle the fixture as JSON** to avoid a parser entirely (simplest; the adapter reads + validates against the shared `NormalizedSourceRecord` Zod schema). If a reviewer prefers CSV for realism, note it as a non-blocking follow-up — still zero-dep.
- **Everything else** reuses installed packages: Drizzle (schema/migration/queries), Zod (`@dealflow/shared` contracts), NestJS (module/controller/guards), the M1 `RolesGuard`/`SessionGuard`/`roleRoutes`, M2 `AuditService`, Next.js App Router (screen), existing `apiFetch` client helper.

**SDK pre-build checklist:** N/A (no new external SDK this wave — see header).

---

# PLAN SECTION

## Action 5 — File-level steps (grouped by B-stage)

### B-1 Schema (DB migration + ORM models)
| # | Path | Op | What changes | Specialist | Order |
|---|---|---|---|---|---|
| 1 | `apps/api/src/db/schema/data-source-connections.ts` | create | 7 tables (incl. contact_provenance) + `dedupe_candidate_status` pgEnum + indexes + FKs per Action 2 | `postgres-pro` | first |
| 2 | `apps/api/src/db/schema/index.ts` | modify | add `export * from './data-source-connections'` (barrel) | `postgres-pro` | after #1 |
| 3 | `apps/api/src/db/migrations/0004_*.sql` | create | drizzle-kit generate diff + hand-appended raw SQL for functional/partial indexes drizzle-kit can't emit (0002/0003 precedent) | `postgres-pro` | after #2 |
| 4 | `apps/api/src/db/migrations/0004_*.down.sql` | create | symmetric drop (FK-dependency order) of the 7 tables (incl. contact_provenance) + enum + hand-appended indexes | `postgres-pro` | with #3 |

### B-2 Contracts (shared types / Zod)
| # | Path | Op | What changes | Specialist | Order |
|---|---|---|---|---|---|
| 5 | `packages/shared/src/sourcing.ts` | create | `NormalizedSourceRecord` (+ Zod), `DataSourceAdapter` interface, `Company`/`Contact`/`Provenance`/`DedupeCandidate` schemas, `syncSummarySchema`, `dedupeResolveSchema`, companies list/detail response schemas | `typescript-pro` | first in B-2 |
| 6 | `packages/shared/src/audit.ts` | modify | append `sourcing-dedupe-resolve` to `auditActionEnum` (additive, order-preserving) | `typescript-pro` | with #5 |
| 7 | `packages/shared/src/rbac.ts` | modify | repoint `/companies`→`/sourcing/companies`; add `/sourcing/companies/:id`, `/sourcing/connections/:id/sync` (analyst,admin), `/sourcing/dedupe-candidates/:id/resolve` (analyst,admin); keep `/sourcing` nav item | `typescript-pro` | with #5 |
| 8 | `packages/shared/src/index.ts` | modify | re-export `./sourcing` | `typescript-pro` | after #5 |

### B-3 Backend (NestJS sourcing module: adapter + ETL + dedupe + controllers)
| # | Path | Op | What changes | Specialist | Order |
|---|---|---|---|---|---|
| 9 | `apps/api/src/modules/sourcing/adapters/data-source-adapter.ts` | create | adapter interface re-export + `AdapterRegistry` (provider_key→adapter; env-secret resolution by key) | `backend-developer` | after B-1,B-2 |
| 10 | `apps/api/src/modules/sourcing/adapters/fixture.adapter.ts` | create | `FixtureDataSourceAdapter` reading the bundled JSON fixture | `backend-developer` | with #9 |
| 11 | `apps/api/src/modules/sourcing/fixtures/companies.fixture.json` | create | bundled dataset — **MUST include cross-source duplicates** (same normalized domain from 2 connections) | `backend-developer` | with #10 |
| 12 | `apps/api/src/modules/sourcing/etl.service.ts` | create | `fetchCompanies→normalize→UPSERT raw_companies` (idempotent by natural key); writes ONLY staging | `data-engineer` | after #9-11 |
| 13 | `apps/api/src/modules/sourcing/dedupe.service.ts` | create | raw→canonical promotion; deterministic match (normalize name/domain/email); merge + provenance; cross-source; review-queue; idempotent (**the hard correctness piece**) | `data-engineer` | after #12 |
| 14 | `apps/api/src/modules/sourcing/sourcing.service.ts` | create | connection/company read + sync orchestration (ETL then dedupe pass) + dedupe-candidate resolve (audited, in tx via M2 `AuditService`) | `data-engineer` | after #13 |
| 15 | `apps/api/src/modules/sourcing/sourcing.repository.ts` | create | Drizzle queries (list/filter companies, detail, candidates) | `data-engineer` | with #14 |
| 16 | `apps/api/src/modules/sourcing/sourcing.controller.ts` | create | `POST /sourcing/connections/:id/sync`, `GET /sourcing/companies(+/:id)`, `POST /sourcing/dedupe-candidates/:id/resolve` — guards + `@Roles(...rolesForRoute())` + fail-closed boot assertion (wave-5 exemplar) | `backend-developer` | after #14-15 |
| 17 | `apps/api/src/modules/sourcing/sourcing.module.ts` | create | wire services/repo/controller; import AuditModule | `backend-developer` | after #16 |
| 18 | `apps/api/src/app.module.ts` | modify | register `SourcingModule` | `backend-developer` | after #17 |

### B-4 Frontend (companies-contacts screen)
| # | Path | Op | What changes | Specialist | Order |
|---|---|---|---|---|---|
| 19 | `apps/web/app/(app)/sourcing/companies/page.tsx` | create | list + filter view per companies-contacts.html (analyst RBAC via assertRole) | `nextjs-developer` | after B-3 contracts stable |
| 20 | `apps/web/app/(app)/sourcing/companies/_components/*.tsx` | create | table, filter bar, dedupe-candidate review panel (resolve merge/reject), canonical-edit — per design + DESIGN-SYSTEM §10 | `nextjs-developer` | with #19 |
| 21 | `apps/web/app/(app)/sourcing/companies/[id]/page.tsx` | create | company detail (contacts + provenance + pending candidates) | `nextjs-developer` | with #19 |

### B-5 Wiring
| # | Path | Op | What changes | Specialist | Order |
|---|---|---|---|---|---|
| 22 | `apps/api/src/db/seed.ts` | modify | seed 2 fixture `data_source_connections` (env-key names only, no secret) for local-dev/CI | `postgres-pro` | after B-1 |
| 23 | `.env.example` | modify | document the fixture provider_key env-name convention (name only, placeholder value) | orchestrator | any |
| 24 | type-check / build fixers across web+api | modify | resolve import/type wiring after module registration | `typescript-pro` | last |

## Action 6 — Specialist routing (validated against AGENTS.md)

All specialists exist in `command-center/AGENTS.md`:
- `postgres-pro` — enumerated in the per-stack executors note (line 91) [schema/migration]. ✓
- `typescript-pro` — enumerated (line 91) [shared contracts/types]. ✓
- `backend-developer` — universal executor (line 70) [NestJS controllers/adapters/module]. ✓
- `data-engineer` — **NOT explicitly listed** in AGENTS.md catalog. **Substitution noted:** route the ETL + dedupe correctness work to `backend-developer` (universal executor, server-side implementation) with `postgres-pro` consulted for the dedupe query/index correctness. This is a catalog-match substitution per rule 11 (closest match; noted, not silent). *If head-product at P-4 judges the dedupe correctness piece warrants a dedicated data-engineering agent, install via agent-creator before B-block.* Flagging for the gate.
- `nextjs-developer` — enumerated (line 91) [screen]. ✓

## Action 7 — Parallelization map

- **B-1:** serial chain #1→#2→#3/#4 (schema file → barrel → migration+down).
- **B-2:** #5 first; then #6, #7 parallel batch (independent files: audit.ts, rbac.ts); #8 after #5. B-2 can start in parallel with B-1 (shared package has no DB dependency) — but the migration (#3) must land before B-3 runs against it.
- **B-3:** #9/#10/#11 parallel batch (adapter + fixture); then serial #12→#13→#14 (ETL → dedupe → orchestration; dedupe depends on staging shape, service depends on both); #15 parallel with #14; then #16→#17→#18 serial (controller → module → app registration).
- **B-4:** #19/#20/#21 parallel batch (page + components + detail) — after B-2 contracts stable (shared types) + B-3 endpoints exist.
- **B-5:** #22 after B-1; #23 anytime; #24 last (post everything).
- **Cross-stage:** B-1 ∥ B-2 (start together). B-3 after B-1 migration + B-2 contracts. B-4 after B-2 + B-3. B-5 trails.

## Action 8 — Self-consistency sweep

**AC → step coverage (every AC across 4 blocks maps to ≥1 step):**

- **Block 1 (ff378a95):** additive migration + 7 tables (incl. contact_provenance) → #1,#3,#4. DataSourceAdapter interface → #5,#9. Fixture adapter → #10,#11. Secrets env-only / no secret column → #1 (no column) + #9 (env resolution) + #22/#23 (env-key convention) + grep-test (T-block). ✓
- **Block 2 (0241222b):** ETL adapter→normalize→staging upsert (idempotent) → #12. On-demand SourceSyncJob + POST sync → #14,#16. Writes ONLY staging → #12 (staging-only). ✓
- **Block 3 (db274731):** raw→canonical deterministic match → #13. Provenance preserved → #13 (+ schema #1 company_provenance). Cross-source dedup + fixtures-with-dups → #13 + #11 (fixture MUST carry cross-source dups). Ambiguous→dedupe_candidates → #13. Idempotent re-run → #13 (promote-if-absent + UNIQUE #1). ✓
- **Block 4 (f5771d13):** screen view+filter per design → #19,#20,#21. Clean actions (resolve merge/reject, edit canonical) → #20 + #14,#16 (resolve endpoint). RBAC analyst + roleRoutes + nav⊆RBAC → #7 (rbac.ts) + #16 (controller guards) + #19 (assertRole). GET companies(+/:id) + POST resolve → #16. ✓

**Cross-cutting constraint coverage:**
- staging↔canonical two-tier → schema #1 + separation ETL(#12)/dedupe(#13). ✓
- idempotent ETL (upsert) → #1 UNIQUE + #12. idempotent dedupe → #13 + #1 UNIQUE(company_provenance). ✓
- deterministic dedupe (no ML) + provenance + cross-source + review-queue → #13 (all four). ✓
- provider secrets env-only (no secret in-DB) → #1 + #9 + grep-test. ✓
- fixture adapter (no new SDK) → #10,#11 + Action 4 (confirmed). ✓
- RBAC analyst/admin (roleRoutes + nav⊆RBAC) → #7 + #16 + #19. ✓
- additive migration (+ down) → #3,#4. ✓
- reuse M1 RBAC/AppShell → #7,#16,#19 (guards + AppShell layout). reuse M2 audit for material mutation → #6 + #14 (dedupe-resolve audited). ✓

**Sweep checklist (P-3 Action 8):**
1. Every AC → ≥1 step. ✓ (table above)
2. Every file-level step has a specialist. ✓ (one `data-engineer` substitution noted → routed to `backend-developer`+`postgres-pro`, flagged for gate).
3. No file in multiple parallel batches. ✓
4. `design_gap_flag` referenced: **false** (companies-contacts.html exists; D-block skipped). ✓
5. Architecture deltas with explicit alternative trade-offs (Action 1). ✓ (6 deltas, each with named alternatives).
6. Data + API contracts concrete — no TBD. ✓ (7 tables (incl. contact_provenance) full DDL; 3 endpoints full req/resp/RBAC).
7. New deps justified. ✓ (zero new deps — confirmed; JSON fixture, no parser).
8. SDK pre-build checklist. ✓ N/A (no new external SDK).

**Sweep result: CLEAN.** One flag carried to P-4 gate: the `data-engineer` catalog gap (substituted to `backend-developer`+`postgres-pro`; head-product may elect agent-creator install for the dedupe correctness piece).

---

## P-4 remediation — Delta 0: databases.md reconciliation + contact-provenance (karen HIGH + jenny BLOCK → resolved; doc/schema-decision, no rebuild)
The 7-table schema (incl. contact_provenance) consciously supersedes the databases.md §companies_contacts/§data_source_connections SKETCH — DECLARED here (per wave-5 compliance-tables precedent), not silent. 5 divergences: (a) raw_companies staging ADDED (was silent); (b) provenance — see contact-provenance below; (c) dedupe_candidates keyed (raw_company_id, matched_company_id) [staging-vs-canonical] supersedes (entity_a_id,entity_b_id); (d) sync_runs DEFERRED; (e) connection enabled-only [status/last_sync_at/sync_frequency deferred with scheduled sync]. databases.md reconciled + product-decisions entry appended.
**Contact-level provenance PRESERVED (jenny substantive, recommended fix):** ADD a `contact_provenance` table (contact_id ← raw_company_id + connection_id + ingested_at, non-null lineage per databases.md principle 3) mirroring company_provenance; dedupe engine writes it at the same promotion point. Honors the principle-3 invariant (feature #9 = this wave's screen is a named consumer).
**companies.normalized_domain UNIQUE backstop (karen MEDIUM):** ADD partial-unique `UNIQUE(companies.normalized_domain) WHERE normalized_domain IS NOT NULL` (hand-appended 0004, per 0003 precedent) — DB-level idempotent-dedup guarantee.
**rbac.test.ts edit (karen LOW):** B-1/B-2 MUST update rbac.test.ts rolesForRoute('/companies')→/sourcing/* assertion (repoint breaks it). Named step.
**cross-source-dup dedupe test = T requirement:** fixtures same-domain 2 connections → 1 canonical + 2 company_provenance (+ contact_provenance).
**manual-create out of scope:** screen = view/filter/clean only (design's +add buttons stubbed/omitted; manual add deferred).

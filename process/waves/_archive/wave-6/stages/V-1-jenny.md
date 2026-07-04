# V-1 jenny — semantic-spec verification (wave 6, deal-sourcing data spine)

**Stage:** V-1 (Verify block, jenny lane — semantic-spec, DEPLOYED-behavior-vs-SPEC-intent)
**Reviewer:** jenny (spec-vs-reality; data-correctness focus)
**Target:** deployed `918dbf0` (api `dealflow-api-production-66d4`, web `dealflow-web-production-a4f7`)
**Spec source of truth:** DB `tasks.description` (task ff378a95 + 3 siblings) incl. the P-4 remediation addendum (7 tables, contact_provenance principle-3, Delta 0 reconcile).
**Verdict: APPROVE** — drift 0 / gap 0.

Scope note: Karen owns source-claim/completeness independently. This lane verifies the deployed behavior matches spec INTENT, data-correctness first. Live probing done against `918dbf0` (health confirms deployed hash); dedupe-payoff data-plane facts cross-checked against C-2's traced live evidence (an authenticated ANALYST + temp DB proxy exercised the full sync→dedupe path against the same deployed hash) rather than re-provisioning a second time — the C-2 evidence is concrete, hash-pinned, and cleaned up. Where I could probe live directly (route existence, RBAC fail-closed, repoint) I did.

---

## Live probes I ran this stage (against 918dbf0)

| Probe | Result | Interpretation |
|---|---|---|
| `GET /health` | `{status:ok, db:ok, version:918dbf0}` | deployed hash matches target; DB connected |
| `GET /sourcing/companies` (unauth) | **401** | route exists, auth-gated fail-closed |
| `POST /sourcing/connections/:id/sync` (unauth) | **401** | route exists, auth-gated |
| `POST /sourcing/dedupe-candidates/:id/resolve` (unauth) | **401** | route exists, auth-gated |
| web `GET /sourcing/companies` (unauth) | **307 → /login** | screen exists at the repointed route, auth-gated |
| web `GET /companies` (old route) | **404** | repoint faithful — no dead old route left serving |

Full authenticated RBAC matrix (analyst 200/201, advisor/compliance 403, unauth 401 across all 4 endpoints) is the C-2 live-traced evidence; my unauth 401/307/404 probes corroborate the fail-closed edge of that matrix directly on `918dbf0`.

---

## Block 1 — connections + adapter + canonical/staging schema → **MATCHES**

- **7 tables exist (live).** C-2 confirmed all 7 present on `918dbf0` (`data_source_connections, raw_companies, companies, contacts, company_provenance, contact_provenance, dedupe_candidates`); migration 0004 (`0004_wandering_harry_osborn.sql`) is the additive-only source and creates exactly these 7 + the enum. Drizzle journal = 5 rows (0000–0004). No existing table touched (verified: 0004 is pure CREATE TABLE/INDEX + two hand-appended CREATE UNIQUE INDEX; no ALTER on users/audit/compliance).
- **DataSourceAdapter interface + fixture adapter.** `packages/shared/src/sourcing.ts:59` defines the typed `DataSourceAdapter` interface (`fetchCompanies(connection): Promise<NormalizedSourceRecord[]>`); `NormalizedSourceRecord` (sourceRecordId/name/domain/contacts[]/raw) at `sourcing.ts:19-34`. `FixtureDataSourceAdapter` (`apps/api/.../adapters/fixture.adapter.ts`) implements it, reads bundled JSON via `node:fs` (zero new dep). Interface isolates vendor-swap to one class — spec intent honored.
- **provider_key→env (no secret col).** Schema (`sourcing.ts:99-137`) stores `provider_key text` (Railway-env credential NAME) — NO `secret`/`api_key`/`credential` column exists on `data_source_connections`. Migration 0004 CREATE TABLE confirms columns are `provider_key, display_name, enabled, config, created_by, created_at` only. Adapter resolves `process.env[providerKey]` at runtime; fixture uses `FIXTURE` needing no credential. Delta 0 (e): `enabled boolean` collapses sketch's `status/last_sync_at/sync_frequency_minutes` (deferred) — reconciled in databases.md:292. MATCHES the reconciled intent.
- **companies.normalized_domain partial-unique backstop (karen MEDIUM).** Present live: `companies_normalized_domain_partial_unique ON companies(normalized_domain) WHERE normalized_domain IS NOT NULL`, hand-appended in 0004. C-2 confirmed the index exists on the deployed DB.

## Block 2 — ETL + on-demand sync → **MATCHES**

- **Idempotent upsert to staging.** `IngestionService.sync` (`ingestion.service.ts`) upserts `raw_companies` via `onConflictDoUpdate` on `(connection_id, source_record_id)` — re-sync UPDATES in place, no pile-up. Live-proven at C-2: first sync `201 {ingested:5, updated:0}`; re-sync `201 {ingested:0, updated:5}`; all row counts identical before/after.
- **POST /sourcing/connections/:id/sync (analyst/admin).** Wired in `sourcing.controller.ts:110` with `@Roles(...rolesForRoute('/sourcing/connections/:id/sync'))`; RBAC matrix `rbac.ts:198` = `['analyst','admin']`. Live: 401 unauth (my probe); analyst 201 / advisor+compliance 403 (C-2 matrix). MATCHES.
- **Writes staging only.** `IngestionService` writes ONLY `raw_companies`; the dedupe pass runs in a SEPARATE `db.transaction` invoking `DedupeEngine.promoteStaging` (`ingestion.service.ts:193`). ETL never touches canonical directly — matches the "dedupe engine owns raw→canonical" invariant.

## Block 3 — dedupe engine → **MATCHES** (this is the M3-metric load-bearing block)

- **Deterministic match (no ML).** `DedupeEngine.promoteOne` (`dedupe.engine.ts:381`): Priority 1 domain-match → auto-merge; Priority 2 name+domain-agreement → auto-merge; Priority 3 name-only / domain-conflict / partial-token-overlap → review queue; Priority 4 → new canonical. All rule-based, documented in the header. Deterministic.
- **Cross-source → 1 canonical + provenance from BOTH (the metric).** Fixture (`companies.fixture.json`) deliberately carries the cross-source dup: `grata-001` (`https://www.acme.com`) + `grata-005` (`http://acme.com/about`) both normalize to `acme.com`. Engine merges into ONE canonical + writes a 2nd `company_provenance` row. LIVE-PROVEN at C-2: `GET /sourcing/companies` → 4 canonical, acme.com = ONE canonical with 2 company_provenance rows (grata-001 + grata-005, distinct raw_company_ids); a 2nd distinct connection re-sync kept companies at 4 with `distinct_conns=2` per canonical — TRUE cross-SOURCE (not just cross-record) proof. Unit test `dedupe.engine.test.ts` (a) asserts exactly 1 canonical + 2 company_provenance both pointing to the same canonicalId.
- **NO false-positive merge.** `normalizeName` deliberately EXCLUDES `co` from stripped suffixes (`dedupe.engine.ts:210`, CRITICAL-1 fix) so "Acme Co"/"Acme Inc" don't collapse. Name-only (no domain) and name+domain-conflict route to review queue, NOT auto-merge (Priority 2/3a/3b). LIVE-PROVEN at C-2: 4 companies = 4 distinct normalized_domains (1:1); brighthorizon.vc / deltasystems.io / epsilon.ai stayed separate. No wrong merge.
- **Ambiguous → review queue.** Priority 3 writes `dedupe_candidates` (status=pending) for name-only/conflict/partial-overlap. Note: the shipped deterministic fixture produces 0 candidates (all dups are exact-domain auto-merges; all distinct records have distinct domains) — this is a CORRECT, non-fabricated outcome, not a gap. The candidate path is covered by `dedupe.engine.test.ts` (b)/(g) engine tests, and the resolve endpoint is live-wired (404 on non-existent candidate = auth+RBAC passed and reached service; 400 on bad body = Zod). This is honest: the auto-merge fixture genuinely yields no ambiguous case, and the code did not fabricate one.
- **Idempotent.** promoteStaging excludes raw rows that already have a company_provenance row AND rows with a pending candidate; provenance UNIQUE(company_id, raw_company_id) + contact UNIQUE(contact_id, raw_company_id) + companies partial-unique + dedupe_candidates partial-unique(raw,matched WHERE pending) are the DB backstops. LIVE-PROVEN idempotent re-sync (counts identical).
- **contact_provenance (principle-3) — the P-4 substantive item — PRESERVED LIVE.** `contact_provenance` table exists (schema `sourcing.ts:471`, migration 0004, live-present per C-2); `DedupeEngine.promoteContacts` (`dedupe.engine.ts:709`) writes a contact_provenance row for every contact at the same promotion point as company_provenance, non-null lineage (contact_id/raw_company_id/connection_id all NOT NULL). LIVE-PROVEN at C-2: Alice Walker (`alice@acme.com` == `ALICE@ACME.COM` case-normalized via `normalizeEmail`) deduped to ONE contact with TWO contact_provenance rows. **The invariant task-completion-validator was told to guard against silent re-drop is delivered and live-verified — not dropped under build pressure.**

## Block 4 — companies screen → **MATCHES**

- **/sourcing/companies view/filter/dedupe-review (RBAC analyst).** Screen live at `apps/web/app/(app)/sourcing/companies/page.tsx` + `_components/CompaniesClient.tsx` + `CompanyDetail.tsx` + `FilterBar.tsx`. View (master list + detail pane), filter (search name/domain, status active/archived, duplicates-only), dedupe review surfaced (pending count "· N need review", "Duplicate Risk" badge, `DedupeCandidateCard` merge/reject → `POST /sourcing/dedupe-candidates/:id/resolve`). RBAC analyst-only (`rbac.ts:186`); live 307→/login unauth. MATCHES journey row 13 (analyst persona) + companies-contacts.html.
- **NO manual-create (jenny minor from P-4).** Confirmed omitted: `CompaniesClient.tsx:446` carries the explicit `{/* +Add button is OUT OF SCOPE per wave-6 plan — omitted */}`. Grep for add/new/create in the sourcing web tree returns nothing; the design HTML's only buttons in the content area are filter/source-chip controls (nav-rail icons at 115-136 are the app sidebar, not manual-create). No dead "+add company/contact" button ships. MATCHES the P-4 IMPORT-then-CLEAN scope.
- **Repoint /companies→/sourcing/companies faithful.** Old `/companies` → 404 live (no orphan route); `rbac.ts:181-188` documents the repoint; rbac.test.ts updated for the /sourcing/* routes (karen LOW step done — 15+ wave-6 assertions in rbac.test.ts). MATCHES.

---

## Key intent checks (the M3-metric questions)

1. **Genuinely a deduped, provenance-tracked canonical company universe, all LIVE?** YES. Cross-source dedup (1 canonical from 2 sources) + NO false-positive (4 domains = 4 companies) + provenance at company (2 rows) AND contact (2 rows for Alice) level — all proven against deployed `918dbf0` at C-2, backed by the schema + engine I read. This is the real M3 spine, not a CSV stub.
2. **Thin slice honest — nothing falsely claimed as a real provider integration?** YES. Only the FIXTURE adapter ships (provider_key `FIXTURE`, bundled JSON, no env credential); the interface establishes the env-by-providerKey pattern for real adapters. Deferred items (real provider SDKs, scheduled/incremental sync, contact enrichment, sourcing-workspace page row 12, `sync_runs` history) are explicitly named as deferred in the spec, journey row 40, and databases.md:297 — none is dressed up as delivered. No false "we integrated Grata" claim anywhere.
3. **Screen matches journey row 13 + companies-contacts.html; repoint faithful?** YES (block 4 above).
4. **contact_provenance (principle-3) actually delivered live, not silently re-dropped?** YES — table present, engine writes it atomically, live-proven Alice = 1 contact + 2 contact_provenance (block 3).
5. **Any spec AC unmet live, or drift from databases.md-reconciled intent?** NONE. All 5 declared Delta-0 divergences (staging tier / provenance naming / dedupe_candidates keying / sync_runs deferral / enabled-collapse) are reconciled in databases.md:290-298 as-built notes and match the shipped schema exactly. No silent divergence.

---

## Non-blocking observations (NOT drift, NOT gaps — L-1 notes)

- **N1 (code hygiene, no functional impact).** `ingestion.service.ts:135-150` contains a dead-code exploratory block (`_existsBefore` with an always-`false` predicate + a `_r`/`return false` no-op) left in before the real per-record existence check at 153-161. It does not affect the ingested/updated split (the real check at 153 drives it) but issues an extra unnecessary `SELECT ... LIMIT 999` per record. Cosmetic/perf-only; the deployed behavior is correct (C-2 counts prove it). Flag for @code-quality-pragmatist at L-2 / a later cleanup — not a wave-6 blocker.
- **N2 (documented, acceptable).** dedupe-resolve audited-merge path (merge → contact_provenance promotion + audit entry) was not exercised end-to-end live because the deterministic fixture yields zero pending candidates; it is unit-covered (dedupe.engine.test.ts candidate-path) + endpoint-wired (404/400/403/401 live). Honest, not a gap. If a later bundle adds a fuzzy-match fixture, the live audited-merge should get one real end-to-end probe.

---

## Verdict

```yaml
jenny_verdict: APPROVE
drift_count: 0
gap_count: 0
blocks:
  block_1_schema_adapter: MATCHES
  block_2_etl_sync: MATCHES
  block_3_dedupe_engine: MATCHES
  block_4_companies_screen: MATCHES
intent_checks:
  deduped_provenance_universe_live: PASS
  thin_slice_honest: PASS
  screen_matches_journey_and_design: PASS
  contact_provenance_principle3_live: PASS
  no_spec_ac_unmet_no_databases_md_drift: PASS
non_blocking:
  - "N1: dead-code exploratory block in ingestion.service.ts:135-150 (extra SELECT/record; no functional impact) — @code-quality-pragmatist cleanup"
  - "N2: audited-merge resolve path not live-exercised (deterministic fixture = 0 pending candidates); unit-covered + endpoint-wired — honest, not a gap"
evidence_basis:
  - "live probe 918dbf0: /health hash-match; unauth 401 on all 3 API endpoints; web /sourcing/companies 307; old /companies 404"
  - "migration 0004: 7 tables additive-only + 2 hand-appended partial-unique indexes"
  - "schema/engine/adapter/controller source read directly (sourcing.ts, dedupe.engine.ts, ingestion.service.ts, sourcing.controller.ts, rbac.ts, fixture.adapter.ts, CompaniesClient.tsx, CompanyDetail.tsx)"
  - "C-2 live-traced dedupe payoff (cross-source 1-canonical+2-provenance, Alice 1-contact+2-contact_provenance, no false-positive, idempotent re-sync, RBAC matrix) against same 918dbf0 hash"
```

# V-1 Karen — Wave 7 (Sourcing-Workspace page) — Source-Claim Reality Check

**Verdict: APPROVE**
**Findings: 22 verified TRUE / 0 false / 0 blocking**

Scope: verify load-bearing CLAIMS are TRUE in the DEPLOYED state (live HTTP + files on
disk + component source). Source-claim only. No rubber-stamping — every claim was hit
with independent evidence, not inferred from green tests.

Deployed: api `0fe63de` (live `/health` version matches), web
`dealflow-web-production-a4f7`. Repo main @ `3d06636`.

---

## A. Files real (claim 1) — ALL PRESENT

| # | Claim | Evidence | Verdict |
|---|-------|----------|---------|
| 1 | `apps/web/app/(app)/sourcing/page.tsx` is the WORKSPACE, not a redirect | Read: real SSR server component, `assertRole('/sourcing', me.role)` (analyst/admin), parallel SSR fetch of connections+companies, renders `<WorkspaceClient>`. Header comment: "REPLACES the old redirect-to-companies stub." NO `redirect('/sourcing/companies')`. | TRUE |
| 2 | `_components/*` present | `WorkspaceClient, SourceFacet, DetailDrawer, SearchBar, AddConnectionForm, ResultsMatrix, SyncTrigger` all on disk | TRUE |
| 3 | `apps/api/.../sourcing.{controller,service,repository}.ts` present w/ connection create/list + companies connectionIds | All present; controller declares `POST/GET /sourcing/connections` + `POST /sourcing/connections/:id/sync` + `GET /sourcing/companies` | TRUE |
| 4 | migration `0005_*` + journal ordering | `apps/api/src/db/migrations/0005_unique_connection_display_name.sql` (ALTER TABLE ADD CONSTRAINT UNIQUE(display_name)). Journal `0005` `when=1783209598319` > `0004` `when=1783123198319` | TRUE |
| 5 | `packages/shared/src/sourcing.ts` `connectionCreateSchema` | Present (line 233): `{ providerKey: z.string().min(1), displayName: z.string().min(1), config? }`, `ConnectionCreateInput` type exported | TRUE |

Note: migrations live at `apps/api/src/db/migrations/` (not `apps/api/migrations/` as the
prompt guessed) — same content, non-blocking path discrepancy.

## B. B-6 / C-2 fixes REAL in code (claim 2) — ALL FOUR CONFIRMED

| # | Claim | Evidence | Verdict |
|---|-------|----------|---------|
| 6 | (a) `listCompanies` returns `connectionIds[]` per company via provenance array | `sourcing.repository.ts:225-241` — `count(distinct connection_id)` for sourceCount + `connectionIds: connectionIdRows.map(r => r.connectionId)` (distinct connection_id from company_provenance). Marked "CRITICAL-1 fix". | TRUE |
| 7 | (b) `createConnection` validates providerKey against adapterRegistry → 400 unknown | `sourcing.service.ts:111-116` — `adapterRegistry.getAdapter(input.providerKey)`; if null → `BadRequestException` BEFORE insert. "CRITICAL-2 fix (a)". | TRUE |
| 8 | (c) 23505 catch unwraps `err.cause.code` (not just `err.code`) → 409 | `sourcing.repository.ts:97-112` — checks `err.cause.code` FIRST (drizzle DrizzleQueryError wrap), falls back to `err.code`; `pgCode === '23505'` → `ConflictException`. Exactly the C-2 fix. | TRUE |
| 9 | (d) journal 0005 `when` > 0004 `when` | 1783209598319 > 1783123198319 (see #4) | TRUE |

## C. Actor-id + audit (claim 3) — CONFIRMED

| # | Claim | Evidence | Verdict |
|---|-------|----------|---------|
| 10 | `createConnectionAsActor` → `getUserWithRole` (app users.id, NOT raw ST id) | `sourcing.service.ts:98` `getUserWithRole(supertokensUserId)`; `appUserId = actor.id`; `createdBy: appUserId` (:124) — raw ST id never enters a users.id FK | TRUE |
| 11 | audited in-tx, action `sourcing-connection-create` | `sourcing.service.ts:118-147` — inside `runInTransaction`; `auditService.append({action:'sourcing-connection-create', actorUserId: appUserId, resourceType:'data_source_connection', ...}, tx)` — same tx as INSERT | TRUE |

## D. /sourcing is the WORKSPACE not a redirect (claim 4) — CONFIRMED (see #1)

## E. LIVE behavioral matrix (claim 5) — ALL GREEN (independent, cookie-jar, unique emails)

Minted analyst + advisor via `POST /auth/invite` → `POST /auth/signup` (rid:anti-csrf).
Unique displayName `karen-conn-<ts>` to dodge the T-5 S2 collision.

| # | Case | Expected | Observed | Verdict |
|---|------|----------|----------|---------|
| 12 | analyst `POST /sourcing/connections {fixture, karen-conn-<ts>}` | 201 | **201** `{id, providerKey:fixture, displayName, enabled:true}` | TRUE |
| 13 | dup displayName | 409 | **409** "A connection with the display name ... already exists" | TRUE |
| 14 | unknown providerKey | 400 | **400** `Unknown provider_key "totally-unknown-xyz". Registered providers: FIXTURE` (rejected BEFORE insert — not a 500) | TRUE |
| 15 | advisor `POST /sourcing/connections` + `GET /sourcing/connections` | 403 | **403 / 403** | TRUE |
| 16 | unauth `POST /sourcing/connections` + `GET /sourcing/companies` | 401 | **401 / 401** | TRUE |
| 17 | analyst `GET /sourcing` via WEB origin (web-domain cookie via web-proxy signup) | 200 workspace | **200**, 20.5KB rendered HTML; SSR shell shows "Connectors" / "Search companies" — NOT a redirect | TRUE |

## F. Deploy hash + migration applied + badges (claim 6) — CONFIRMED

| # | Claim | Evidence | Verdict |
|---|-------|----------|---------|
| 18 | live `/health` version == `0fe63de` | `{"status":"ok","db":"ok","version":"0fe63de"}` | TRUE |
| 19 | migration 0005 applied (UNIQUE on display_name) | Proven live: dup displayName → 409 (constraint enforced in prod DB) — #13 | TRUE |
| 20 | `connectionIds` returned by GET /sourcing/companies (badges not '—') | Live: after sync, `Acme Technologies Inc.` returns `connectionIds:[...]`, `sourceCount>=1`. Component `ResultsMatrix.tsx:302-397` resolves badges from real `connectionIds → displayName` (AC-BADGE); NO literal PitchBook/Crunchbase in served HTML | TRUE |
| 21 | **≥2-source facet REAL against real rows** (M3 metric) | Live: 2 enabled fixture connections (`t5-src-A` + `karen-conn-<ts>`); after syncing both, 4 companies show **sourceCount=2** with 2 distinct connectionIds each. Metric verifiable end-to-end. | TRUE |

## G. Reuse (claim 7) — CONFIRMED

| # | Claim | Evidence | Verdict |
|---|-------|----------|---------|
| 22 | trigger-sync reuses wave-6 `POST /sync` (not re-implemented); search = canonical companies | Controller `syncConnection` → `sourcingService.syncConnection(id)` (wave-6 ETL→dedupe→canonical); live sync returned `{ingested:5, updated:0}`. Search = `GET /sourcing/companies` (canonical deduped universe, `count(distinct)` provenance). | TRUE |

## AC surface (P-4 remediation) — MET
- **AC-SEED:** POST /sourcing/connections create endpoint real, RBAC analyst/admin, audited, actor=app users.id. ≥2-source facet verified against REAL created rows (not test-only inserts). ✔
- **AC-BADGE:** badges from real `data_source_connections.displayName`; no literal PitchBook/Crunchbase shipped (grep=0 in served HTML; component uses displayName). ✔
- **AC-CTA:** Review-Import CTA → `/sourcing/companies` hand-off (`WorkspaceClient.tsx:270`, `DetailDrawer.tsx:275`), NOT the deferred in-page modal. ✔

## Notes / non-blocking
- Migration path is `apps/api/src/db/migrations/` not `apps/api/migrations/` (prompt guess) — content correct.
- `__drizzle_migrations` row count not directly queried: local `CLAUDOMAT_DB_URL` points at a
  different (empty) DB than production; production DB is not reachable via SQL from this env.
  Migration-applied is instead proven behaviorally (live 409 = UNIQUE constraint enforced in prod). Non-blocking.
- Web `GET /sourcing` returns 307 when hit with an API-domain cookie jar — expected host-scoped-cookie
  behavior, NOT a page defect; genuine 200 obtained with a web-domain cookie (#17).
- SSR HTML is a hydration shell; connection badges + CTA link render client-side in WorkspaceClient
  after hydration. Data-layer correctness proven independently via the API (#20, #21).

**No blocking gaps. Every load-bearing claim verified TRUE against the deployed state. APPROVE.**

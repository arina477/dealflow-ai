# V-1 Karen — Wave 6 (deal-sourcing data spine) — Source-Claim Verification

**Reviewer:** Karen (V-1, source-claim only; jenny owns spec-semantics)
**Focus:** data-correctness of the dedupe engine (the load-bearing case) + deployed-state truth.
**Deployed artifact:** `918dbf0` (confirmed live via `/health`). Repo main HEAD `63b9473`.
**Verdict:** **APPROVE**

---

## Headline

Every load-bearing CLAIM is TRUE in the deployed state. Critically, **the code I audited on disk IS the deployed code** — `git diff --stat 918dbf0..63b9473` over `modules/sourcing/`, `db/schema/sourcing.ts`, `migrations/0004*`, and the web screen is **EMPTY** (zero changes since deploy), and `918dbf0` is a confirmed ancestor of main HEAD. So static code verification here is verification of the deployed behavior, not of a drifted tree.

Dedupe correctness — the hard part — holds: no false-positive merge path, provenance written on BOTH merge paths, candidate + resolve idempotency real, atomic single-winner resolve. 41/41 dedupe engine tests pass locally.

**One honest caveat (does NOT block):** the live end-to-end payoff (mint analyst + seed fixture connection + POST sync → observe 1 canonical + 2 provenance in the live DB) could NOT be independently re-run this pass. The postgres service exposes no TCP proxy right now (`DATABASE_PUBLIC_URL` resolves to `postgres:…@:/railway` — empty host:port; C-2's temp proxy is torn down), signup is invite-only, and no prod-fixture creds are populated in `test-accounts.md`. Per V-1 instructions, I fell back to cross-checking the C-2 live evidence — which is detailed, internally consistent, gated APPROVED by head-ci-cd, and corroborated by the zero-drift provenance chain above. I verified the live layer to the depth reachable without creds/proxy: `/health` hash, unauth 401.

---

## Findings (claim → evidence)

### 1. Files real — TRUE
- `apps/api/src/db/schema/sourcing.ts`: 7 `pgTable(...)` decls present — `data_source_connections`, `raw_companies`, `companies`, `contacts`, `company_provenance`, `contact_provenance`, `dedupe_candidates` (+ `dedupe_candidate_status` pgEnum).
- `migrations/0004_wandering_harry_osborn.sql` (+ `.down.sql`); `meta/_journal.json` contains `0004` (grep -c = 1).
- Partial-uniques present in 0004 (lines 106/114): `companies_normalized_domain_partial_unique … WHERE "normalized_domain" IS NOT NULL`; `dedupe_candidates_raw_matched_pending_unique ("raw_company_id","matched_company_id") WHERE status = 'pending'`; provenance UNIQUEs `company_provenance_company_raw_unique`, `contact_provenance_contact_raw_unique`.
- Module files all present: `dedupe.engine.ts`, `ingestion.service.ts`, `sourcing.service.ts`, `sourcing.repository.ts`, `adapters/fixture.adapter.ts`, `sourcing.module.ts`, `fixtures/companies.fixture.json`, `sourcing.di-boot.spec.ts`. (Note: claim also references `adapters/` which additionally holds `adapter.registry.ts` — superset, fine.)
- `apps/web/app/(app)/sourcing/companies/`: `page.tsx`, `[id]/`, `_components/`, `page.test.tsx`.

### 2. Dedupe correctness in CODE (load-bearing) — TRUE, all four sub-claims
- **(a) NO false-positive merge.** `dedupe.engine.ts:210` — `CORP_SUFFIX_RE = /(?:^|\s)(inc|llc|ltd|corp|plc|gmbh|limited|incorporated|lp|llp|sa|ag|bv|nv)$/`. **`co` is deliberately ABSENT** (documented at :36, :206 as CRITICAL-1). Name-only never auto-merges: `promoteOne` (:414–:455) — an exact name match only auto-merges when `domainsAgree` (both non-null, equal); name-only (no domain) and name+domain-conflict both route to `insertDedupeCandidate` (pending), NOT merge, NOT new-canonical. Domain match (Priority 1, :387) is the only unconditional auto-merge, and it requires equal non-null `normalized_domain`.
- **(b) contact_provenance on BOTH merge paths.** Auto-merge: `mergeInto` (:558) → `company_provenance` insert (:594, onConflictDoNothing) + `promoteContacts` which writes `contact_provenance` (:766, onConflictDoNothing). Human-merge: `sourcing.repository.ts mergeRawIntoCanonical` (:242) explicitly `new DedupeEngine().mergeInto(...)` (:295–:298) — SAME implementation, no drift. Both company- and contact-provenance written on the human path via that delegation.
- **(c) candidate-idempotency.** `promoteStaging` (:313) builds `pendingCandidateIdSet` (:328–:334) and filters raws that already have a pending candidate (:344) BEFORE calling `promoteOne`; `insertDedupeCandidate` uses `.onConflictDoNothing` on the partial-unique `(raw_company_id, matched_company_id) WHERE status='pending'` (:801). Two-layer guard, as claimed.
- **(d) atomic resolve.** `findDedupeCandidateByIdForUpdate` = `SELECT … FOR UPDATE` inside tx (repo :284+); `updateDedupeCandidateStatus` conditional `UPDATE … WHERE id=? AND status='pending'` (:330) → 0 rows on the loser → ConflictException. Single-winner confirmed (CRITICAL-3).

### 3. DI boot fix — TRUE
`sourcing.service.ts` uses VALUE imports (no `import type`) for `AuditService` (:44), `AuthRepository` (:46), `IngestionService` (:48). `sourcing.di-boot.spec.ts` present; asserts `design:paramtypes[0]` non-undefined + full `TestingModule.compile()` of `SourcingModule` (would throw `UnknownDependenciesException` under `import type`).

### 4. Fixture-asset fix — TRUE
`apps/api/nest-cli.json` has `assets` glob `modules/sourcing/fixtures/**/*.json`. This is the `918dbf0` fix (`git show 918dbf0` = "copy sourcing fixture JSON to dist (nest-cli assets)"). C-2 confirmed fixture lands in `dist/` at 1290 bytes and sync went 500→201.

### 5. Env-secrets — TRUE
`data_source_connections` columns = `provider_key text NOT NULL`, `display_name`, `enabled boolean`, `config jsonb` — **NO** `secret` / `api_key` / `credential` / `password` / `token` column (schema-asserted at :107). Secret-grep of the wave-6 diff CLEAN (T-8 `secret_grep_findings: []`). Fixture adapter reads bundled JSON via `readFileSync` and needs no credential; real adapters resolve `process.env[providerKey]` at runtime (pattern documented, no secret persisted).

### 6. LIVE payoff — CROSS-CHECKED (independent live re-run not feasible this pass; see caveat)
- Independent live checks I ran: `/health` → `{"status":"ok","db":"ok","version":"918dbf0"}`; unauth `GET /sourcing/companies` → **401**; web root → 307 (redirect to auth, expected).
- C-2 live evidence (against the same `918dbf0`, head-ci-cd APPROVED) — cross-checked as genuine + internally consistent:
  - `POST /sourcing/connections/:id/sync` (analyst+rid) → **201 `{ingested:5,updated:0}`**.
  - `GET /sourcing/companies` → **4 canonical**; `acme.com` = **ONE** canonical (grata-001 + grata-005) with **2 company_provenance** rows; Alice `alice@acme.com`==`ALICE@ACME.COM` → **1 contact + 2 contact_provenance**.
  - 2nd distinct connection re-sync → companies stayed **4**, `distinct_conns=2` per canonical → true cross-SOURCE dedup.
  - False-positive guard: 4 companies = 4 distinct `normalized_domain` (`brighthorizon.vc`/`deltasystems.io`/`epsilon.ai` stayed separate).
  - Idempotent re-sync → **201 `{ingested:0,updated:5}`**; all row counts identical (no pile-up).
  - RBAC live matrix: analyst 200/201, advisor/compliance **403**, unauth **401** across all 4 endpoints.
- Fixture on disk corroborates: `acme.com` appears 5× (2 records = cross-source dup: grata-001, grata-005), matching the C-2 count.

### 7. Deploy hash + migration + actor-translation — TRUE
- Live `/health` version == **918dbf0** (deployed). `918dbf0` is a confirmed **ancestor of main HEAD** `63b9473`, and the sourcing/schema/migration/web diff between them is **EMPTY** → deployed == audited code.
- Migration 0004 applies 7 tables (down migration drops ONLY the 7 new tables + 2 indexes + enum, in FK order — additive/safe, no existing table touched). C-2 confirmed all 7 present live + the 3 guard indexes.
- Actor-id translation: `sourcing.service.ts:164` `this.authRepository.getUserWithRole(supertokensUserId)` in `resolveDedupeCandidateAsActor` → 403 if null → maps SuperTokens id to app `users.id` before audit/resolvedBy writes (wave-5 lesson honored).

---

## Non-blocking notes (for the record, not REWORK)
- **N1 (LOW):** `dedupe.engine.test.ts` (41 tests, all pass) runs against an in-memory store mock that *models* the partial-unique idempotency in the harness rather than exercising it against real Postgres. The engine branch logic is genuinely asserted (cross-source → 1 canonical + 2 provenance; ambiguous → pending; idempotent re-run). The real-DB idempotency backstop was proven at C-2 live. Acceptable for MVP; flagging so L-2 knows the DB-constraint path's only live proof is C-2, not the unit suite.
- **N2 (INFO):** Live independent re-run of the dedupe payoff was blocked by no TCP proxy + invite-only signup + empty prod-fixture creds. Not a wave defect. If a future V-block wants Karen to independently reproduce live, a standing read-only proxy or a populated `test-accounts.md` analyst is needed.

**Verdict: APPROVE** — 7 claim-groups verified TRUE; 2 non-blocking notes.

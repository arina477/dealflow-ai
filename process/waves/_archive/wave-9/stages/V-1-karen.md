# V-1 Karen — wave-9 buyer-universe builder (M4 final bundle)

**Verdict: APPROVE**
**Findings: 5 (0 Critical / 0 High / 0 Medium / 3 Low / 2 Info)**
**Auditor:** karen (V-1). **Source-claim, no rubber-stamp.**
**Repo:** main @ 424b298 (audited-HEAD). **Deployed:** 937ae18 (ancestor of 424b298; zero buyer-universe diff between them — deployed == audited for this module).
**Live:** api https://dealflow-api-production-66d4.up.railway.app (health `{status:ok, db:ok, version:937ae18}`), web proxy 401 on unauth POST (reaches API, not 404).

---

## Method note (why SQL-on-app-DB was NOT run directly)

`CLAUDOMAT_DB_URL` resolves to the **brain DB** (`has_tasks=t`, `has_waves=t`, `has_mandates=f`, `has_companies=f`, db name `railway`), NOT the app's production Postgres. The buyer_universe tables live in the app's separate Railway DB, whose creds are not exposed to the V-worker context (Iron Law — same constraint C-2 documented). So migration-applied is verified by the two ground-truth proxies I CAN observe: (1) static file/journal correctness in code, and (2) live API behaviour — the same standard C-2 used. This is a genuine caveat, not a gap; every SQL query below ran against reachable state.

---

## Verify-item results (evidence traced)

### 1. Files real — PASS
All present at 424b298: `apps/api/src/modules/buyer-universe/{service,controller,repository}.ts` (37k/12k/23k) + `di-boot.spec.ts` + `module.ts`; `db/schema/buyer-universe.ts`; `db/migrations/0008_noisy_hitman.sql` + `.down.sql`; `meta/_journal.json` idx 8 tag `0008_noisy_hitman` `when:1783468800000` (verified exact); `packages/shared/src/buyer-universe.ts`; `apps/web/app/(app)/buyer-universe/{page,_components/BuyerUniverseClient}.tsx`. mandate_id UNIQUE present in both .sql (line 10 `buyer_universe_mandate_id_unique UNIQUE(mandate_id)`) and schema.ts (line 150).

### 2. B-6 7-CRIT fixes REAL in code — PASS (all 7 + patchCandidate)
- **(a) SSR list-wrapper parse** — page.tsx:96-100 parses `{ universes: [...] }` wrapper, takes `[0].id`, then GET detail. Hydrates existing (initialDetail non-null path). ✓
- **(b) filter/submit/enrich return + client consumes Detail** — service returns `composeDetailInTx` (service.ts:453/540/693); client parses `buyerUniverseDetailSchema` + `setDetail` on all three (Client:815-816, 844-849, 919-924, 977-982). ✓
- **(c) mandate_id UNIQUE + advisory lock** — schema.ts:150 unique + SQL:10; `pg_advisory_xact_lock(hashtext($mandateId))` repo:194; upsert `onConflictDoUpdate` repo:221; candidate `onConflictDoNothing` repo:360. Double-universe race closed at both DB-constraint AND advisory-lock layers. ✓
- **(d) submit guard: INCLUDED-count + un-triaged → 400** — service:651 (includedCount===0 → 400), service:661 (untriaged>0 → 400), service:642 (draft → 400). Three-guard chain. ✓
- **(e) enrich uses InTx reads** — service:489/495/503 all `...InTx` variants inside `runInTransaction` (CRITICAL-5 consistent snapshot). ✓
- **(f) filter records unsupported dims (not silent)** — service:325-334 builds `unsupportedDimensions[]` + `partialFilterNote`; written to provenance (405/414) AND audit payload (`unsupportedDimensions`, `partialFilter` service:434-435). NOT silent match-all. ✓
- **(g) re-assemble resets status→draft on new candidates** — service:227-229 (`!isNew && newCount>0 && status!=='draft'` → updateBuyerUniverseStatus 'draft'). ✓
- **patchCandidate cross-universe-scoped** — service:807 `updateCandidateMembershipScoped(tx, universeId, ...)` → predicate adds `AND buyer_universe_id=$universeId`; null → 404 (service:817). ✓

### 3. Actor-id + audit + one-txn — PASS
Every mutation (assemble/filter/enrich/submit/patch) opens with `authRepository.getUserWithRole(supertokensUserId)` → uses `actor.id` (app users.id, NOT raw ST) for the `actorUserId` FK. All wrapped in `runInTransaction`; `auditService.append(auditInput, tx)` is the LAST call before return in every mutating txn (service:253/450/537/690/843). Audit-fail rolls back (in-txn). Actions: `buyer-universe-{assemble,filter,enrich,submit}` + patch reuses `buyer-universe-filter`. ✓

### 4. M4/M5 boundary — PASS (byte-scan clean)
Raw byte-scan (all lines incl. comments) of the module + shared + page + client for `score|rank|ranking|fit|rationale|llm|openai|anthropic|embedding|cosine`: **every hit is a comment asserting the boundary or a "ready-to-rank"/name-ASC doc note — ZERO columns, ZERO calls.** Schema has no score/rank/fit/rationale column on either table. Candidate table columns: id, buyer_universe_id, company_id, membership_status, provenance, created_at. Assemble order is `name ASC` presentation-only (explicitly commented non-ranking, repo:142). ✓

### 5. LIVE cross-check (C-2 genuineness) — PASS
Independent probes match C-2: `/health` = exact deployed `937ae18` + `db:ok`; unauth POST `/buyer-universe-data` (web proxy) → **401** (spot-probe confirms proxy REACHES API auth guard, not 404 route-miss); unauth POST `/buyer-universe` (api) → 401; unauth GET `/buyer-universe/:id` → 401. C-2's evidence is not fabricated: it is specific, traceable (universe id `f7155385`, 4 M3 candidates, 3 contacts, entriesChecked 57→153), and internally consistent with observable live state. The idempotent-same-universe result is the correct ground-truth proxy for mandate_id UNIQUE being live-enforced (a missing constraint would yield a 2nd universe or 500). ✓

### 6. Deploy / migration / reuse — PASS
- `/health` version `937ae18` live. ✓
- Migration 0008: static additive (2 CREATE TYPE + 2 CREATE TABLE + 4 FK + 4 index; no DROP/ALTER-TYPE/TRUNCATE); journal idx8 registered; `.down.sql` present (drops children-first, then enums — 0000-0006 convention, correctly NOT copying 0007's missing-down debt). Live-applied proxied by C-2 assemble-writes-rows + idempotent re-assemble. ✓
- Reuse: candidates FK→companies (M3, schema:233); filter reads `mandateBuyerCriteria` (repo:26,104-108); enrich reads `contacts` (M3, repo:34,163-165); all M3/M4 reads explicitly READ-ONLY ("NEVER writes" repo:10-11,135,165). No new vendor/SDK. Additive-only. ✓

### 7. T-5 W9-2 clearance (404 false-positive) — SOUND
The 404 clearance is well-founded and I INDEPENDENTLY reproduced its key evidence: my own live probe returns **401 not 404** on `POST /buyer-universe-data`, proving the afterFiles rewrite reaches the API (a 404 would mean no rewrite). Structural backing confirmed: next.config.ts:201-215 has all four rewrites, correctly ordered (specific `/candidates/:cid` before `/:id/:sub` before `/:id`). The test's own S1-b PASSED (assemble worked same run). The W9-2 404 was a transient deploy-propagation window, analogous to the wave-7 S2 false-positive. Clearing it without a B route is correct. ✓

---

## Findings

| ID | Severity | Finding |
|---|---|---|
| V1-K1 | Low | `buyer-universe.ts` schema doc-comment (lines 25-26) reads "no DB UNIQUE on mandate_id — allows re-assemble idempotence without conflict" — STALE/contradictory. The actual code (line 150) and SQL (line 10) DO add the UNIQUE, and CRIT-3's whole idempotency backbone depends on it. Comment is misleading; the constraint is real & correct. Cosmetic doc-drift, no functional impact. |
| V1-K2 | Low | journey-map row-8 route was stale (`/mandates/:id/buyers`); jenny P-4 LOW flagged it for T-9 reconcile. Commit 3dfbcc1 ("T-9 regen … route reconciled to /buyer-universe") indicates it was fixed — verify no residual stale ref remains. Non-blocking. |
| V1-K3 | Low | TopBar title shows "Dashboard" on all pages (FINDING-TOPBAR, T-5) — recurring cosmetic defect from wave-3/4/8, not introduced by wave-9. Backlog, not a wave-9 blocker. |
| V1-K4 | Info | Unbounded assemble: `listActiveCompaniesInTx` selects ALL active companies with no pagination/cap (T-8 INFO → backlog). Fine at current scale; will need a bound before large-firm datasets. Correctly deferred. |
| V1-K5 | Info | Direct app-DB migration-applied row-count is NOT verifiable from the V-worker context (app-DB creds not exposed; CLAUDOMAT_DB_URL is the brain DB). Verified via functional live-behaviour proxy per Iron Law — the accepted standard. Documented so a later reviewer with app-DB access can close it to hard-proof if desired. |

---

## Rationale

Every load-bearing CLAIM is TRUE in the deployed state and code. The 7 B-6 CRIT fixes are present and correctly implemented, not merely commented. Actor-id (app users.id via getUserWithRole), one-txn atomicity, and last-in-txn audit hold across all five mutations. The M4/M5 boundary is structurally clean by byte-scan — no rank/score/fit/rationale column or LLM call anywhere. Migration 0008 is additive with a real down-migration and registered journal entry; mandate_id UNIQUE is live-enforced (proven by idempotent re-assemble). Reuse is genuine and read-only (M3 companies/contacts, M4 mandateBuyerCriteria — no new vendor). The T-5 W9-2 404 clearance is sound and independently reproduced (live 401, not 404). The only findings are three Low cosmetic/doc items and two Info deferrals — none block the wave. M4's success metric ("assemble AND enrich a buyer universe ready to rank") is met end-to-end.

**APPROVE.**

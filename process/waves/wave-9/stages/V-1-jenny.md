# V-1 — jenny (semantic-spec verification) · wave-9 buyer-universe builder (M4 FINAL)

**Verdict: APPROVE** — drift: 0 · gaps: 0 (2 non-blocking cosmetic notes, 0 spec-drift / 0 metric-gap)

**Scope of this review:** semantic-spec only — does deployed behavior match the SPEC CONTRACT intent, and does this bundle genuinely COMPLETE M4 without leaking M5 scope? (Karen owns source-claim/build-reality.) Method: DB spec-contract (3 blocks + P-4 karen/jenny notes) → M4/M5 milestone prose → C-2 + T-5 deployed evidence → live independent spot-probes → actual source (service/controller/schema/shared-contracts/page/client) → design + journey reconciliation.

**Deploy verified live (independent probes this session):**
- `GET /health` → `{"status":"ok","db":"ok","version":"937ae18"}` — exact deployed hash, db reachable.
- anon `POST /buyer-universe` → **401** (auth guard reached).
- web `GET /buyer-universe` (no session) → **307 → /login** (RBAC redirect).

---

## Per-block verdict

### Block 1 — Spine (92a8ff3f: schema + assemble/filter service) — **MATCHES**

| AC | Verdict | Evidence |
|---|---|---|
| assemble persists `buyer_universe` (one per mandate, FK→mandates) + `buyer_universe_candidates` from M3 companies (FK→companies + FK→buyer_universe; default `candidate` + provenance) | MATCHES | `buyer-universe.ts` schema: both tables, FKs→mandates/users/companies, membership enum `candidate\|included\|excluded`, `provenance text`. `service.assembleAsActor` selects M3 companies (`listActiveCompaniesInTx`), inserts candidates `provenance:'assembled from sourcing'`. C-2 live: assemble 201, 4 candidates M3-sourced. |
| filter narrows per mandate criteria dims, records include/exclude per candidate (audit provenance) | MATCHES | `filterAsActor` reads `mandateBuyerCriteria`, writes membership + provenance per candidate, status→`filtered`. C-2 live: filter→Detail, `universeStatus=filtered`. |
| listable via shared-Zod GET; assemble+filter+list endpoints | MATCHES | controller: `@Post()`, `@Post(':id/filter')`, `@Get()` (list by mandate), `@Get(':id')`. Shared Zod `buyerUniverse*Schema`. T-3 contract: "No drift." |
| RBAC analyst-primary (+advisor/admin); anon 401 / unauth-role 403; audited LAST-IN-TXN; actor = app `users.id` via `getUserWithRole` | MATCHES | `BUYER_UNIVERSE_ROLES` from `rolesForRoute('/buyer-universe')`, fail-closed boot assertion. Every mutation resolves `getUserWithRole` → `appUserId` (never raw ST id), `auditService.append(..., tx)` last-in-txn. C-2/T-8 live: anon 401, compliance 403, analyst 2xx; audit chain ok (153 entries). Independent probe reconfirms anon 401. |
| ALL schema additive; NO scoring/ranking/rationale/LLM | MATCHES | migration 0008 additive (2 enums + 2 tables, C-2 destructive-DDL grep clean). Schema/service/shared carry NO score/rank/fit/rationale column or field. |

Edge cases confirmed: empty universe (no crash), idempotent re-assemble (**same universe id live** — `mandate_id UNIQUE` + `onConflictDoNothing` on `(buyer_universe_id, company_id)`), DrizzleError-unwrap pattern present.

**Note (non-blocking, cosmetic):** the schema docstring at `buyer-universe.ts` says *"no DB UNIQUE on mandate_id"*, but the code **does** add `unique('buyer_universe_mandate_id_unique').on(table.mandateId)` (and C-2 proved it live-enforced via idempotent re-assemble). This aligns with the correct/stronger disposition — the DB UNIQUE is the authoritative idempotency guard. Only the stale comment lags the code; no behavioral drift. (Karen's lane if worth a one-line fix.)

### Block 2 — Page (394a60ba: /buyer-universe SSR) — **MATCHES**

| AC | Verdict | Evidence |
|---|---|---|
| `/buyer-universe` (assemble/filter/review, include/exclude); RBAC analyst/advisor/admin per design | MATCHES | `page.tsx` server component: `assertRole('/buyer-universe', me.role)`; `BuyerUniverseClient` renders candidate table (company + membership + provenance) with include/exclude toggle. |
| SSR-hydrated (server fetches universe+candidates, serializable props; NO client fetch to page-route path) | MATCHES | `page.tsx` SSR-fetches via `apiBase()` (internal API, not page route), passes `initialDetail`. C-2 live: web-origin GET renders candidate `<table>` w/ real universe id, zero empty-state markers; negative control shows Assemble CTA — two states genuinely differ. |
| mounts on wave-8 mandate-detail D6 anchor | MATCHES | C-2 + T-5 S1-a/S5-f: mandate-detail "Open Buyer Universe" link `href=/buyer-universe?mandateId=…` live (D6 placeholder replaced). |
| mutations via apiFetch (rid); read-schema accepts real serialization; empty state no-crash | MATCHES | client uses `apiFetch` + `/buyer-universe-data` non-page-colliding proxy (next.config rewrites, T-5 orchestrator cleared the W9-2 404 as a deploy-propagation artifact — live re-probe returned 401 not 404). `buyerUniverseDetailSchema` passthrough. |

Design fidelity: `design/buyer-universe.html` sections (Assemble/Filter/Enrich/Gap/Submit/Include/Exclude) map 1:1 to the shipped client. NO score/rank/fit column in either design or client (`BuyerUniverseClient` `<th>` set = Company/Membership/Provenance/contacts).

### Block 3 — Enrich/flag/submit (c907731f) — **MATCHES**

| AC | Verdict | Evidence |
|---|---|---|
| enrich each included candidate with its M3 contacts (existing store, NOT new vendor); viewable per candidate | MATCHES | `enrichAsActor` reads M3 contacts via `findContactsByCompanyIdsInTx` (read-only join; no writes to companies/contacts, no SDK). C-2 live: enrich→Detail, included candidate got 3 M3 contacts. |
| flag gaps (no contacts / missing fields) | MATCHES | `getGaps` flags included candidates with 0 contacts OR all-null emails, reason strings. `GET /:id/gaps` endpoint. |
| submit-to-matching marks ready-to-rank (`submitted`); handoff M5 reads; NO ranking; audited | MATCHES | `submitAsActor` status→`submitted`, audited. Guards: draft→400, 0-included→400 (CRITICAL-4), untriaged rows→400 (CRITICAL-7). C-2 live: all 3 guards fire; valid submit→`submitted`. |

Edge cases confirmed: candidate with no M3 contacts → flagged not crashed; submit-empty guarded (400); no ranking (byte-scan 0 rank/score/fit/rationale, C-2).

---

## Key intent checks

**1. M4 SUCCESS METRIC completion (THE key check) — HONESTLY DELIVERED.**
M4 metric 2nd half = "an analyst can ASSEMBLE AND ENRICH a buyer universe... READY TO RANK." Every verb is present, live-proven, and genuine (not faked):
- **assemble** — `assembleAsActor` persists universe + M3-sourced candidates; C-2 live 201 + 4 candidates.
- **enrich** — `enrichAsActor` attaches real M3 contacts; C-2 live 3 contacts on the included candidate.
- **ready-to-rank** — `submitAsActor` → `status=submitted` (the M5-read handoff), guarded against empty/draft/untriaged; C-2 live submit→submitted.
Combined with wave-8's shipped mandate spine (create + criteria + compliance), **M4's full metric is now complete**. Product-decisions confirms this is the final M4 bundle (M4 `## Scope` fully decomposed). Not done-theater: the flow is DOM/JSON-verified against the live artifact at C-2 (first-try) and T-5 (14/14).

**2. M4/M5 boundary — POLICED, CLEAN, no leak / no under-deliver.**
M5's flagship (`## Scope`) = deterministic pre-score + LLM ranked matching + integer fit-scores + rationale + accept/reject shortlist. This bundle contains **none** of it — verified at four layers: schema (no score/rank/fit column), shared Zod (grep confirms only the boundary comment, no field), service (byte-scan comment + no ranking logic; assemble order is name-ASC presentation-only, explicitly documented non-ranking), client (no score column). The design's one "rank" string (html:685) is descriptive copy explaining *why* enrichment matters to the future Matching Engine — an honest forward-reference to M5, not a rendered rank/score. **"ready to rank" = submitted + filtered + enriched persisted rows = the honest handoff M5 reads.** No M5 leak; no M4 under-delivery.

**3. Honest partial-filter (wave-8 D1 gap closed) — RIGHT DISPOSITION.**
M3 companies carry only `sector`. `filterAsActor` (CRITICAL-6) evaluates only the supported `industry→sector` dim (with tightened token-match, not the over-broad substring that was the wave-8 D1 root cause), and for `geo`/`sizeBand`/`dealType` records them in `unsupportedDimensions` + a `partialFilterNote` in each candidate's provenance + `partialFilter:true` in the audit payload — **not a silent match-all, not a false "filtered" claim.** C-2 live confirms the honest provenance string ("geo criteria not applied — pending enrichment"). This is the correct honest disposition: the system tells the analyst the filter is partial rather than overclaiming.

**4. Reuse — GENUINE, no re-invent.**
Candidates ARE M3 companies (FK→`companies`; service is read-only consumer, never writes). Filter uses M4 `mandateBuyerCriteria` (wave-8-persisted). Enrich uses EXISTING M3 contacts (`findContactsByCompanyIds`, no vendor/SDK — the real enrichment provider correctly stays deferred to M9). No new company/contact store invented.

**5. Compliance/integrity intent — CONSISTENT with compliance-first product.**
Idempotent re-assemble (one universe per mandate, DB UNIQUE + advisory lock, live-proven). Submit-guard chain prevents an empty/draft/untriaged universe reaching M5 (avoids M5 choking on submitted-empty). Every mutation audited LAST-IN-TXN via M2 HMAC chain (rollback on audit-fail); chain verified intact live (153 entries). Actor = app `users.id`. Additive-only schema. All consistent with the audit-first regime.

**6. Nothing invented / nothing omitted; page matches design.**
No behavior beyond journey/design/M4-scope. Journey row-8 route reconciled at T-9 (`/mandates/:id/buyers` stale → `/buyer-universe` live) — the jenny P-4 LOW fix closed. Design→client fidelity holds (sections + no-rank-column match).

---

## Non-blocking notes (NOT drift, NOT gaps — for the record)
- **[COSMETIC-1]** Stale schema docstring says "no DB UNIQUE on mandate_id" while the code adds it (correct/stronger). Comment-only lag; C-2 proved the constraint live-enforced. One-line comment fix if desired.
- **[COSMETIC-2]** Recurring TopBar title "Dashboard" on all pages (pre-existing wave-3/4/8 defect, T-5 FINDING-TOPBAR, low) — not wave-9-introduced, not an M4-metric requirement.

## Verdict
**APPROVE.** All three spec blocks MATCH the deployed behavior. M4's success metric is honestly and completely delivered (assemble + enrich + ready-to-rank, every verb live-proven). The M4/M5 boundary is clean at all four layers with zero ranking/scoring/rationale/LLM leak. The honest partial-filter disposition closes the wave-8 D1 gap correctly. Reuse is genuine; compliance/audit integrity holds. This is the final M4 bundle and it completes M4.

drift: 0 · gaps: 0

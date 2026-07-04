# V-1 Karen — wave-8 mandate spine + create/list/detail

**Agent:** karen (reality-check, source-claim + deployed-state)
**Stage:** V-1 (parallel with jenny)
**Repo:** main tip `e57be83`; **deployed** `46642e7` (live `/health` version confirmed)
**Live:** api `https://dealflow-api-production-66d4.up.railway.app` · web `https://dealflow-web-production-a4f7.up.railway.app`
**Method:** file-on-disk reads + independent live HTTP (own advisor/analyst sessions minted via `/auth/invite`→`/auth/signup`, cookie jar, `rid: anti-csrf`, unique emails) + git ancestry. Did NOT rubber-stamp C-2 — re-ran the load-bearing live invariants myself.

## VERDICT: **APPROVE**

Every load-bearing CLAIM is TRUE in both the code (main `e57be83`) and the DEPLOYED state (`46642e7`). The create→derive→audit→active-lock→detail vertical is proven working live by my own HTTP calls, not inferred from green tests. The two T-block fixes on main-but-not-deployed are correctly scoped as defense-in-depth / cosmetic and are acceptable to ship next deploy because the load-bearing enforcement is already live and independently re-verified.

---

## Findings (18)

### Files & migrations (claim 1) — PASS
1. **All 14 source files exist on disk.** service (427L), controller (246L), repository (484L), `db/schema/mandate.ts` (290L), `packages/shared/src/mandate.ts` (298L), web `page.tsx`/`new/page.tsx`/`[id]/page.tsx` + `_components/{MandateForm,MandateListClient,MandateDetailClient,StatusFilter,DeferredPlaceholder}.tsx`. **PASS.**
2. **Migrations 0006 + 0007 present + journal-registered ascending.** `_journal.json` idx 6 (`when` 1783296000000) + idx 7 (1783382400000), both after idx 5. 0006 = enum + 3 CREATE TABLE + FK/index (additive). 0007 = partial unique index. **PASS.**

### B-6 + C-2 + T fixes real in code @ e57be83 (claim 2) — PASS (8/8)
3. **(2a) `configureAsActor` returns `MandateDetail`** (service:214-218 signature `Promise<MandateDetail>`; returns `{mandate, buyerCriteria, complianceProfile}` at 308-332) — the PATCH-crash fix. **PASS.** Live-confirmed: PATCH returns wrapped `{"mandate":{…}}`.
4. **(2b) Active-mandate state-machine lock** (service:240-245 `if existing.status==='active' → ConflictException` 409; comment confirms active→draft also blocked). **PASS.** Live: edit-active 409, active→draft 409.
5. **(2c) Disclaimer derive deterministic + ambiguity→409 + migration 0007.** repository `findActiveDisclaimerByJurisdiction` `.orderBy(version DESC)` (repo:119); `>1 active` → `ConflictException` (repo:125); 0007 creates partial unique index `disclaimer_templates_one_active_per_jurisdiction_idx … WHERE active=true`. **PASS.**
6. **(2d) next.config: NO `/mandates` or `/mandates/:id` rewrite; `/mandates-data` + `/mandates-data/:id` present** (next.config:174-179; removal + rationale documented lines 153-172). **PASS.** Live: web `/mandates/:id` served by Next.js (`x-powered-by: Next.js`, `text/html`), NOT Express — DEFECT-1 genuinely fixed.
7. **(2e) MandateForm reads flat `created.id` via `mandateSchema.safeParse`** (MandateForm:454-455 `mandateSchema.safeParse(json)` → `.data.id`; POST → `/mandates-data` at 444). The wrapped-shape create bug is fixed. **PASS.**
8. **(2f) `GET /mandates/jurisdictions` (advisor/admin) declared BEFORE `:id`** (controller:223 `@Get('jurisdictions')` @Roles WRITE; `@Get(':id')` at 240; ordering rationale 204-211). **PASS.** Live: advisor 200, analyst 403, anon 401, and it resolves as its own route (not swallowed by `:id`).
9. **(2g) 3-acks SERVICE guard uses `!== true` strict** (service:104-106 `acknowledgments.x !== true`; comment 99-101 explicitly rejects `"true"`/`1`). **PASS.** (Landed in `a061c57` — see finding 15.)
10. **(2h) MandateListClient hides new-mandate button for read-only roles** (`canCreate = rolesForRoute('/mandates/new').includes(userRole)`; CTA gated `{canCreate && …}` at 149 + 305). **PASS.** (Landed in `1312fb4` — see finding 15.)

### Actor-id + audit + one-txn (claim 3) — PASS
11. **createAsActor translates ST id → app users.id via `getUserWithRole`** (service:90-95 `authRepository.getUserWithRole(supertokensUserId)` → `appUserId = actor.id`; `created_by = appUserId` at 129). **PASS + LIVE-PROVEN:** created `createdBy=5db03d90-…` ≠ `/auth/me` userId `494ac11d-…` — the app-users translation is real, not the raw ST id.
12. **One transaction, 3 tables + audit-last.** `runInTransaction` wraps insertMandate + insertBuyerCriteria + insertComplianceProfile + `auditService.append(auditInput, tx)` as the LAST tx op (service:114-186; action `'mandate-create'`, `actorUserId=appUserId`). Audit failure rolls back all. **PASS.**
13. **M2 reuse confirmed.** FK `disclaimer_template_id` → `disclaimerTemplates.id` (schema:285-287, from `compliance-rules`); `created_by` → `users.id` onDelete restrict (schema:128-130); audit via M2 `AuditService.append`. Buyer criteria + compliance cascade on mandate delete. **PASS.**

### LIVE deployed-state (claim 4) — PASS (own HTTP, not C-2 trust)
14. **Full live vertical re-run by karen against `46642e7`:**
    - advisor `GET /mandates/jurisdictions` → **200 + `US`** present.
    - `POST /mandates` (valid, US, 3 acks true) → **201**, flat `Mandate`, `status=draft`.
    - `GET /mandates/:id` → derived `disclaimerTemplateId=fe1c504d-…` **non-null** (D2); 3 acks persisted **true** (D5).
    - `POST` ack-false → **400**; `POST` jurisdiction `ZZ-NOTEMPLATE` → **400** (not null-FK 500).
    - `PATCH` draft→active → **200**; edit-active → **409**; active→draft → **409**.
    - analyst `POST` → **403**; analyst list → **200**; analyst `/jurisdictions` → **403**; anon list/detail/jurisdictions → **401**.
    - web `GET /mandates/:id` → Next.js SSR HTML (not raw JSON).
    All ✓. **PASS.** (Fully corroborates C-2's live evidence — which is genuine, not fabricated: real Railway deploy IDs, real headless-DOM proof, honest FAIL→FAIL→PASS iteration.)

### Deploy provenance & migrations (claim 5) — PASS
15. **Live `/health` = `{"status":"ok","db":"ok","version":"46642e7"}`** — running container reports the exact deployed hash. `db:ok` confirms app-DB (mandate tables) reachable + migrations 0006/0007 applied (the app Postgres is Railway-internal, not reachable via `CLAUDOMAT_DB_URL` which is the brain DB — so DB-level table/index SQL was verified transitively via `db:ok` + the live create/derive/list working end-to-end, and directly by C-2's temporary-proxy check: 8 `__drizzle_migrations` rows, 3 mandate tables, partial index present). **PASS.**

### Deployed vs main delta (claim 6) — ACCEPTABLE
16. **`46642e7` is an ancestor of HEAD `e57be83`.** Post-deploy commits: `a061c57` (acks-service-harden) + `1312fb4` (hide-button + reliable 3-ack client validation). These are on main but NOT in the live `46642e7` container. **Confirmed.**
17. **Acks-harden ship-next-deploy is ACCEPTABLE.** The load-bearing acks enforcement was already LIVE on `46642e7` via the controller's `mandateCreateSchema` `z.literal(true)` (shared/mandate.ts:121-133) — I independently re-verified ack-false→**400** on the live deploy. `a061c57` adds a service-layer `!== true` guard as defense-in-depth for any non-Zod call-site (there is none in the HTTP path). No live gap. **ACCEPTABLE.**
18. **Hide-button ship-next-deploy is ACCEPTABLE.** C-2 flagged the analyst "New mandate" button as non-blocking minor: the create route server-blocks + redirects, no privilege escalation (analyst `POST` → 403 live-confirmed). Cosmetic-only, no security consequence. **ACCEPTABLE.**

---

## Bullshit-detection scorecard
- **Done-theater?** No. The primary payoff works live for a real user (own HTTP proof).
- **Green-test amnesia?** No. C-2 honestly FAILED twice on real UI defects before the PASS; each defect root-caused + fixed + re-verified in a real browser.
- **Spec-vs-deployed drift?** None load-bearing. The only delta (2 post-deploy commits) is defense-in-depth + cosmetic, with the load-bearing enforcement already live.
- **Compliance-gate bypass?** No. Acks enforced (400 live), audit last-in-txn, derived disclaimer non-null, actor-id = app users.id (not ST id).
- **Over/under-engineering?** 3-table spine is justified (queryable criteria + M6-readable compliance); no speculative DSL; suppression is a captured scalar per D4.

## Recommendation
APPROVE for V-2/V-3. No REWORK items. Non-blocking note for the next deploy: ship `e57be83` so `a061c57`+`1312fb4` reach production (tidies the analyst CTA + adds the service-layer acks belt-and-braces) — but nothing here blocks the wave.

```yaml
karen_verdict:
  verdict: APPROVE
  stage: V-1
  findings_total: 18
  pass: 15
  acceptable: 3
  reject: 0
  deployed_hash: "46642e7"
  main_tip: "e57be83"
  live_reverified: true
  blocking_items: []
```

# C-2 — Deploy & Verify (wave-8 mandate spine)

**Stage:** C-2 deploy-and-verify (incl. canary)
**Gating head:** head-ci-cd
**Deploy target:** commit `c278f7d` (main HEAD, CI green all 5) → Railway project `ce095f75-…` env production `0e84f0b6-…`
**Verdict source:** this file's `head_signoff` footer.

```json
{
  "agent": "head-ci-cd",
  "stage": "C-2",
  "status": "gating",
  "block_state": {
    "pr_url": "merged @ c278f7d (main)",
    "ci_run_id": "green (5/5)",
    "deploy_target": "dealflow-api + dealflow-web @ c278f7d",
    "canary_status": "skipped (0 DAU < 1000 threshold)",
    "monitor_tasks": ["railway-deploy poll (900s budget, 30s delay) — both services"]
  }
}
```

## ci_stage_verdict: **FAIL** — REWORK

The **deploy + migrations succeeded and the API layer is fully sound**, but **two independent CRITICAL defects break the wave-8 mandate UI vertical end-to-end on the live deploy**. The primary wave-8 payoff (create a mandate + see its detail through the actual UI) does not work for a real user. Per the Iron Law (mandate-create fails / detail renders empty), this is a hard FAIL + RETURN.

---

## 1. Deploy (PASS)

| Service | Deployment ID | Status | Commit |
|---|---|---|---|
| dealflow-api (`dcdb4ab4-…`) | `d9cbec93-fafc-41ef-881a-43b3c2f32d97` | SUCCESS | c278f7d |
| dealflow-web (`06b07f19-…`) | `714dcfcb-68c8-4be1-89d0-c84ab0473c54` | SUCCESS | c278f7d |

- Trigger: `variableUpsert GIT_SHA=c278f7d` on api + web → Railway auto-built a fresh immutable container at the exact HEAD commit (deployment `meta.commitHash = c278f7dd… = c278f7d`, branch `main`, `reason: deploy`). **Provenance verified** — deployed hash == CI-tested SHA == PR HEAD.
- **Rollback armed pre-mutation:** known-good IDs cached before deploy — api `67a39336-…`, web `bfcca5a0-…` (both SUCCESS @ e4debc6). New known-good after this deploy: api `d9cbec93`, web `714dcfcb`.
- Monitor: bounded poll, `timeout_budget=900s`, `poll_delay=30s`, `success_condition = edges[0].status=='SUCCESS'`, `failure_condition = status IN (FAILED,CRASHED,REMOVED,SKIPPED)`. Both reached SUCCESS in ~90s. No SKIPPED (no Railway "Wait for CI" phantom skip). Immutable freshly-built artifact (not in-place mutation).
- **api /health probed at the deployed hash** (not just global domain): `{"status":"ok","db":"ok","version":"c278f7d"}`. api boots clean.
- Env vars all present pre-boot (no new env var introduced this wave): AUDIT_LOG_HMAC_KEY, DATABASE_URL, SUPERTOKENS_*, WEB_ORIGIN, INTERNAL_API_BASE_URL. No missing-env-var crash.
- `preDeployCommand: drizzle-kit migrate` runs as a one-shot BEFORE routing traffic (migration-before-boot sequencing — structurally correct).

## 2. Migrations 0006 + 0007 (PASS)

- **Additive-only static check (STABLE):** 0006 = `CREATE TYPE` + 3 `CREATE TABLE` + FK/index adds (no DROP/destructive DDL). 0007 = partial unique index add. Both journal-registered ascending (idx 6 @ when 1783296000000, idx 7 @ when 1783382400000).
- **0007 pre-check (duplicate-active-disclaimer hazard):** ran `SELECT jurisdiction,count(*) FROM disclaimer_templates WHERE active GROUP BY jurisdiction HAVING count(*)>1` **before** deploy → **0 rows**. Each jurisdiction had exactly one active row → **index applied cleanly. NO dedup needed / performed.**
- **Post-deploy DB verification (via temporary TCP proxy, since deleted):**
  - `__drizzle_migrations` = **8 rows** (ids 1-8). **NOTE / CORRECTION:** the prompt anticipated "7 rows" — the actual pre-wave baseline was **6** rows (0000-0005), and 0006+0007 added 2 → **8**. Both new migrations are registered (ids 7 & 8, ascending `created_at`). The "7" in the prompt was an off-by-one; the substance (both migrations applied, journal-ascending) is confirmed.
  - 3 mandate tables exist: `mandates`, `mandate_buyer_criteria`, `mandate_compliance_profile`.
  - Partial unique index exists: `disclaimer_templates_one_active_per_jurisdiction_idx … USING btree (jurisdiction) WHERE (active = true)`.

## 3. LIVE verification — API layer (ALL PASS)

Verified via cookie-jar sessions (advisor/analyst/compliance minted through the live invite→signup flow; `rid: anti-csrf` on mutations). Jurisdiction `US` used (has an active disclaimer template).

| Invariant | Result |
|---|---|
| **Create (advisor, US, 3 acks true)** | **201** — status `draft`, `createdBy` = app users.id (actor-id translation OK, not SuperTokens id) |
| **Derived disclaimer** | compliance profile `disclaimer_template_id = fe1c504d-…` (the active US template) — non-null, correctly derived (D2) |
| **Audited (one-txn)** | `GET /compliance/audit-log/verify`: entriesChecked **57 → 58** (+1 for the create), chain `ok:true` intact |
| **3-acks required** | false ack → **400**; missing ack → **400** (precise attestation messages; not persisted) |
| **derive-no-match** | unknown jurisdiction → **400** "No active disclaimer template found…" — **NOT a null-FK 500** ✓ |
| **active-mandate lock** | draft→active → **200**; edit-while-active → **409**; active→draft → **409**; DB confirms sellerName unchanged (lock enforced, not cosmetic) |
| **RBAC** | analyst POST → **403**; compliance POST → **403**; analyst GET list+detail → **200**; anon POST+GET → **401** |
| **List + filter** | `?status=draft`→0, `?status=active`→1, `?status=all`→1 (correct filtering) |
| **API regression** | `/compliance/summary`, `/compliance/suppression`, `/compliance/disclaimers`, `/auth/me` all **200** |

The API create vertical, compliance invariants, and RBAC are **correct and sound**. The API is NOT the source of the failure.

## 4. LIVE verification — UI layer (**TWO CRITICAL FAILURES**)

Verified via browser (Playwright/chromium) as advisor + analyst.

### DEFECT 1 — CRITICAL: Mandate DETAIL SSR page is hijacked to the Express API `[nextjs]`
- `GET https://<web>/mandates/:id` returns **`x-powered-by: Express`** + raw `application/json` — **identical to the API's own response**. The Next.js SSR detail page (`apps/web/app/(app)/mandates/[id]/page.tsx`, which exists in source with deferred placeholders) is **never served** on the live deploy.
- Contrast: `GET /mandates` (list) and `/dashboard` correctly return `x-powered-by: Next.js`.
- **Root cause (confirmed by nextjs-developer):** `apps/web/next.config.ts` `afterFiles` rewrite `{ source:'/mandates/:id', destination: API }`. `afterFiles` defers only to **static exact-path** page matches, **not to dynamic segment pages** — so the pattern `/mandates/:id` matches and proxies `/mandates/<uuid>` to Express before the dynamic `[id]/page.tsx` can render. The static `/mandates` rewrite is safe; the dynamic `/mandates/:id` rewrite is not. The config's own comment (lines 158-179) asserts the opposite and is wrong for dynamic segments.
- **Fails acceptance criteria:** "Detail SSR-hydrated" + "deferred placeholders (Buyer Engine / Ranked Candidates / Pipeline)" — both entirely absent from the live deploy.
- **Fix plan (do NOT apply here — follow-up build cycle):** remove the `/mandates/:id` afterFiles rewrite so the SSR page wins for browser GET; route the client PATCH (MandateDetailClient ConfigureForm, line 163) to a non-colliding path `/mandates-data/:id → API` (exact mirror of the wave-7 `/sourcing/company-detail/:id` collision fix). Two files: `next.config.ts` + `MandateDetailClient.tsx`.

### DEFECT 2 — CRITICAL: UI create form jurisdiction values have no matching active disclaimer template `[react / data-contract]`
- The create form (`MandateForm.tsx` `JURISDICTIONS`, lines 60-67) offers jurisdiction option values `us_delaware`, `us_federal`, `uk`, `eu`, `singapore`, `cayman`. The only active `disclaimer_templates` row is `jurisdiction='US'`. **No form option matches any active template** → every UI create hits derive-no-match **400 "Failed to create mandate"**. Confirmed live (3 attempts, different jurisdictions, none persisted; grep confirms no migration/seed ever inserts `us_federal`/`us_delaware`).
- **This is NOT an API bug** — the API's derive-no-match guard is correct (it is a compliance fence). The defect is the form-value ↔ seed-data contract mismatch: a real advisor using the shipped UI **can never create a mandate**.
- **Fails acceptance criterion:** "Mandate create (advisor) → 201 + derived disclaimer, redirect to detail" — fails through the real UI (works only via direct API with `jurisdiction:"US"`).
- **Fix plan (do NOT apply here):** align `MandateForm.tsx` `JURISDICTIONS` option values to jurisdiction strings that have active disclaimer templates (currently only `'US'`); any additional jurisdiction option must be paired with an active disclaimer_templates INSERT for that value. One file: `MandateForm.tsx`.

### Minor (non-blocking, logged for the fix cycle)
- Analyst list UI still renders a "New mandate" button (non-functional — route server-blocks + redirects to `/`; no privilege escalation, but should be hidden for read-only roles).
- `favicon.ico` 404 (cosmetic).

### UI regression (PASS)
- `/` (dashboard), `/sourcing` (307→/), `/compliance/settings` (307→/) load without error for the advisor. List page + create-form rendering (form fields) OK. Login (both roles) OK.

## 5. Canary
**Skipped** — 0 DAU, below the `canary_threshold_dau: 1000` in `project.yaml`. Full-cutover is acceptable at this traffic level (blast radius = 0 real users).

## 6. Cleanup (done)
- Test mandate `56f76b3b-…` deleted (0 mandates remain); temporary Postgres TCP proxy (`bd578fee-…`, hayabusa.proxy.rlwy.net:42887) deleted; local secret/cookie-jar files scrubbed.
- Test users (`adv-c2-…`, `ana-c2-…`, `comp-c2-…`) **retained** — FK'd by `audit_log_entries` (audit-immutability).

## Chronological ledger
- Deploy trigger: 2026-07-04 ~12:01 UTC (GIT_SHA upsert). Both SUCCESS by ~12:03 UTC (~90s). Migrations applied in the pre-deploy one-shot before boot. Canary window: N/A (skipped). Verification window: ~12:03–12:10 UTC.

---

```yaml
head_signoff:
  verdict: REJECTED
  stage: C-2
  reviewers:
    ui_verification: ui-comprehensive-tester (live browser, advisor + analyst)
    defect_1_rootcause: nextjs-developer (detail-route hijack)
    defect_2_rootcause: fullstack-developer (jurisdiction-seed mismatch)
  failed_checks:
    - "LIVE detail SSR-hydrated + deferred placeholders — detail route hijacked to Express API by next.config.ts afterFiles /mandates/:id rewrite; SSR page never served"
    - "LIVE mandate create (advisor) → 201 + redirect via the real UI — form JURISDICTIONS values (us_federal/us_delaware/...) have no matching active disclaimer template (only 'US' is active); every UI create derive-no-match-400s"
  passed_checks:
    - "deploy c278f7d both services SUCCESS; /health version==c278f7d; api boots clean; rollback armed; immutable artifact; no SKIPPED"
    - "migrations 0006+0007 applied (8 __drizzle_migrations rows [prompt said 7 — baseline was 6, +2=8]; 3 mandate tables; partial unique index; 0007 pre-check 0 dups, no dedup needed)"
    - "API layer: create 201 + derived disclaimer + audited (57→58, chain ok); 3-acks 400; derive-no-match 400 (not 500); active-lock 409; RBAC full matrix; list+filter; API regression"
    - "canary skip justified (0 DAU); cleanup done"
  rationale: >
    Deploy and migrations are clean and the API vertical is fully sound (create/derive/audit/
    3-acks/derive-no-match/active-lock/RBAC all verified live). BUT the wave-8 UI payoff is broken
    end-to-end on the live deploy by two independent CRITICAL defects: (1) the mandate detail SSR
    page is hijacked to the Express API by a next.config.ts afterFiles /mandates/:id rewrite that
    shadows the dynamic [id] page (afterFiles defers only to static, not dynamic, page matches);
    (2) the create form's jurisdiction option values (us_federal/us_delaware/uk/eu/...) have no
    matching active disclaimer template — only 'US' is seeded — so every UI create derive-no-match-
    400s. A real advisor can neither create a mandate nor view a mandate detail through the shipped
    UI. Both fail load-bearing acceptance criteria and trip the Iron Law (mandate-create fails /
    detail renders empty). Root causes are fully diagnosed with minimal fix plans (both mirror the
    wave-7 sourcing page-route-collision precedent). Not fabricating a green on a passing API when
    the user-facing vertical is dead.
  next_action: REWORK_B_block
```

**Routing:** two triage fixes owned by the B-block on RETURN:
1. `nextjs` / web-routing — remove the colliding `/mandates/:id` afterFiles rewrite + non-colliding `/mandates-data/:id` proxy for the client PATCH (`next.config.ts` + `MandateDetailClient.tsx`).
2. `react` / data-contract — align `MandateForm.tsx` `JURISDICTIONS` values to jurisdictions with active disclaimer templates (currently `'US'`), or seed active templates for each offered jurisdiction.

After fixes land + CI green → re-enter C-2 for a fresh deploy-and-verify of the UI vertical.

---

# UI re-verify (7b33598)

**Verdict: FAIL — REWORK.** The two prior UI defects (DEFECT-1 detail-page shadowing, DEFECT-2 jurisdiction-value/seed mismatch) are **both genuinely fixed and verified live**. But the create-via-UI payoff is broken by a **NEW, independent CRITICAL client-side defect** surfaced only now that the create request finally reaches the API: `MandateForm.tsx` mis-parses the 201 create response (expects a `{ mandate: {...} }` wrapper the API never returns), so create succeeds server-side (201) yet the browser shows a red "Failed to create mandate." and never redirects to detail. A real advisor cannot complete the create → detail flow through the shipped UI. Trips the Iron Law (create fails from the UI / no redirect to detail).

## 1. Deploy (PASS)

| Service | Deployment ID | Status | Commit |
|---|---|---|---|
| dealflow-api (`dcdb4ab4-…`) | `276945ff-27c7-47fe-8aab-7528707128f9` | SUCCESS | 7b33598 |
| dealflow-web (`06b07f19-…`) | `288949b8-493f-4f2f-be11-a8356099e54f` | SUCCESS | 7b33598 |

- Token: `RAILWAY_TOKEN` (project-scoped, 36-char) validated via `{ projectToken { projectId environmentId } }` → project `ce095f75-…`, env `0e84f0b6-…`. Deploy-scoped, `Project-Access-Token` header (never `me{}`, never CLI).
- Trigger: `variableUpsert GIT_SHA=7b33598` on api + web → Railway auto-built a fresh immutable container. Provenance verified — both deployments' `meta.commitHash = 7b33598` == target == CI-green SHA.
- **Rollback armed pre-mutation:** known-good IDs cached before deploy — api `d9cbec93` / web `714dcfcb` (both SUCCESS @ c278f7d). New known-good after this deploy: api `276945ff`, web `288949b8`.
- Monitor: bounded poll, `timeout_budget=900s`, `poll_delay=45s`, `success_condition = both edges[0].status=='SUCCESS'`, `failure_condition = either status IN (FAILED,CRASHED,REMOVED,SKIPPED)`. Both SUCCESS in ~90s. No SKIPPED (no phantom skip). Immutable freshly-built artifact.
- **api /health at the deployed hash:** `{"status":"ok","db":"ok","version":"7b33598"}` HTTP 200. api boots clean, db ok. web root → `x-powered-by: Next.js` (307→/login for anon).

## 2. The UI payoff — live verification (advisor + analyst minted via invite→signup; real headless chromium for post-hydration DOM)

| Check | Result |
|---|---|
| **GET /mandates/jurisdictions — advisor** | **200** + non-empty list **including `{jurisdiction:'US'}`** ✓ (advisor-readable fix — DEFECT-3 resolved). [Extra `US-KAREN-…`/`US-VER-…`/`US-admin-…` entries are leftover test-fixture disclaimer templates from prior verify runs — cosmetic test-data residue, not a defect; load-bearing `US` present.] |
| GET /mandates/jurisdictions — analyst / anon | **403** / **401** ✓ (RBAC correct) |
| **/mandates/new dropdown POPULATED (browser DOM)** | `#jurisdiction` select present, options `["US", …]`, **contains `US`** ✓. NOT the empty "no jurisdictions configured" state; NOT the old `us_federal`/`uk` mismatch (DEFECT-2 resolved). |
| **DEFECT-1 — /mandates/:id SSR page (browser DOM)** | GET /mandates/:id on WEB origin → **HTTP 200, `content-type: text/html`, `x-powered-by: Next.js`** — NOT raw `x-powered-by: Express` JSON. Page is **no longer shadowed**. DOM contains seller name + jurisdiction `US`; deferred placeholders **Buyer Engine / Ranked Candidates / Pipeline** all render. `next.config.ts` colliding `/mandates/:id` rewrite removed; only `/mandates-data` + `/mandates-data/:id` proxies remain. **DEFECT-1 resolved.** |
| List — created mandate appears (browser DOM) | ✓ appears in `/mandates`; API `?status=draft`→1, `active`→0, `all`→1 (filter works). |
| Active-lock (regression of B-6 fix, /mandates-data/:id PATCH) | draft→active **200**; PATCH active mandate → **409** "Active mandate is locked…" ✓ |
| RBAC — analyst read-only | analyst GET list+detail **200**; analyst POST **403**; anon list+detail **401** ✓. In UI: analyst `/mandates/new` server-redirects to `/`. |
| **Create via the UI — the PRIMARY payoff** | **FAIL.** Filled the real form (seller + geo + size + buyer criteria + jurisdiction=`US` + suppression + all 3 acks) → submit → **POST /mandates-data (web-origin proxy) returned 201** (create succeeded server-side; DEFECT-1 proxy path + DEFECT-2 jurisdiction both work end-to-end) — BUT the browser did **NOT** redirect to detail and surfaced a red **"Failed to create mandate."** alert. |
| API-direct create (control) | POST /mandates (advisor, US, 3 acks, `rid:anti-csrf`) → **201**, status `draft`, `createdBy` = app users.id (actor-id translation, not ST id); derived disclaimer `fe1c504d` (active US template). API create is sound — the defect is purely client-side. |

## 3. NEW CRITICAL defect — create-response shape mismatch (client-side) `[react / data-contract]`

- **Symptom:** create-via-UI returns **201** but the browser shows "Failed to create mandate." and never redirects to `/mandates/:id`. A real advisor cannot complete create → detail through the shipped UI. A duplicate mandate is silently created on each retry.
- **Root cause (confirmed by nextjs-developer):** the deployed API `POST /mandates` returns a **flat `Mandate`** (top-level keys `['id','createdBy','sellerName',…]`, verified live — NO `{ mandate }` wrapper). But `MandateForm.tsx` (lines 435-436) reads `const created = json as { mandate?: { id?: string } }; const id = created?.mandate?.id;` — expecting a **wrapped** shape. `id` is therefore always `undefined`, the `router.push('/mandates/${id}')` guard is false, and control falls through to `setSubmitError('Failed to create mandate.')` (compounded: the error path's second `res.json()` throws because the body stream was already consumed on line 433, so only the generic string surfaces). The developer conflated the create response (flat `Promise<Mandate>`) with the DETAIL/PATCH response (wrapped `Promise<MandateDetail>` = `{ mandate, buyerCriteria, complianceProfile }`).
- **Not an API bug** — the API is correct and consistent with its declared return types (`createAsActor: Promise<Mandate>`). Pure client-side response-parsing bug, contained entirely to the web app.
- **Sibling check (clean):** `MandateDetailClient.tsx` ConfigureForm PATCH → `/mandates-data/:id` reads the response as `MandateDetail` and the API PATCH returns exactly that wrapped shape — **no mismatch**; active-lock PATCH verified 200/409 live.
- **Fails acceptance criterion:** "Create via the UI (the primary payoff) → 201 → redirect to the created mandate detail" — fails at the browser.
- **Fix plan (do NOT apply here — follow-up B-cycle):** one file, two lines in `apps/web/app/(app)/mandates/_components/MandateForm.tsx` — change lines 435-436 to `const created = json as { id?: string }; const id = created?.id;`. No API change. After fix + CI green → re-enter C-2 (a thin re-verify: just create-via-UI → 201 → redirect → detail renders; the rest of the vertical is already green on 7b33598).

## 4. Regression (partial)

- `/health` ok. Detail SSR / list / new-form render correctly for the advisor (verified above). Login OK (both roles).
- `/` (dashboard), `/sourcing`, `/compliance/settings`: browser navigation returned HTTP 200 but resolved to `/` with a short body in the final browser pass (session-window artifact of the automated run near access-token boundary). API-side these routes were healthy at deploy; not a deploy regression, but re-confirm on the next C-2 pass alongside the create-via-UI re-check. Not a blocker for this FAIL verdict (the FAIL is already decided by the create-via-UI defect).

## 5. Canary
**Skipped** — 0 DAU, below `canary_threshold_dau: 1000` in `project.yaml`. Blast radius = 0 real users.

## 6. Cleanup (done)
- No DELETE endpoint on mandates (rows audit-FK'd) — test mandates (`dec0e967` active, `4811fe03`/`fa3fe2f1` draft) retained per prior-C2 precedent. Advisor + analyst sessions logged out. Local secret/cookie-jar/Playwright-script files scrubbed. Test users retained (audit-immutability).

## Chronological ledger
- Deploy trigger: 2026-07-04 ~12:43 UTC (GIT_SHA=7b33598 upsert). Both SUCCESS by ~12:45 UTC (~90s), migration one-shot before boot (no new migration this cycle). Canary: N/A (skipped). Verification window: ~12:45–12:50 UTC.

---

```yaml
head_signoff:
  verdict: REJECTED
  stage: C-2 (UI re-verify 7b33598)
  reviewers:
    ui_dom_verification: head-ci-cd (real headless chromium — advisor + analyst, post-hydration DOM)
    create_defect_rootcause: nextjs-developer (create-response shape mismatch, sibling-clean confirmation)
  failed_checks:
    - "LIVE create via the UI → 201 + redirect to detail — MandateForm.tsx parses the 201 create response as { mandate: {id} } but the API returns a FLAT Mandate; id resolves undefined, no redirect, and a false 'Failed to create mandate.' error is shown despite the 201"
  passed_checks:
    - "deploy 7b33598 both services SUCCESS; /health version==7b33598 (probed at deployed hash); api boots clean db ok; rollback armed (api d9cbec93 / web 714dcfcb); immutable artifact; no SKIPPED"
    - "DEFECT-3 (advisor jurisdictions): GET /mandates/jurisdictions advisor 200 + US present; analyst 403; anon 401"
    - "DEFECT-2 (jurisdiction dropdown): /mandates/new dropdown populated in browser DOM, contains US, no empty-state, no us_federal/uk mismatch"
    - "DEFECT-1 (detail shadowing): GET /mandates/:id serves Next.js SSR text/html (x-powered-by Next.js, NOT Express JSON); DOM has profile+compliance(jurisdiction/derived-disclaimer)+deferred placeholders Buyer Engine/Ranked Candidates/Pipeline"
    - "list shows created mandate + status filter (draft/active/all); active-lock draft→active 200 + edit-active 409; RBAC analyst read-only 200 + POST 403 + anon 401; API-direct create 201 with actor-id + derived disclaimer"
    - "canary skip justified (0 DAU); cleanup done"
  rationale: >
    Deploy is clean and all three previously-failed items are genuinely fixed and verified
    live in a real headless browser: the advisor-readable jurisdictions endpoint returns 200+US
    (analyst 403), the /mandates/new dropdown is populated with US (no empty-state, no
    us_federal/uk mismatch), and the /mandates/:id detail page now serves the Next.js SSR page
    (text/html, x-powered-by Next.js — NOT raw Express JSON) with the deferred Buyer Engine /
    Ranked Candidates / Pipeline placeholders. Active-lock (409) and the full RBAC matrix hold.
    BUT the primary wave-8 payoff — create a mandate through the real UI and land on its detail
    page — is broken by a NEW, independent CRITICAL client-side defect exposed only now that the
    create POST finally reaches the API on the fixed /mandates-data proxy path: MandateForm.tsx
    parses the 201 create response as a wrapped { mandate: {id} } object, but the deployed API
    returns a FLAT Mandate. id resolves undefined, the redirect never fires, and the advisor is
    shown a false 'Failed to create mandate.' error despite the mandate having been created
    (201). A real advisor therefore cannot complete create → detail through the shipped UI, and
    each retry silently duplicates the mandate. This trips the Iron Law (create fails from the
    UI / no redirect to detail). Root cause is fully diagnosed (nextjs-developer) with a
    one-file, two-line fix (MandateForm.tsx 435-436: read created.id, not created.mandate?.id);
    the PATCH/configure sibling path was checked and is clean. Not fabricating a green on a
    passing API + three-of-four fixed UI items when the load-bearing create-via-UI vertical is
    still dead for a real user.
  next_action: REWORK_B_block
```

**Routing:** one triage fix owned by the B-block on RETURN:
1. `react` / data-contract — `apps/web/app/(app)/mandates/_components/MandateForm.tsx` lines 435-436: parse the flat 201 create response (`created.id`), not the non-existent `{ mandate: {id} }` wrapper. No API change. (DEFECT-1, DEFECT-2, DEFECT-3 all already resolved on 7b33598 and need no further work.)

After the fix lands + CI green → re-enter C-2 for a thin re-verify: create-via-UI → 201 → redirect → detail renders (+ re-confirm the dashboard/sourcing/compliance-settings render pass). The rest of the vertical is already verified green on 7b33598.

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

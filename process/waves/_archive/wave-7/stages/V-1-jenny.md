# V-1 Jenny — Wave 7 (Sourcing-Workspace page) — Semantic Spec Verification

**Verdict: REJECT**
**Counts: 2 DRIFT / 1 GAP** (1 Critical gap blocks the M3 metric live; 1 High drift on client-search; the 2 are the same root cause surfaced on two paths)

Scope: verify DEPLOYED behavior matches the SPEC-CONTRACT INTENT (semantic, not
source-claim — Karen owns source-claim and APPROVED 22/22). Every finding below is
reproduced against the LIVE deploy (api `0fe63de`, web `dealflow-web-production-a4f7`)
with a real analyst session minted through the web-origin proxy, plus the shipped
production JS artifact. Not inferred from green tests or the C-2 log.

**Deployed:** api `0fe63de` (`/health` version matches), web at
`dealflow-web-production-a4f7.up.railway.app`. Spec source = DB task
`dfa5bd56-…` (incl. P-4 remediation addendum AC-SEED/AC-BADGE/AC-CTA). M3 metric =
milestone `b372bbf7-…`.

---

## Headline

The **data layer is correct** and every AC that C-2 + Karen verified via the **API
directly** is genuinely met (connection-create 201 / dup 409 / bad-key 400 / audited;
sync reuses wave-6 pipeline; `connectionIds` returned per company; ≥2-source
provenance real). **BUT the workspace PAGE renders EMPTY of companies live** — the
results matrix, source badges, search, and source-facet all show zero rows even when
≥2 fixture connections are synced and 4 canonical companies exist. Root cause: a
Zod `z.string().datetime()` timestamp-format mismatch that silently drops the entire
company list at the SSR boundary. **The M3 success metric ("run a sourcing search
across ≥2 connected sources … and view them") is NOT deliverable in the browser** —
the analyst sees "No companies found" no matter what. This is precisely the
spec-vs-deployed drift V-1 exists to catch: the C-2 and Karen probes hit the JSON API
(which works) and never asserted the RENDERED page had rows.

---

## Per-block MATCHES / DRIFTS

### 1. Workspace at /sourcing (journey row 12) — PARTIAL / **DRIFT (High)**
- **MATCHES:** `/sourcing` is the workspace, NOT the old redirect stub. Live analyst
  `GET /sourcing` → **200**, 20 510 bytes, renders WorkspaceClient shell (Connectors
  row + "Search companies" + source-facet aside + results-matrix region). Non-analyst
  (host-scoped cookie) → 307. `page.tsx:92-111` is a real SSR server component with
  `assertRole('/sourcing', me.role)`. No `redirect('/sourcing/companies')`. Server
  component in the (app) AppShell. ✔
- **DRIFT:** the results matrix renders **"No companies found" (empty)** on the live
  deploy despite 4 canonical companies existing (proven: `GET /sourcing/connections`
  reports `companyCount:4` on every connection; my two synced connections each
  returned `{ingested:5}`). The SSR payload ships `"initialCompanies":[]`. The
  "search over the canonical deduped universe + results matrix + detail drawer"
  acceptance criterion is therefore NOT satisfied in the rendered product — the core
  screen is blank of data.

### 2. AC-SEED (POST /sourcing/connections create) — **MATCHES**
- Live (my session, web proxy): analyst `POST /sourcing/connections {fixture, "Jenny
  Source A/B <ts>"}` → **201** ×2 (distinct ids). Dup displayName → **409**. Unknown
  providerKey `nope-xyz` → **400** ("Unknown provider_key … Registered providers:
  FIXTURE") — rejected before insert, not a 500. `GET /sourcing/connections` lists
  real rows with per-connection `companyCount`. Audited (Karen verified chain
  `entriesChecked=40`, actor = app `users.id` via `getUserWithRole`). ✔ The ≥2-source
  enabler exists via a REAL path.

### 3. AC-BADGE (badges from real connection displayNames) — **MATCHES in code, UNREACHABLE live**
- **Code MATCHES:** `ResultsMatrix.tsx:302-309` resolves badges from
  `connectionMap.get(connId).displayName` (real rows), falls back to '—' only when a
  company has no provenance. No literal "PitchBook"/"Crunchbase" in served HTML
  (grep=0). The API returns `connectionIds` per company (`repository.ts:229-241`,
  distinct `connection_id` from `company_provenance`). The design mock's literal
  PitchBook/Crunchbase badges (`design/sourcing-workspace.html:528,553,600`) are
  correctly NOT shipped. ✔
- **Caveat (folds into the GAP):** because the company list renders empty live (finding
  #1 / GAP below), **no badge is ever rendered to a real user.** The badge logic is
  correct but structurally unreachable in the deployed product until the empty-render
  bug is fixed. Not counted as a separate drift — it is a downstream symptom.

### 4. AC-CTA (Review-Import → /sourcing/companies hand-off) — **MATCHES**
- `WorkspaceClient.tsx:392` — the floating Review-Import bar links
  `href="/sourcing/companies"` (the wave-6 dedupe review queue), NOT the deferred
  in-page modal (`design/sourcing-workspace.html:731-971` `confirmImport()` is
  correctly dropped). `DetailDrawer.tsx` hand-off likewise points at companies. No
  dead/deferred CTA ships. ✔ (Note: the bar only appears when rows are selected, and
  rows can't appear until #1 is fixed — but the CTA target itself is correct.)

### 5. Trigger-sync reuses wave-6 pipeline — **MATCHES**
- Live: `POST /sourcing/connections/:id/sync` → **201 `{ingested:5,updated:0}`** on
  both my connections. Controller `syncConnection` delegates to the wave-6
  `sourcingService.syncConnection` (ETL → dedupe → canonical); NOT re-implemented.
  `SyncTrigger.tsx` calls the wave-6 endpoint via the same-origin proxy. Search is
  server-side against canonical `companies` (`repository.listCompanies` — `ilike` on
  name/domain + provenance-based `source` filter + `status='active'`), NOT raw
  staging, NOT client-side dedup. ✔ (The pipeline works; only the render of its output
  is broken.)

### 6. M3 metric ("search across ≥2 connected sources … view/clean") — **GAP (Critical)**
- **Data-plane MATCHES:** ≥2 enabled fixture connections exist; syncing them produces
  4 canonical companies each carrying provenance from multiple connections
  (`sourceCount ≥ 2`, distinct `connectionIds`). The metric is honestly *computable*
  and NOT falsely claimed at the API layer.
- **GAP:** the metric is **not deliverable through the UI.** The analyst's actual
  journey — open `/sourcing`, see companies, see ≥2-source badges, search, filter by
  source — yields an EMPTY matrix ("No companies found") on the live deploy. "View
  them" fails. The success metric is end-to-end-unverifiable in the product exactly as
  wave-7 was chartered to make it verifiable. This is the wave's reason-to-exist and it
  does not work live.

---

## ROOT CAUSE (confirmed with certainty — reproduced + traced to shipped artifact)

**Zod `z.string().datetime()` rejects the API's Postgres-wire timestamp format → SSR
silently returns `[]`.**

1. The canonical `companies` (and `data_source_connections`) rows define
   `createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' })`
   (`apps/api/src/db/schema/sourcing.ts:290` and `:134`). Drizzle `mode:'string'`
   returns the raw PG wire value with a **space** separator and non-`Z` offset:
   `"2026-07-04 04:30:08.014852+00"`. **Proven live** — `GET /sourcing/connections`
   returns exactly `"createdAt":"2026-07-04 04:30:08.014852+00"`. Companies serialize
   identically (same column type; `service.listCompanies` passes `row.createdAt`
   through raw).
2. The SSR fetch validates with
   `workspaceCompanySchema = z.object({ …, createdAt: z.string().datetime() })`
   (`apps/web/app/(app)/sourcing/_lib/workspace-types.ts:60-72`).
   `z.string().datetime()` accepts ONLY strict ISO-8601 with a `T` delimiter (and, by
   default, `Z`/no-offset). **Reproduced with the shipped zod:**
   - `"2026-07-04 04:30:08.014852+00"` (space)         → **safeParse FAIL**
   - `"2026-07-04T04:30:08.014852+00"` (T, +offset)     → **FAIL** (needs `{offset:true}`)
   - `"2026-07-04T04:30:08.014Z"` (ISO-Z)               → pass
3. `fetchWorkspaceCompanies` (`workspace-types.ts:74-104`): on `safeParse` failure it
   returns `[]` (the `if (parsed.success) …; return []` path) — no throw, no log. The
   workspace therefore ALWAYS SSRs `initialCompanies:[]`.
4. **Shipped-artifact proof:** the deployed `apps/web/.next/server/app/(app)/sourcing/
   page.js` bundle contains verbatim `createdAt:g.Yj().datetime()` (minified
   `z.string().datetime()`) and the `n.safeParse(f) … return []` path. This is what
   runs at `0fe63de`.

**Secondary path — same root cause — DRIFT (High): client-side search + source-facet
are also inert.** `WorkspaceClient.handleSearch` (`WorkspaceClient.tsx:48-68`) fetches
`new URL('/sourcing/companies', window.location.origin)` — i.e. the **web origin**
`/sourcing/companies`, which (per `next.config.ts` afterFiles) is the Next.js **PAGE
(HTML)**, not the API. **Proven live:** `GET <web>/sourcing/companies?q=Acme` returns
`content-type: text/html` (the page), not JSON. `res.ok` is true (200 HTML) so the code
enters `res.json()`, which throws on HTML, caught by the empty `catch {}` ("Keep
current companies on error"). Net effect: **typing in the search box or clicking a
source facet does nothing** — it fetches HTML, fails to parse, and leaves the (already
empty) list unchanged. Even if the datetime bug were fixed so SSR seeded rows, live
search/filter would still be non-functional because it targets the page route, not the
API JSON endpoint. (Wave-6's own detail fetch uses `apiFetch`/`/sourcing/companies/:id`
which the `[id]` page handles differently; the workspace's list re-fetch has no
equivalent working route.)

**Blast radius note (not this wave's gate, but flag for L/N):** the shared
`companySchema` (`packages/shared/src/sourcing.ts:88`) and the wave-6 companies
`page.tsx` fetch (`companiesWithMetaResponseSchema`, which extends it) use the SAME
`z.string().datetime()`. Live, the wave-6 `/sourcing/companies` page ALSO renders
"0 records / No companies yet" against the same populated DB. Wave-6's C-2 verified
companies via the JSON API, not the rendered page, so this latent defect shipped in
wave-6 and is re-exposed (not introduced) by wave-7. The fix should cover both
schemas.

---

## Why C-2 (PASS) and Karen (APPROVE) missed it — NOT a contradiction
Both verified the **API** returns the right JSON (it does) and that the SSR route
returns **200 with the workspace shell** (it does). Neither asserted that the rendered
results matrix CONTAINED company rows — Karen explicitly notes "SSR HTML is a hydration
shell; badges render client-side … data-layer correctness proven independently via the
API (#20, #21)." That reasoning is where the gap hides: the data layer is correct, the
shell renders, but the SSR→render hand-off drops every row via the datetime parse, and
the client re-fetch targets the wrong (HTML) route. Semantic V-1 is the layer that
asks "does the screen actually show the data" — and it does not.

---

## The honest split — CORRECT (not faked)
The deferrals are honest: the real `DataSourceAdapter` (345dfbc6) is genuinely deferred
pending a founder vendor + API-key decision (fixture adapter is what's live — not
dressed up as a real integration); the in-page dedupe/import modal (b9141490) is
genuinely dropped in favor of the `/sourcing/companies` review-queue hand-off. No false
"real integration" claim. AC-SEED/BADGE/CTA are implemented via real paths. The problem
is not dishonesty — it is a real presentation-layer defect that makes the honestly-built
data unviewable.

---

## Fix routing (for V-2 triage → Build/fast-fix — orchestrator does NOT fix)
Classification: `frontend` / data-contract-mismatch (silent SSR parse-drop) + a
routing bug. Both are targeted:
1. **Timestamp schema:** relax the `createdAt`/`updatedAt` validators to accept the
   real API format — `z.string()` (plain) OR `z.string().datetime({ offset: true })`
   AFTER the API is confirmed to emit `T`-delimited output, OR normalize the API to
   emit ISO-`Z`. Apply to `workspace-types.ts` (wave-7) AND `packages/shared`
   `companySchema` + `contactSchema` (wave-6 blast radius). Add a fixture whose
   `createdAt` is the real PG-wire string to the unit test so the mock stops masking
   prod (the B-block tests used `T`/ISO fixtures, which is why green tests passed while
   prod renders empty).
2. **Client search route:** point `handleSearch` (and the facet/query re-fetch) at the
   real API JSON endpoint via `apiFetch` / the env API base (as wave-6's CompanyDetail
   does), NOT `window.location.origin + '/sourcing/companies'` (which resolves to the
   HTML page). OR add an afterFiles rewrite for a dedicated JSON path. Verify live that
   a keystroke returns JSON and re-renders rows.
3. Re-verify at C-2/V by asserting the RENDERED matrix contains ≥1 company row and ≥2
   source badges for a cross-source company — not just that the API returns them.

Collaboration: @task-completion-validator to confirm the rendered-page fix actually
shows rows end-to-end; @head-verifier owns the V-3 gate. Consider
@code-quality-pragmatist on the schema fix to avoid over-tightening.

---

```yaml
v1_jenny:
  verdict: REJECT
  stage: V-1
  reviewer: jenny (semantic spec-vs-deployed)
  deployed: { api: "0fe63de", web: "dealflow-web-production-a4f7" }
  counts: { drift: 2, gap: 1 }
  blocking: true
  findings:
    - id: GAP-1
      severity: Critical
      tag: gap
      ac: "M3 metric / workspace results-matrix (search over canonical universe + view)"
      claim: "workspace shows searched companies with ≥2-source badges"
      observed: "live /sourcing renders 'No companies found' / initialCompanies:[] despite 4 canonical companies + companyCount:4 on every connection"
      root_cause: "SSR fetchWorkspaceCompanies safeParse fails: z.string().datetime() rejects PG-wire createdAt '2026-07-04 04:30:08.014852+00' → returns []"
      evidence: "live GET /sourcing (SSR empty) + GET /sourcing/connections companyCount:4 + shipped page.js 'createdAt:g.Yj().datetime()' + zod repro (space-format safeParse=false)"
    - id: DRIFT-1
      severity: High
      tag: drift
      ac: "interactive search + source facet (server-side over canonical universe)"
      claim: "search box + facet re-query the canonical universe live"
      observed: "handleSearch fetches <web-origin>/sourcing/companies → returns text/html (Next page), res.json() throws, caught silently → search/facet inert"
      root_cause: "client fetch targets the HTML page route, not the API JSON endpoint (afterFiles: page wins)"
      evidence: "live GET <web>/sourcing/companies?q=Acme content-type: text/html; WorkspaceClient.tsx:48-68"
    - id: DRIFT-2
      severity: Medium
      tag: drift
      ac: "AC-BADGE reachability (blast-radius / same root cause)"
      claim: "per-company ≥2-source badges visible to the analyst"
      observed: "badge logic correct (ResultsMatrix.tsx:302) but structurally unreachable — no company row ever renders live (downstream of GAP-1). Same datetime defect also blanks the wave-6 /sourcing/companies page live."
      note: "counted as drift because it is a distinct user-visible surface (badges never shown) though it shares GAP-1's root cause; fix is the same schema relaxation"
  matches:
    - "AC-SEED: POST /sourcing/connections 201 / dup 409 / bad-key 400 / audited (live)"
    - "AC-CTA: Review-Import → /sourcing/companies (WorkspaceClient.tsx:392), not the deferred modal"
    - "trigger-sync reuses wave-6 POST /sync (live {ingested:5}); search server-side over canonical (not raw staging)"
    - "/sourcing is the workspace, not the redirect stub (live 200, real SSR server component, assertRole)"
    - "honest split: fixture adapter live (not faked as real); real adapter + in-page modal genuinely deferred"
    - "data plane: connectionIds + sourceCount≥2 real per company (API)"
  rationale: >
    The data layer delivers the M3 metric honestly, but the WORKSPACE PAGE — the entire
    reason wave-7 exists — renders zero companies to a live analyst because a
    z.string().datetime() schema silently rejects the API's Postgres-wire timestamp and
    drops the whole list at SSR, and the client-side search/facet fetch the HTML page
    route instead of the JSON API so they do nothing either. Both reproduced live at
    0fe63de and traced to the shipped artifact. Approving would ship a blank front door
    for the milestone metric. REJECT → V-2 triage → Build/fast-fix (relax the timestamp
    schema in workspace-types + shared companySchema/contactSchema; repoint client
    search at the API JSON endpoint; harden the unit fixture to the real PG-wire format;
    re-verify by asserting rendered rows + badges, not just API JSON).
  next_action: REWORK_B-block
```

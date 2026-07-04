# V-1 jenny — wave-8 mandate spine + create/list/detail (semantic spec-compliance)

**Agent:** jenny (spec-vs-DEPLOYED semantic verification; Karen owns source-claim)
**Stage:** V-1 (parallel with Karen)
**Deployed:** `46642e7` (live `/health` = `{"status":"ok","db":"ok","version":"46642e7"}` — own probe)
**Live:** api `https://dealflow-api-production-66d4.up.railway.app` · web `https://dealflow-web-production-a4f7.up.railway.app`
**Method:** DB spec-contract (3 blocks + D1-D6 addendum + karen precision note) → deployed source (`apps/api/src/modules/mandate/*`, `apps/api/src/db/schema/mandate.ts`, `apps/web/app/(app)/mandates/*`) → design HTML → C-2/T-5 live evidence CROSS-CHECKED with my own independent HTTP probes. Did NOT rubber-stamp — re-ran the anon-RBAC matrix + web-SSR routing + deployed-hash myself; corroborated (not assumed) C-2/Karen's authenticated vertical.

## VERDICT: **APPROVE**

Every acceptance criterion across all 3 spec blocks MATCHES the deployed behavior. The M4 first-bundle success-metric first-half (advisor creates a configured sell-side mandate → persisted → viewable) is genuinely delivered LIVE, not faked — independently proven by C-2 (real headless chromium, post-hydration DOM + URL bar) AND Karen (own cookie-jar HTTP) AND my own probes (deployed-hash, anon 401×, web-SSR-not-Express). The buyer-universe builder is correctly DEFERRED (labelled placeholders present, not built, not dropped). Compliance is CAPTURED-not-enforced with real UI framing and jurisdiction-DERIVED disclaimer (no picker). D1-D6 all delivered. No spec invention, no metric over-claim.

**Counts: 0 drift · 0 gap.**

---

## Per-block verdicts

### Block ba0edebf — Mandate spine + create/configure — **MATCHES** (6/6 AC)

| AC | Verdict | Evidence |
|---|---|---|
| Advisor persists a fully-configured mandate (profile + core-4 criteria + compliance {jurisdiction, derived disclaimer, suppression, 3 acks}) | MATCHES | schema `mandate.ts` has all columns (seller profile + seller_geo text[]/seller_size_band + criteria industry/geo/size_band/deal_type + compliance jurisdiction/disclaimer_template_id/suppression_scope/3 boolean attestations). C-2 FINAL + T-5 S1: full form → 201 → `/mandates/<id>` → detail renders all parts LIVE. |
| POST advisor/admin only; analyst/compliance 403, anon 401; status draft default | MATCHES | own probe: anon POST→**401**. C-2/Karen live: analyst POST→403, compliance POST→403, create→201 status `draft`. |
| One-txn 3-table create; actor = app users.id via getUserWithRole (not ST id) | MATCHES | service:114 `runInTransaction` wraps insertMandate+buyerCriteria+complianceProfile+audit; service:90 `getUserWithRole`. Karen LIVE-proved `createdBy` ≠ `/auth/me` userId. |
| Every mutation audited via M2 AuditService.append LAST-IN-TXN (rollback on audit fail) | MATCHES | service:183 `auditService.append(auditInput, tx)` is last tx op; actions `mandate-create`/`mandate-configure` registered in `packages/shared/src/audit.ts:70,75`. C-2 live: audit chain 57→58, `ok:true`. |
| Compliance FK-references M2 disclaimer_templates; CAPTURED-not-enforced; UI frames as captured-for-later-gate | MATCHES | single FK `disclaimer_template_id → disclaimer_templates.id` (schema:285). MandateForm:777-782 renders "Compliance information captured here … **not enforced at this step** — a separate compliance review is required before any outreach can be authorized." No false-safety. |
| PATCH re-configures draft; draft→active when complete; audited | MATCHES | service `configureAsActor` returns MandateDetail, audits `mandate-configure`; active-lock: edit-active→409, active→draft→409 (C-2/Karen/T-5 S3 live). |

Edge cases all confirmed live: partial-create rollback (audit-last design), non-advisor 403 / anon 401 (own probe), invalid/unknown jurisdiction → **400** not null-FK 500 (derive fence, C-2+Karen), acks-false → 400.

### Block c070ca23 — Mandates-list — **MATCHES** (3/3 AC)

| AC | Verdict | Evidence |
|---|---|---|
| /mandates list (name/deal-type/status/date) + status filter (draft/active/all); advisor/admin/analyst RBAC | MATCHES | C-2 live: `?status=draft`→correct, `?status=active`→correct, `?status=all`→correct. Own probe: web `/mandates`→Next.js SSR (307→/login anon). analyst GET list→200. |
| GET /mandates list + server-side status filter; RBAC-consistent (roleRoutes) | MATCHES | filter server-side (verified C-2). anon list→**401** (own probe). |
| "New mandate" entry point; empty-state prompt (no crash) | MATCHES | T-5 S1 empty-state renders; "Create a new mandate" CTA present. |

Read-schema wave-7-lesson AC (no `.datetime()/.strict()` rejection of real API serialization) — list renders real created mandate live (C-2/T-5), no empty-despite-data.

### Block 50227055 — Mandate-detail (+ configure/edit) — **MATCHES** (3/3 AC + D6)

| AC | Verdict | Evidence |
|---|---|---|
| /mandates/:id shows profile + criteria + compliance + status | MATCHES | C-2 FINAL live DOM: seller name, jurisdiction US, derived disclaimer `fe1c504d-…`, status draft, all parts. |
| GET /mandates/:id SSR-hydrated (server fetch → serializable props; NO client fetch to page-route) | MATCHES | **own probe**: web `GET /mandates/:id` → `x-powered-by: Next.js`, `content-type: text/html` (307→/login anon) — NOT Express raw JSON. The C-2 DEFECT-1 route-hijack (wave-7 collision class) is genuinely fixed; `/mandates-data/:id` carries the client PATCH. |
| Advisor/admin edit from detail (reuse PATCH); analyst read-only; edits audited | MATCHES | Configure button gated by role; analyst read-only (T-5 S4); active-lock 409; edits audited `mandate-configure`. |
| **D6** deferred placeholders (Buyer Engine / Ranked Candidates / Pipeline) rendered as labelled "coming in a later step" mount points | MATCHES | `DeferredPlaceholder.tsx` + `MandateDetailClient.tsx:750-760` render all 3 with "…will appear here in a later step." C-2+T-5 live DOM confirms all 3 present. NOT built, NOT dropped. |

Edge cases: not-found→404 (design), analyst read-only (live), SSR-hydrated (own probe), read-schema accepts real serialization (detail renders live).

---

## Key intent checks (the honest questions)

1. **M4 success-metric first-half genuinely delivered LIVE, not faked?** — **YES.** create→configured-mandate→persisted→viewable is proven end-to-end on the live `46642e7` deploy by THREE independent methods: C-2 FINAL (real headless chromium: form filled → 201 → URL redirects to `/mandates/<id>` → detail renders seller/US/derived-disclaimer/draft/3-placeholders → list shows exactly ONE row, no duplicate), Karen's own cookie-jar HTTP re-run, and my own deployed-hash + anon-RBAC + web-SSR probes. C-2 honestly FAILED twice (detail-shadow DEFECT-1, jurisdiction-seed DEFECT-2, then flat-response-parse defect) before the genuine PASS — not green-test amnesia.

2. **Buyer-universe builder correctly DEFERRED (not falsely complete)?** — **YES.** M4 metric SECOND half ("analyst assembles/enriches a buyer universe ready to rank") is explicitly the next M4 bundle (product-decisions.md M4 bundle log + journey-map row 8 `/mandates/:id/buyers`). Detail ships D6 labelled placeholders as stable mount points — the bundle claims only the first half, no false full-metric completion.

3. **Compliance-first intent (captured-not-enforced; disclaimer DERIVED not picked)?** — **YES, consistent.** (a) UI framing is real (MandateForm:777-782 amber note, explicit "not enforced at this step"; MandateDetailClient:673 "Captured for the compliance gate — not enforced at this stage") — no false-safety. (b) disclaimer is DERIVED server-side from jurisdiction (service:116 `findActiveDisclaimerByJurisdiction`; schema:227-238 "DERIVED … never user-supplied"), matching decision #8 jurisdiction-keyed templates and D2 — the create form has a jurisdiction dropdown only, NO disclaimer picker (confirmed: the single `disclaimerTemplateId` string in MandateForm is a code comment). (c) Enforcement correctly deferred to M6 pre-send gate (the M2 non-bypassable gate the profile persisted here will later be read by) — consistent with the M2 pre-send-gate design.

4. **Genuine reuse (M1 RolesGuard, M2 AuditService, M2 disclaimer_templates FK, M3 canonical criteria fields)?** — **YES.** M1 RolesGuard (advisor/admin @Roles; live RBAC matrix), M2 AuditService.append last-in-txn (audit enum extended, not re-implemented), M2 disclaimer_templates via the ONE FK. M3-canonical-fields alignment correctly SOFTENED per D1 (only `sector`/industry aligns to a shipped M3 column today; geo/size_band/deal_type are mandate-side capture presuming later M3 enrichment) — the 3-table justification stands on the criteria table being queryable + compliance being M6-readable, not on cross-filtering M3 today. No re-implementation.

5. **D1-D6 all delivered live?** — **YES, all 6.** D1 alignment-claim softened (schema comments + criteria on own table). D2 derive-no-picker (service derive + jurisdiction-only dropdown). D3 seller_geo (text[]) + seller_size_band columns present. D4 suppression_scope as JSONB scalar (MandateForm comment: text/tags, CSV dropzone simplified — stated in copy). D5 three attestation boolean columns, all-3-required (400 otherwise, `z.literal(true)` + service `!== true` guard, live-verified 400). D6 detail placeholders present. **No drift.**

6. **Any invention beyond scope / omission the metric requires? Detail matches design (SSR not raw JSON — the C-2 fix)?** — **NO invention** (no speculative criteria DSL, suppression a captured scalar not a file-parse pipeline, no M5/M6 logic built). **NO omission** of the first-half metric. Deployed detail matches `design/mandate-detail.html` structure (profile + criteria + compliance + Buyer Engine / Pipeline anchors) and is served as Next.js SSR HTML — the C-2 DEFECT-1 (Express raw-JSON hijack) is genuinely fixed, confirmed by my own `x-powered-by: Next.js` probe.

---

## Non-blocking notes (shared with Karen; not drift/gap)
- Deployed `46642e7` trails main-tip `e57be83` by 2 commits (`a061c57` acks-service-harden, `1312fb4` hide-analyst-CTA + reliable client 3-ack validate). Both are defense-in-depth / cosmetic: the load-bearing acks enforcement (`z.literal(true)` in the controller path) is ALREADY live (acks-false→400 confirmed by C-2+Karen); the analyst CTA leaks no privilege (POST→403 + server redirect live). ACCEPTABLE to ship next deploy — nothing blocks the wave. Consistent with Karen finding 17-18.
- T-5 FINDING-W8-4 (TopBar shows "Dashboard" on mandate pages) — Low, cosmetic, recurring; logged, non-blocking.

```yaml
jenny_verdict:
  verdict: APPROVE
  stage: V-1
  blocks:
    ba0edebf: MATCHES   # spine + create/configure — 6/6 AC
    c070ca23: MATCHES   # mandates-list — 3/3 AC
    50227055: MATCHES   # mandate-detail + D6 — 3/3 AC
  drift_count: 0
  gap_count: 0
  deployed_hash: "46642e7"
  live_reverified: true       # own probes: /health hash, anon 401x3, web /mandates/:id => Next.js SSR (not Express)
  d1_d6_all_delivered: true
  m4_first_half_metric_live: true
  buyer_universe_correctly_deferred: true
  compliance_captured_not_enforced_framing_real: true
  disclaimer_derived_no_picker: true
  blocking_items: []
```

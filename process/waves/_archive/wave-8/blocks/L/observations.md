# Wave 8 — L-block Observations

Mandate spine (M4 create/list/detail) shipped + live-verified at commit `e57be83`.
Synthesized by `knowledge-synthesizer` against wave-8 deliverables (C-2 deploy-and-verify,
B-6 review) + the wave-4/5/6/7 carry-forward queue, then reality-checked and dispositioned
by `head-learn`. Cross-wave glob path is canonical `blocks/L/observations.md`
(future L-2 reads `_archive/wave-*/blocks/L/observations.md`).

Reviewer note: the entire wave-8 defect chain was invisible to green CI + unit tests and
surfaced exclusively through live-deploy + real-browser verification. `head-learn` verified
each claim below against the actual C-2 and B-6 deliverable text before dispositioning; the
prompt's "7 migration rows" figure was corrected against C-2 (pre-wave baseline 6 → 8 after
0006+0007). CHANGELOG `[0.8.0]` is already authored (L-1 doc). M4 is NOT complete this wave —
the buyer-universe builder is a further M4 bundle (Deferred in CHANGELOG); M4 stays
`in_progress`, do NOT close it.

---

## OBS-W8-1: A next.config `afterFiles` rewrite whose source can match a dynamic-segment path shadows the dynamic app-router page — PROMOTED (as the parse-shape family; see disposition)

**Systemic root:** Next.js `afterFiles` rewrites defer to page routes for exact-path STATIC matches only; they do NOT defer to dynamic-segment page routes (`[id]/page.tsx`). No B-block build convention requires auditing a `next.config` rewrite `source` against the `app/` page-route namespace before the rewrite is authored. The rewrite `{source:'/mandates/:id', destination: API}` silently won over `app/(app)/mandates/[id]/page.tsx`, proxying every detail URL to Express and serving raw JSON (`x-powered-by: Express`) instead of the SSR detail page. The static `/mandates` list rewrite was safe; only the dynamic `/mandates/:id` variant collided. The config's own comment asserted the opposite and was wrong for dynamic segments.

**Plan-authoring defect trace:** The B-block proxy spec for the mandate-detail route specified an `afterFiles` rewrite at `/mandates/:id` with no requirement to audit whether a dynamic page segment already occupied that path pattern. The `afterFiles`/static-only deferral behavior was captured in no SDK-doc or build convention, so the collision was undetectable at plan time.

**Cross-wave lineage:** CONFIRMS-PRIOR OBS-W7-3 (wave-7, FIRST-OBSERVATION, warning, BUILD, carry-forward). Wave-7 = a client fetch to a same-origin path that is also a page route returns HTML. Wave-8 = a framework `afterFiles` rewrite targeting a dynamic-segment path shadows the dynamic page. Same mechanism family (a same-origin path resolves to the framework page layer instead of the intended API/proxy), distinct sub-variant (framework rewrite rule + dynamic segment vs. programmatic client fetch + page route). SECOND firing. Identical fix pattern (non-page-colliding proxy path `/mandates-data/:id` + SSR server-side reads) — C-2 explicitly calls it "an exact mirror of the wave-7 `/sourcing/company-detail/:id` collision fix." Do NOT merge with wave-4 OBS-4 (same-origin proxy for cookie-guarded routes) — that shares the FIX pattern but has a DISTINCT root cause (httpOnly cookie not sent cross-origin, not page-route namespace collision).

**Severity:** strong (upgraded from warning; 2-wave confirmed; production served raw API JSON at a compliance-sensitive detail route). **Candidate file:** BUILD. **2-wave gate:** MET.

**Disposition:** NOT promoted this wave — runner-up. `head-learn` promotes AT MOST ONE principle per wave; OBS-W8-2 outranks this on cross-cutting breadth and recurrence (see below). This candidate is genuinely enforceable (grep `next.config` rewrites, cross-check `source` against `app/**/[param]` pages) and remains CONFIRMED-AND-READY for immediate promotion the next time the parse-shape family does NOT also compete for the single BUILD slot. Promotable form on record:
`Never add a next.config rewrite whose source can match a dynamic-segment path that has an app-router page.`

---

## OBS-W8-2: Client code that parses an API response must be authored against the API's real response shape, not an assumed wrapper — PROMOTED to BUILD rule 5

**Systemic root:** No build convention requires that a client-side parse site for a mutation response (POST/PATCH) be authored from — or validated against — the API's actual serialized output shape. When a mock returns a wrapper (`{mandate:{id}}`) the API does not produce (flat `Mandate`), or a richer type (`MandateDetail`) the API does not produce (bare `Mandate`), unit tests pass green while production fails silently: `id` resolves `undefined`, the redirect never fires, the user sees a false "Failed to create mandate" error, and each retry silently duplicates the mandate. The same class also covers the ack SERVICE guard using truthiness (`!value`) instead of strict `!== true` — a Zod-bypassing caller passing `"true"`/`1` slipped the defense-in-depth layer while the schema layer + normal API path stayed guarded.

**Plan-authoring defect trace:** The B-block spec for MandateForm (create) and the PATCH configure handler did not require the author to (a) cite the exact response schema from the shared API contract, or (b) run a shape-assert fixture against the real endpoint before writing the parse site. The mock shape diverged from the contract at three distinct points within this wave (create: flat-vs-wrapped; configure: `Mandate`-vs-`MandateDetail`; ack guard: truthy-vs-strict) and none was caught until live deploy.

**Cross-wave lineage:** CONFIRMS-PRIOR OBS-W7-2 (wave-7, FIRST-OBSERVATION, strong, BUILD, explicitly labeled "Strong wave-8 candidate"). Wave-7 = web read-schemas using `.datetime()`/`.strict()` silently drop a payload when the API's real serialization differs from the mock. Wave-8 = the client parse site for mutation responses hard-codes an assumed wrapper or narrower type. Same root family ("wrong-shape mock passes CI, real API boundary breaks the client"), distinct sub-variant (mutation-response parse site vs. query read-schema). SECOND firing across waves; fired THREE times within wave-8 alone. Near-dup risk vs VERIFY rule 1 ("test recompute path against real DB wire format") is mitigated by layer: VERIFY-1 is SERVER recompute against DB wire format; this is CLIENT parse of the API RESPONSE shape at the call site. Karen confirmed no collision — the promoted rule never mentions DB or recompute.

**Severity:** strong. **Candidate file:** BUILD. **2-wave gate:** MET.

**Disposition:** PROMOTED to **BUILD rule 5** (karen APPROVE after Why-trim to ≤100 chars; deterministic linter PASS). Highest-recurrence, most cross-cutting family this wave (any client/endpoint pair, stack-agnostic; enforceable against the existing shared-Zod contract). Preventing the defect at the authoring layer beats catching it downstream.

---

## OBS-W8-3: A compliance state-machine must gate state-advancing writes; edit-after-activation is a silent correctness failure, not a runtime error

**Systemic root:** No build convention or B-6 review checklist flags the absence of a state-machine guard on update paths for domain objects with irreversible compliance states. A mandate's `active` state is a compliance commitment; allowing reconfiguration after activation silently produces an inconsistent legal record. The gap is invisible to type-checking and unit tests because the write succeeds at the DB layer — it is a correctness invariant, not a thrown exception.

**Plan-authoring defect trace:** The B-block spec for the PATCH configure endpoint enumerated field updates but carried no precondition asserting the mandate's lifecycle state. The plan treated configure as a generic update rather than a state-machine transition with a guard, so no guard was authored initially. Fixed at B-6 (37998bb): edit-while-active → 409, active→draft → 409; DB confirmed `sellerName` unchanged (lock enforced, not cosmetic).

**Cross-wave lineage:** FIRST-OBSERVATION. No prior wave observation covers compliance state-machine guarding for domain objects with irreversible states. Distinct from VERIFY rule 2 (adversarial review for auth/integrity/merge diffs — a security surface) and from the BUILD DI/migration families.

**Severity:** strong (a compliance SaaS that permits editing an active legal mandate is a product-layer correctness defect). **Candidate file:** BUILD. **2-wave gate:** NOT MET (first observation). Carry-forward — watch any future irreversible-state domain object shipped without a transition guard.

---

## OBS-W8-4: A configuration query that can return multiple candidates must fail loud (409), not silently pick one; compliance-config ambiguity is not a tie-break

**Systemic root:** No build convention requires that a query driving compliance-configuration derivation (`SELECT … LIMIT 1` for a disclaimer template) either assert uniqueness or reject the ambiguous case loudly. `LIMIT 1` with no `ORDER BY` and no DB uniqueness is non-deterministic: the same input can yield a different legal disclaimer across deployments or across Postgres plan changes. The failure is silent — 200 returned, the wrong disclaimer ships in a signed mandate, nothing logged. The fix required two layers: an application ambiguity-409 (fail-loud on `count > 1`) AND a DB partial unique index `(jurisdiction) WHERE active = true` (migration 0007).

**Plan-authoring defect trace:** The B-block spec for disclaimer derivation described the lookup as "find the active disclaimer for the jurisdiction" without specifying (a) the DB-layer uniqueness guarantee, or (b) the application behavior when the query returns more than one row. The omission left the implementation to silently apply `LIMIT 1`.

**Cross-wave lineage:** FIRST-OBSERVATION. No prior observation covers non-deterministic compliance-config derivation. Shares the "silent failure" surface with OBS-W8-2 and VERIFY-1 but is a distinct mechanism (unguarded query non-determinism, not a schema-parse failure or DB-wire divergence).

**Severity:** strong (non-deterministic legal-disclaimer derivation is compliance-critical in M&A advisory). **Candidate file:** BUILD. **2-wave gate:** NOT MET (first observation). Carry-forward — watch any future compliance-config lookup using `LIMIT 1` without a uniqueness assertion.

---

## OBS-W8-5: A UI form's selectable values must be validated at plan time against the seed/reference data that backs them; a mismatch is a silent 400 blocking every user action

**Systemic root:** No plan convention requires that a form whose dropdown values drive a server-side lookup be cross-referenced against the seed/reference data the lookup depends on. The create form offered six jurisdiction values (`us_delaware`, `us_federal`, `uk`, `eu`, `singapore`, `cayman`); the only active disclaimer template was `jurisdiction='US'`. Every non-`US` selection hit derive-no-match 400, and even the intended path emitted `us_federal` (not `US`), so a real advisor could NEVER create a mandate through the shipped UI. Invisible to unit tests (the lookup mock succeeds) and to linting (the values are valid strings).

**Plan-authoring defect trace:** The B-block spec for the create form listed jurisdiction options with no reference to the seed-data migration or the derivation's key-matching contract. The form enum and the seed jurisdiction keys were authored in separate tasks with no shared contract asserting their equality.

**Cross-wave lineage:** FIRST-OBSERVATION. No prior observation covers form-value-to-seed-data key mismatches. Shares the "mock passes, real boundary fails" surface with OBS-W8-2 and OBS-W7-2, but the broken boundary is a UI enum ↔ migration-populated reference table, not an API response shape. Tracked separately.

**Severity:** warning (blocks all users from the primary action; does not corrupt data; fix is a form/seed alignment). **Candidate file:** BUILD. **2-wave gate:** NOT MET (first observation). Carry-forward.

---

## OBS-W8-6 (carry-forward confirmation): V-block live-render-method safeguard fires a second time — NOT promoted (unverifiable-as-worded)

**Systemic root:** (Carries from OBS-W7-1.) No gate or plan convention mandates that the V-block render a UI data surface in a live post-hydration browser DOM against real seeded data before declaring it verified. All wave-8 CRITICAL defects surfaced exclusively through live-deploy + real-browser verification; green CI without a live render detects none of them.

**Cross-wave lineage:** CONFIRMS-PRIOR OBS-W7-1 (wave-7, FIRST-OBSERVATION, strong, VERIFY, carry-forward). SECOND firing. Load-bearing variable remains *live post-hydration render*. Near-dup risk with VERIFY-1 (server recompute vs DB wire format) and T-5-1 (CORS/cookie via real browser).

**Severity:** strong. **Candidate file:** VERIFY. **2-wave gate:** MET on recurrence — but **NOT promoted.** Karen REJECTED the promotable form as not deterministically checkable ("what counts as a UI data surface? every surface? which?" is reviewer-judgment, not a mechanical PASS/FAIL) and as a grab-bag Why bundling three unrelated failure classes (route collision + parse-shape + empty-list) into one rule, plus overlap with VERIFY-2's existing live-verification posture. Promoting it would ship observation-theater dressed as a principle. The concrete, gradeable form of this family's defect authoring is already captured at BUILD rule 5 (OBS-W8-2). Carry-forward: a future promotable VERIFY rule must name a single, mechanically-checkable assertion (e.g., "one named surface, real seeded rows, hydrated DOM row-count > 0"), not an open-ended render mandate.

---

## Cross-wave confirmation + carry-forward summary

| Obs | Cluster | Confirmation | Near-dup risk | Candidate | 2-wave gate | Disposition |
|---|---|---|---|---|---|---|
| OBS-W8-1 | next.config rewrite shadows dynamic page | CONFIRMS-PRIOR OBS-W7-3 (2nd firing) | none (distinct from wave-4 OBS-4) | BUILD | MET | Runner-up; not promoted (1-per-wave) |
| OBS-W8-2 | client parse must match real API response shape | CONFIRMS-PRIOR OBS-W7-2 (2nd firing) | adjacent to VERIFY-1 (distinct layer) | BUILD | MET | **PROMOTED → BUILD rule 5** |
| OBS-W8-3 | compliance state-machine gate on update paths | FIRST-OBSERVATION | none | BUILD | NOT MET | Carry-forward |
| OBS-W8-4 | compliance-config ambiguity must 409, not silently pick | FIRST-OBSERVATION | none | BUILD | NOT MET | Carry-forward |
| OBS-W8-5 | form enum values must match seed/reference-data keys | FIRST-OBSERVATION | shares surface w/ W8-2 family (distinct boundary) | BUILD | NOT MET | Carry-forward |
| OBS-W8-6 | V-block live-render-method safeguard | CONFIRMS-PRIOR OBS-W7-1 (2nd firing) | VERIFY-1 ∩ T-5-1 | VERIFY | MET (recurrence) | Not promoted (unverifiable-as-worded) |

**Carry-forward queue after wave-8:** OBS-W8-1 (next.config-rewrite-vs-dynamic-page, BUILD, CONFIRMED-AND-READY — promote next wave the parse-shape family does not also occupy the BUILD slot); OBS-W8-3/4/5 (compliance correctness, BUILD, FIRST-OBSERVATION); OBS-W8-6 (V-block live-render method, VERIFY, needs a mechanically-checkable rewording); prior open: wave-4 OBS-4, wave-5 OBS-1/2, wave-6 OBS-2, wave-7 OBS-W7-5 (none re-fired in wave-8).

**Promoted this wave:** OBS-W8-2 → BUILD rule 5. One principle, format-exact, 2-wave-confirmed, deterministically enforceable. No VERIFY promotion (karen-rejected as unverifiable). Migrations 0006+0007 journal `when` ascending — BUILD rule 4 held (no Ghost Green this wave).

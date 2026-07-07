# V-1 — jenny: spec-vs-deployed verification (wave-23 M9 seller-intent)

**Agent:** jenny (spec-compliance auditor) · **Stage:** V-1 · **Wave:** 23 (M9 seller-intent vertical)
**Authoritative spec:** seed `9e54cc11` `tasks.description` (DB) incl. P-0 CORRECTIONS [tieBreak-removed + trend-added] + SI1–SI4 · **Deployed tip:** `6c22919` (api `…-66d4`, web `…-a4f7`).
**Method:** DB spec fetch + source read of the 4 deployed blocks + live unauthed prod probes + CI e2e/scorer.spec evidence review. Authed per-mandate score NOT obtained (no prod advisor fixtures — invite→signup unavailable); limitation stated, not fabricated (per C-2's wave-21 CI-authoritative policy).

## VERDICT: **APPROVE** — 8 MATCHES / 0 DRIFTS / 1 spec-gap (already fixed in code) + 1 process flag (SI4 → N-block)

---

## Deployed-behavior evidence (live prod, unauthed)
| Probe | Expected | Observed | Source line |
|---|---|---|---|
| API `/health` | 200 version==tip | `200 {status:ok,db:ok,version:6c229197…}` — exact deployed tip, `db:ok` ⇒ RLS-GUARD passed (dealflow_app non-superuser) | live curl |
| API `GET /seller-intent` anon | 401 (mounted, fail-closed) | **401** | SellerIntentController `@UseGuards(SessionGuard,RolesGuard)` |
| API `GET /seller-intent` bogus session | 401 (not 500/leak) | **401** | SessionGuard fail-closed |
| WEB `/insights` anon | 307/200 (route live) | **307** (auth redirect; route mounted) | insights/page.tsx `redirect('/login')` |

Authed 200-body + cross-firm-negative + per-mandate direction are CI-verified: `seller-intent-isolation.e2e-spec` (SIT-1 real-service WS_A-includes / WS_B-absent as dealflow_app, SIT-2 positive control, SIT-3 fault-killing no-ALS THROW) + `seller-intent.scorer.spec` (determinism, no-Date.now/no-Math.random source-grep, SI1 no-tieBreak×3, SI2 epsilon boundary, SI3 empty/single-event, RBAC) — both RAN+GREEN in C-1 run 28858565829. **Limitation:** I did not independently execute authed-DOM in prod (no fixtures); the score logic is CI-authoritative, the mount+fail-closed is live-verified here.

---

## Drift checks (the 8 the prompt itemized)

**1. Workspace-scoped + read-only vs M8 — MATCH (crux, no drift).**
`SellerIntentRepository.getAll()` routes EVERY one of its 4 queries through `getDb(this.db)` (ALS GUC-bound handle → FORCE RLS as dealflow_app) — never `this.db` directly (repository.ts:104, doc-block lines 6–15). Service is fail-closed: `getWorkspaceId() === null → throw` at the START of `getList()` (service.ts:60–66). ZERO writes / ZERO audit rows across service+repository+controller — identical to the analytics + match-feedback read-only precedent (service.ts:16–18, controller.ts:57–59). No cross-firm leak vector; consistent with M8 isolation (wave-17) and the read-only-analytics precedent.

**2. PURE NO-LLM determinism vs the LLM deferral — MATCH.**
`seller-intent.scorer.ts` is a pure module mirroring `matching.scorer.ts`: no Anthropic/LLM/OpenAI/SDK/network/credential/randomness import; `scoreMandateIntent` reads `Date.parse(input.referenceInstant)` (a fixed passed-in ISO string, deterministic) — NO `Date.now()` inside (scorer.ts:9, 292–293; enforced by scorer.spec source-grep tests at lines 182/192). referenceInstant is derived by the service/repository (workspace max-event-ts, repository.ts:190–216) and passed in — the M5-LLM-deferral / matching.ts NO-LLM boundary is honored: a reproducible auditable score, not a black-box guess.

**3. tieBreak-removal (SI1) vs wave-19 + PRODUCT #1 — MATCH (PRODUCT #1 enforced, no drift).**
No `tieBreak` in the scorer output, the `SellerIntentBreakdown` Zod schema, the service, or the UI. breakdown = `{outreachEngagement, pipelineVelocity, matchDisposition, total, notApplied}` exactly (shared/seller-intent.ts, scorer.ts:434–440). scorer.spec asserts `'tieBreak' in out.breakdown === false` (line 211) + schema-absence + exact-key-shape (SI1 tests C). Deterministic ORDER is stabilized in the service layer by `(mandate.createdAt, mandate.id)` — NOT a scored/surfaced dimension (service.ts:116–122). This is PRODUCT-PRINCIPLES #1 ("a metric shown to users must have a real source column, not be noise by construction…") directly enforced — the wave-19 tieBreak-noise decision carried forward. The only `tieBreak` occurrences repo-wide are the pre-existing `matching.ts` scorer dimension (untouched, correct) and `match-feedback.ts` which already EXCLUDES it from the lift surface (wave-19). No re-introduction.

**4. trend/direction (heating/cooling/flat) vs the value promise — MATCH, not gold-plating.**
`direction ∈ {heating,cooling,flat}` = sign of (recentWindowScore − priorWindowScore) with pinned constants `WINDOW_DAYS=30`, `DIRECTION_EPSILON=5` (scorer.ts:63–70, 403–428). SI2 satisfied: constants are fixed + unit-tested at the boundary (delta==EPSILON→flat, delta==EPSILON+1→heating; scorer.spec D lines 273/298/337). Delivers the seed's "heating vs cooling" promise; MINIMAL (an enum + windowed basis, no time-series subsystem / charts-lib) — consistent with the "keep minimal" P-0 correction, no gold-plating.

**5. /insights seller-intent section vs journey map — MATCH (additive, no collision).**
UI is an additive `SellerIntentSection` on the existing `/insights` page alongside F1–F4 analytics (wave-18) + calibration (wave-19); no route collision (page.tsx:35–41, 644–645). Journey map T-9 updated: line 213–217 documents the seller-intent section + `GET /seller-intent` proxy + "NO tieBreak surfaced (PRODUCT #1)". SI-column rendering: notApplied signals render "—" (absence-of-data) not "0"/NaN; direction chip color-coded (heating emerald / cooling amber / flat zinc) — all present.

**6. RBAC advisor+admin — MATCH.**
`/seller-intent` → `allowedRoles: ['advisor','admin']` in shared `rbac.ts:705` (DB-authoritative pattern, same as /analytics + /match-feedback). Controller resolves roles from `rolesForRoute('/seller-intent')` and refuses to boot if it returns `[]` (RBAC-drift fail-closed, controller.ts:38–45). scorer.spec H asserts advisor+admin included, analyst/compliance excluded (lines 546/552). Consistent with wave-18/19 M9 API RBAC and DB-authoritative RBAC.

**7. _TBD metric NOW DUE — CONFIRMED, flagged for N-block (SI4).**
M9 milestone `## Success metric` is `_TBD by founder_` (DB milestone `099cee10`). This is M9's LAST buildable vertical (CRM seed `345dfbc6` remains founder-gated). The founder poll is DUE before M9 closes and is already surfaced: `process/session/updates/digest-2026-07-07-M9-metric-and-gated-pileup.md` + `founder-decision-ci-actions-blocked.md:21` ("The M9 success metric is now due"). **N-block flag:** do NOT close M9 as `done` without the founder metric decision (consistent with the waves 18–22 carry). SI4 decomposer decision-log check: the wave-23 seller-intent decomposer decision IS logged in `command-center/product/product-decisions.md` (2026-07-07 M9 bundle-authored entries) — complete.

**8. Spec-gap surfaced — the NaN-seed recency bug is ALREADY FIXED in deployed code (impl detail, not a live gap).**
The recency reducer seeds the accumulator with `completed[0]`'s effective ts rather than `''` — with an explicit comment that `Date.parse('') === NaN` would break the `>=` comparison (scorer.ts:316–322). The referenceInstant derivation uses the same `Date.parse`-based chronological max rather than lexical order, defending against UTC-offset variation (repository.ts:205–210). So the review-uncovered NaN/lexical hazard is closed in the tip that deployed. **Genuine forward-looking spec-gap (Low, → N-block, NOT blocking):** the spec fixes `referenceInstant` = workspace max-event-ts, which means a dormant mandate always reads `cooling` relative to the most-active mandate in the firm — a defensible-but-implicit semantic (SI3 documents it; scorer.ts:130–140). It is stated + boundary-tested, but the founder-facing meaning of "cooling relative to the firm's hottest deal" (vs. absolute time) is a product-semantic the spec asserted without a founder poll; worth surfacing alongside the M9 `_TBD` metric decision so the metric definition and the direction semantic are set together.

---

## Summary
- **Load-bearing invariants (M8-isolation, NO-LLM-determinism, tieBreak-removal) all MATCH** — the three the prompt flagged as most important.
- Deployed prod: `/health`==tip, `/seller-intent` anon+bogus→401 (mounted, fail-closed), `/insights`→307 (live). Authed body CI-authoritative (SIT-1/2/3 + scorer.spec green in run 28858565829); authed-DOM not independently run in prod (no fixtures) — stated, not fabricated.
- **0 DRIFTS** — no conflicting prior decision violated. PRODUCT #1 (tieBreak noise-as-signal) and the M8 read-only-workspace-scoped precedent are both actively enforced, not merely claimed.
- **N-block carries:** (a) SI4/M9 `_TBD` success-metric founder poll DUE before M9 closes; (b) Low spec-gap — referenceInstant "cooling-relative-to-firm-hottest" direction semantic to be confirmed with the founder alongside the metric definition.

```yaml
v1_jenny_verdict: APPROVE
matches: 8
drifts: 0
conflicting_prior_decision: null
spec_gaps:
  - {severity: Low, item: "NaN-seed recency / lexical-ts hazard", status: already-fixed-in-tip, ref: "scorer.ts:316-322, repository.ts:205-210"}
  - {severity: Low, item: "referenceInstant=workspace-max-event-ts → dormant mandate reads 'cooling' relative to firm's hottest; product semantic asserted without founder poll", status: stated+boundary-tested, route: N-block-alongside-M9-metric}
process_flags:
  - {id: SI4, item: "M9 _TBD success-metric founder poll DUE before M9 closes (this is M9's last buildable vertical)", route: N-block, surfaced_in: "digest-2026-07-07-M9-metric-and-gated-pileup.md + founder-decision-ci-actions-blocked.md"}
  - {id: SI4-log, item: "wave-23 seller-intent decomposer decision logged in product-decisions.md", status: complete}
deployed_evidence:
  api_health: "200 version==6c22919 db:ok (RLS-GUARD dealflow_app)"
  seller_intent_anon: "401 (mounted, fail-closed)"
  seller_intent_bogus_session: "401 (no leak)"
  insights_web: "307 (route live)"
  authed_body: "CI-authoritative (SIT-1/2/3 e2e + scorer.spec green run 28858565829); not independently run in prod — no advisor fixtures (stated, not fabricated)"
load_bearing_status:
  m8_isolation: MATCH
  no_llm_determinism: MATCH
  tiebreak_removal_product_1: MATCH
```

**ONE LINE:** APPROVE — 8 MATCHES / 0 DRIFTS (M8-isolation ✓ workspace-scoped read-only getDb+FORCE-RLS fail-closed, no audit rows; NO-LLM-determinism ✓ pure scorer no-Date.now-inside referenceInstant-passed-in; tieBreak-removal ✓ PRODUCT #1 enforced end-to-end scorer/contract/UI) — no conflicting prior decision; NaN-recency hazard already fixed in tip; SI4 M9 `_TBD` metric poll DUE → N-block.

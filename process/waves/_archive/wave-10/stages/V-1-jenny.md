# V-1 Jenny — Wave 10 (Deterministic Match Spine, M5 first bundle)

**Reviewer:** jenny (semantic-spec: DEPLOYED behavior vs SPEC-CONTRACT INTENT + boundary hold — Karen owns source-claim)
**Deployed:** api/web `0075a20` · main `a5de983` · verified 2026-07-04
**Verdict:** **APPROVE**
**Drift:** 1 (Low, journey-map stale route) · **Gap:** 1 (Medium — F-1 score_breakdown explainability does not render; corrects Karen's severity nuance)

---

## Verdict rationale

Every acceptance-criterion in the three-spec contract (47ed7ddd / fb82d339 / f74dce45) is delivered in DEPLOYED behavior, and both HARD BOUNDARIES hold with zero leakage. The M5 deterministic-half is delivered HONESTLY — the LLM/rationale half is correctly deferred (not faked, not implied). The P-4 karen MANDATORY AI-framing STRIP shipped clean live (S2 9 phrases absent, self-confirmed against the design source). The scorer genuinely discriminates on thin M3 data. The M5/M6 boundary is a status-flip sentinel only.

The single actionable gap (F-1) is the score_breakdown per-dimension explainability not rendering in the drawer. I ESCALATE Karen's F-1 from "renders nothing / degrades to No-breakdown-data" to a more precise failure mode (renders broken/blank dimension rows — see F-1 below) and confirm it IS a spec-AC-adjacent gap because the per-dimension breakdown is a NAMED AC in both fb82d339 and 47ed7ddd. It is NOT deploy-blocking (score, ranking, disposition, handoff, notApplied all work; no crash) and NOT a boundary/honesty violation. It is the single V-2/V-3 fast-fix.

---

## Per-block: MATCHES / DRIFTS

### Block 1 — Spine (47ed7ddd) — MATCHES

| AC | Verdict | Evidence |
|---|---|---|
| create-run reads submitted buyer_universe → persisted match_run + match_candidates (one per included), integer fit_score 0-100 + score_breakdown jsonb | MATCHES | C-2 LIVE: POST /matches (advisor) 201, run `1f47f6a0…`, 4 ranked candidates, status:scored, 0.13s. Migration 0009 additive (2 tables + enums + FK + indexes; UNIQUE buyer_universe_id + CHECK fit_score 0..100). |
| fit_score DETERMINISTIC + rule-based, MEANINGFULLY discriminating on thin M3 data | MATCHES | scorer.ts pure (no Math.random/Date.now; tie-break = char-code hash mod 11). C-2 LIVE spread `[37,33,32,30]` = 4 distinct, driven by contactCompleteness. Unit asserts ≥80pt best-vs-worst. See check 3. |
| ORDERED fit_score DESC via shared-Zod API; create-run + list endpoints | MATCHES | GET /matches/:id ranked; matchRankedListSchema in @dealflow/shared. |
| RBAC advisor-primary; anon 401 / unauth 403; every mutation audited last-in-txn (rollback on audit-fail); actor = users.id via getUserWithRole | MATCHES | LIVE (self-probed): unauth POST/GET /matches → 401/401. C-2: analyst POST 403, analyst GET 200, audit entriesChecked 206→207 on disposition PATCH (HMAC chain append). |
| Idempotent (one run per submitted universe; re-run reconciles); submit-guard (400 if not submitted) | MATCHES | C-2 LIVE: re-POST → SAME run id AND accepted candidate STAYS accepted; draft universe → 400. |
| ALL schema ADDITIVE; no score/rank column on M4 tables; migration journaled + .down.sql | MATCHES | 0009 additive-only, journal idx-9, .down.sql drops children-first. No M3/M4 alteration. |
| HARD BOUNDARY: no Anthropic/Claude/LLM, no BullMQ, no rationale-text | MATCHES | See check 1. scorer.ts header + Karen grep: zero real imports; 0.13s sync (no external-API signature). |

### Block 2 — Page (fb82d339) — MATCHES (with F-1 gap on the explainability sub-AC)

| AC | Verdict | Evidence |
|---|---|---|
| /matches-shortlist ranked list SSR-hydrated; reachable from mandate flow | MATCHES | C-2 LIVE: 200, 39KB SSR HTML, scores 37/33/32/30 in rendered React. Mandate-detail "Ranked Candidates" → matches-shortlist link (T-5 S4-f live). SSR via /matches-data proxy (no page-route collision). |
| score framed RULE-BASED, NOT AI; no implied AI-generated rationale | MATCHES | See check 2. Live S2: 9 phrases absent; "rule-based" ×5, "fit score" ×7, "score breakdown" ×9. |
| score explainability shown per buyer (score_breakdown / per-dimension) | **DRIFTS (F-1, Medium)** | Per-dimension bars do NOT render correctly — write/read shape mismatch. Headline score, disposition, notApplied DO render. See F-1. |
| empty/no-run state (no crash) | MATCHES | T-5 S1: empty state "No match run yet" + Create-Match-Run CTA, role=alert error surface, no crash. |

### Block 3 — Accept/reject/handoff (f74dce45) — MATCHES

| AC | Verdict | Evidence |
|---|---|---|
| advisor/admin accept/reject/flag each candidate → shortlist; audited; actor-id | MATCHES | C-2 LIVE: PATCH candidate→accepted persists; audited (chain increment). Cross-run-scoped PATCH (AND match_run_id → 404). |
| accepted shortlist marked READY-FOR-OUTREACH (persisted status M6 reads); NO outreach | MATCHES | See check 4. service `handoffAsActor` sets ready_for_outreach=true only; ":359 NO outreach executed here — M6 handoff sentinel only". |
| handoff guard on ACCEPTED count (≥1); idempotent re-handoff | MATCHES | C-2 LIVE: 0-accepted → 400; ≥1 → 2xx readyForOutreach:true; re-handoff idempotent 2xx. |
| shortlist listable; analyst read-only | MATCHES | T-5 S3-a: analyst sees no Create/Accept/Reject/Handoff controls; read-only. |

---

## Key intent checks

### 1. M5 DETERMINISTIC-half HONESTY — MATCHES (clean)

M5's full `## Success metric` names "integer fit-scores (0-100) **+ explainable rationale per buyer**". This bundle delivers the DETERMINISTIC half only: ranked list + integer fit-scores + accept/reject/flag + ready-for-outreach handoff. The LLM/rationale half is deferred, NOT faked:
- product-decisions.md [2026-07-04] M5 bundle-authored entry explicitly slices "the DETERMINISTIC match spine only, with ZERO Anthropic/Claude/LLM dependency and ZERO API spend" and defers the LLM-assisted ranking + rationale to a later M5 bundle carrying the wave-9-close BOARD gates a–f (SDK-research, provider-agnostic gateway, zero-retention DPA, rationale-as-audit-read, load-test/explainability, LLM-spend Tier-3).
- Milestone stays `in_progress` (NOT prematurely closed); N-1 note: "M5's ## Scope is NOT yet fully decomposed — the LLM-rationale second vertical remains."
- No AI-rationale is implied anywhere: journey-map line 40 states plainly "The score is RULE-BASED — NOT AI-generated (no LLM/rationale this bundle; the LLM-assisted ranking + explainable rationale is a later, gated M5 bundle)."
- Grep-confirmed (Karen + scorer header): zero anthropic/bullmq/langchain/openai real imports; scorer is a pure integer function.

No drift where M5 is claimed complete or AI-rationale is present/implied. This is honest deterministic-half delivery.

### 2. AI-framing STRIP (karen MANDATORY / CODE-OF-CONDUCT provenance) — MATCHES (correct compliance-first disposition)

The design source `design/matches-shortlist.html` DID carry the false AI-capability framing (confirmed by me):
- `:619` `<i data-lucide="bot">` + "AI Match Analysis"
- `:607` "Rationale Explainability Engine" · `:687` "Model Data Freshness" · `:702` "AI rationale is generated deterministically… to improve model"
- `:679` fabricated cross-client "Included in shortlists by DealFlow AI clients for 5 similar mandates in Q2" — a signal NOT in the deterministic scorer inputs.

The shipped page STRIPS all of it. Live S2 (T-5) + C-2 self-grep: all 9 forbidden phrases ABSENT from the rendered 39KB HTML. The only "AI-powered" string is the site-wide `<meta name="description">` marketing tagline present on EVERY page (incl. /login) — a product descriptor, not a scorer capability claim; correctly judged non-violating. Shipped strings are "Rule-based fit score" (emerald pill, not bot badge), "Score breakdown" (not Explainability Engine), "ordered by rule-based fit score", "Fit score ↓ (deterministic)". The `.tsx` grep hits are removal-documenting comments only.

This is the correct compliance-first, CODE-OF-CONDUCT-compliant disposition: the bundle refused to hydrate-per-design blindly and instead reframed to match the actual (deterministic) capability. No residual paraphrased AI-capability language found. **No fabricated cross-client signal ships.** MATCHES.

### 3. Deterministic scorer MEANINGFUL — MATCHES

The scorer is honest and discriminating, NOT hollow-uniform:
- Weights: sector 0/20/30/60, contact-completeness 0/15/30, deterministic tie-break 0..10. This is exactly the problem-framer's load-bearing P-2 requirement (graded sector + contact tiers + deterministic tie-break to avoid a near-flat ranking on ~2 live dimensions).
- LIVE C-2 real-data spread `[37,33,32,30]` = 4 distinct scores, driven by contactCompleteness (candidates with M3 contacts rank higher). NOT uniform.
- The spread being in the 30s (not 90s) is HONEST for thin M3 data: same-sector buyers get sectorMatch=60 only on a full token match; the observed candidates evidently score partial/neutral sector + varying contact tiers + tie-break — a truthful reflection of the sparse data, exactly what the problem-framer flagged. The ranking still discriminates, which is the AC.
- Unit test asserts ≥80pt best-vs-worst gap on constructed data (real assertion, not tautology). MATCHES.

### 4. M5/M6 boundary — MATCHES (handoff = status only, no outreach)

`matching.service.ts` `handoffAsActor` sets `ready_for_outreach=true` and nothing else — `:359 "NO outreach executed here — this is the M6 handoff sentinel only"`, `:394 "M6 sentinel — NO outreach executed here"`. No sendEmail / template / compliance-pre-send-gate path in the module. Cross-checked M6 scope (milestone `a068dc3d`): M6 owns the template library + non-bypassable pre-send compliance gate + outreach composer, and `## Depends on: M2, M5` — it READS the ready-for-outreach handoff this bundle persists. Boundary held. MATCHES.

*(Minor copy note, aligns with Karen F-5: the handoff CTA copy "Compliance checks auto-run on confirm" is a forward-looking M6 promise. Not an AI-provenance violation and boundary in CODE is clean; flagged for D/L copy polish only — "Compliance checks run at outreach" would be truer. Not a V-gate item.)*

### 5. Reuse — MATCHES (genuine, no re-invent)

- match_candidates FK→M4 buyer_universe_candidates (score lives on the NEW table, NOT bolted onto M4 rows — M4/M5 boundary respected; problem-framer verified buyer-universe.ts carries no score/rank column).
- Score inputs: M3 companies.sector + contacts (contact-completeness), M4 mandate_buyer_criteria dims. ScorerCompany/ScorerContact/ScorerCriteria read exactly these; unsupported geo/sizeBand/dealType recorded in notApplied provenance (wave-9 graceful-degradation), never a crash.
- M1 RolesGuard/getUserWithRole (RBAC + actor-id) + M2 AuditService (last-in-txn) reused, not rebuilt.
Genuine reuse. MATCHES.

### 6. Invents-beyond / omits — 1 GAP (F-1), 1 DRIFT (journey route)

**F-1 (Medium, GAP — corrects Karen's severity nuance):** the score_breakdown per-dimension explainability does NOT render, and I find the failure mode is WORSE than Karen described.
- **Where:** scorer emits FLAT `{sectorMatch: number, contactCompleteness: number, tieBreak: number, total, notApplied}` (`matching.scorer.ts:285-291`). Client reads NESTED objects `breakdown?.sectorMatch as {score, weight, label}` (`MatchesShortlistClient.tsx:65-72`).
- **Karen said** the truthy guards fall falsy → zero bars → "No breakdown data available." **That is not what happens.** The scorer emits `sectorMatch: 60` — a *truthy number* — so `{sectorMatch && <BreakdownDimension.../>}` (`:191`) PASSES. `BreakdownDimension` renders with `score={sectorMatch.score}` = `undefined` (nested access on a primitive). In `BreakdownDimension` (`:289`) `Math.min(100, Math.max(0, undefined))` = `NaN` → the row renders with its fallback label ("Sector / industry match") but a blank/`undefined` score value and a `NaN%`-width (empty) bar. Same for contactCompleteness and tieBreak.
- **Net deployed UX:** the drawer shows THREE broken dimension rows (correct labels, blank scores, empty bars) + the correct notApplied list — NOT a clean "No breakdown data" fallback. Slightly worse than Karen's read; same root cause and same fast-fix.
- **Is this a spec-AC gap?** YES, partial. The per-dimension score_breakdown / explainability IS a NAMED AC (fb82d339: "score_breakdown/explainability shown per buyer"; 47ed7ddd: "score_breakdown jsonb — per-dimension contribution + provenance"; problem-framer called the per-dimension breakdown "genuinely actionable… explainable from components ALONE"). The jsonb IS persisted correctly (backend AC met); only the UI PROJECTION of the per-dimension contribution is broken. So it is a real gap against the explainability sub-AC, but the load-bearing metric (ranked list + integer scores + accept/reject + handoff) is fully delivered.
- **Not deploy-blocking / not a boundary or honesty violation:** score gauge, total, disposition, ranking, notApplied all render; no crash; framing stays rule-based. Single V-2/V-3 fast-fix: align client to read flat numbers (or export a shared `ScoreBreakdown` type so both bind one shape — prevents recurrence, per Karen's cross-agent note to @code-quality-pragmatist).

**Journey-map route DRIFT (Low):** `user-journey-map.md:38` table row still lists the OLD route `/mandates/:id/matches` for "Matches & shortlist" while the wave-10 prose (`:40`) and the live deploy use `/matches-shortlist?mandateId=`. Cosmetic stale-route in the inventory table; the live link IS correct (T-5 S4-f). Flag for L-1 doc pass.

Nothing invented beyond journey/design/M5-scope. No AC omitted except the F-1 UI-projection gap above.

---

## Cross-agent follow-ups
- **@head-verifier (V-2/V-3):** F-1 is the single actionable fast-fix (score_breakdown UI projection). Corrected failure mode: broken/blank dimension rows render (not a clean fallback) — the fix must render REAL flat numbers, verify visually.
- **@task-completion-validator:** after F-1 fix, confirm the drawer renders three dimension bars with real scores + widths (not undefined/NaN) end-to-end on a live scored run.
- **@code-quality-pragmatist:** export `ScoreBreakdown` from `@dealflow/shared` so scorer + client bind one contract (root cause = write/read shape drift).
- **L-1/L-2:** (a) journey-map:38 stale route; (b) handoff CTA copy "Compliance checks auto-run on confirm" → "run at outreach"; (c) plan-authoring-defect candidate already noted by P-4 karen (design-exists ≠ design-conforms-to-boundary).

```yaml
v1_reviewer: jenny
verdict: APPROVE
blocks: {spine_47ed7ddd: MATCHES, page_fb82d339: MATCHES-with-F1-gap, handoff_f74dce45: MATCHES}
boundaries: {deterministic_vs_llm: HELD, m5_m6_outreach: HELD, ai_framing_strip: SHIPPED}
counts: {drift: 1, gap: 1}
findings:
  - {id: F-1, severity: Medium, type: gap, spec_ac: "score_breakdown per-dimension explainability (fb82d339 + 47ed7ddd)", deployed: "3 broken/blank dimension rows render (write/read shape drift); score/rank/disposition/handoff/notApplied all correct", blocking: false, disposition: v2-v3-fast-fix, note: "corrects Karen F-1 failure-mode: NOT clean fallback, renders undefined/NaN rows"}
  - {id: D-1, severity: Low, type: drift, where: "user-journey-map.md:38", detail: "table row lists old route /mandates/:id/matches; live + prose use /matches-shortlist?mandateId=", disposition: L-1-doc-pass}
```

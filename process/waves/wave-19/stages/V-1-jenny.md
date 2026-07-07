# V-1 — jenny (spec-vs-deployed semantic verification) — wave-19 M9 match-calibration

**Verdict: APPROVE** — 7 MATCHES / 0 spec-drift-defects / 2 sound-drift-with-rationale / 2 spec-gaps-surfaced-for-next-P-2.
**Deployed LIVE @3cc58de** (independently confirmed: `/health.version == 3cc58decb40a209e1dc4f7ba096d5e05461c5394`, `db:ok`).
**Authoritative spec:** seed `5568ad44` `tasks.description` (DB, read this turn) + the 3 sibling ACs (69387b56 / e206a56a / 077974a2).
**Authed limitation (honest):** no prod advisor fixtures on this deployment → authed-200 calibration payload NOT observed live (would be fabrication). Isolation + RBAC proof carried by CI e2e on the exact deployed SHA + live unauthed gating. Stated, not papered over.

---

## The three load-bearing checks (per prompt priority)

### 1. M8 isolation intent — "a firm sees ONLY its own calibration" — **MATCH**
- **Spec (seed 5568ad44 AC2 + edge-cases):** "EVERY query runs through getDb(this.db) under app.workspace_id GUC + FORCE RLS … NO raw off-GUC/module-singleton query"; T-8 cross-firm negative-read via the REAL service.
- **Deployed:** `match-feedback.repository.ts:125,185` — both query methods use `getDb(this.db)` (no `this.db` direct query anywhere; header comment lines 6-16 codify the invariant). Service (`match-feedback.service.ts`) holds no Drizzle handle — isolation enforced structurally at repo layer.
- **Proof (CI authoritative, single-firm prod):** `match-feedback-isolation.e2e-spec.ts` ran + PASSED in CI run 28836091590 on deployed SHA — **7 tests, 0 skipped** (log line `✓ test/match-feedback-isolation.e2e-spec.ts (7 tests) 1629ms`; MFC-1 explicitly `✓ … totalDecided reflects WS_A … WS_B excluded 492ms`). Test invokes the **REAL** `MatchFeedbackService` via `workspaceAls.run` as **dealflow_app** (`SET ROLE dealflow_app` line 542, FORCE RLS). **MFC-4 fault-killing** (lines 656-685): no-ALS singleton total must differ from ALS-scoped total — collapses to failure if `getDb` is ever replaced by raw `this.db`. Non-skipped, non-hollow (the wave-18 B-6 lesson held on attempt 1 per B-6-review.md).
- **Live prod (independent, this turn):** `…-66d4/match-feedback` anon → **401** (mounted + fail-closed). Cross-firm leak vector is a workspace-scoped read; single-firm prod can't exhibit it → CI is authoritative and green. **No cross-firm calibration leak. M8 intent honored.**

### 2. Read-only DISPLAY vs founder-gated ML/scorer-retrain — **MATCH**
- **Spec (AC4):** "READ-ONLY … no scorer retrain, no model mutation … NO LLM/ML (matching.ts NO-LLM boundary; scorer-retrain is founder-gated + deferred)."
- **Deployed:** repository has ZERO INSERT/UPDATE/DELETE (header lines 17-19); service header lines 13-16 assert "No scorer-retrain. No LLM/ML import. NO Anthropic/Claude/BullMQ import." Controller (`match-feedback.controller.ts:20-21`) — GET only, "appends ZERO audit rows." Confirms the matching.ts NO-LLM boundary + M5-LLM deferral. **No drift into a founder-gated ML loop.** Shipped exactly as the read-only calibration DISPLAY the P-3 plan chose (scorer-retrain alt REJECTED as ML/founder-gated).

### 3. Metric integrity — tieBreak drop / small-sample caveat / null→n/a — **SOUND DRIFT-WITH-RATIONALE (not a defect)**
- **Spec said 3 dimensions** (seed AC1 + decomposer decision line 406: `score_breakdown: sectorMatch/contactCompleteness/tieBreak`). **Shipped 2** (`repository.ts:69` `DIMENSIONS = ['sectorMatch','contactCompleteness']`; contract `match-feedback.ts:168`; UI `insights/page.tsx:26`).
- **Judgment — this is a metric-HONESTY correction, not spec-drift-defect.** tieBreak = `deterministicTieBreak(candidate.id)`, a pure hash of the row ID — **uncorrelated with acceptance by construction**; any apparent lift is a sampling artifact (noise). Surfacing it to M&A advisors as a "dimension lift" would present noise as signal → violates **CODE-OF-CONDUCT §metric (no misleading metric)**. The drop is documented at 4 layers (repo 61-69, contract 23-28/140-143, UI 26, e2e MFC-3 `expect(dims).not.toContain('tieBreak')` line 645) and was **blessed by /review + B-6** (B-6-review.md:6-7 — P2 metric-honesty fix, commits 6f95607 backend / 83dddda UI). This is the intended sense of the spec ("computable over REAL columns", "no vanity-metric") better served than the literal 3-item list. **Dropping a by-construction-noise dimension to avoid a misleading metric is sound drift-with-rationale, not a defect.**
- **Small-sample caveat (added, honest):** `insights/page.tsx:169` `LOW_SAMPLE_THRESHOLD = 5`; decidedCount < 5 → "X.X% (n=N)" muted (zinc-400 not emerald) so a 1-row "100%" isn't read as a strong signal. Spec did not require it — additive honesty.
- **null→n/a (spec-honored):** AC3 "empty→null/n-a (no div-by-zero)". `repository.ts:150,254` acceptRate=null when decidedCount=0, 0 when decided>0 & accepted=0; contract `match-feedback.ts:98,127` `.nullable()`; UI renders null→"n/a", 0→"0%" (page.tsx:568-570, header 27). G2 non-conflation is explicit. **Honest metric, CODE-OF-CONDUCT consistent.**

---

## Remaining spec checks

### 4. Calibration section on /insights vs wave-18 dashboard — **MATCH**
- **Spec (AC 077974a2):** section on existing /insights page, design-system reuse, NO charts-lib/real-time/export, empty-state graceful, RBAC-gated.
- **Deployed:** `insights/page.tsx` — additive section "C — Match Score Calibration" (header line 23-29) on the SAME wave-18 page; **no new route → no route conflict**. `CalibrationSection` (line 583) has error state (585), empty state (607 "Not enough decided matches yet"), design-system zinc/emerald cards. No charts library imported. Proxy: `/match-feedback` afterFiles rewrite (header 40) + SSR `apiBase()` cookie-forwarded no-store (header 8-11).
- **Journey map (T-9): updated** — `user-journey-map.md:201-205` "Match-score calibration (M9 wave-19, LIVE @3cc58de)" with the honest-metrics note (tieBreak noise-dimension excluded, small-sample n=X caveat, null→n/a). **Live:** `…-a4f7/insights` anon → 307→/login (mounted, fail-closed).

### 5. RBAC advisor+admin — **MATCH** (consistent with wave-18 analytics + DB-authoritative RBAC)
- **Spec (AC e206a56a):** advisor+admin 200 / analyst+compliance 403 / anon 401.
- **Deployed:** `rbac.ts:656-658` `/match-feedback → allowedRoles: ['advisor','admin']`. Controller (`controller.ts:37-44`) fail-closed-at-boot (`rolesForRoute()==[] → throw`, mirrors AnalyticsController). Unit tests (`match-feedback.spec.ts:383-412`): advisor→200, admin→200, analyst→403, compliance→403, anon→401 (22 tests green in CI). Roles resolved DB-authoritatively via RolesGuard. **Live anon 401 confirmed.**

### 6. _TBD success metric — **MATCH** (consistent with wave-18/M8 pattern)
- Spec: "M9 quantitative success metric founder-TBD (poll before M9 close, not a build hard-stop)." Build was made against the qualitative intent (does higher score predict acceptance) — same posture as M8's qualitative metric + wave-18. Not a V-block blocker; **flag for N-block: founder poll on the quantitative M9 metric before M9 closure.**

### 7. Spec-gap detection (surface for next-wave P-2)
- **GAP-A (tieBreak noise):** the spec's literal 3-dimension list did not anticipate that one dimension is uncorrelated-by-construction. The B-block honesty correction was the right call, but **next P-2 authoring over score_breakdown should pre-classify predictive vs structural-noise dimensions** rather than list them uniformly.
- **GAP-B (small-sample honesty):** spec required null-vs-0 but did NOT require a low-n caveat; a single-row "100%" cohort is technically non-null but misleading. B-3 added `LOW_SAMPLE_THRESHOLD`. **Next P-2 for any rate/aggregate surface should specify a confidence/low-n treatment as an explicit AC**, not leave it to B-block discretion.
- (Neither is a wave-19 defect — both were caught and resolved in-branch; surfaced so P-2 anticipates them.)

---

## Drift ledger
| # | Spec | Shipped | Classification |
|---|---|---|---|
| tieBreak | 3 dimensions incl. tieBreak (AC1 + decomposer #406) | 2 dimensions (tieBreak dropped) | **Sound drift-with-rationale** (metric-honesty, CODE-OF-CONDUCT §metric; /review+B-6 blessed) — NOT a defect. Conflicting prior artifact = decomposer line 406's 3-item list, superseded by B-6 honesty ruling. |
| small-sample | not specified | low-n "(n=N)" muted caveat added | Additive honesty (spec-gap filled), no drift |

No spec-drift-defect (code-wrong-vs-intent) found. The one literal-list divergence is a rationale-backed honesty improvement, blessed at review.

---

```yaml
v1_reviewer: jenny
verdict: APPROVE
deployed_commit: 3cc58decb40a209e1dc4f7ba096d5e05461c5394
matches: 7
spec_drift_defects: 0
sound_drift_with_rationale: 2   # tieBreak-noise-drop, (implicitly) small-sample additive
spec_gaps_surfaced: 2           # dimension-noise-preclassify, low-n-confidence-AC
authed_live_limitation: "no prod advisor fixtures -> authed-200 calibration payload not observed; isolation+RBAC authoritative via CI match-feedback-isolation.e2e (7 tests, 0 skipped, MFC-4 fault-killing) on deployed SHA + live anon 401/307 gating"
load_bearing_confirmed:
  - m8_isolation: "getDb on every query (repo:125,185); CI e2e REAL service as dealflow_app FORCE RLS, MFC-1 cross-firm exclusion + MFC-4 fault-killing PASS; live anon 401"
  - no_scorer_retrain: "zero writes, no LLM/ML/Anthropic/BullMQ import; matching.ts NO-LLM boundary + M5 deferral honored"
  - tiebreak_drop: "metric-honesty correction (hash-of-row-id, uncorrelated by construction); CODE-OF-CONDUCT §metric; /review+B-6 blessed (commits 6f95607/83dddda) — sound drift, not defect"
live_probes_independent:
  - "api …-66d4/health: 200 version==3cc58de db:ok"
  - "api …-66d4/match-feedback anon: 401 (mounted, fail-closed)"
  - "api …-66d4/compliance/audit-log/verify anon: 401 (not 500 — chain intact)"
  - "web …-a4f7/insights anon: 307 -> /login"
next_block_flags:
  - "N-block: founder poll on quantitative M9 success metric before M9 closure (_TBD, per spec)"
  - "next P-2: pre-classify predictive-vs-noise score dimensions; specify low-n confidence treatment as explicit AC"
```

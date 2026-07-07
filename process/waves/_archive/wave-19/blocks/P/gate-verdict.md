# Wave 19 — P-4 Gate verdict (Phase 1, Attempt 1)

**Block:** P (Product) | **Wave:** 19 — M9 matching-feedback calibration (multi-spec, 4 blocks)
**Gate:** P-4 | **Phase:** 1 | **Attempt:** 1
**Agent:** head-product (fresh spawn)
**verdict_source:** this file

```json
{
  "agent": "head-product",
  "stage": "P-4",
  "status": "gating",
  "block_state": {
    "claimed_task_ids": ["5568ad44-3702-46d5-809a-40c1de0a2035", "69387b56-2366-4343-809d-3a6e75129753", "e206a56a-b98a-4533-b31e-ba91fae6327e", "077974a2-9be9-4a29-a13e-6ac1d7b78e35"],
    "design_gap_flag": false,
    "spec_contract": "seed 5568ad44 tasks.description (DB, authoritative)",
    "escalation_log": [],
    "reviewer_verdicts": { "problem-framer": "PROCEED", "ceo-reviewer": "PROCEED-HOLD-SCOPE", "mvp-thinner": "OK-no-split" }
  }
}
```

## VERDICT: APPROVED

A read-only matching-feedback calibration vertical (aggregation → shared contracts → RBAC API → /insights section) over already-shipped `match_candidates`, a near-clone of the wave-18 analytics vertical. Every load-bearing invariant from the wave-18 lessons (vanity-metric + hollow-test) is closed with a binary, source-verified, falsifiable AC. No REWORK defect. Proceed to Phase 2.

## Judge findings (source-verified, not framer-trusted)

### 1. COMPUTABILITY (wave-18 karen vanity-metric lesson) — PASS, verified against REAL schema
Confirmed directly in `apps/api/src/db/schema/matching.ts` + `packages/shared/src/matching.ts` (control-plane DB holds only tasks/milestones/waves; app schema verified in code, the true source of truth):
- `match_candidate_disposition` pgEnum = `pending | accepted | rejected | flagged`. The AC "only DECIDED (accepted/rejected) count toward the rate; pending/flagged excluded from the denominator" is **sound and empty-state-safe** — the two decided states exist as first-class enum members.
- `fit_score` = `integer('fit_score').notNull()`, CHECK 0–100 → co-populated, no NULL-band pathology. Accept-rate-by-fit_score-band is real.
- `score_breakdown` JSONB is typed by `scoreBreakdownSchema` with flat numbers `sectorMatch`, `contactCompleteness`, `tieBreak` — the per-dimension acceptance-lift is computable exactly as specced (does that dimension track advisor acceptance).
- This is a **real calibration insight (does the deterministic score predict accept/reject; which dimensions track acceptance), NOT a vanity metric.** The wave-18 karen lesson is answered against real columns, not asserted.

### 2. ISOLATION AC (post-M8/wave-18 load-bearing) — PASS, falsifiable + REAL-service anchored
- Spec mandates **EVERY query via `getDb(this.db)` → `app.workspace_id` GUC + FORCE RLS** (own-firm only; NO raw off-GUC / module-singleton aggregation). The reuse target exists: `apps/api/src/modules/analytics/analytics.repository.ts` uses exactly this pattern.
- The T-8 cross-firm negative-read runs through the **REAL MatchFeedbackService**, cloning `apps/api/test/analytics-isolation.e2e-spec.ts` — which explicitly drives the real service via `workspaceAls.run` + a `dealflow_app` (NOSUPERUSER NOBYPASSRLS) GUC-bound handle under FORCE RLS, and carries the **AMP-4 fault-killer**: a no-ALS-context call yields a DIFFERENT result, so a `getDb → raw.db` regression is DETECTABLE. The spec names this pattern and forbids re-implemented inline SQL — the wave-18 B-6 hollow-test lesson is pre-empted at spec-time. A cross-firm calibration leak (which would undo M8) is a **falsifiable** regression guard, not an aspiration.

### 3. READ-ONLY, no scorer-retrain — PASS
Spec is disciplined: read-only DISPLAY only; the service "writes nothing (no scorer retrain, no model mutation, no audit row on a read)"; NO LLM/ML (the `matching.ts` NO-LLM hard boundary; scorer-retrain is founder-gated + deferred). No smuggled ML loop. `schema_change: false`, `new_secret: false`, `new_sdk: false` in P-3.

### 4. AC QUALITY — PASS
- Empty-state: 0 decided → null/n-a, no division-by-zero; null represented explicitly (not NaN/undefined) in the shared-Zod shape.
- RBAC: binary + observable — advisor+admin **200** / analyst+compliance **403** / anon **401**. Negative-role constraint is explicit (analyst/compliance forbidden), satisfying the SoD negative-test requirement.
- No gold-plating: NO charts-library, NO real-time, NO export (ceo-reviewer HOLD-SCOPE honored). No scope smuggle — every claimed_task_id traces to the P-0 AI-matching bet.

### 5. _TBD quantitative metric — PASS (correctly deferred, not a blocker)
M9's quantitative success metric is founder-TBD. Spec correctly builds against the qualitative claim ("advisors see score-vs-decision calibration"). ceo-reviewer's watch-item — poll the founder for the metric before M9 is called done — is carried to milestone-close, explicitly **NOT a wave-19 build hard-stop.** Recorded below.

### 6. security_scope — CONFIRMED standard (Phase-2 + the T-8 AC suffices)
Not a classic auth/payment/session/CSRF surface. The isolation-respect is inherited from the already-tested M8/wave-18 layer (getDb + GUC + FORCE RLS), and the one net regression surface (cross-firm calibration leak) is covered by the T-8 REAL-service cross-firm negative-read AC. This matches the wave-18 head-product ruling: **standard Phase-2 security review + the T-8 isolation AC is sufficient; no security-scope-tightened gate.**

## Cross-review resolution (P-4 checklist item 2)
| Reviewer | Verdict | Resolution |
|---|---|---|
| problem-framer | PROCEED | Computability verified independently against real schema — concurs. |
| ceo-reviewer | PROCEED (HOLD-SCOPE) | HOLD honored (no charts-lib/real-time/export in spec). Watch-item (_TBD metric founder-poll) carried to M9-close, not a wave-19 blocker. |
| mvp-thinner | OK (no split) | Per-dimension lift is a near-free same-join GROUP-BY and part of the mvp-critical calibration claim; no THIN to mediate. Concur. |

No open escalations. No unresolved conflict.

## Stage-exit checklist (P-4)
- [x] All ACs touching audit-log / compliance-gate / RBAC suppression are binary, observable, machine-readable — RBAC 200/403/401; read-only writes no audit row; isolation falsifiable via AMP-4 fault-killer.
- [x] Cross-review responses (problem-framer / ceo-reviewer / mvp-thinner) logged, resolved, integrated.
- [x] [STABLE] No-Go default not triggered — every artifact is machine-readable and every claimed_task_id traces end-to-end to the P-0 frame.

## Carry-forward to Phase 2 / milestone-close
- **B-block policing (head-builder):** workspace-scoped-via-getDb (no raw off-GUC); cross-firm negative-read e2e REAL (clone `analytics-isolation.e2e-spec.ts`, not hollow inline SQL); computable-over-real-columns; read-only (no scorer-retrain); RBAC 200/403/401; no gold-plating.
- **Milestone-close watch-item (ceo-reviewer):** founder-poll the M9 quantitative success metric before M9 is called done. NOT a wave-19 blocker.

```yaml
head_signoff:
  verdict: APPROVED
  stage: P-4
  phase: 1
  attempt: 1
  reviewers: { problem-framer: PROCEED, ceo-reviewer: PROCEED-HOLD-SCOPE, mvp-thinner: OK-no-split }
  failed_checks: []
  security_scope: standard-phase-2-plus-T-8-isolation-AC   # inherited from tested M8/wave-18 layer; no tightened gate (matches wave-18 ruling)
  computable_not_vanity: true       # disposition enum + fit_score int NOT NULL + score_breakdown{sectorMatch,contactCompleteness,tieBreak} verified in apps/api/src/db/schema/matching.ts
  isolation_falsifiable: true       # getDb+GUC+FORCE-RLS; T-8 cross-firm negative-read via REAL MatchFeedbackService (clone analytics-isolation.e2e-spec.ts AMP-4 fault-killer), NOT re-implemented SQL
  read_only_no_retrain: true        # no scorer-retrain, no LLM/ML (matching.ts NO-LLM boundary)
  no_gold_plating: true             # no charts-lib / real-time / export
  rationale: >
    A read-only calibration vertical over shipped match_candidates. Both wave-18 lessons are closed with source-verified, binary, falsifiable ACs — computability confirmed against the real Drizzle schema (disposition/fit_score/score_breakdown all present + co-populated), and the load-bearing cross-firm isolation guard is anchored to the proven REAL-service AMP-4 fault-killer, not re-implemented SQL. Read-only, RBAC-binary, no gold-plating, design_gap false. The only open item (_TBD M9 metric) is a milestone-close founder-poll, correctly out of scope for the wave-19 build. No REWORK defect.
  next_action: PROCEED_TO_PHASE_2
```

---
## Phase 2 (Karen + jenny + Gemini) — merged
- **Karen:** APPROVE (5/5 VERIFIED, 0 WRONG — calibration computable over REAL co-populated columns [matching.service writes disposition+fit_score+score_breakdown on every scored row — materially unlike the wave-18 phantom column]; getDb+app.workspace_id GUC+FORCE-RLS on match_candidates [0014]; the REAL-service cross-firm pattern [analytics-isolation.e2e via workspaceAls.run as dealflow_app] exists + mirrorable; RolesGuard/@Roles+/insights exist; read-only/NO-LLM held). Watch-item: score_breakdown is schema-nullable → B-2 MUST apply the spec's per-row exclusion (skip rows missing a dimension), B-6 polices.
- **jenny:** APPROVE (7/7 MATCHES, 0 DRIFTS — M8-isolation-consistency [getDb→GUC→FORCE-RLS, no off-GUC read] + no-scorer-retrain-drift [read-only DISPLAY, matching.ts NO-LLM] both verified against real code; additive /insights section; design_gap false correct [extends, doesn't create]; RBAC advisor+admin; _TBD founder-poll). 2 spec-gaps → B-block obligations.
- **Gemini:** UNAVAILABLE (429 credits depleted) → degrades, non-blocking.

## MERGED P-4 VERDICT: APPROVED
Phase 1 head-product APPROVED (computable-not-vanity verified against schema; security-scope standard — isolation inherited from tested M8/wave-18); Phase 2 Karen + jenny APPROVE + Gemini UNAVAILABLE. → exit P-block to B-0. design_gap_flag=false → B (no D-block).
## B-BLOCK OBLIGATIONS (from Phase 2, MUST be honored):
- **[karen]** score_breakdown is schema-nullable → the per-dimension-lift query MUST apply the spec's per-row exclusion (skip rows missing a dimension), NOT assume non-null (else null throws). B-6 polices.
- **[jenny G1]** the cross-firm negative-read MUST be a FIRST-CLASS test (executed AS dealflow_app via workspaceAls.run through the REAL MatchFeedbackService, 2 workspaces, firm-A calibration excludes firm-B — mirror the wave-18 analytics-isolation.e2e; NOT re-implemented SQL — the wave-18 B-6 hollow-test lesson). Fault-killing.
- **[jenny G2]** pin the null-vs-zero empty-state convention at the B-1 contract: accept-rate with 0 DECIDED candidates → null (insufficient data, renders "n/a"); a band with decided-but-0-accepted → 0 (real 0%, renders "0%"). CODE-OF-CONDUCT honesty (no misleading metric).
- verdict_complete: true

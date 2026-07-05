# P-4 Phase 2 — jenny drift-check (wave-12 M6 pipeline)

PLAN review (pre-build): spec + P-3 plan vs. prior product-decisions + user-journey-map.

## Per-check verdict

1. **Stage enum — MATCHES #137.** Spec (07989285 AC2) fixes exactly `shortlisted→contacted→engaged→diligence→offer→closed→withdrawn` (7), "no configurable stages (H2-deferred)". PD#137 (product-decisions.md:303) = FIXED enum, advisor-configurable per-mandate stages H2-deferred. P-3 Action-1 explicitly REJECTS configurable-per-mandate-stages "per product-decision #137". No drift — spec does NOT sneak in configurable stages nor a different set.

2. **Pipeline screen — MATCHES #80.** Spec/plan build `/pipeline` to `design/pipeline.html` (exists, design_gap_flag=false). PD#80 (product-decisions.md:303) = already-designed+approved screen, canonical at design/pipeline.html. Journey-map row 11 (`/pipeline`, Adv, F4, Pipeline module) confirms `/pipeline` is an established M6 scope page. No drift.
   - NOTE (design-mockup illustration, NOT a spec drift): the mockup + per-page-pd use *illustrative* column labels (Contacted / Interested / NDA & Diligence / Closed & Won) that predate PD#137's canonical 7-value enum. Spec correctly follows PD#137 (the authoritative later decision) for the actual columns. Flag for D/B: render the 7 fixed enum stages as columns, not the mockup's illustrative labels. Not a plan-vs-decision contradiction — spec is aligned with the governing decision.

3. **Deferrals honored — MATCHES #141 + LLM-gate.** Spec HARD BOUNDARIES (all 3 tasks) + P-3 Action-4: NO email-send/SDK, NO webhook, NO LLM, NO new spend. PD#141 / deferral-note (product-decisions.md:306) = send-via-provider + webhook + AI-drafting stay founder-gated. Nothing in any of the 3 spec blocks sneaks in a send/webhook/LLM affordance (B-3 explicitly "NO send/AI affordances"). No drift.

4. **Eligible sources — MATCHES shipped surfaces.** Spec (07989285 AC3): enroll ONLY from outreach `status=send_eligible` OR accepted match_candidate under `match_run.ready_for_outreach=true`. Journey F16 (line 139-142) ships the send-ELIGIBLE record; wave-10 (line 40) ships accept→ready-for-outreach handoff status ("M6 reads"). Sources match how those surfaces shipped. No drift.

5. **Compliance-first thread — MATCHES.** Spec: every enroll/transition/note audited via M2 AuditService.append LAST-IN-TXN (HMAC-SHA256 chain), append-only pipeline_events, actor via getUserWithRole. Matches M6 immutable-recordkeeping success-metric thread + compliance-first posture + PD#137's "pipeline_events feeds the M2 audit log". ceo-reviewer wedge (P-0) = the audit trail IS the value. No drift.

6. **Contradictions — NONE.** No spec item bypasses the audit/compliance posture; the 7-stage model is coherent M&A deal flow (shortlisted→…→closed/withdrawn); append-only + last-in-txn + RBAC (advisor+compliance, SoD-consistent) all consistent with established journeys. Additive-only schema (migration 0011, distinct enum names) consistent with prior-wave discipline.

## VERDICT
APPROVE — all spec items MATCH established product-decisions (#137/#80/#141) + journeys (F16, wave-10 handoff, row-11 pipeline page). One non-blocking hand-off note for D/B: pipeline columns must be the 7 canonical enum stages, not the design mockup's illustrative labels.

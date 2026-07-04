verdict: PROCEED
verdict_source: problem-framer
matched_antipatterns: []
reasoning: |
  Symptom-vs-cause: PASS. The seed treats the ABSENCE of a mandate data spine as the
  root cause that blocks every downstream M4/M5/M6 stage, not a surface symptom. Verified
  against DB: M4 is in_progress with 0 shipped tasks; M5 (matching) and M6 (outreach) are
  both status=todo and structurally read the mandate as their input container. Framing the
  mandate as the load-bearing vertical is cause-layer, correct, and at the right layer
  (data + service + one create/list/detail slice). All four reuse claims are real, not
  aspirational: M1 roles.guard.ts, M2 audit.service.ts + compliance-rules/disclaimers/
  suppression schema, and M3 sourcing.ts company fields all exist in the shipped codebase.
  The compliance seam (capture jurisdiction + disclaimer + suppression at mandate creation,
  enforce later at the M6 pre-send gate) is the correct seam for a compliance-first product:
  you cannot enforce a policy you never captured, and the seed explicitly scopes this bundle
  to CAPTURE/STORE only. Create/list/detail is a coherent vertical slice with the buyer-
  universe builder correctly deferred to a later bundle (no horizontal bundling, no scope
  creep). No catalog antipattern crosses match threshold. Three near-misses are flagged below
  as notes for P-2/D-block, not as framing defects.
proposed_reframe: |
  (not a reframe — PROCEED. Three design-layer guardrails to carry into P-2 spec / D-block,
  each a "smells like X but no catalog match" note, NOT a framing correction:)

  1. Near-miss #4 (premature abstraction) — schema normalization. The 3-table split
     (mandates / mandate_buyer_criteria / mandate_compliance_profile) vs JSONB-on-mandates is a
     legitimate B-block schema-design tradeoff, NOT a framing error. Resolve it in P-2 with one
     explicit test: does the later buyer-universe builder QUERY/filter on criteria dimensions?
     If yes (multi-valued industry/geo/size/deal-type filters that JOIN against M3 companies),
     the normalized child table is justified. If the criteria are only ever read back whole with
     the mandate, JSONB is simpler. mandate_compliance_profile carrying 3 real FKs into distinct
     M2 tables already justifies its own table. P-2 must state the reasoning; do not let it slip
     to B-block undecided.

  2. Near-miss #7 (validation theater / false-safety) — capture-without-enforce. Storing a
     compliance profile that is NOT yet enforced is the correct seam, but it invites a false-
     safety UI: mandate-new / mandate-detail must NOT imply the profile is actively gating
     anything now. Add a P-2 acceptance criterion + D-block copy requirement that the compliance
     section is clearly labelled as "captured now, enforced at send time" so an advisor never
     believes a mandate is send-safe before the M6 gate ships.

  3. Near-miss #4 again (premature abstraction) — buyer-criteria alignment. Aligning criteria
     fields to M3 canonical company fields is PRUDENT reuse (M3 is done/shipped, and the consumer
     bundle is named + roadmapped), NOT speculative coupling. Guardrail: criteria must be CONCRETE
     fields mirroring the existing shipped M3 company taxonomy (industry/geo/size/deal-type). If
     P-2 or B-block proposes a generalized filter/operator DSL or query-builder engine now, THAT
     crosses into antipattern #4 and is a REFRAME trigger at that point — flag it forward.
escalation_reason: |
  (n/a)
sibling_visible: false

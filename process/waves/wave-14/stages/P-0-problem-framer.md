verdict: PROCEED
verdict_source: problem-framer
matched_antipatterns: []
reasoning: |
  Symptom-vs-cause (mandatory) PASSES: the wave-13 gap is "compliance gate decisions
  are not in the mandate-scoped recordkeeping export." The symptom-layer fix would be a
  template-version->mandate back-derivation in the export SQL — and 487b0f0c's acceptance
  criteria EXPLICITLY REJECT that (it over-captures other mandates sharing the template).
  Instead 487b0f0c fixes at the true cause: the gate-evaluate audit row is keyed to a
  cross-mandate reusable resource (resourceType='outreach-template-version', verified at
  outreach.service.ts:268-269 + recordkeeping.repository.ts:265-269) and never records the
  mandate/outreach context it possesses at gate-evaluate time. Recording context at the
  producer, where the mandate is known, is the correct layer — no lossy back-derivation.
  No wrong-layer antipattern (#2): the hash-chain is verified append-only and version-gated
  (audit.hash.ts:107-132, audit.verifier.ts:99) — additive metadata on NEW rows cannot break
  EXISTING-row verification; 487b0f0c's AC guards verifyChain, so no chain regression.
  No scope-creep-through-coupling (#5): the three tasks are milestone-bundle breadth under
  one theme (M6 compliance hardening), not "while we're in there" coupling — 487b0f0c+07bd1e1a
  are a tight vertical (fix the H1 gap + prove it on a real DB), and f5074df8 is the last
  unshipped M6 page, buildable-without-credential and touching the same shipped SoD/audit
  surfaces. Bundle sizing/splitting is P-1's purview, not a P-0 framing defect.
  One ordering dependency to carry forward (NOT a reframe trigger): 07bd1e1a's inclusion
  assertion (gate-evaluate rows ARE captured for the mandate) depends on 487b0f0c's
  gate-attribution landing first. This is intra-wave B-block sequencing — flag for P-3 plan
  ordering so the e2e is authored after the producer fix, or its inclusion-assertion is
  gated on the attribution being present.
proposed_reframe: |
  (n/a — PROCEED)
escalation_reason: |
  (n/a — PROCEED)
sibling_visible: false

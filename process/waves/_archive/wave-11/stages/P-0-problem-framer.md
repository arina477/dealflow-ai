verdict: PROCEED
verdict_source: problem-framer
matched_antipatterns: []
reasoning: |
  Symptom-vs-cause: PASS. The root problem is framed at the cause layer, not the
  symptom layer. The wave does not treat "an advisor might send a non-compliant
  message" as a UI-validation problem; it locates the load-bearing container — the
  approved-template-version store with a service-asserted version-binding invariant —
  as the thing every downstream reader (composer, non-bypassable pre-send gate, later
  send path) reads from. Template-spine-FIRST is the correct decomposition: the
  container must exist before the composer and gate that read it.

  Version-binding invariant (the compliance heart): correctly designed and correctly
  placed. "Editing an approved template mints a NEW version + content_hash mismatch →
  not usable-for-send" mirrors the M2 disclaimer approval-version binding exactly —
  verified live: apps/api/dist/db/schema/compliance-rules.d.ts carries content_hash =
  "SHA-256 hex of the content at approval time; the gate recomputes...", and
  product-decisions #4 states "editing a message after approval invalidates the
  approval (compliance version-binding)". Asserting the invariant in the SERVICE (not
  just the UI) is the right enforcement layer — a UI-only guard would be a wrong-layer
  (#2) / validation-theater (#7) miss since the send path is server-side. The seed and
  sibling 2601ba33 both explicitly demand service-layer assertion, re-checked at
  compose AND gate time (defense in depth at the correct layer). This is the
  load-bearing control preventing a real compliance breach (edited-but-unapproved body
  reaching a send-eligible draft).

  Antipattern scan clean. The two-table split (outreach_templates +
  outreach_template_versions) is NOT premature abstraction (#4): it is REQUIRED by the
  invariant — an approved version must never be mutated in place, so each edit is a new
  immutable row. content_hash + the approval-version-binding column are not premature —
  they are the exact mechanism the gate consumes; without them the invariant is
  unenforceable. Required-compliance-block FK→M2 disclaimer_templates is verified real
  reuse (live shipped table), not a new disclaimer store. The three-sibling bundle is a
  genuine vertical slice (store → composer+gate → SoD/version-binding enforcement), not
  scope-creep-through-coupling (#5): each sibling is on the same compliance-critical
  send path with explicit hard boundaries.

  Both hard boundaries hold. LLM/AI-drafting is correctly deferred: manual/structured
  drafting yields a REAL approved-template store the composer reads and exercises the
  full version-binding / approval / required-block / audit machinery with no LLM — it
  does not under-deliver, since the compliance spine is the load-bearing half and
  AI-drafting is a productivity layer on top; deferring it to the same blocked
  founder-spend Tier-3 gate as M5's LLM bundle is consistent. Email-SDK/send is
  correctly deferred: the sibling stops at "gate-passed, send-eligible" with no
  send-path or provider-SDK leak. M6 ## Class=product-feature is correctly flagged
  (P-0 runs mvp-thinner), and M6 ## Scope explicitly lists both deferred items as
  scope belonging to later bundles.
proposed_reframe: |
  (n/a — PROCEED)
escalation_reason: |
  (n/a — PROCEED)
sibling_visible: false

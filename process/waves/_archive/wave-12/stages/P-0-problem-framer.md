verdict: PROCEED
verdict_source: problem-framer
matched_antipatterns: []
symptom_vs_cause_check: |
  MANDATORY CHECK — result: PASS (cause-layer, not symptom-layer).
  M6's real need is "one live mandate flows end-to-end; buyers advance through a
  pipeline; every step immutably recorded." This wave addresses the STRUCTURAL CAUSE
  of that need — a durable, audited pipeline model + human-driven stage advancement —
  not a surface symptom. The seed explicitly scopes the manual/structural half and
  DEFERS the automated reply/open-driven advance to the credential-gated send/webhook
  bundle (product-decision #141). That is a correct cause-layer decomposition.
reasoning: |
  Framing verified against the DB, not just the prose. M6 (a068dc3d) is a
  product-feature/T1 milestone whose ## Scope names `pipeline` as an M6 page and lists
  "pipeline/deal-stage tracking" as in-scope; the fixed-stage enum + SEPARATE append-only
  pipeline_events table is the literal content of product-decision #137, with
  advisor-configurable stages EXPLICITLY H2-deferred; the pipeline page design is approved
  (#80, design/pipeline.html). No antipattern matches. Four red-team probes, all cleared:

  (1) "Tracking before there's anything to track / enrolling never-sent records" (antipattern
  #3 candidate) — DOES NOT HOLD. A deal enters at `shortlisted` on the basis of an ACCEPTED
  match (match_candidates.disposition='accepted' under a ready_for_outreach run) or a
  send-eligibility decision (outreach.status='send_eligible', wave-11 live) — both are real,
  human-made deal-progression events that exist TODAY, independent of any email being sent.
  In M&A advisory a deal is "in the pipeline" the moment the advisor decides to pursue it;
  the send is a LATER stage (contacted), marked manually on the board. Real state to track
  exists before any send path. Not premature.

  (2) Fixed enum vs configurable stages (antipattern #4, premature abstraction) — the task
  chose the CONCRETE fixed enum and deferred the generalized configurable-stage framework to
  H2. That is the correct direction; it avoids premature abstraction rather than committing it.

  (3) Symptom-vs-cause — PASS (see above); manual pipeline board IS the right next step because
  automated advancement is blocked on the credential-gated send/webhook layer, correctly deferred.

  (4) Scope coherence (antipattern #5) — clean vertical slice: seed = DB+service backbone,
  sibling 1 = API+RBAC+board UI over it, sibling 2 = notes/timeline over the same pipeline_events.
  Same workflow, layered — not unrelated changes bundled. Actual sizing/split is P-1's decision;
  no coupling defect at the framing layer. HARD BOUNDARIES (additive-only, zero-ghost-dep, no-send,
  audit last-in-txn, RBAC via getUserWithRole) are correctly restated inline per wave-10/11 precedent.

  Note (no catalog match): the seed's enrollment guard hinges on "send_eligible outreach that was
  never actually sent" being a coherent pipeline entry point — it IS coherent for M&A (accepted-match
  = deal-worth-pursuing), but B/T blocks should assert the eligibility guard rejects enrollment from
  a NON-eligible record, so the pipeline can never contain a deal the advisor never chose to pursue.
proposed_reframe: |
  (n/a — PROCEED)
escalation_reason: |
  (n/a — PROCEED)
sibling_visible: false

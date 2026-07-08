verdict: OK
verdict_source: mvp-thinner
milestone_id: 099cee10-562d-4e56-9a57-0dade2914760
milestone_title: "M9 — advisors sync to existing CRM + see response/throughput analytics"
milestone_class: product-feature
milestone_success_metric: |
  "_TBD by founder_ — target: advisors sync to their existing CRM and see
  response/throughput analytics."
  (Quoted verbatim from M9 ## Success metric. The prose metric is _TBD; only a
  non-binding target line is present — no measurable acceptance threshold exists.)
mvp_critical_status: |
  no mvp-critical scope declared yet — M9 ## Success metric is _TBD by founder.
  Thinness re-classification requires a binding metric to run the trace test
  against; without one, per hard-rule "_TBD → verdict OK and flag," AC-level
  deferral analysis cannot be performed. Wave scope is nonetheless already
  correctly bounded on its face (see ok_rationale) and this wave is INFRA/DEVOPS
  deploy-class, not a feature AC-set, so mvp-thinner has no in-scope surface to peel.

ok_rationale: |
  Two independent reasons this wave gets OK, not THIN:
  (1) HARD-RULE — M9's ## Success metric is _TBD by founder. mvp-thinner may
  never improvise the founder's metric; without a binding metric the trace test
  ("would the metric still be satisfiable if this AC were absent?") has no anchor,
  so no defensible split can be proposed. This is the governing reason.
  (2) SCOPE ALREADY THIN & DEVOPS-CLASS — even setting the metric aside, this is
  an infra/devops FOUNDATIONAL deploy wave, not a feature AC-bundle. The seed
  description already declares WRITE path + company/contact SCREEN-migration as
  "LATER waves" (candidates (a) and (b) are pre-deferred by the founder pivot,
  correctly). The five in-wave ACs form one indivisible read-activation slice:
    - research Twenty self-hosting — CORE (guessing infra fails the deploy; not thinnable)
    - deploy self-hosted Twenty (server+PG+Redis+worker) — CORE (the wave IS the deploy)
    - auto-provision API key inside the instance — CORE (without it the wave cannot
      self-complete autonomously; cutting it manufactures a founder-key block)
    - point wave-31 adapter at instance + activate READ — CORE (the "value proven" leg)
    - live-verify real companies flow into sourcing search — CORE (proves DATA FLOWS,
      not merely "deployed"; cutting this is the classic OVER-CUT trap)
  Candidates (c) production hardening (backups/HA/monitoring) and (d) large
  real-data seeding are correctly OUT: (c) is a later ops concern once the
  instance runs; (d) only a few records are needed to prove the read path, and
  the seed already scopes seeding to the minimum for live-verify. None of the five
  in-wave ACs traces to a nice-to-have; all are load-bearing for "a running
  instance DealFlow can read from, proven live." Nothing to split into siblings.

  ONE-WAVE vs SPLIT read (advisory, not a THIN — mvp-thinner never shrinks a wave):
  deploy + read + verify should stay ONE wave. Splitting DEPLOY-only into wave-32
  and read-activation into wave-33 would ship wave-32 with NO live-verifiable
  DealFlow value — a bare running instance with no proof the product can consume
  it — exactly the "deployed but unproven" failure the live-verify leg exists to
  prevent. The read-activation reuses the already-built twenty.adapter.ts (wave-31,
  task 1eb63a40 done), so the incremental cost over deploy-alone is small and the
  verify closes the loop. Keep as one foundational slice. Wave-size / floor
  authority is P-1's, not mine.

floor_constraint_active: false
floor_constraint_detail: |
  n/a — no split proposed, so no floor pre-check was triggered. OK is driven by the
  _TBD metric hard-rule and the already-thin devops scope, not by a floor block.

sibling_visible: false

flags:
  - metric_tbd: |
      M9 ## Success metric is _TBD by founder. This weakens EVERY P-0 thinness/
      ambition judgment on M9 waves until the founder sets a binding metric.
      Surface to head-product / P-0 merge: consider prompting the founder to
      convert the target line ("advisors sync to existing CRM + see analytics")
      into a measurable success metric before further M9 feature waves.

verdict: OK
verdict_source: mvp-thinner
milestone_id: 099cee10-562d-4e56-9a57-0dade2914760
milestone_title: M9 — Integrations & insight
milestone_class: product-feature
milestone_success_metric: |
  "_TBD by founder_ — target: advisors sync to their existing CRM and see
  response/throughput analytics."
  NOTE: no founder-authored ## Success metric exists (metric is _TBD_). The
  trailing "target:" line is a planning aspiration, NOT a bound acceptance
  metric. Thinness analysis has no anchor to trace ACs against; per mvp-thinner
  hard rules a _TBD_ metric forces OK + flag rather than a THIN split.
mvp_critical_status: |
  N of M still pending. M9 is in_progress with 17 done insight-vertical tasks;
  the CRM/DataSourceAdapter track is the remaining founder-gated scope. The
  wave-30 Affinity adapter (345dfbc6, "first real DataSourceAdapter") is done;
  wave-31's Twenty adapter is the 2nd real source (the >=2-sources direction).
  No mvp-critical AC subset can be formally computed because the milestone
  success metric is _TBD_.

ok_rationale: |
  Two independent reasons for OK. (1) Rule-binding: M9's ## Success metric reads
  "_TBD by founder_" — with no founder-authored metric, the trace test ("would
  the metric still be satisfiable if this AC were absent?") has no anchor, so I
  cannot legitimately classify any AC as nice-to-have. Flag: metric is _TBD_;
  thinness analysis is metric-blind and defaults to OK. (2) On the merits, the
  proposed scope is already the minimum coherent adapter slice and mirrors the
  already-OK-sized wave-30 Affinity adapter (same fetchCompanies(connection) ->
  NormalizedSourceRecord[] interface, same registry, same robustness bar). Every
  THIN candidate from the brief is ALREADY absent from the proposed scope:
  opportunities + custom-objects are not in scope (companies + people = CORE
  only); the API is a single choice (GraphQL OR REST, not both — SDK-research
  decides); write-back / webhooks / incremental-sync are not in scope. Nothing
  remains to peel into a sibling. The reliability primitives (internal
  pagination, retry/backoff, timeout, boundary-Zod, output normalization,
  graceful-no-key) and the per-connection base URL (load-bearing because Twenty
  is self-hostable) are correctly retained as CORE — cutting any of them would be
  an OVER-CUT that guts adapter reliability, not a thinning. This is a single
  backend integration task, not a multi-AC product-feature bundle; there is no
  AC surface to re-classify.
floor_constraint_active: false
floor_constraint_detail: |
  N/A — OK was reached on (1) a _TBD_ success metric that blocks thinness
  analysis and (2) an already-minimal single-task adapter slice, NOT because a
  size floor blocked an otherwise-valid THIN. No peel-off was proposed, so no
  residual-LOC / floor computation applies.

sibling_visible: false

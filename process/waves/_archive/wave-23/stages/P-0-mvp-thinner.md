verdict: OK
verdict_source: mvp-thinner
milestone_id: 099cee10-562d-4e56-9a57-0dade2914760
milestone_title: M9 — Integrations & insight
milestone_class: product-feature
milestone_success_metric: |
  _TBD by founder_ — target: advisors sync to their existing CRM and see
  response/throughput analytics.
mvp_critical_status: |
  no mvp-critical scope formally declared yet — M9 ## Success metric is
  "_TBD by founder_". Several insight verticals already shipped under M9
  (advisor-insights analytics a5ba8068→9e05828b→4b014689; match-calibration
  feedback 5568ad44→...; outreach-activity tracker d45c73b5→...). The CRM-sync
  half of the target sentence remains founder-gated (DEFERRED 345dfbc6 —
  vendor spend + account key). This wave adds a deterministic seller-intent
  score vertical (9e54cc11 seed → 1188e7da contracts → 12947422 API → 6840c25d UI).

ok_rationale: |
  Two independent reasons converge on OK — no valid AC split exists here.

  (1) GOVERNING RULE — unratified metric. M9's ## Success metric is
  "_TBD by founder_". Per the mvp-thinner hard rule ("_TBD_ → verdict OK and
  flag — you cannot do thinness analysis without a metric"), a formal
  trace-test cannot be run: there is no ratified success-metric floor to
  measure "still satisfiable without this AC?" against. This is the SAME basis
  on which the wave-18/19/20 mvp-thinner splits were correctly NOT adopted
  (unratified _TBD metric + data already live + not gold-plating + floor-safety).
  The identical logic applies here.

  (2) SUBSTANTIVE — the proposed scope is already the minimum coherent slice,
  not a packed one. The 4 tasks are a standard vertical (scorer+service →
  shared-Zod contracts → RBAC read API → /insights UI); thinning the API or UI
  breaks the milestone-felt outcome "advisors SEE the score", so no
  cross-task split is available. WITHIN the scorer, the thinness surface is
  the three REAL signal dimensions — outreachEngagement (over outreach_activity),
  pipelineVelocity (over pipeline_events), matchDisposition (over
  match_candidates.disposition). All three are load-bearing "why is this deal
  hot" evidence: the seed problem statement itself frames the value as
  "outreach touches, pipeline stage progression, AND match dispositions ...
  scattered with no derived score." Peeling ONE real signal into a v2 sibling
  would not remove gold-plating — it would leave a two-signal number whose
  meaning is undercut, i.e. it trends toward OVER-CUT (a uselessly-thin score),
  not THIN. All three signals read from already-shipped-and-live tables via the
  same on-read aggregation pattern as the analytics service — zero new table,
  zero extensibility-ahead-of-demand, no polish AC. There is no AC in this wave
  that traces OUTSIDE a minimal seller-intent score.

floor_constraint_active: false
floor_constraint_detail: |
  Not the binding constraint. Floor did not force this OK — a valid THIN
  simply does not exist (no gold-plated/deferrable AC; the three signal
  dimensions are the minimum coherent set, and splitting one is OVER-CUT-ward,
  not THIN). The unratified _TBD metric (reason 1) is the governing basis.

# ---- Flags for head-product / P-4 (advisory, not splits) ----
flags:
  - metric_unratified: |
      M9 ## Success metric = "_TBD by founder_". Thinness analysis is
      structurally impossible without a ratified metric. Consistent with the
      non-adopted wave-18/19/20 mvp-thinner splits. If the founder later
      ratifies an M9 metric, re-run thinness against it before the NEXT M9
      product-feature wave. NOT a cross-milestone move; NOT a split proposal.
  - tieBreak_in_surfaced_breakdown: |
      NOT a thinness split — a spec-quality note for P-4 / head-designer.
      The seed's breakdown shape is
      { outreachEngagement, pipelineVelocity, matchDisposition, tieBreak,
        total, notApplied }. `tieBreak` is a DETERMINISTIC ORDERING component
      (sort-stabilizer for equal scores), NOT an intent signal — it is not
      "why is this deal hot" evidence. Per the wave-19 tieBreak-is-noise lesson
      (PRODUCT #1), P-4 should confirm tieBreak is EXCLUDED from the
      founder-facing surfaced breakdown on the /insights seller-intent UI
      (6840c25d), or is explicitly labeled non-evidence — so advisors do not
      read a sort-stabilizer as a fourth signal. This lives inside the scorer
      contract / UI acceptance criteria, not as a splittable sibling AC.

proposed_split: null
over_cut_rationale: null
sibling_visible: false

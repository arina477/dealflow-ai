verdict: OK
verdict_source: mvp-thinner
milestone_id: a068dc3d-8f77-4d01-ba1d-bbc6ed9b16bc
milestone_title: "Compliant outreach & pipeline — one live mandate, end-to-end (M6)"
milestone_class: product-feature
milestone_success_metric: |
  An advisor can send a compliance-checked, approved, tracked outreach to a shortlist; every message is
  recorded immutably in the tamper-evident audit log; compliance can export a verifiable recordkeeping
  package; replies/opens advance buyers through the pipeline — i.e. ONE live mandate flows sourcing to
  match to compliant outreach to pipeline end-to-end.
mvp_critical_status: |
  M6 in_progress. 3 of 3 wave-11 (templates + composer + non-bypassable pre-send gate) and all wave-12
  (pipeline + board + timeline) mvp-critical tasks are done. This wave-13 audit-log/recordkeeping-export
  bundle (seed 36a17c81 + siblings 20c479db, 10ee0ec4) is the vertical satisfying the still-open metric
  phrase "every message is recorded immutably in the tamper-evident audit log; compliance can export a
  verifiable recordkeeping package." All 3 tasks in this bundle are todo/pending.

# TRACE-TEST RESULT (per-AC classification)
# Applied: "if this AC were absent from M6 entirely, would the ## Success metric still be satisfiable?"
#
# Seed 36a17c81 (filtered read + hash-chain integrity-VERIFY API)
#   -> NO. The integrity-VERIFY endpoint IS the "tamper-evident" wedge — without it there is no proof
#      the immutable log is tamper-evident, so "recorded immutably in the tamper-evident audit log" is
#      not demonstrable. mvp-critical. KEEP.
#
# Sibling 20c479db (verifiable FINRA/SOX export-package generator)
#   -> NO. The metric names it verbatim: "compliance can export a verifiable recordkeeping package."
#      Remove export entirely and the phrase is directly unsatisfiable. mvp-critical AS AN AC. KEEP.
#      NOTE (depth, not existence): the FULL-form package in per-page-pd/audit-log-export.md — PDF board
#      report renderer, CSV+JSON+PDF triple format, multi-regulation presets (FINRA 4512 / SOX 302 / GDPR /
#      internal), size-split — is depth beyond the metric's "a verifiable recordkeeping package." A single
#      deterministic verifiable format (CSV or JSON + entry hashes + verifyChain result + manifest) already
#      satisfies the metric. The PDF/multi-format/regulation-preset layer is polish-ahead-of-demand and is
#      the ONLY genuinely thinnable material in this bundle. It is intra-AC depth, NOT a separable AC.
#
# Sibling 10ee0ec4 (/compliance/audit-log page)
#   -> Metric is API-satisfiable in principle, but "compliance CAN export" needs a real surface, and this
#      page carries the integrity BADGE (tamper-evidence made visible) + the export panel. Core is
#      mvp-critical. Depth (?mandate_id/?campaign_id/?mode=export deep-links, advisor own-outreach
#      role-scoped rendering) is intra-AC polish, not a separable AC. KEEP.
#
# CONCLUSION: No WHOLE AC in this bundle is nice-to-have. Each of the 3 traces cleanly to the mvp-critical
# floor ("regulator-provable tamper-evident audit trail" + "export a verifiable recordkeeping package").
# The only deferrable material is DEPTH INSIDE the export sibline (PDF/multi-format/regulation presets) —
# and mvp-thinner splits ACs, not sub-features within an AC. That depth-trim is correctly a P-2/P-3 spec
# scoping call (spec the export as ONE deterministic verifiable format for v1), NOT an AC-level sibling.

ok_rationale: |
  Every AC traces cleanly to M6's mvp-critical floor: the integrity-verify API is the tamper-evidence
  wedge, the export-package generator is the literal metric phrase "compliance can export a verifiable
  recordkeeping package," and the page is the compliance reviewer's surface + visible integrity proof.
  No whole AC is deferrable without breaking the mvp-critical claim. The one genuinely ahead-of-demand
  element — full FINRA/SOX PDF-report + multi-format + multi-regulation-preset export DEPTH — is intra-AC
  scope, not a separable sibling AC; it belongs to P-2/P-3 as a "spec v1 as one deterministic verifiable
  format" instruction, which mvp-thinner flags below but cannot itself peel without dropping the wave
  under its multi-spec floor (see floor_constraint_active).
floor_constraint_active: true
floor_constraint_detail: |
  Wave type: multi-spec (claimed_task_ids = 3). Applicable floor: net LOC > 2,500 OR >= 6 specs.
  current_wave_loc estimate: ~2,800 net LOC (per P-0 frame, <=30 files).
  Would-have-thinned material (the export-depth polish — PDF report renderer + CSV/JSON/PDF triple
  format + multi-regulation presets + size-split): ~600-900 LOC; plus UI deep-link/advisor-scope depth
  ~150-250 LOC. Total deferrable depth: ~750-1,150 LOC.
  residual_loc after deferral: ~2,800 - ~950 (midpoint) = ~1,850 LOC — BELOW the 2,500 multi-spec floor.
  Because (a) no WHOLE AC is nice-to-have (seed = tamper-evidence wedge; export = verbatim metric phrase;
  page = the surface), and (b) the only thinnable material is intra-AC depth whose removal would push the
  wave under its multi-spec floor, mvp-thinner refuses to emit THIN. The correct home for the export-depth
  trim is P-2 Spec: scope the export sibling to ONE deterministic verifiable format (CSV or JSON + entry
  hashes + verifyChain result + manifest) for v1, deferring PDF-report + multi-format + regulation-preset
  rendering to a later M6 recordkeeping-polish bundle. This keeps the wave whole and above floor while
  still preventing polish-ahead-of-demand.

sibling_visible: false

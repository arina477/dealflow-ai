verdict: PROCEED
verdict_source: problem-framer
matched_antipatterns: []
reasoning: |
  Symptom-vs-cause: SOUND. M5's success metric is "a ranked buyer list with integer
  fit-scores an advisor can act on to build a shortlist that hands off to outreach."
  The seed attacks the CAUSE layer — no match container and no score exist because the
  shipped M4 tables deliberately carry no score/rank/fit column (verified in
  apps/api/src/db/schema/buyer-universe.ts line 37/185: "NO score / rank / fit column
  exists on either table. Those belong to M5"). Building match_run + match_candidates as
  the load-bearing persistence spine every later M5 piece reads is the correct
  root-problem framing, not a surface patch.

  Wrong-layer: NONE. Score lives on a NEW match_candidates table (FK -> buyer_universe_
  candidates), NOT bolted onto the M4 candidate row — this respects the documented M4/M5
  boundary exactly. Scoring in-place on buyer_universe_candidates would VIOLATE the
  boundary; the separate container is the right home. Additive-only migration, no refactor
  of M3/M4 surfaces.

  Deterministic-vs-LLM boundary (policed HARD): CORRECT decomposition. Shipping a
  deterministic rule-based integer fit_score FIRST — zero Anthropic/Claude/LLM, zero
  BullMQ, zero rationale-text, zero API spend — with the LLM-assisted ranking + rationale
  deferred to a later BOARD-gated bundle is the right slice ordering. All three tasks carry
  explicit reject-if-crossed LLM boundaries. This is NOT a hollow placeholder: the
  deterministic score produces a real ordered list the advisor views (fb82d339) and acts on
  (f74dce45) with a per-dimension breakdown that is explainable from components ALONE — a
  genuinely actionable first slice, not done-theater. The LLM layer later ENRICHES this
  spine rather than replacing it.

  M5/M6 boundary: HELD. Sibling f74dce45 stops at a ready-for-outreach status flip +
  persisted accepted rows M6 will consume; it explicitly excludes outreach send, email, and
  the compliance pre-send gate (all M6). Correct hand-off-not-do framing.

  Antipatterns 4 (premature abstraction) and 3 (demo-path tunnel vision) considered and
  DISMISSED: the score-breakdown jsonb is not premature — it is the explainability +
  audit-provenance substrate the UI already consumes this wave AND the anchor the later LLM
  enrichment writes into; and the empty-data path (dimensions absent on M3 companies) is the
  PRIMARY path the framing handles via the wave-9 graceful-degradation pattern, not an
  ignored edge case.

data_availability_flag: |
  NOT a reframe trigger, but a load-bearing P-2/P-3 scoring-design note the spec MUST carry
  forward. Verified against schema: mandate_buyer_criteria exposes four dimensions
  (industry/sector, geo, size_band, deal_type), but the M3 companies table
  (apps/api/src/db/schema/sourcing.ts) has ONLY: name, domain, normalizedDomain,
  normalizedName, sector, status. There is NO geo, NO size_band, NO deal_type, NO
  revenue/employee-count column on the buyer company. Therefore of the four criteria
  dimensions, ONLY sector-match and contact-completeness (from the contacts table) score
  against real buyer data today; geo/size/deal_type will be unsupported-dimension provenance
  on essentially every candidate.

  Consequence for P-2/P-3 (NOT for framing): a fit_score derived from ~two live dimensions
  risks LOW DISCRIMINATION — many same-sector buyers could tie at an identical score,
  producing a near-flat ranking that under-delivers "ranked" in the metric. This does not
  make the problem wrong (the spine, the integer column, and the provenance jsonb are all
  correct regardless of current dimension coverage, and the provenance jsonb is precisely
  what makes the sparse-data state legible + auditable). But P-2 MUST specify how the two
  live dimensions are weighted/bucketed to produce meaningful ordering (e.g. graded
  sector-match, contact-completeness tiers, deterministic tie-break), and an acceptance
  criterion should assert the ranking actually discriminates on realistic data rather than
  collapsing to one bucket. Flagging here so it is not discovered at V-1.

coherence: |
  score (seed) -> view ranked list (fb82d339) -> accept/reject/flag + shortlist handoff
  (f74dce45) is one coherent vertical slice (schema + service + Zod API + one page + the
  disposition/handoff on the same tables). No part warrants sibling deferral; splitting the
  view or the disposition out would break the milestone's actionable-shortlist claim. Not a
  RESCOPE-AUTO-SPLIT candidate.

proposed_reframe: |
  (n/a — PROCEED)

escalation_reason: |
  (n/a — PROCEED)

sibling_visible: false

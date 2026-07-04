verdict: THIN
verdict_source: mvp-thinner
milestone_id: b372bbf7-09f3-4eb0-87df-28b5ec52bfc2
milestone_title: "M3 — Deal sourcing & company/contact data"
milestone_class: product-feature
milestone_success_metric: |
  An analyst can run a sourcing search across >=2 connected sources, import
  deduped company/contact records (with provenance) into the store, and
  view/clean them on the companies screen.
mvp_critical_status: |
  M3 in_progress. Wave-6 shipped the data spine (connection store + pluggable
  DataSourceAdapter + fixture adapter, on-demand ETL/SourceSyncJob, deterministic
  dedupe → canonical companies/contacts with provenance, AND the companies screen
  at /sourcing/companies incl. the dedupe review queue merge/reject). This wave =
  the sourcing-workspace PAGE (seed dfa5bd56) on the wave-6 fixture adapter; the
  real DataSourceAdapter (345dfbc6) is SPLIT to its own wave per problem-framer +
  ceo-reviewer RESCOPE-AUTO-SPLIT. The page is the last mvp-critical gap that makes
  the M3 "run a search across >=2 connected sources → import → view/clean" loop
  verifiable end-to-end. 1 of M3's core scope items (this page) still pending.

# THIN — proposed sibling split (one AC peeled off; the core search→trigger→outcome→handoff loop stays intact)
proposed_split:
  acs_to_keep:                                    # mvp-critical — stay in wave 7
    - ac: "AC-1 — /sourcing page: connected-sources display + basic search/filter form (name / domain / sector-SIC) scoped across the connected sources + a 'Run sourcing search / sync' action that triggers the existing wave-6 SourceSyncJob (IngestionService.syncSource)."
      rationale: "This IS the metric's 'run a sourcing search across >=2 connected sources' + trigger-ingestion clause; without it there is no front door and the loop is unverifiable."
    - ac: "AC-2 — Sync-outcome surface: poll/stream sync-run status, live progress + per-source result counts, quarantined/degraded records, then hand off to /sourcing/companies. Trigger audited to the M2 tamper-evident log (analyst, source(s), run id)."
      rationale: "Closes the metric's 'import ... into the store' → 'view/clean on the companies screen' hand-off; the audit-write on a data-mutating trigger is a compliance-core invariant, non-deferrable."
    - ac: "AC-3 — Shared Zod contracts in @dealflow/shared for search-criteria + sync-trigger + sync-status DTOs (RHF + Zod resolver); design-system tokens; D-block runs; reuse wave-6 companies-screen table/list primitives."
      rationale: "Contract-once and the design/D-block are load-bearing for AC-1/AC-2 to exist at all; not separable from the core loop."
    - ac: "AC-4 — E2E acceptance: from /sourcing an analyst runs a search across the connected sources (fixture valid as one source), triggers ingestion, watches the sync outcome, and lands on /sourcing/companies viewing the freshly deduped provenance-tracked records."
      rationale: "This is the verbatim M3 success-metric loop demonstrated in-product; it is the reason the wave exists."
  acs_to_split:                                   # nice-to-have on THIS page — sibling under M3
    - ac: "Per-candidate import-review / dedupe-decision modal ON the /sourcing page — design lines 731-851 ('Review Targets for Import': per-result Import-as-New / Skip, per-source select-all checkboxes, in-page clean-vs-duplicate review before import)."
      rationale: "Trace test on the metric: the metric routes cleaning/review to the *companies screen* ('view/clean them on the companies screen'), and wave-6 ALREADY shipped the dedupe review queue (accept/reject/merge on dedupe_candidates) + provenance trail on /sourcing/companies (f5771d13, done). A connection-level 'run search → trigger sync → land on the companies screen where dedupe review already lives' satisfies the metric fully; per-result cherry-pick + a second in-page dedupe-review surface on page 12 duplicates page 13's shipped capability and is depth built ahead of demand. Cutting it leaves the search→trigger→outcome→handoff loop unbroken. The results-matrix table itself + its detail drawer (source lineage, 'Select for Import' → triggers the sync) STAY in AC-1/AC-2; only the standalone per-candidate dedupe-decision MODAL is deferred."
      sibling_task_seed:
        title: "Add per-result selective-ingest + in-page dedupe-preview to the sourcing-workspace page"
        description: |
          Problem: the wave-7 sourcing-workspace page ships connection-level
          "run search → trigger sync → land on the companies screen" (where the
          wave-6 dedupe review queue already handles clean/merge/reject). Analysts
          who want to cherry-pick individual results for import — and preview the
          clean-vs-duplicate split BEFORE the sync lands on /sourcing/companies —
          currently must let the whole connection sync and resolve on page 13.
          Acceptance sketch: on /sourcing, add per-result row selection + a
          "Review Targets for Import" step that previews DedupeService's
          clean-vs-candidate classification for the SELECTED results and lets the
          analyst import-as-new / skip per candidate, reusing wave-6
          DedupeService + dedupe_candidates + the shared Zod DTOs (no new dedupe
          logic). Every selective-import action audited to the M2 log. Does NOT
          re-implement page-13's review queue; it is a page-12 pre-import preview
          over the same engine.
          # Orchestrator INSERTs as a tasks row: milestone_id = b372bbf7-09f3-4eb0-87df-28b5ec52bfc2,
          # wave_id = NULL, parent_task_id = dfa5bd56-0c7e-46ed-830f-9c35e5bfd471, status='todo', prose description.

# OK / OVER-CUT fields — not applicable (verdict is THIN)
ok_rationale: |
  n/a — verdict is THIN.
floor_constraint_active: false
floor_constraint_detail: |
  Floor pre-check (mandatory): wave 7 is single-spec after the real-adapter split
  (claimed_task_ids = [dfa5bd56] only) → floor = net LOC > 1,500. The kept ACs
  (full Next.js /sourcing page: RHF+Zod search form, connected-sources panel,
  results-matrix table + detail drawer, live sync-status polling + outcome
  surface, audit wiring, shared Zod DTOs, D-block designs, E2E) comfortably clear
  1,500 net LOC on their own. The single split AC (standalone per-candidate
  dedupe-review MODAL, ~200-400 LOC, reusing wave-6 DedupeService) is a small
  fraction; residual after peel-off stays well above the 1,500 floor. Floor does
  NOT block this split.

# Notes for head-product mediation
mediation_notes: |
  - ceo-reviewer verdict'd RESCOPE-AUTO-SPLIT (real adapter → own wave), NOT
    SCOPE-EXPANSION/SELECTIVE-EXPANSION, so the § Mediation precedence tie-break
    (ceo-reviewer expansion vs mvp-thinner THIN) does NOT fire on this wave.
  - Multi-source aggregation UI check: the M3 metric says ">=2 sources", but the
    real 2nd source is the DEFERRED real adapter (345dfbc6). This does NOT block
    the page: wave-6's ETL fan-out + connection store support >=2 FIXTURE
    connections representing >=2 sources, so the >=2-source search + per-source
    result-count UI is buildable AND testable NOW on fixture connections. The
    ">=2-source" UI is therefore mvp-critical and KEPT (folded into AC-1/AC-2), NOT
    inherently blocked on the real adapter. Do not thin the multi-source view.
  - Search sophistication check: the design already ships only BASIC search
    (name / sector-SIC / a client-side "filter this list") — no faceted/advanced
    filtering, no saved searches present. Nothing to peel there; the page is
    already thin on search sophistication. No split proposed on search.
  - The ONLY AC-level gold-plating is the standalone in-page dedupe-decision
    modal, which duplicates wave-6's shipped page-13 review queue.

sibling_visible: false

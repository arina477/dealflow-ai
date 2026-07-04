verdict: RESCOPE-AUTO-SPLIT
verdict_source: problem-framer
matched_antipatterns: [5]
symptom_vs_cause_check: |
  Ran (mandatory). Seed dfa5bd56 (sourcing-workspace page) is framed at the CAUSE
  layer, not the symptom layer:
  - It TRIGGERS the existing wave-6 IngestionService.syncSource / listSources /
    getSyncStatus + SourceSyncJob rather than re-implementing sync/ETL — no
    pipeline bypass, no client-side dedup (dedupe stays in the wave-6
    DedupeService; the page only observes sync_runs outcomes).
    Antipattern #2 (wrong layer) and the "trigger-ingestion bypasses the
    idempotent ETL/dedupe" smell are BOTH cleared.
  - Search is scoped over the connected sources feeding raw_companies → dedupe →
    canonical companies/contacts (the ingested/deduped universe), NOT a hollow
    search box and NOT a live-provider catalog query — the correct first slice,
    and it works on fixture data today. Antipattern #3 (demo-path tunnel) cleared:
    the page proves the full search → import → view → clean loop end-to-end
    against the wave-6 FIXTURE adapter (its own acceptance line keeps the fixture
    valid as one source).
  - Reuses M1 RolesGuard RBAC, M2 tamper-evident audit log, wave-6 shared Zod
    contracts + table/list primitives. No new config knob, no validation theater,
    no backwards-compat shim. Seed framing is sound.
reasoning: |
  The verdict is driven entirely by BUNDLE COMPOSITION, not by either task's
  framing (both are individually well-framed). Sibling 345dfbc6 (first REAL
  DataSourceAdapter) is EXTERNALLY BLOCKED on two things the agent cannot produce
  autonomously: (a) a deal-source vendor choice that is a spend-commitment
  decision (sdks.md §3 "vendor TBD" + Risk item 1 "vendor selection is pending …
  spend-commitment decision"; product-decisions.md line 225 records the sibling as
  gated on that decision), and (b) an account-issued API key the founder must
  supply (DATA_SOURCE_PRIMARY_API_KEY is an empty placeholder in .env.example; the
  task itself mandates a C-block MONITOR: task for tier/key activation and states
  "the live ≥2-source E2E is gated on it"). Bundling a fully-completable,
  demoable vertical slice (the page, provable end-to-end on the fixture adapter)
  with a task blocked on an unresolved money + credential gate of unknown timing
  is antipattern #5 (scope creep through coupling). The page does NOT need the
  real adapter to exist, be tested, or demonstrate the M3 success metric — the
  wave-6 fixture is a permanently valid source. Coupling forces the whole wave to
  either wait on an external decision or ship half-done.
proposed_split: |
  (For P-1 sizing rubric — P-1 owns the actual split.)
  - KEEP THIS WAVE: seed dfa5bd56 — build the /sourcing sourcing-workspace page
    (search connected sources + trigger sync via wave-6 IngestionService, observe
    sync_runs outcome, hand off to /sourcing/companies). Provable end-to-end NOW
    against the wave-6 fixture adapter; no external dependency; completes the M3
    front-door and demonstrates the search → import → view → clean loop.
  - DEFER to its own wave: sibling 345dfbc6 — the first real DataSourceAdapter,
    once (1) the founder/BOARD/ceo-agent resolves the vendor spend decision and
    records it in product-decisions.md, (2) P-3 SDK-research + SDK-doc authoring
    runs per external-sdk-integration-rules.md, and (3) the account API key / tier
    is provisioned (C-block MONITOR: with success/failure/timeout budget). That
    wave completes the M3 metric "for real" (≥2 sources, ≥1 real) on top of the
    page shipped here.
  Rationale for the direction: split by DEPENDENCY BOUNDARY, not by layer — the
  page is a complete vertical slice on its own; the adapter is externally gated.
  This is a de-coupling, not a horizontal salami-slice, so it survives head-next's
  vertical-slice test.
sibling_visible: false

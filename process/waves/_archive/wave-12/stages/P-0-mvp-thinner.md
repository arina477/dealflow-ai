verdict: THIN
verdict_source: mvp-thinner
milestone_id: a068dc3d-8f77-4d01-ba1d-bbc6ed9b16bc
milestone_title: "Compliant outreach & pipeline (one live mandate, end-to-end)"
milestone_class: product-feature
milestone_success_metric: |
  An advisor can send a compliance-checked, approved, tracked outreach to a
  shortlist; every message is recorded immutably in the tamper-evident audit
  log; compliance can export a verifiable recordkeeping package; replies/opens
  advance buyers through the pipeline — i.e. ONE live mandate flows sourcing to
  match to compliant outreach to pipeline end-to-end.
mvp_critical_status: |
  M6 pipeline vertical: 0 of 3 pipeline tasks done (all todo). The pipeline-thread
  of the success metric — "buyers advance through the pipeline" — has NO shipped
  surface yet. The automated "replies/opens advance" half is explicitly deferred
  (credential-gated, product-decision #137/#141); this wave delivers the pipeline
  STRUCTURE + manual advance half. mvp-critical claim under review: "an advisor can
  advance a buyer through fixed pipeline stages, every transition audited, end-to-end."

# THIN — proposed sibling split
proposed_split:
  acs_to_keep:
    # --- Seed 07989285: DB→service spine (ALL mvp-critical) ---
    - ac: "07989285 / additive pipeline + pipeline_events tables + fixed pipeline_stage enum"
      rationale: "No spine = no pipeline exists = 'advance a buyer through stages' unsatisfiable. Foundational."
    - ac: "07989285 / PipelineService.enrollAsActor (eligibility-guarded, idempotent, initial stage shortlisted)"
      rationale: "Getting a buyer INTO the pipeline is the entry half of 'advance a buyer through the pipeline'."
    - ac: "07989285 / PipelineService.transitionStageAsActor (fixed-enum guard + writes stage_changed pipeline_events row)"
      rationale: "The advance mechanic itself. This AC ALSO already captures transition history in pipeline_events — the timeline sibling's history data exists without the sibling."
    - ac: "07989285 / every enroll+transition audited via M2 AuditService.append LAST-IN-TXN, actor = getUserWithRole"
      rationale: "Directly satisfies the '...audited' half of the mvp-critical claim + M6's immutable-recordkeeping thread. Not deferrable."
    - ac: "07989285 / unit+contract coverage of enum guard, eligibility guard, idempotent enroll, last-in-txn audit"
      rationale: "Coverage of the load-bearing compliance invariant (audit last-in-txn) is mvp-critical for a compliance-first product."
    # --- Sibling d1940142: board API + RBAC + page (ALL mvp-critical) ---
    - ac: "d1940142 / REST endpoints list-by-stage + enroll + transition, guarded by M1 RolesGuard"
      rationale: "The human-driven advance surface. Without an API the advisor cannot advance a buyer — metric unsatisfiable end-to-end."
    - ac: "d1940142 / pipeline page: stage-columned board, lists enrolled deals w/ mandate+buyer identity, moves a deal to an adjacent/valid stage"
      rationale: "The advisor-facing 'advance a buyer' UI. NOTE: the AC says 'move to an adjacent/valid stage' — it does NOT mandate drag-and-drop; a stage-select control fully satisfies it. Already at minimum interaction; nothing to thin here."
    - ac: "d1940142 / illegal transitions + unauthorized roles rejected SERVER-SIDE; board reflects only server truth"
      rationale: "Server-truth + RBAC is the compliance floor; hiding-in-UI-only would be a false-compliance defect. mvp-critical."
    - ac: "d1940142 / E2E/contract coverage of list-by-stage + transition against a seeded eligible deal"
      rationale: "Proves the end-to-end advance path — the exact metric claim. mvp-critical."

  acs_to_split:
    - ac: "45b259e1 / PipelineService.addNoteAsActor — free-text advisor notes as note-type pipeline_events rows (+ audit last-in-txn)"
      rationale: "Free-text notes are net-new enrichment data with NO trace to 'advance a buyer through pipeline stages'. Removing notes entirely leaves the success metric ('buyers advance through the pipeline', audited) fully satisfiable — the seed already audits every enroll+transition. Notes are recordkeeping depth ahead of demand, not the advance mechanic."
      sibling_task_seed:
        title: "Ship advisor free-text notes on pipeline deals (append-only, audited)"
        description: |
          Advisors need to annotate a pipeline deal with free-text context (call notes,
          rationale for a hold) as an append-only record that feeds the M2 audit log.
          This is recordkeeping enrichment on top of the shipped pipeline advance flow —
          it does NOT gate "advance a buyer through stages", which is delivered by the
          seed + board in the current wave.
          Acceptance sketch: PipelineService.addNoteAsActor appends a note-type
          pipeline_events row (actor = getUserWithRole app users.id) with a corresponding
          M2 audit entry LAST-IN-TXN (HMAC-SHA256 chain); notes are append-only (no
          edit/delete path); RBAC-guarded via M1 RolesGuard. Contract coverage: adding a
          note writes exactly one pipeline_events row AND one audit_log_entries row in the
          same txn. Orchestrator INSERTs as tasks row: milestone_id = a068dc3d-8f77-4d01-ba1d-bbc6ed9b16bc,
          wave_id = NULL, parent_task_id = 07989285-7e64-4f26-a3de-1954ba89a5c7.
    - ac: "45b259e1 / read endpoint + rendered per-deal timeline UI panel (enrolled + every stage_changed + every note, actor+timestamp)"
      rationale: "The stage_changed transition events are ALREADY written by the seed (07989285 transitionStageAsActor) and ALREADY mirrored to the tamper-evident M2 audit log. 'Advance a buyer, audited, end-to-end' is satisfied by that audit write + the board reflecting server truth. A dedicated rendered timeline PANEL is a second read-view of history that already exists in queryable+audited form — depth/polish on the audit surface (whose mvp-critical first pass shipped in M2), not a gate on the advance claim. Removing it leaves the metric satisfiable."
      sibling_task_seed:
        title: "Ship per-deal pipeline event timeline (transition history + notes read + UI panel)"
        description: |
          A per-deal chronological timeline (enrollment, each stage transition from→to,
          free-text notes) rendered on the pipeline deal view, giving advisors a
          human-readable history without querying the audit log directly. This is a
          read-view over pipeline_events data the seed already writes; it does NOT gate
          "buyers advance through the pipeline", which ships via the seed + board this wave.
          Acceptance sketch: a read endpoint returns the ordered event timeline for a
          pipeline deal (enrolled + every stage_changed + every note), RBAC-guarded via
          M1 RolesGuard; the pipeline deal view renders the chronological history with
          actor + timestamp per event. E2E: the timeline endpoint returns transitions
          produced by board stage moves. Sequence AFTER the notes sibling (or fold notes
          in) since the panel renders both transitions and notes. Orchestrator INSERTs as
          tasks row: milestone_id = a068dc3d-8f77-4d01-ba1d-bbc6ed9b16bc, wave_id = NULL,
          parent_task_id = 07989285-7e64-4f26-a3de-1954ba89a5c7.

floor_constraint_active: false
floor_constraint_detail: |
  Floor pre-check (multi-spec floor = >2,500 LOC OR >=6 specs, per P-1-decompose § Minimum size floor):
  - current_wave_loc_estimate: ~3,200 LOC / 3 tasks (per P-0 frame prose).
  - ACs proposed to split (all of sibling 45b259e1): ~700-900 LOC (one service method + one read
    route + one timeline UI panel + contract/E2E). Estimate ~800 LOC.
  - residual_loc after peel-off: ~3,200 - ~800 = ~2,400-2,500 LOC across 2 tasks (seed + board).
  - MARGINALITY FLAG: residual lands AT / just-above the 2,500 LOC arm and drops to 2 specs (the
    >=6-spec arm was never binding — only 3 tasks). The LOC estimate is soft. If P-1's own LOC
    estimate at decompose comes in below 2,500 for the residual 2-task bundle, this THIN should be
    REFUSED and re-emitted as OK/floor_constraint_active:true — the seed+board 2-task residual is a
    coherent, floor-satisfying vertical ("advance a buyer, audited, end-to-end") and MUST NOT be
    thinned below floor. Deferred to head-product / P-1 to confirm residual clears floor before
    executing the split. Emitting THIN because on the frame's own ~3,200 estimate the residual
    clears the LOC floor; the peel-off does NOT reduce total M6 scope (siblings stay under M6).

ok_rationale: |
  N/A — verdict is THIN. (Field retained per schema.) Every kept AC traces cleanly to the
  mvp-critical claim "an advisor can advance a buyer through fixed pipeline stages, every transition
  audited, end-to-end"; the two split ACs (notes + rendered timeline panel) are recordkeeping depth
  on the audit surface whose mvp-critical first pass already shipped in M2 and is re-hit by the
  seed's last-in-txn transition audit writes.

# Notes for head-product / mediation with ceo-reviewer:
# - The seed + board 2-task residual is a COMPLETE vertical: DB->service->API->UI, buyer enroll +
#   audited stage advance + server-guarded RBAC + E2E. It does not "half-ship" the pipeline.
# - Do NOT over-thin the board: its "move a deal to an adjacent/valid stage" AC is already the
#   minimum interaction (stage-select suffices; drag-and-drop is NOT mandated). No further peel.
# - Both split-out ACs stay under M6 (milestone unchanged), parent_task_id = the seed, wave_id NULL.
#   No cross-milestone move. No new ACs proposed. Total M6 scope unchanged — this is re-classification
#   into a future M6 bundle, not a size reduction.

sibling_visible: false

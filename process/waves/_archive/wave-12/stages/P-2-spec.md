# Wave 12 — P-2 Spec (pointer)
The authoritative spec contract is the YAML head of task **07989285**'s `tasks.description` (DB row). multi-spec, 3 blocks.
## claimed_task_ids: [07989285 (seed), d1940142, 45b259e1]
## Acceptance summary (see DB row for full ACs/contracts/edge-cases):
- **07989285 (spine):** migration 0011 additive (pipeline + pipeline_events + pipeline_stage enum 7 fixed stages); PipelineService enroll (eligible-source-guarded, idempotent) + transition (valid-stage-guarded); every mutation audited last-in-txn (M2 HMAC); actor=getUserWithRole.
- **d1940142 (board):** PipelineController (GET grouped-by-stage/?mandateId, POST enroll, PATCH transition) RBAC advisor+compliance; /pipeline stage-columned board (design/pipeline.html); illegal transition + role rejected server-side; SSR-hydrate + /pipeline-data proxy.
- **45b259e1 (timeline):** addNoteAsActor (append-only note + audit last-in-txn); GET /pipeline/:id/events ordered timeline; timeline UI panel on deal view; exactly-one-pipeline_events+one-audit-row per note.
design_gap_flag: false. Boundaries: additive-only, no send/webhook/LLM/spend/SDK.

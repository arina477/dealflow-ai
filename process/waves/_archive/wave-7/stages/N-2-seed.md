# N-2 — Seed (wave 8 bundle)

```yaml
n_stage_verdict: COMPLETE
verdict_evidence:
  - "seed task id: ba0edebf-8509-46b2-b69f-f5458ba400fd"
  - "bundled siblings: 2 (c070ca23, 50227055)"
  - "validation: pass (all 3: status=todo, wave_id NULL, milestone_id=M4; siblings parent=seed)"
seed_task_id: ba0edebf-8509-46b2-b69f-f5458ba400fd
seed_task_title: "Build mandate data spine + create/configure sell-side mandate flow"
bundled_sibling_ids:
  - c070ca23-0a93-4432-9390-d54d54159935   # Build mandates-list page with status filters and list endpoint
  - 50227055-22b6-4457-a694-dbecff7497c3   # Build mandate-detail page with profile, criteria, and compliance view
claimed_task_ids:
  - ba0edebf-8509-46b2-b69f-f5458ba400fd
  - c070ca23-0a93-4432-9390-d54d54159935
  - 50227055-22b6-4457-a694-dbecff7497c3
active_milestone_id: c67b1610-9cc3-4cad-bcfa-1bee0573da72
queue_exhausted: false
validation_failed: false
note: >
  Seed picked from the milestone-decomposer bundle authored at N-1 Action 7 (M4 freshly promoted,
  0 done tasks). Oldest/only parent_task_id-IS-NULL wave_id-IS-NULL seed under M4. The 3 re-homed
  backlog follow-ups (bfadcec1/6fe232e3/d7f716b4) carry a wave_id -> correctly excluded from the
  seed query (not siblings). Vertical slice: mandate data spine (DB->service->API->UI) + list + detail
  = create/list/review-edit end-to-end, the first half of M4's success metric. buyer-universe builder
  deferred to a later M4 bundle. Buildable, not founder-blocked. Wave 8 is a UI + product-feature wave
  -> P-0 mvp-thinner + D-block will run.
```

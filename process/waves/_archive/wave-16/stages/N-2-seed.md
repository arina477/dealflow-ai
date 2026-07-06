# N-2 — Seed (wave-16 close → wave-17 bundle)

```yaml
n_stage_verdict: COMPLETE
verdict_evidence:
  - "seed task id: 0db154ff-31f1-45c4-85cd-71d34d65c437"
  - "bundled siblings: 3"
  - "validation: pass (all 4 rows: status=todo, wave_id NULL, milestone_id=M8; siblings parent_task_id=seed)"
seed_task_id: 0db154ff-31f1-45c4-85cd-71d34d65c437
seed_task_title: "Add workspaces anchor + workspace_id scoping column across tenant tables"
bundled_sibling_ids:
  - e45ba68c-80f3-475e-a240-54c23ea9ccb2   # Enforce deny-by-default Postgres RLS scoped by workspace_id
  - 96026365-77b2-4763-bf57-705fbf340ba8   # Propagate authenticated user workspace into every request-scoped DB session
  - df2f3b2f-6e7d-4f39-a6ab-7ca49020e967   # Prove cross-tenant isolation with a negative-read integration test
claimed_task_ids:
  - 0db154ff-31f1-45c4-85cd-71d34d65c437   # SEED
  - e45ba68c-80f3-475e-a240-54c23ea9ccb2
  - 96026365-77b2-4763-bf57-705fbf340ba8
  - df2f3b2f-6e7d-4f39-a6ab-7ca49020e967
active_milestone_id: 9ed98c3c-8cb8-4736-8337-22dc0dae48d4   # M8 — Pilot-partner workspace (data isolation)
queue_exhausted: false
validation_failed: false
note: >
  Vertical slice (DB spine → RLS policy → request-scope middleware → adversarial cross-tenant test) — NOT a
  horizontal migrations-only bundle. No ghost deps (builds on shipped-and-live M1 Auth&RBAC / M2 audit / M7
  admin-workspace-settings). RBAC/isolation SoD central to seed; deterministic negative-read test spec sibling
  present; additive-only rollback (drop column/table + DISABLE RLS). Sibling count (3) + est ~2,000–3,200 LOC
  within single-session floor/ceiling. head-next N-2 gate: APPROVED.
```

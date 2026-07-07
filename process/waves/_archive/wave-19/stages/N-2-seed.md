# N-2 — Seed (wave 19 → seeds wave 20)

## Actions

- **Action 1 — pick seed:** Two seed candidates under M9 (`parent_task_id IS NULL`, `wave_id IS NULL`, `status='todo'`): `345dfbc6` (older, 2026-07-04, FOUNDER-GATED CRM) and `d45c73b5` (newer, 2026-07-07, buildable outreach-activity). Per N-2 Action 1 re-order allowance ("prefer whichever the milestone scope needs next"), skipped the gated older candidate (seeding it deadlocks wave 20 on a founder decision) and picked **`d45c73b5`** — the buildable credential-free vertical. Same discipline wave-19's N-2 applied to skip 345dfbc6.
  - `seed_task_id` = `d45c73b5-39bc-4a8a-a5c3-65d12b0cb5eb`
  - `seed_task_title` = "Add outreach_activity table + additive migration (workspace-scoped, RLS, WORM-free)"
- **Action 2 — load siblings:** 3 siblings under the seed: `5c12ac3a` (outreach-activity service, RLS + audit-logged), `c3776cac` (shared-Zod outreach-activity contracts), `b2acf4ce` (RBAC-scoped API + /outreach UI panel).
- **Action 3 — validate:** all 4 rows re-confirmed against DB — status=todo, wave_id NULL, milestone_id=M9, siblings parent_task_id=seed. PASS. Vertical slice (DB migration + service + contract + API + UI), not horizontal. No ghost deps (all FK targets shipped-and-live; no dep on gated 345dfbc6; no unmerged-PR dep). RLS/workspace-scoped + RBAC + audit-logged per compliance backbone.
- **Action 5 — claimed_task_ids:** `[d45c73b5, 5c12ac3a, c3776cac, b2acf4ce]`.

```yaml
n_stage_verdict: COMPLETE
verdict_evidence:
  - "seed task id: d45c73b5-39bc-4a8a-a5c3-65d12b0cb5eb"
  - "bundled siblings: 3"
  - "validation: pass"
seed_task_id: d45c73b5-39bc-4a8a-a5c3-65d12b0cb5eb
seed_task_title: "Add outreach_activity table + additive migration (workspace-scoped, RLS, WORM-free)"
bundled_sibling_ids: [5c12ac3a-87f6-43d0-9674-5c39a7b029ee, c3776cac-8f37-47fb-81f4-ea9ef72b6f29, b2acf4ce-bc2a-48b9-9e28-87c26b34d37c]
claimed_task_ids: [d45c73b5-39bc-4a8a-a5c3-65d12b0cb5eb, 5c12ac3a-87f6-43d0-9674-5c39a7b029ee, c3776cac-8f37-47fb-81f4-ea9ef72b6f29, b2acf4ce-bc2a-48b9-9e28-87c26b34d37c]
active_milestone_id: 099cee10-562d-4e56-9a57-0dade2914760
queue_exhausted: false
validation_failed: false
note: "Seed re-ordered off strict oldest-created_at: skipped gated 345dfbc6 (CRM, founder-blocked) for buildable d45c73b5 per N-2 Action 1 scope-needs allowance."
```

head_signoff:
  verdict: APPROVED
  stage: N-2
  reviewers: {}
  failed_checks: []
  rationale: "Bundle is a complete end-to-end vertical slice (DB → service → shared-Zod contract → RBAC API + UI panel) for a single feature (internal outreach-activity tracker), not a horizontal DB-only bundle. All siblings belong to one workflow. No ghost dependencies on unmerged PRs; no dependency on the gated CRM seed. Additive-only, rollback-safe, RLS/RBAC/audit-honoring. Seed correctly re-ordered off the gated older candidate to avoid a founder-decision deadlock. Validation passed against the DB."
  next_action: PROCEED_TO_N-3

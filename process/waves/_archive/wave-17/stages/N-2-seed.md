# N-2 — Seed (wave 17 → seeds wave 18)

```yaml
n_stage_verdict: COMPLETE
verdict_evidence:
  - "seed task id: a5ba8068-2e1b-48ea-83d9-6da739a41e2b"
  - "bundled siblings: 2"
  - "validation: pass (all 3 rows: status=todo, wave_id NULL, milestone=M9 099cee10, siblings parent=seed)"
seed_task_id: a5ba8068-2e1b-48ea-83d9-6da739a41e2b
seed_task_title: "Build advisor-insights analytics aggregation service (workspace-scoped, RLS-honoring)"
bundled_sibling_ids:
  - 9e05828b-38dd-475c-9f82-cd5ac4565fff   # Expose shared-Zod-typed analytics API endpoint(s) with RBAC-scoped read
  - 4b014689-8e12-4560-95c9-5b0ae4d2f4fc   # Build the /insights advisor analytics dashboard page (Next.js 15)
claimed_task_ids:
  - a5ba8068-2e1b-48ea-83d9-6da739a41e2b
  - 9e05828b-38dd-475c-9f82-cd5ac4565fff
  - 4b014689-8e12-4560-95c9-5b0ae4d2f4fc
active_milestone_id: 099cee10-562d-4e56-9a57-0dade2914760   # M9 — Integrations & insight
queue_exhausted: false
validation_failed: false
note: >
  Seed re-ordered off the oldest candidate. M9 had two parent_task_id-NULL/wave_id-NULL/todo candidates:
  345dfbc6 (oldest, 2026-07-04) and a5ba8068 (new). 345dfbc6 is DEFERRED/founder-blocked (deal-source vendor
  selection = spend hard-stop + account-issued API key, rule-6 exception) and NOT autonomously completable —
  seeding it stalls wave 18 on a founder decision. Per N-2 Action 1 ("LLM may re-order... prefer whichever
  the milestone scope needs next") + the FOUNDER-CREDENTIAL/SPEND GUARD, selected the buildable credential-free
  analytics seed a5ba8068 instead. 345dfbc6 stays queued under M9 for a future wave once the founder picks a
  vendor + supplies the key. Clean vertical slice (aggregation service → shared-Zod API → /insights page);
  no ghost deps (reads only shipped-and-live M2-M8 tables through the M8 RLS/GUC); no credential/spend/LLM/SDK;
  additive-only (rollback = drop optional summary cache + remove route/schema/page).
```

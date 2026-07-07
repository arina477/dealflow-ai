# N-2 — Seed (wave-27 → seeds wave-28)

Head: head-next. Mode: automatic.

## Actions

- **Action 1 — seed pick:** oldest `parent_task_id IS NULL`, `wave_id IS NULL`, `status='todo'` under M10 → `d3cc1337-c7a4-4a89-9857-02ba99e1292d` — "Add workspace retention-policy table + additive migration (config, RLS, WORM-preserving)". Sole seed candidate; no re-ordering needed.
- **Action 2 — siblings:** `parent_task_id = d3cc1337`, all `todo` / `wave_id NULL`:
  - `b7786c5b-4126-482c-8db7-01a8d5ba77f6` — Add shared-Zod retention-policy contracts to packages/shared
  - `ed4945e0-e239-44d8-a14e-03e1eddc78fa` — Build retention-policy service + RBAC-scoped API (RLS, audit-logged, WORM-preserving)
  - `ce75c6c6-f723-48c7-8c7c-8260dfcd952a` — Build retention-policy settings + cutoff surfacing UI on the compliance surface
- **Action 3 — validation:** PASS. All 4 rows: `status='todo'`, `wave_id IS NULL`, `milestone_id = 033f97e0…` (m_ok=t); the 3 siblings carry `parent_task_id = d3cc1337`. Vertical slice spanning DB migration → shared contract → RLS/RBAC service+API → compliance-surface UI. No horizontal-layer bundle, no ghost dependency on unmerged PRs, no cross-workflow mixing.
- **Action 5 — claimed_task_ids:** `[d3cc1337, b7786c5b, ed4945e0, ce75c6c6]` — B-0 claims this batch; L-2 closes it.

```yaml
n_stage_verdict: COMPLETE
verdict_evidence:
  - "seed task id: d3cc1337-c7a4-4a89-9857-02ba99e1292d"
  - "bundled siblings: 3"
  - "validation: pass"
seed_task_id: d3cc1337-c7a4-4a89-9857-02ba99e1292d
seed_task_title: "Add workspace retention-policy table + additive migration (config, RLS, WORM-preserving)"
bundled_sibling_ids:
  - b7786c5b-4126-482c-8db7-01a8d5ba77f6
  - ed4945e0-e239-44d8-a14e-03e1eddc78fa
  - ce75c6c6-f723-48c7-8c7c-8260dfcd952a
claimed_task_ids:
  - d3cc1337-c7a4-4a89-9857-02ba99e1292d
  - b7786c5b-4126-482c-8db7-01a8d5ba77f6
  - ed4945e0-e239-44d8-a14e-03e1eddc78fa
  - ce75c6c6-f723-48c7-8c7c-8260dfcd952a
active_milestone_id: 033f97e0-bc25-48dd-bb5a-b2f2be5b056a
queue_exhausted: false
validation_failed: false
note: "RETENTION-policy vertical slice for wave-28. WORM audit-chain immutability + HMAC hash-chain preserved (retention = window-policy config + surfacing, NOT WORM-row deletion)."
```

# N-2 — Seed (wave-22 bundle)

## Action 1 — Pick the seed

DB query (`milestone_id=M9 AND status='todo' AND wave_id IS NULL AND parent_task_id IS NULL ORDER BY created_at LIMIT 1`) returns exactly one row:

- **`02f4e6a1-4b67-4bb1-80e8-ac1d3be3f762`** — "Fix-forward: scope OAE-class unscoped audit-count assertions in outreach-activity-rls e2e (T-4 rule 2)". Sole candidate, taken as seed.

## Action 2 — Load siblings

`WHERE parent_task_id = 02f4e6a1... AND status='todo' AND wave_id IS NULL` → 0 rows. Single-task bundle (valid).

## Action 3 — Validate the bundle

Re-confirmed against DB (`WHERE id = ANY('{02f4e6a1...}')`):
- `status = 'todo'` ✓
- `wave_id IS NULL` ✓
- `milestone_id = 099cee10-...` (M9) ✓

Validation **passed**.

## Action 5 — claimed_task_ids

`[02f4e6a1-4b67-4bb1-80e8-ac1d3be3f762]` — propagates to N-3 handoff, wave-22 B-0 (claim batch → `in_progress` + `wave_id`), and wave-22 L-2 (close batch → `done`).

```yaml
n_stage_verdict: COMPLETE
verdict_evidence:
  - "seed task id: 02f4e6a1-4b67-4bb1-80e8-ac1d3be3f762"
  - "bundled siblings: 0"
  - "validation: pass"
seed_task_id: 02f4e6a1-4b67-4bb1-80e8-ac1d3be3f762
seed_task_title: "Fix-forward: scope OAE-class unscoped audit-count assertions in outreach-activity-rls e2e (T-4 rule 2)"
bundled_sibling_ids: []
claimed_task_ids:
  - 02f4e6a1-4b67-4bb1-80e8-ac1d3be3f762
active_milestone_id: 099cee10-562d-4e56-9a57-0dade2914760
queue_exhausted: false
validation_failed: false
note: "Single-task test-hygiene wave (test-only fix-forward enforcing promoted T-4 rule 2 across the ~4 unscoped audit-count assertion sites in outreach-activity-rls.e2e-spec.ts). Vertical-slice requirement N/A (no feature surface). head-next APPROVED. Site-count (~4 vs L-1 OBS-W21-2's 8) to reconcile at wave-22 P-2 against the actual file — the seed mandates the whole class regardless."
```

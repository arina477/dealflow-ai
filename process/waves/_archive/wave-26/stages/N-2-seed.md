# N-2 — Seed (wave-26)

## Action 1 — pick the seed

```sql
SELECT id FROM tasks
WHERE milestone_id='033f97e0-bc25-48dd-bb5a-b2f2be5b056a'
  AND status='todo' AND wave_id IS NULL AND parent_task_id IS NULL
ORDER BY created_at LIMIT 1;
```

→ **no row.** M10 has zero seed candidates (all 3 child tasks are `done`; N-1 Action 7 decomposition returned `incomplete-scope` and authored no new bundle). Jump to Action 4 (empty-queue path).

## Action 4 — empty-queue path

Empty queue here is the EXPECTED, framework-designed outcome — not a defect. Upstream reason (from N-1): decomposition fired under `automatic` and returned `incomplete-scope` (M10 `## Success metric` = `_TBD by founder`; four `## Scope` verticals unbuildable without the founder-reserved compliance-regime decision). This is the wave-25 BOARD 7/7 disposition (c) enforced circuit-breaker.

Emit queue-exhausted. N-3 records the pause-loop emission (`loop_state: paused`) so P-0 does not spin on nothing.

```yaml
n_stage_verdict: DEFERRED
verdict_evidence:
  - "seed task id: null"
  - "bundled siblings: 0"
  - "validation: skipped (queue exhausted — decomposition returned incomplete-scope on _TBD metric)"
seed_task_id: null
seed_task_title: ""
bundled_sibling_ids: []
claimed_task_ids: []
active_milestone_id: 033f97e0-bc25-48dd-bb5a-b2f2be5b056a
queue_exhausted: true
validation_failed: false
note: "No legal seed for wave-27 on M10. Upstream: N-1 Action 7 decomposition → incomplete-scope (_TBD success metric, founder-reserved recordkeeping scope). Enforced pause; loop pauses at N-3."
```

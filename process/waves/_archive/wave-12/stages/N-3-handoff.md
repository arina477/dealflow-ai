# N-3 — Handoff (wave-12 → wave-13)

Head: head-next. Mode: automatic.

## Action 1 — Next wave number + loop state

Next wave = **13**. Loop does NOT pause: seed exists (`36a17c81`, validated), no queue-exhaustion, no ritual deferred to founder (decomposition completed inline under automatic mode). `loop_state: ready`.

## Action 2 — Pre-create wave-13 directory + checklist

`process/waves/wave-13/{blocks/{P,D,B,C,T,V,L,N},stages}` created; `checklist.md` seeded from the DISPATCHER stage-completion template, pre-filled with the wave-13 seed + siblings + active milestone + carry-forwards.

## Action 3 — This deliverable

Written before Action 4 archive so it archives with the wave.

## Action 4 — Archive wave-12

`git mv process/waves/wave-12/ process/waves/_archive/wave-12/` + commit. (SHA recorded post-commit below.)

## Action 5 — Final state emission

**5a.** DB wave-close runs AFTER archive: `UPDATE waves SET status='ok'` on the current `running` row (wave 12) → RETURNING wave_number.
**5b.** `.last-wave-completed.yaml` overwritten with the wave-13 handoff anchor.

```yaml
n_stage_verdict: COMPLETE
verdict_evidence:
  - "next wave: 13"
  - "next wave checklist: process/waves/wave-13/checklist.md"
  - "archive commit: <recorded at commit time>"
  - "waves row 12 closed: status='ok' (RETURNING wave_number=12)"
prev_wave: 12
next_wave: 13
loop_state: ready
seed_task_id: 36a17c81-3778-4594-a7d1-4b1977e5b5a0
bundled_sibling_ids:
  - 20c479db-d8ba-4ae3-9a64-cd3cc7874a27
  - 10ee0ec4-c34d-4899-b39f-43aed12b9616
claimed_task_ids:
  - 36a17c81-3778-4594-a7d1-4b1977e5b5a0
  - 20c479db-d8ba-4ae3-9a64-cd3cc7874a27
  - 10ee0ec4-c34d-4899-b39f-43aed12b9616
active_milestone_id: a068dc3d-8f77-4d01-ba1d-bbc6ed9b16bc
active_milestone_status: in_progress
state_transitions_applied_this_wave: []
note: >
  M6 stays in_progress (closure withheld — send/tracking/recordkeeping-export scope remains).
  Wave-13 seeds the buildable, no-credential audit-log/recordkeeping-EXPORT vertical.
  LLM-spend deferral carried non-blocking; re-surface trigger NOT met this wave.
  Cross-wave transition — STATUS stays RUNNING; no b/d/e/f pause trigger fired.
```

# N-3 — Handoff (wave 7 → wave 8)

```yaml
n_stage_verdict: COMPLETE
verdict_evidence:
  - "next wave: 8"
  - "next wave checklist: process/waves/wave-8/checklist.md"
  - "archive commit: <set at archive move>"
  - "waves row close: wave_number 7 -> status='ok'"
prev_wave: 7
next_wave: 8
loop_state: ready
seed_task_id: ba0edebf-8509-46b2-b69f-f5458ba400fd
bundled_sibling_ids:
  - c070ca23-0a93-4432-9390-d54d54159935
  - 50227055-22b6-4457-a694-dbecff7497c3
claimed_task_ids:
  - ba0edebf-8509-46b2-b69f-f5458ba400fd
  - c070ca23-0a93-4432-9390-d54d54159935
  - 50227055-22b6-4457-a694-dbecff7497c3
active_milestone_id: c67b1610-9cc3-4cad-bcfa-1bee0573da72
active_milestone_status: in_progress
state_transitions_applied_this_wave:
  - {milestone: "M3 (b372bbf7)", from: in_progress, to: done}
  - {milestone: "M4 (c67b1610)", from: todo, to: in_progress}
note: >
  Clean seed + buildable bundle -> loop_state ready (not paused). Wave 7 archived in one move;
  wave-7 waves row closed status='ok' AFTER archive (FS-independent). Wave 8 pre-created with
  the M4 mandate-spine bundle. STATUS=RUNNING (wave 8 cleanly seeded + buildable; no founder-blocked
  seed). Founder vendor-selection for the real DataSourceAdapter (345dfbc6, now under M9) remains a
  surfaced non-blocking deferred decision — does NOT gate wave 8.
```

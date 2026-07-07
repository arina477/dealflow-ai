# Wave 20 — N-3 Handoff

## Action 1 — Next wave + loop state

- Current wave: 20. Next wave: **21**. Not pausing (a valid seed exists; no strict-mode founder-defer; `automatic` mode, STATUS RUNNING).
- `loop_state: ready`.

## Action 2 — Pre-create wave-21 directory + checklist

- `process/waves/wave-21/blocks/{P,D,B,C,T,V,L,N}` + `stages/` created.
- `process/waves/wave-21/checklist.md` seeded from the DISPATCHER template, pre-filled with seed `1d95cac0`, no siblings, active milestone M9, and carry-forward notes (tech-debt holds, seller-intent-is-wave-22, `_TBD` metric poll pending).

## Action 3 — This deliverable

Written before Action 4 archive so it archives with the wave.

## Action 4 — Archive wave-20

`git mv process/waves/wave-20/ process/waves/_archive/wave-20/` → commit `chore: N-3 archive wave-20`. (See archive-commit SHA in the footer / final report.)

## Action 5 — Final state emission

- **5a. Close wave row:** `UPDATE waves SET status='ok' WHERE id=(SELECT id FROM waves WHERE status='running' ORDER BY wave_number DESC LIMIT 1) RETURNING wave_number;` → returned `20`. `ended_at` auto-set by the `set_wave_ended_at()` trigger. 0 running rows remain.
- **5b. Loop-handoff anchor:** `process/session/.last-wave-completed.yaml` overwritten (next_wave 21, seed 1d95cac0, no siblings, M9 in_progress, loop ready).

```yaml
n_stage_verdict: COMPLETE
verdict_evidence:
  - "next wave: 21"
  - "next wave checklist: process/waves/wave-21/checklist.md"
  - "archive commit: see final report"
  - "waves row 20 closed status='ok' (RETURNING 20); 0 running remain"
prev_wave: 20
next_wave: 21
loop_state: ready
seed_task_id: 1d95cac0-b396-40b7-8904-be0fa42aa3ab
bundled_sibling_ids: []
claimed_task_ids: [1d95cac0-b396-40b7-8904-be0fa42aa3ab]
active_milestone_id: 099cee10-562d-4e56-9a57-0dade2914760
active_milestone_status: in_progress
state_transitions_applied_this_wave:
  - {milestone: none, from: null, to: null}
note: "Task dispositions this wave (not milestone-state): 1d95cac0 wave_id→NULL (re-home); 345dfbc6 todo→blocked (external founder-gate). Seller-intent = wave-22 seed."
```

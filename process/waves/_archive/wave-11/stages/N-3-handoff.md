# N-3 — Handoff (wave 11 → wave 12)

## Action 1 — Next wave number + loop state
- Current wave: 11. Next wave: **12**.
- Loop state = **ready** (NOT paused): N-2 emitted a valid seed (`queue_exhausted: false`); no stockout-pending-founder (6 todo milestones remain); decomposition ran INLINE under automatic mode (not deferred to founder). None of the three pause conditions hold.

## Action 2 — Pre-created wave-12 directory + checklist
- `process/waves/wave-12/blocks/{P,D,B,C,T,V,L,N}` + `stages/` created.
- `process/waves/wave-12/checklist.md` written from the DISPATCHER template, pre-filled: wave 12; seed 07989285; siblings d1940142 + 45b259e1; claimed_task_ids; active milestone M6; pending carry-forwards (LLM-spend deferred non-blocking; mvp-thinner; D-block for pipeline pages; pipeline design contract #137; hard boundaries; no-ghost-dep surfaces; L-2 OBS-W11-1 priority carry-forward).

## Action 3 — This deliverable written before archive move (so it archives with the wave).

## Action 4 — Archive entire wave-11 (single git mv + commit). See verdict_evidence.archive_commit.

## Action 5 — Final state emission
- **5a. DB wave-close** (AFTER archive): `UPDATE waves SET status='ok' WHERE id=(SELECT id FROM waves WHERE status='running' ORDER BY wave_number DESC LIMIT 1) RETURNING wave_number`. Expected `RETURNING wave_number = 11`. Trigger auto-sets `ended_at`.
- **5b. `.last-wave-completed.yaml`** overwritten with handoff anchor (next_wave 12, seed, siblings, claimed ids, active milestone M6/in_progress, loop_state ready, pending LLM-spend deferral carried).

```yaml
n_stage_verdict: COMPLETE
verdict_evidence:
  - "next wave: 12"
  - "next wave checklist: process/waves/wave-12/checklist.md"
  - "archive commit: see git log (chore: N-3 archive wave-11)"
  - "waves row closed: UPDATE waves status='ok' RETURNING wave_number=11"
prev_wave: 11
next_wave: 12
loop_state: ready
seed_task_id: 07989285-7e64-4f26-a3de-1954ba89a5c7
bundled_sibling_ids:
  - d1940142-e962-48cd-b1eb-26d0c79e98dd
  - 45b259e1-d0d4-40b1-b09b-aeab25971700
claimed_task_ids:
  - 07989285-7e64-4f26-a3de-1954ba89a5c7
  - d1940142-e962-48cd-b1eb-26d0c79e98dd
  - 45b259e1-d0d4-40b1-b09b-aeab25971700
active_milestone_id: a068dc3d-8f77-4d01-ba1d-bbc6ed9b16bc
active_milestone_status: in_progress
state_transitions_applied_this_wave: []
note: "M6 remains in_progress (foundation shipped, scope not complete — pipeline seeded next; send/tracking/queue-screen/export still ahead). No milestone transitions this wave. Clean archive; wave row closed after archive per lifecycle ordering."
```

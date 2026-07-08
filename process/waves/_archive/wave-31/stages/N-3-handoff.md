# N-3 — Handoff (wave-31)

## Actions

### Action 1 — Next wave number + loop state
Current wave `<N>` = 31. Loop **PAUSES**: N-2 emitted `queue_exhausted: true` AND no ritual is in-flight that will produce work (BOARD ratified the pause 7/7; the founder-gated inputs are keys + _TBD metrics). Per pause rule: record `next_wave: paused`; do NOT increment the wave counter.

### Action 2 — Pause marker (no next-wave dir)
Not pausing path skipped. Wrote `process/session/.loop-paused.yaml` (paused_reason: scope-exhausted-pending-founder). wave-32 dir intentionally NOT pre-created (P-0 must not spin on nothing).

### Action 3 — This deliverable
Written before Action 4 archive so it archives with the wave.

### Action 4 — Archive wave-31
`git mv process/waves/wave-31/ process/waves/_archive/wave-31/` + commit.

### Action 5 — Final state emission
5a. `UPDATE waves SET status='ok'` on the running wave (wave 31) — trigger sets `ended_at`. RETURNING wave_number confirms.
5b. `process/session/.last-wave-completed.yaml` reconciled: last_wave 31, next_wave paused, seed null, loop_state paused, active_milestone M9 in_progress.
Plus: `STATUS: BLOCKED` written to `status-check.yaml` with pause_evidence (trigger f + board-escalation).

## Deliverable footer

```yaml
n_stage_verdict: COMPLETE
verdict_evidence:
  - "next wave: paused"
  - "archive commit: <see chore: N-3 archive wave-31>"
  - "waves.status: 31 → ok (ended_at trigger-set)"
  - "BOARD: next-milestone-slot-wave-31 7/7 APPROVE-PAUSE (no dissent, no HARD-STOP)"
prev_wave: 31
next_wave: paused
loop_state: paused
seed_task_id: null
bundled_sibling_ids: []
claimed_task_ids: []
active_milestone_id: 099cee10-562d-4e56-9a57-0dade2914760
active_milestone_status: in_progress
state_transitions_applied_this_wave: []      # M9 NOT closed; no promotion
note: >
  wave-31 fully closed (waves.status=ok). M9 stays in_progress (cannot close: _TBD success metric + both CRM
  adapters dormant/key-gated, unverifiable-live — NOT force-closed). Loop PAUSED (scope-exhausted-pending-founder);
  BOARD 7/7 APPROVE-PAUSE. Mode flag intact (automatic — a pause is not a mode change). STATUS BLOCKED (terminal
  until founder resumes via ESC+chat or edit). 3rd consecutive founder-gated edge (w29→w30→w31→now).

head_signoff:
  verdict: APPROVED
  stage: N-3
  reviewers:
    board: {slug: next-milestone-slot-wave-31, tally: "7/7 APPROVE-PAUSE"}
  failed_checks: []
  rationale: >
    Block-exit archive-readiness satisfied: wave-31 state immutably consistent (all P→L stages checked, done
    tasks terminal in DB), context distilled (L-block ran, DECISIONS captured), no secrets in any archived doc,
    no scope creep. Wave closed cleanly (status=ok). M9 disposition correct — left in_progress, not force-closed
    (the career-ending Hallucinated-Milestone-Completion failure is avoided). Pause is measured (trigger f +
    board-escalation), not anticipatory. milestone_transition explicitly evaluated: none (M9 stays; M11/M12
    _TBD-blocked). Clean end-of-life handoff.
  next_action: ESCALATE_TO_founder   # loop paused; founder resolves via .loop-resume.yaml (worker mailbox)
```

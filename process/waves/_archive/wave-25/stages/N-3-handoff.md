# N-3 — Handoff (wave-25 → wave-26)

Head: head-next. Mode: automatic. Not pausing (buildable seed exists) → increment to wave-26.

## Actions

- **Action 1 — next wave + loop state:** next wave = 26; loop_state = ready (N-2 seeded a valid single-task bundle; no pause condition fires now).
- **Action 2 — pre-create:** `process/waves/wave-26/{blocks/*,stages}` + `checklist.md` created (seed 1a1c5855, siblings [], M10). BOARD-bound context + wave-27 pause commitment recorded in the checklist header.
- **Action 3 — this deliverable** written before archive.
- **Action 4 — archive:** `git mv process/waves/wave-25/ process/waves/_archive/wave-25/` + commit.
- **Action 5a — close wave 25:** `UPDATE waves SET status='ok'` on the running row (wave_number 25).
- **Action 5b — handoff anchor:** `process/session/.last-wave-completed.yaml` overwritten.
- **status-check.yaml reconcile:** → wave-26 / P-0 / STATUS RUNNING (write-only founder mirror).

## Milestone state snapshot
- M10 (033f97e0): in_progress — NO transition this wave (open=1, scope not shipped).
- No promotion, no closure, no cancellation this wave.

## head_signoff (N-3 / block-exit)

```yaml
head_signoff:
  verdict: APPROVED
  stage: N-3
  reviewers: { board: "7/7 APPROVE disposition (c) — N-1-M10-recordkeeping-integrity-wave-25" }
  failed_checks: []
  rationale: >
    Archive-readiness clean: wave-25 fully staged for single-move archive; DECISIONS captured in
    L-1/L-2 + product-decisions; tech debt (RLS connection-split) is the wave-26 seed, not lost;
    no secrets in docs (verified); no scope creep. Tripwire resolved by BOARD, not mechanically
    seeded. Milestone_transition evaluated (none). next_wave_seed cleanly set to the FINAL M10
    hardening item with a framework-enforced wave-27 pause on the founder recordkeeping decision.
    Wave closes clean.
  next_action: PROCEED_TO_wave-26_P-0
```

---

```yaml
n_stage_verdict: COMPLETE
verdict_evidence:
  - "next wave: 26"
  - "next wave checklist: process/waves/wave-26/checklist.md"
  - "archive commit: see chore(wave-26): N-3 archive commit"
prev_wave: 25
next_wave: 26
loop_state: ready
seed_task_id: 1a1c5855-b8f8-4d86-93ea-7948e6881c10
bundled_sibling_ids: []
claimed_task_ids: [1a1c5855-b8f8-4d86-93ea-7948e6881c10]
active_milestone_id: 033f97e0-bc25-48dd-bb5a-b2f2be5b056a
active_milestone_status: in_progress
state_transitions_applied_this_wave: []
note: >
  Explicitly-FINAL M10 hardening wave seeded per BOARD disposition (c). wave-27 pauses
  structurally if the founder hasn't scoped M10 recordkeeping (_TBD metric refusal) by then.
```

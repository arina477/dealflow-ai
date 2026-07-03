# N-3 — Handoff (wave 3 close → wave 4)

## Actions

- **Action 1 — next wave number & loop state:** current wave = 3 → next = 4. No pause conditions (N-2 seed found, no founder-pending ritual). `loop_state: ready`.
- **Action 2 — pre-create wave-4:** `process/waves/wave-4/{blocks/{P,D,B,C,T,V,L,N},stages}` + `checklist.md` pre-filled with the M2 audit-log bundle.
- **Action 3 — this deliverable** written before Action 4 archive.
- **Action 4 — archive:** `git mv process/waves/wave-3/ process/waves/_archive/wave-3/`.
- **Action 5a — close wave row:** `UPDATE waves SET status='ok'` on the running wave-3 row (`57f2b2da…`). `ended_at` auto-set by trigger.
- **Action 5b — write `.last-wave-completed.yaml`** with the milestone state-machine snapshot + wave-4 seed.

```yaml
n_stage_verdict: COMPLETE
verdict_evidence:
  - "next wave: 4"
  - "next wave checklist: process/waves/wave-4/checklist.md"
  - "archive commit: see chore: N-3 archive wave-3 (wave-close commit)"
  - "waves.status: wave-3 (57f2b2da) running→ok"
prev_wave: 3
next_wave: 4
loop_state: ready
seed_task_id: ec1f279d-ea8a-44db-977b-cb6891972c1f
bundled_sibling_ids:
  - a8b2b5a2-18c5-46a3-a430-bb36e492500f
  - e6a4cbfe-121b-4fdc-8ae4-85db7e434378
  - 031d79fc-7513-4571-b0c9-8f43590fc9bf
claimed_task_ids:
  - ec1f279d-ea8a-44db-977b-cb6891972c1f
  - a8b2b5a2-18c5-46a3-a430-bb36e492500f
  - e6a4cbfe-121b-4fdc-8ae4-85db7e434378
  - 031d79fc-7513-4571-b0c9-8f43590fc9bf
active_milestone_id: 2f116b9b-0338-421d-a9ad-899a11403aff
active_milestone_status: in_progress
state_transitions_applied_this_wave:
  - {milestone: "M1 (2c79236a)", from: in_progress, to: done}
  - {milestone: "M2 (2f116b9b)", from: todo, to: in_progress}
note: "M1 shipped + closed; M2 (compliance backbone) promoted + decomposed. Wave-4 seeds the tamper-evident audit-log vertical slice — the load-bearing dependency for M2's rules engine + pre-send compliance check."
```

## head_signoff

```yaml
head_signoff:
  verdict: APPROVED
  stage: N-3
  reviewers: {}
  failed_checks: []
  rationale: "Wave immutably consistent for archive: all P→L gates APPROVED, wave-3 live at 935b847 with real-browser E2E 7/7 (end-to-end, not mocked). Milestone state machine advanced correctly (M1 closed on shipped judgment, M2 promoted, transitions logged to product-decisions.md). Next-wave seed cleanly emitted; loop_state ready. No secret leaks in archived docs, no undocumented tech-debt crossing the boundary (the 3 M1 follow-ups are tracked DB rows re-parented to M2, not lost hacks). Wave row closed status=ok after archive (correct ordering). Bundle context is distilled (per-task prose descriptions + decision-log entry), not raw chat log."
  next_action: PROCEED_TO_wave-4_P-0
```

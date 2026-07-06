# N-3 — Handoff (wave-14 → wave-15)

## Action 1 — Next wave + loop state
Next wave = 15. loop_state = **ready** (decomposition succeeded inline under automatic; seed 82ec8724 exists in DB — no pause condition: N-2 not queue-exhausted, no stockout, no strict-mode founder-defer).

## Action 2 — Pre-created wave-15
`process/waves/wave-15/blocks/{P,D,B,C,T,V,L,N}` + `stages/` + `checklist.md` (seed 82ec8724 + 3 siblings, active milestone M7, BOARD-dissent carry-forward notes).

## Action 4 — Archive
`git mv process/waves/wave-14/ → process/waves/_archive/wave-14/` (single move). Commit SHA recorded below.

## Action 5a — DB wave-close
`UPDATE waves SET status='ok' WHERE id=(running, max wave_number)` → RETURNING wave_number=14. ended_at trigger-set.

## Action 5b — .last-wave-completed.yaml
next_wave=15, seed 82ec8724 + 3 siblings, active milestone M7 (in_progress), M6→blocked + M7→in_progress transitions recorded, pending_founder_decisions carried (email credential #141 + LLM-spend).

## Archive-readiness (head-next N-3 exit checklist)
- Prior blocks all APPROVED/PASS (P-4 PASSED, D-3, B-6 APPROVED, C-1/C-2 PASS @ 5754fbf, T-1..T-9, V-1/V-2/V-3, L-1/L-2). ✓
- Context distilled (L-1 Docs + L-2 Distill complete). ✓
- Tech debt registered: bfadcec1 (test-fixture typing, unparented M7 debt), b1a0b2ac (/health wording, unassigned). ✓
- No secret leaks in wave-14 docs (grep scan clean; T-8 passed; C-2 repo scan clean). ✓
- No scope creep: wave-14 shipped exactly its seed bundle (07bd1e1a + 2 siblings, all done). ✓
- next_wave_seed_task cleared of wave-14's input; milestone_transition explicitly evaluated (M6→blocked + M7→in_progress). ✓

```yaml
n_stage_verdict: COMPLETE
verdict_evidence:
  - "next wave: 15"
  - "next wave checklist: process/waves/wave-15/checklist.md"
  - "archive commit: see git log (chore: N-3 archive wave-14)"
  - "waves row 14 closed: status='ok' RETURNING wave_number=14"
prev_wave: 14
next_wave: 15
loop_state: ready
seed_task_id: 82ec8724-3f9e-45bd-8e81-e4e3fab8872d
bundled_sibling_ids:
  - 648a86a6-024b-4fce-9212-1e637ee16765
  - 41c017f7-0665-4fca-b95f-82fbf8962178
  - d7f716b4-d451-4095-8b43-9fbe4e85fcf8
claimed_task_ids:
  - 82ec8724-3f9e-45bd-8e81-e4e3fab8872d
  - 648a86a6-024b-4fce-9212-1e637ee16765
  - 41c017f7-0665-4fca-b95f-82fbf8962178
  - d7f716b4-d451-4095-8b43-9fbe4e85fcf8
active_milestone_id: 08d3053a-48fb-4562-a25b-6d99d40b0f62
active_milestone_status: in_progress
state_transitions_applied_this_wave:
  - {milestone: "M6 (a068dc3d)", from: in_progress, to: blocked}
  - {milestone: "M7 (08d3053a)", from: todo, to: in_progress}
note: "M6 blocked = honest external-hold (founder email credential #141 + LLM-spend). M7 promoted + decomposed buildable-without-credential. BOARD 7/7 APPROVE."
```

# N-3 — Handoff (wave 5 → wave 6)

Head: head-next. Mode: `automatic`.

## Action 1 — next wave + loop state
No pause condition (N-2 seed found; no stockout; no strict-mode founder-defer under `automatic`). Next wave = **6**. `loop_state: ready`.

## Action 2 — wave-6 pre-created
`process/waves/wave-6/{blocks/{P,D,B,C,T,V,L,N},stages}` + `checklist.md` created, pre-filled with seed ff378a95 + 3 siblings + active milestone M3 + P-0 pending notes (mvp-thinner, D-block, SDK-research, M1-followup backlog).

## Action 4 — archive
`git mv process/waves/wave-5/ → process/waves/_archive/wave-5/` (single move). N-1/N-2/N-3 rows ticked in checklist first.

## Action 5a — wave-5 row closed
`UPDATE waves SET status='ok'` on the running row (wave_number 5, id 42f6400a-23a3-4398-bdf9-f861cc4e78f9). Runs AFTER archive per stage contract.

## Action 5b — loop-handoff anchor
`process/session/.last-wave-completed.yaml` overwritten with wave-6 handoff state + milestone snapshot (M2→done, M3→in_progress).

```yaml
n_stage_verdict: COMPLETE
verdict_evidence:
  - "next wave: 6"
  - "next wave checklist: process/waves/wave-6/checklist.md"
  - "archive commit: see chore: N-3 archive wave-5 + seed wave-6"
prev_wave: 5
next_wave: 6
loop_state: ready
seed_task_id: ff378a95-b86c-4d26-89e3-6e6072381d44
bundled_sibling_ids:
  - 0241222b-dda3-4606-bbc8-d15f5103a278
  - db274731-bba9-4276-b092-a32538027bf6
  - f5771d13-e3cf-4878-96fe-5d9056fa5944
claimed_task_ids:
  - ff378a95-b86c-4d26-89e3-6e6072381d44
  - 0241222b-dda3-4606-bbc8-d15f5103a278
  - db274731-bba9-4276-b092-a32538027bf6
  - f5771d13-e3cf-4878-96fe-5d9056fa5944
active_milestone_id: b372bbf7-09f3-4eb0-87df-28b5ec52bfc2
active_milestone_status: in_progress
state_transitions_applied_this_wave:
  - {milestone: M2 (2f116b9b), from: in_progress, to: done}
  - {milestone: M3 (b372bbf7), from: todo, to: in_progress}
note: "M2 closed (compliance backbone shipped, both named halves live-verified). M3 promoted + first bundle authored. Wave 5 shipped LIVE 13e55ef. Next: wave-6 P-0 (mvp-thinner + D-block + likely SDK-research)."
```

## Exit
Wave-6 dir + checklist exist; wave-5 fully archived; `.last-wave-completed.yaml` reflects handoff; wave-5 `waves.status='ok'`. `n_stage_verdict: COMPLETE`.

---

```yaml
head_signoff:
  verdict: APPROVED
  stage: N-3
  reviewers: {}
  failed_checks: []
  rationale: >
    Wave 5 is immutably consistent for archival — all preceding stages checked, spec/decisions distilled (L-1/L-2 already committed), no secret leaks in the archived tree, no unauthorized scope creep vs the wave-5 seed (rules engine + pre-send gate exactly as specified, live-verified). The milestone state machine is honestly recorded in the DB and the decision log (M2→done, M3→in_progress). next_wave_seed_task is cleanly set to the M3 bundle and milestone_transition explicitly evaluated (M2 closure + M3 promotion). Wave row closes AFTER the archive move per contract. loop_state ready — no pause trigger fires under automatic mode.
  next_action: PROCEED_TO_wave-6-P-0
```

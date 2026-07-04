# N-1 — Survey & triggers (wave 10)

```yaml
n_stage_verdict: COMPLETE
verdict_evidence:
  - "active milestone: d72b4510 (M5) at N-1 entry"
  - "todo queue head: a068dc3d (M6, T1)"
  - "active child tasks: open=0 done=3 seed_candidates=0"
  - "unassigned queue depth: 1 (b1a0b2ac /health spec-wording, low)"
  - "closure: none (M5 scope NOT shipped — flagship LLM-rationale half unbuilt)"
  - "disposition: M5 in_progress→blocked (founder LLM-spend hold); M6 todo→in_progress"
  - "decomposition fired: true (M6 first bundle, automatic→milestone-decomposer inline)"
  - "rituals fired: [milestone-decomposition]"
prev_wave: 10
active_milestone_id: a068dc3d-8f77-4d01-ba1d-bbc6ed9b16bc   # M6, after disposition
active_milestone_child_summary:
  open: 0     # M5 at entry
  done: 3     # M5 deterministic spine
  seed_candidates: 0   # M5 at entry (before M6 promotion+decomposition)
next_todo_id: a068dc3d-8f77-4d01-ba1d-bbc6ed9b16bc
unassigned_queue_depth: 1
state_transitions_applied:
  - {milestone: "M5 (d72b4510)", from: in_progress, to: blocked, recorded_in_decisions_log: true}
  - {milestone: "M6 (a068dc3d)", from: todo, to: in_progress, recorded_in_decisions_log: true}
slot_promotion:
  promoted_id: a068dc3d-8f77-4d01-ba1d-bbc6ed9b16bc   # M6
  prior_active_id: d72b4510-0ddb-4cf6-b494-ccbaa64aa633   # M5 (→ blocked, not done)
decomposition_fired: true
proposals_fired:
  - {ritual: milestone-decomposition, target_milestone: "M6 (a068dc3d)", reason: decomposition-needed, decision: decomposition-complete, by: milestone-decomposer, fired_at: "2026-07-04"}
ritual_outcomes:
  - {ritual: milestone-decomposition, outcome_summary: "M6 first bundle authored — seed 102a2f00 (versioned template library) + siblings e90a4a99 (composer + non-bypassable server-side pre-send gate), 2601ba33 (SoD + version-binding)", decision: complete, by: milestone-decomposer}
loop_state: ready
note: >
  M5 NOT closed (Hallucinated-Milestone-Completion avoided): success metric requires "explainable
  rationale per buyer"; all 3 M5 done tasks are deterministic; the LLM-rationale half is genuinely
  unbuilt. M5→blocked (external hold on the founder LLM-spend money decision) because the LLM bundle
  needs a live Claude call to build/verify (wave-9 carry-forwards b+e) ⇒ spend routes to founder under
  automatic mode. Single-active invariant required M5 to leave the in_progress slot before M6 could be
  promoted; blocked keeps M5 + its LLM bundle tracked on the roadmap (re-surface trigger recorded).
  BOARD 7/7 APPROVE (slug N-1-milestone-disposition-wave-10, strict Tier-3 6+/7 bar) on path (b).
  head-next N-1 gate: APPROVED.
```

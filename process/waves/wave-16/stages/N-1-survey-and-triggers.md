# N-1 — Survey & triggers (wave-16 close)

```yaml
n_stage_verdict: COMPLETE
verdict_evidence:
  - "active milestone (at entry): 08d3053a (M7 — Admin & settings, in_progress)"
  - "todo queue head: 9ed98c3c (M8 — Pilot-partner workspace / data isolation, H2/T4, oldest todo)"
  - "active child tasks: open=4 done=10 seed_candidates=1 (the 1 was bfadcec1 test-typing debt — NOT a substantive M7 seed; the 3 G-* hardening gaps have wave_id=16 so are NOT valid seeds)"
  - "unassigned queue depth: 1"
  - "closure/disposition: M7 in_progress→blocked (BOARD; #141-gated sending-domain leg; M5/M6 precedent)"
  - "promotion: 9ed98c3c (M8): todo→in_progress"
  - "decomposition fired: true (M8 first bundle authored — decomposition-complete)"
  - "rituals fired: [milestone-disposition-BOARD, milestone-decomposition]"
prev_wave: 16
active_milestone_id: 9ed98c3c-8cb8-4736-8337-22dc0dae48d4   # M8 after disposition (M7 was active at entry)
active_milestone_child_summary:
  open: 4        # M7 (now blocked): 3 V-2 Low gaps + bfadcec1 carryover — stay parented to M7
  done: 10       # M7
  seed_candidates: 1   # bfadcec1 (M7 testing-infra debt) — NOT chosen
next_todo_id: 099cee10-562d-4e56-9a57-0dade2914760   # M9 (next after M8 promoted)
unassigned_queue_depth: 1
state_transitions_applied:
  - {milestone: "M7 (08d3053a)", from: in_progress, to: blocked, recorded_in_decisions_log: true}
  - {milestone: "M8 (9ed98c3c)", from: todo, to: in_progress, recorded_in_decisions_log: true}
slot_promotion:
  promoted_id: 9ed98c3c-8cb8-4736-8337-22dc0dae48d4
  prior_active_id: 08d3053a-48fb-4562-a25b-6d99d40b0f62
decomposition_fired: true
proposals_fired:
  - {ritual: milestone-disposition, target_milestone: "M7 08d3053a", reason: "success-metric leg 3 (#141-gated sending-domain) unshipped; 2/3 legs live", decision: "BOARD 7/7 forward-motion — M7→blocked, promote M8", by: BOARD, fired_at: "2026-07-06"}
  - {ritual: milestone-decomposition, target_milestone: "M8 9ed98c3c", reason: "decomposition-needed (newly-promoted, 0 child tasks)", decision: decomposition-complete, by: milestone-decomposer, fired_at: "2026-07-06"}
ritual_outcomes:
  - {ritual: milestone-disposition-BOARD, outcome_summary: "M7→blocked (honest external-hold, #141), M8→in_progress; decision-slug N-1-milestone-disposition-M7-wave-16; 7/7 endorse forward motion, 0 HARD-STOP", decision: APPROVED, by: BOARD}
  - {ritual: milestone-decomposition, outcome_summary: "M8 first bundle: seed 0db154ff (workspace_id spine) + 3 siblings (RLS deny-by-default, request-scope propagation, cross-tenant negative-read test); ~2,000–3,200 LOC; additive-only; commit 1234f41", decision: decomposition-complete, by: milestone-decomposer}
loop_state: ready
note: >
  M7 disposition is a Tier-3 strategic call (milestone-theme advance) routed to BOARD under automatic mode.
  M7 held at `blocked` (not `done`) per dispositive M5/M6 #141-gate precedent — Hallucinated-Milestone-Completion
  avoided. realist's `_TBD`-M8-metric concern resolved: decomposer's scope-too-vague guard is a CLUSTER condition
  that did not fire (rich ## Scope + live ## References + qualitative "no cross-firm visibility" target anchor the
  bundle); only the quantitative metric is founder-deferred → digest note, non-blocking. #141 sending-domain +
  M8 quantitative-metric surfaced to founder digest.
```

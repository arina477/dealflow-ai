# N-1 — Survey & triggers (wave 9)

**Head:** head-next (owns N-block lifetime). **Mode:** automatic.

## Survey signals (Actions 1–4)

- **Action 1 — active milestone:** M4 `c67b1610-9cc3-4cad-bcfa-1bee0573da72` (in_progress at entry).
- **Action 2 — todo queue head:** M5 `d72b4510-0ddb-4cf6-b494-ccbaa64aa633` (roadmap-sequence next: sourcing M3 → mandates M4 → matching M5 → outreach M6; T2, product-feature, flagship differentiator, consumes wave-9 ready-to-rank universe). Full todo queue: M5, M6, M7, M8, M9, M10, M11, M12.
- **Action 3 — M4 child summary:** open=3, done=6, seed_candidates=0. The 3 open were M1/M2-era foundation backlog parked under M4 (each `parent_task_id NULL` + stale `wave_id` from waves 1/2/3 → not seed candidates), NOT M4-scope.
- **Action 4 — unassigned queue depth:** 1 (b1a0b2ac — /health spec wording; a P-0 walk candidate for wave-10).

## Trigger phase (Actions 6–10)

- **Action 6 — M4 closure check:** M4 `## Success metric` fully shipped + live-verified (wave-8 mandate spine live e57be83 + wave-9 buyer-universe builder live 937ae18, V-3 APPROVED, C-2 first-try, all T/V/L gates passed). `open_count=3` but all 3 open are NON-M4-scope backlog → re-homed first (below), THEN closed. Honest close (metric live-verified, not tickets-closed; ready-to-rank is real persisted state, not a stub — Hallucinated-Milestone-Completion avoided). **Routed to BOARD** (milestone-disposition, automatic mode; Tier-3-adjacent strict 6+/7 bar). BOARD 7/7 APPROVE, 0 HARD-STOP → `M4 in_progress → done` applied.
  - Re-home (before close, satisfies 0-open-children invariant): 6fe232e3 auth-hardening → M10; d7f716b4 AppShell-polish → M7; bfadcec1 test-fixture-typing → M7. All cleared to clean future seeds (`wave_id=NULL`, `parent_task_id=NULL`, `status=todo`).
- **Action 8 — slot promotion:** M4 closed → active slot empty → promote M5 (`next_todo_id`) `todo → in_progress`. Single-active invariant held (0 in_progress between the flips, verified). Same BOARD 7/7 verdict.
- **Action 7 (re-eval vs new active M5):** M5 has 0 child tasks post-promotion → seed_candidates=0, scope NOT shipped → **fire milestone-decomposition** (automatic → spawn milestone-decomposer sub-agent, inline). Returned `decomposition-complete`: seed 47ed7ddd (deterministic match spine + rule-based pre-score) + siblings fb82d339 (/matches-shortlist page) + f74dce45 (accept/reject/flag shortlist + ready-for-outreach handoff); est 2,800–4,200 LOC; deterministic-only (NO LLM/SDK/BullMQ/spend this bundle — LLM-rationale is a later M5 bundle carrying the BOARD wave-10 carry-forwards). Committed eabb215. seed_candidates 0 → 1.
- **Action 9 — daily-checkpoint:** NOT fired. Condition requires "Action 7 found no seed candidate AND decomposition not fired" — decomposition fired successfully (seed exists). The 1 unassigned-queue task defers to wave-10 P-0 walk.

```yaml
n_stage_verdict: COMPLETE
verdict_evidence:
  - "active milestone: c67b1610-9cc3-4cad-bcfa-1bee0573da72 (M4, in_progress at entry → done)"
  - "todo queue head: d72b4510-0ddb-4cf6-b494-ccbaa64aa633 (M5)"
  - "active child tasks: open=3 done=6 seed_candidates=0 (3 open = non-M4 backlog, re-homed)"
  - "unassigned queue depth: 1"
  - "closure: M4 in_progress→done (BOARD 7/7)"
  - "promotion: d72b4510 (M5) todo→in_progress (BOARD 7/7)"
  - "decomposition fired: true (M5 first bundle: seed 47ed7ddd + 2 siblings)"
  - "rituals fired: [milestone-decomposition]"
prev_wave: 9
active_milestone_id: d72b4510-0ddb-4cf6-b494-ccbaa64aa633
active_milestone_child_summary:
  open: 3
  done: 0
  seed_candidates: 1
next_todo_id: a068dc3d-8f77-4d01-ba1d-bbc6ed9b16bc   # M6 (next after M5 promoted)
unassigned_queue_depth: 1
state_transitions_applied:
  - {milestone: M4 (c67b1610-9cc3-4cad-bcfa-1bee0573da72), from: in_progress, to: done, recorded_in_decisions_log: true}
  - {milestone: M5 (d72b4510-0ddb-4cf6-b494-ccbaa64aa633), from: todo, to: in_progress, recorded_in_decisions_log: true}
task_rehomes_applied:
  - {task: 6fe232e3 (auth-hardening), from_milestone: M4, to_milestone: M10, wave_id_cleared: true}
  - {task: d7f716b4 (AppShell-polish), from_milestone: M4, to_milestone: M7, wave_id_cleared: true}
  - {task: bfadcec1 (test-fixture-typing), from_milestone: M4, to_milestone: M7, wave_id_cleared: true}
slot_promotion:
  promoted_id: d72b4510-0ddb-4cf6-b494-ccbaa64aa633
  prior_active_id: c67b1610-9cc3-4cad-bcfa-1bee0573da72
decomposition_fired: true
proposals_fired:
  - {ritual: milestone-decomposition, target_milestone: M5, reason: decomposition-needed, decision: decomposition-complete, by: milestone-decomposer, fired_at: 2026-07-04}
board_decision:
  slug: N-1-milestone-disposition-wave-9
  bar: strict-tier-3 (6+/7)
  result: 7/7 APPROVE
  hard_stops: 0
  record: process/waves/wave-9/escalations/board-N-1-milestone-disposition-wave-9.md
ritual_outcomes:
  - {ritual: milestone-decomposition, outcome_summary: "M5 first bundle authored (deterministic match spine + /matches-shortlist + shortlist-handoff); LLM-rationale deferred to later M5 bundle", decision: complete, by: milestone-decomposer}
loop_state: ready
note: "M4 honestly closed (metric live-verified both halves); M5 promoted + first deterministic bundle seeded; M5 scope NOT fully decomposed (LLM-rationale vertical remains for a future N-1). LLM SDK+spend gated to wave-10 P-3/P-4 (non-blocking flags recorded in product-decisions.md)."
```

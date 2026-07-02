# N-1 — Survey & triggers (wave 1)

Combined survey (Actions 1–4) + trigger phase (Actions 6–10) for the wave-1 close-out. Mode: **automatic**.

## Survey phase

| Action | Signal | Value |
|---|---|---|
| 1 | Active milestone (`status='in_progress'`) | **0 rows** — no active milestone (M1 never promoted during greenfield bootstrap) |
| 2 | `todo` queue head (highest tier) | M1 `2c79236a-…` (T1, platform-foundation, required-by all). M2–M12 also `todo`. |
| 3 | M1 child summary | open=1, done=1, **seed_candidates=0** |
| 4 | Unassigned queue depth | 2 (both backend/infra follow-ups; neither blocks M1's next slice) |

Action-3 detail: done child = `e83584db` (scaffold). Open child = `bfadcec1` ("Tighten test-fixture typing in wave-1 health tests") with `wave_id` SET (wave-1 V-2 follow-up) → NOT a seed candidate, which is why seed_candidates read 0.

## Trigger phase

- **Action 6 — Closure check:** M1 has `open_count=1 (>0)` AND scope NOT shipped (only scaffold+CI of M1's `## Scope`; auth/RBAC/AppShell/data-model/auth-screens remain). → NOT closed. Fell through to Action 8 (promotion) then Action 7 (decomposition).
- **Action 8a — Slot promotion:** active slot empty (Action 1 = 0 rows). Promoted highest-tier `todo` M1 `todo → in_progress` (guarded UPDATE re-asserting the ≤1-in_progress invariant; post-check confirmed exactly 1 in_progress). Decision-log entry appended.
- **Action 8b — Stockout cascade:** NOT fired — `next_todo_id != null` (M2–M12 exist). Roadmap-planning NOT fired.
- **Action 7 — Per-wave decomposition:** M1 active AND seed_candidates=0 AND scope not shipped → fired milestone-decomposition, caller mode `next-bundle`. Under `automatic`, spawned `milestone-decomposer` sub-agent (inline). Returned `decomposition-complete` — authored the **auth vertical slice** bundle (1 seed + 2 siblings). Post-INSERT validated: seed_candidates now = 1.
- **Action 9 — Daily-checkpoint:** NOT fired (decomposition fired this tick → first condition fails).
- **Action 10 — Routing:** decomposition routed per `automatic` mode table (spawn `milestone-decomposer`). Outcome applied: one bundle INSERTed under M1.

## Bundle authored by decomposition (for N-2)

| Role | id | title |
|---|---|---|
| seed | `e15f71dd-8f61-441c-904a-bdfa108bd6e1` | Integrate SuperTokens auth + user/role data model |
| sibling | `e1c0e81e-41b8-4b49-9d6c-8b1ed5c33e38` | Build invite-only auth API: signup, session, reset |
| sibling | `af6cbc59-ffcb-43ca-810d-4860d6e6bf64` | Wire login, accept-invite, reset-password screens end-to-end |

Vertical slice DB+API+UI (authentication). ~3,200 LOC, ~30–40 files. Deferred to a follow-up M1 bundle: AppShell chrome, role-aware dashboard shell, full per-route RBAC enforcement.

```yaml
n_stage_verdict: COMPLETE
verdict_evidence:
  - "active milestone: 2c79236a-ffc0-43e2-b406-a5aa56413882 (M1, promoted this tick)"
  - "todo queue head: 2c79236a-ffc0-43e2-b406-a5aa56413882 (M1, T1) prior to promotion"
  - "active child tasks: open=4 done=1 seed_candidates=1 (post-decomposition)"
  - "unassigned queue depth: 2"
  - "closure: none (scope not shipped)"
  - "promotion: 2c79236a-…:todo→in_progress"
  - "decomposition fired: true (milestone-decomposer, decomposition-complete)"
  - "rituals fired: [milestone-decomposition]"
prev_wave: 1
active_milestone_id: 2c79236a-ffc0-43e2-b406-a5aa56413882
active_milestone_child_summary:
  open: 4
  done: 1
  seed_candidates: 1
next_todo_id: 2f116b9b-0338-421d-a9ad-899a11403aff   # M2 (next after M1 promoted out)
unassigned_queue_depth: 2
state_transitions_applied:
  - {milestone: "M1 (2c79236a)", from: todo, to: in_progress, recorded_in_decisions_log: true}
slot_promotion:
  promoted_id: 2c79236a-ffc0-43e2-b406-a5aa56413882
  prior_active_id: null
decomposition_fired: true
proposals_fired:
  - {ritual: milestone-decomposition, target_milestone: "2c79236a-ffc0-43e2-b406-a5aa56413882", reason: decomposition-needed, decision: applied, by: milestone-decomposer, fired_at: "2026-07-02"}
roadmap_planning_fired: false
daily_checkpoint_fired: false
ritual_outcomes:
  - {ritual: milestone-decomposition, outcome_summary: "auth vertical slice bundle authored (seed e15f71dd + siblings e1c0e81e, af6cbc59)", decision: applied, by: milestone-decomposer}
loop_state: ready
head_signoff:
  verdict: APPROVED
  stage: N-1
  reviewers: {}
  failed_checks: []
  rationale: >
    Milestone invariant re-verified live: exactly 1 in_progress (M1). Promotion
    todo→in_progress correctly resolves the greenfield never-promoted artifact and
    is recorded in the decision log. Closure correctly declined — M1 scope not
    shipped (only scaffold+CI done). Per-wave decomposition fired inline via
    milestone-decomposer per automatic-mode routing and produced a valid bundle in
    the DB. Stockout correctly not fired (M2–M12 todo). Daily-checkpoint correctly
    suppressed. No hallucinated milestone completion, no replanning loop.
  next_action: PROCEED_TO_N-2
note: "M1 promotion resolves the greenfield never-promoted artifact flagged by head-learn. M1 NOT closed (scope not shipped)."
```

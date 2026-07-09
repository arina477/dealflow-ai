# N-1 — Survey & triggers (wave-38)

Mode: automatic. head-next owns the N-block (agent a050d76cce68bf7c7). N-1 head_signoff: APPROVED.

## Survey signals (Actions 1–4)

- **Active milestone (Action 1):** exactly one `in_progress` — M7 — Admin & settings (`08d3053a-48fb-4562-a25b-6d99d40b0f62`). Singleton invariant holds.
- **todo queue (Action 2):** M11 (multi-tenant SaaS + billing, `4636e74e-…`), M12 (deal network & predictive models, `ede6e8a2-…`). Both intentionally held/deferred to H3 per the 2026-07-09 founder refresh. `next_todo_id` not promoted (M7 still active).
- **M7 child summary (Action 3):** open=3, done=14, **seed_candidates=0**.
- **Unassigned queue depth (Action 4):** 2 — `b1a0b2ac` (tighten /health spec wording, wave-1 residual) + `26710959` (wire /health version to real build SHA, V-2 follow-up this wave). Neither under M7.

The 3 open M7 children are all parented under seed `6235baf7` (status=`done`, the wave-37 self-serve-firm-setup seed):
- `0ef436c3` — Admin role transfer/demote-self + role-sharing (beyond grant-admin) — todo, wave_id NULL
- `81e06ff3` — Full member-management CRUD UI (beyond grant-admin) — todo, wave_id NULL
- `dd5ff64b` — Onboarding polish: create-firm wizard + logo/branding — todo, wave_id NULL

No fresh unparented seed under M7 → `seed_candidates=0` is genuine (all open children are deferred siblings of a CLOSED bundle).

## Triggers (Actions 6–10)

- **Action 6 (closure):** NO CLOSE. M7 open_count=3 ≠ 0; scope unshipped (sending-domain DKIM/SPF/DMARC verification from `## Success metric` not among the 14 done tasks). Closing would be Hallucinated Milestone Completion.
- **Action 7 (per-wave decomposition):** FIRES. active_milestone exists AND seed_candidates=0 AND scope not shipped → milestone-decomposition with reason `decomposition-needed` against M7.
- **Action 8 (promotion/stockout):** N/A — active slot filled (M7 in_progress); M11/M12 held at H3.
- **Action 9 (daily-checkpoint):** N/A — decomposition fired this tick (guard unsatisfied).
- **Action 10 (routing):** automatic mode → spawn `milestone-decomposer` sub-agent inline (NOT BOARD; BOARD only for the incomplete-scope escalation path, which concrete non-TBD M7 prose does not trigger). No split/hard-stop → no founder-ask.

```yaml
n_stage_verdict: COMPLETE
verdict_evidence:
  - "active milestone: 08d3053a-48fb-4562-a25b-6d99d40b0f62 (M7 — Admin & settings, in_progress)"
  - "todo queue head: held (M11/M12 deferred H3; not promoted — M7 still active)"
  - "active child tasks: open=3 done=14 seed_candidates=0"
  - "unassigned queue depth: 2"
  - "closure: none (M7 open=3, scope unshipped)"
  - "promotion: none (active slot filled)"
  - "decomposition fired: true (Action 7 — automatic-mode inline milestone-decomposer spawn)"
  - "rituals fired: [milestone-decomposition]"
prev_wave: 38
active_milestone_id: 08d3053a-48fb-4562-a25b-6d99d40b0f62
active_milestone_child_summary:
  open: 3
  done: 14
  seed_candidates: 0
next_todo_id: null
unassigned_queue_depth: 2
state_transitions_applied: []
slot_promotion:
  promoted_id: null
  prior_active_id: 08d3053a-48fb-4562-a25b-6d99d40b0f62
decomposition_fired: true
proposals_fired:
  - {ritual: milestone-decomposition, target_milestone: 08d3053a-48fb-4562-a25b-6d99d40b0f62, reason: decomposition-needed, decision: fire-inline, by: automatic-mode, fired_at: "2026-07-09"}
ritual_outcomes:
  - {ritual: milestone-decomposition, outcome_summary: "M7 next bundle authored (admin role transfer/demote-self + role-sharing seed)", decision: complete, by: milestone-decomposer}
loop_state: ready
note: "head-next N-1 APPROVED. Action 7 decomposition trigger correctly identified; automatic-mode inline decomposer spawn (not BOARD). 3 open M7 children are parented siblings of closed seed 6235baf7, not fresh seeds."
```

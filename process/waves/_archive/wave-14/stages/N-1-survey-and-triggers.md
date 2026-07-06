# N-1 — Survey & triggers (wave-14)

## Survey signals (Actions 1–4)
- **Active milestone (Action 1):** M6 (a068dc3d — Compliant outreach & pipeline), status=in_progress. One row (invariant OK).
- **`todo` queue (Action 2):** M7 (08d3053a, H1/T3), M8 (9ed98c3c, H2/T4), M9 (099cee10), M10 (033f97e0, H2/T4), M11, M12. `next_todo_id` = M7 (highest tier: H1/T3 beats all others' H2/T4).
- **M6 child-task summary (Action 3):** open=0, done=12, seed_candidates=0. All 12 M6 child tasks terminal (done).
- **Unassigned queue depth (Action 4):** 1.

## Trigger phase (Actions 6–10)

### Action 6 — M6 closure check → NOT closed (WITHHELD)
open_count=0 but LLM judges M6 ## Scope NOT fully shipped. All 5 ## Scope Pages shipped (templates-library, outreach-composer, compliance-queue, audit-log-export, pipeline), BUT M6 ## Success metric (send→track→advance end-to-end) is UNMET: compliant SEND + webhook event-tracking + reply/open auto-advance + AI-drafting are all founder-credential/spend-gated (email-provider key + EMAIL_WEBHOOK_SECRET #141; LLM-spend). Marking M6 `done` would be Hallucinated Milestone Completion → REFUSED.

### Disposition (Tier-3, routed to BOARD — decision-slug N-1-milestone-disposition-wave-14)
Because M6's buildable-without-credential scope is EXHAUSTED and the remainder is founder-gated (brain cannot author per always-on rule 6), and because the next-milestone-promotion is a product-priority call (rule 17): routed to BOARD under automatic mode.
**BOARD outcome: 7/7 APPROVE, 0 HARD-STOP** (clears Tier-3 6+/7). Record: `process/waves/wave-14/escalations/board-N-1-milestone-disposition-wave-14.md`.
- **M6 in_progress → BLOCKED** (external hold: founder credential #141 + LLM-spend). Honest; NOT done. Recorded in product-decisions.md + milestones.status.
- **M7 todo → in_progress** (promoted; highest-tier todo, H1, critical-path to send-unblock via sending-domain verification, serves both live bets). Recorded.

### Action 7 — Per-wave decomposition
Active milestone is now M7 (post-promotion). M7 had 2 pre-existing carry-forward seed candidates (bfadcec1 test-fixture debt, d7f716b4 AppShell polish) — both LOW-priority debt, NOT M7's feature vertical. Fired milestone-decomposer (automatic → sub-agent, inline) for M7's first BUILDABLE-WITHOUT-CREDENTIAL feature vertical (BOARD-approved). Returned `decomposition-complete`. Credential guard honored (no DKIM/DMARC generation, no live connection-test, no #141-seamed path). d7f716b4 re-parented as a sibling; bfadcec1 left as unparented debt.

### Action 8 — Slot promotion
M7 promoted (Action 8a). No stockout (todo milestones remain M8–M12).

### Action 9 — Daily-checkpoint: NOT fired (decomposition fired this tick; seed now exists).

### Action 10 — Routing: disposition → BOARD (7/7 APPROVE); decomposition → milestone-decomposer sub-agent (inline, decomposition-complete).

## Founder deferrals surfaced (non-blocking)
- **Email-provider credential #141** — NOW the true M6-completion blocker (its re_surface_trigger fired: M6 buildable scope exhausted). Surfaced loudly.
- **LLM-spend** — still pending (blocks M5 + M6 AI-drafting).

```yaml
n_stage_verdict: COMPLETE
verdict_evidence:
  - "active milestone: a068dc3d (M6) → transitioned to blocked; new active M7 (08d3053a)"
  - "todo queue head: 08d3053a (M7, H1/T3)"
  - "active child tasks (M6): open=0 done=12 seed_candidates=0"
  - "unassigned queue depth: 1"
  - "closure: none (M6 closure WITHHELD — Hallucinated-Milestone-Completion avoided)"
  - "disposition: M6 in_progress→blocked; M7 todo→in_progress (BOARD 7/7 APPROVE, slug N-1-milestone-disposition-wave-14)"
  - "decomposition fired: true (M7 first buildable bundle: seed 82ec8724 + 3 siblings)"
  - "rituals fired: [milestone-decomposition]"
prev_wave: 14
active_milestone_id: 08d3053a-48fb-4562-a25b-6d99d40b0f62
active_milestone_child_summary:
  open: 5     # M7: 4 new bundle tasks + bfadcec1 unparented debt
  done: 0
  seed_candidates: 2   # 82ec8724 (new feature seed) + bfadcec1 (untouched debt)
next_todo_id: 9ed98c3c-8cb8-4736-8337-22dc0dae48d4   # M8 now-highest remaining todo
unassigned_queue_depth: 1
state_transitions_applied:
  - {milestone: M6 (a068dc3d), from: in_progress, to: blocked, recorded_in_decisions_log: true}
  - {milestone: M7 (08d3053a), from: todo, to: in_progress, recorded_in_decisions_log: true}
slot_promotion:
  promoted_id: 08d3053a-48fb-4562-a25b-6d99d40b0f62
  prior_active_id: a068dc3d-8f77-4d01-ba1d-bbc6ed9b16bc
decomposition_fired: true
proposals_fired:
  - {ritual: milestone-decomposition, target_milestone: 08d3053a, reason: decomposition-needed, decision: decomposition-complete, by: milestone-decomposer, fired_at: wave-14 N-1}
ritual_outcomes:
  - {ritual: milestone-decomposition, outcome_summary: "M7 first buildable vertical — seed 82ec8724 (user-mgmt admin) + 3 siblings (workspace/firm-profile, data-source UI, re-parented AppShell polish)", decision: decomposition-complete, by: milestone-decomposer}
loop_state: ready
note: "M6→blocked is honest external-hold (email credential #141 + LLM-spend); mirrors wave-10 M5→blocked. M7 promoted + decomposed buildable-without-credential. BOARD 7/7."
```

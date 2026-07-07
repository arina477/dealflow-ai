# N-1 — Survey & triggers (wave-27)

Head: head-next (spawn-pattern, owns N-block). Mode: automatic.

## Survey signals (Actions 1–4, from DB — canonical)

- **Active milestone (Action 1):** M10 — Advanced compliance & recordkeeping, id `033f97e0-bc25-48dd-bb5a-b2f2be5b056a`, status `in_progress`. Exactly one `in_progress` row (invariant OK).
- **`todo` queue (Action 2):** M11 (Multi-tenant SaaS + billing), M12 (Deal network & predictive). `next_todo_id` irrelevant this tick — active slot is occupied by M10.
- **M10 child summary (Action 3):** open=0, done=5, seed_candidates=0. The 5 done: auth-hardening, WORM-migration-proof standing-AC, RLS connection-split doc, recordkeeping-export endpoint (0d2c5f08), recordkeeping-export page (f331a51c). The last two = the EXPORTS vertical, shipped live @ff29cf4.
- **Unassigned queue depth (Action 4):** 1.

## Triggers (Actions 6–10)

- **Action 6 — closure check:** open=0 satisfied, BUT LLM-judged scope NOT shipped. M10 ## Scope build order = (1) EXPORTS [shipped], (2) RETENTION policy [not built], (3) records VIEW [not built]. Invariant 3 (all-terminal AND scope-shipped) not met on scope-shipped. → **M10 STAYS in_progress. No closure, no transition.** Fall through to Action 7.
- **Action 7 — per-wave decomposition:** active milestone exists + seed_candidates=0 + scope-not-shipped → FIRE milestone-decomposition, reason `decomposition-needed`, target M10, next vertical = RETENTION policy. M10 ## Success metric is SET (LIGHT posture, founder 2026-07-07) — this is NOT the wave-26 `_TBD` incomplete-scope pause. Under automatic mode: spawned `milestone-decomposer` sub-agent inline. Result: **`decomposition-complete`** — bundle seed `d3cc1337` + 3 siblings (b7786c5b, ed4945e0, ce75c6c6). WORM audit-chain immutability + HMAC hash-chain + `audit_log_no_mutate` trigger explicitly preserved in authored prose; retention = window-POLICY config + read-only surfacing, NOT WORM-row deletion (genuine retention-delete over WORM data DEFERRED — founder/compliance).
- **Action 8 — promotion / stockout:** active milestone non-null → no promotion. `todo` queue non-empty (M11, M12) → no stockout cascade.
- **Action 9 — daily-checkpoint:** NOT fired — decomposition fired this tick (Action 9 precondition requires decomposition NOT fired). unassigned_depth=1 is deferred to next P-0 walk.
- **Action 10 — routing:** decomposition routed to `milestone-decomposer` sub-agent per automatic-mode table; completed inline, no BOARD/founder escalation needed.

```yaml
n_stage_verdict: COMPLETE
verdict_evidence:
  - "active milestone: 033f97e0-bc25-48dd-bb5a-b2f2be5b056a (M10, in_progress)"
  - "todo queue head: M11 4636e74e / M12 ede6e8a2 (active slot occupied; no promotion)"
  - "active child tasks: open=0 done=5 seed_candidates=0"
  - "unassigned queue depth: 1"
  - "closure: none (open=0 but scope NOT shipped — retention + view verticals remain)"
  - "promotion: none"
  - "decomposition fired: true (RETENTION vertical; decomposition-complete)"
  - "rituals fired: [milestone-decomposition]"
prev_wave: 27
active_milestone_id: 033f97e0-bc25-48dd-bb5a-b2f2be5b056a
active_milestone_child_summary:
  open: 0
  done: 5
  seed_candidates: 0
next_todo_id: 4636e74e-7a25-4a23-a237-9b7ec13a3bf1
unassigned_queue_depth: 1
state_transitions_applied: []
slot_promotion:
  promoted_id: null
  prior_active_id: 033f97e0-bc25-48dd-bb5a-b2f2be5b056a
decomposition_fired: true
proposals_fired:
  - {ritual: milestone-decomposition, target_milestone: 033f97e0-bc25-48dd-bb5a-b2f2be5b056a, reason: decomposition-needed, decision: fired-inline, by: milestone-decomposer, fired_at: "2026-07-07"}
ritual_outcomes:
  - {ritual: milestone-decomposition, outcome_summary: "decomposition-complete — RETENTION-policy bundle: seed d3cc1337 + 3 siblings; WORM immutability + HMAC chain preserved", decision: applied, by: milestone-decomposer}
loop_state: ready
note: "M10 stays in_progress — EXPORTS vertical shipped live @ff29cf4; on-demand-export metric-half MET; RETENTION vertical decomposed for wave-28; records VIEW = LATER (vertical 3)."
```

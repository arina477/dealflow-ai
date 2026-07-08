# N-1 — Survey & triggers (wave-28)

Mode: automatic. head-next spawned (agentId a711162c2ecfe1367) and ACK'd; concurs on all reconciliation calls.

## Survey signals (Actions 1–4, verified against DB — canonical per rule 15)

- **Action 1 — active milestone:** M10 — Advanced compliance & recordkeeping, id `033f97e0-bc25-48dd-bb5a-b2f2be5b056a`, status `in_progress`. Exactly one `in_progress` row (invariant OK).
- **Action 2 — todo queue:** M11 (Multi-tenant SaaS + billing, `4636e74e-...`) [priority head], M12 (Deal network & predictive models, `ede6e8a2-...`). `next_todo_id = 4636e74e` (but NOT promoted — M10 still active).
- **Action 3 — M10 child summary:** open=0, done=9, seed_candidates=0.
- **Action 4 — unassigned queue depth:** 1 (`b1a0b2ac` — "Tighten /health spec wording"; wave-produced follow-up, `milestone_id` NULL; valid terminal unassigned state).

## Trigger phase (Actions 6–10)

### Action 6 — M10 closure check → NO closure
M10 `## Scope` = 3 LIGHT verticals in build order: (1) recordkeeping EXPORTS — SHIPPED wave-27; (2) RETENTION policy — SHIPPED wave-28; (3) **records VIEW — NOT shipped**. `## Success metric` is SET (light, founder 2026-07-07). open_count=0 BUT LLM-judges scope NOT fully shipped (records-view outstanding). → M10 STAYS `in_progress`. Fall through to Action 7. **No promotion of M11/M12.** (Wave-29's N-block will own the M10→next transition once records-view ships.)

### Action 7 — Per-wave decomposition → FIRED
`seed_candidates=0` AND scope not shipped → fired `milestone-decomposition` (reason `decomposition-needed`, caller `next-bundle`) against M10. Mode automatic → spawned `milestone-decomposer` sub-agent inline (agentId a7223e38e6467ee61). Returned `decomposition-complete`. Metric SET → decomposition succeeded as expected (no `incomplete-scope`, no escalation, no pause).

Bundle authored (records-VIEW, M10's last light vertical):
- seed `d573e7bf-30e8-4eb2-9bba-2b1588f69578` — "Build firm-admin Records view page + deal-activity list read API"
- sibling `6f86b594-569c-43fa-87d2-4294833bf7c9` — "Add shared-Zod records-view / deal-activity list filter contract"
- sibling `770ab1c4-6e22-493c-9184-b63722b24d1b` — "Author deterministic RLS-isolation + RBAC-deny tests for the Records read"

Constraints baked in: READ-ONLY / WORM-preserving (no mutation/delete/purge surface), workspace-RLS-scoped (getDb/FORCE RLS as tenant guard), RBAC compliance/admin, vertical slice (page + read API, reusing shipped GET /compliance/audit-log for the audit half), no new migration (correct clean-read signal). ~1,500–3,000 net LOC, ≤~25 files.

### Action 8 — Slot promotion + stockout → N/A
`active_milestone != null` (M10 still active). No promotion. `todo` queue non-empty (M11, M12) → no stockout cascade.

### Action 9 — Daily-checkpoint → NOT fired
Action 7 DID fire decomposition (seed candidate now exists). Daily-checkpoint precondition ("no seed candidate found AND decomposition not fired") is false. Not fired.

### Action 10 — Routing
Decomposition routed per automatic mode = inline `milestone-decomposer` spawn. Completed. Decision-log appended by the ritual (`cb26c49` — "chore(roadmap): bundle for M10 — 3 tasks").

## M11 anomaly reconciliation (L-1 flag)
M11 (todo) carries 1 open child `2867d087-...` — "Make data-source/settings write-path workspace assignment fail-closed (drop DEFAULT_WORKSPACE_ID fallback)". Investigation: it is a V-1-jenny GAP-2 follow-up, re-homed from M8 (closed done) to M11 by an explicit **wave-17 BOARD decision** (slug `N-1-milestone-disposition-M8-wave-17`, 7/7 APPROVE-A) as a deliberately-parked, BOARD-ratified **BLOCKING M11 prerequisite** (M11 must not introduce any 2nd-workspace provisioning until the repo-wide `workspaceId ?? DEFAULT_WORKSPACE_ID` write-path fail-closed sweep lands). roadmap-lifecycle § "Bug/follow-up tasks (V-2, D-3)" permits follow-ups homed to the relevant milestone (`milestone_id` set, `parent_task_id NULL`, `wave_id NULL`) — distinct from the decomposition-authoring path. The "todo milestone carries zero child tasks" guidance describes the decomposition path, NOT BOARD-ratified pre-parked prerequisites. **Verdict: correctly-homed, NOT an orphan/mis-parent. Leave as-is — no re-home, no cancel, no M11 activation.** It is top-level (`parent_task_id NULL`) so it becomes a valid seed candidate naturally when M11 activates. head-next concurs.

```yaml
n_stage_verdict: COMPLETE
verdict_evidence:
  - "active milestone: 033f97e0-bc25-48dd-bb5a-b2f2be5b056a (M10, in_progress)"
  - "todo queue head: 4636e74e (M11) — NOT promoted (M10 active)"
  - "active child tasks: open=0 done=9 seed_candidates=0"
  - "unassigned queue depth: 1"
  - "closure: none (records-view vertical unshipped; M10 stays in_progress)"
  - "promotion: none"
  - "decomposition fired: true (records-VIEW bundle, decomposition-complete)"
  - "rituals fired: [milestone-decomposition]"
prev_wave: 28
active_milestone_id: 033f97e0-bc25-48dd-bb5a-b2f2be5b056a
active_milestone_child_summary:
  open: 0
  done: 9
  seed_candidates: 0
next_todo_id: 4636e74e-7a25-4a23-a237-9b7ec13a3bf1
unassigned_queue_depth: 1
state_transitions_applied: []
slot_promotion:
  promoted_id: null
  prior_active_id: 033f97e0-bc25-48dd-bb5a-b2f2be5b056a
decomposition_fired: true
proposals_fired:
  - {ritual: milestone-decomposition, target_milestone: 033f97e0-bc25-48dd-bb5a-b2f2be5b056a, reason: decomposition-needed, decision: complete, by: milestone-decomposer, fired_at: "2026-07-08"}
ritual_outcomes:
  - {ritual: milestone-decomposition, outcome_summary: "records-VIEW bundle authored — 3 tasks (seed + 2 siblings); read-only/WORM, RLS-scoped, RBAC compliance-admin, no new migration", decision: complete, by: milestone-decomposer}
m11_anomaly_reconciliation: "leave-as-is — correctly-homed BOARD-ratified (wave-17, 7/7) M11 blocking prerequisite; not an orphan/mis-parent"
loop_state: ready
note: "M10 stays in_progress; records-view is its LAST light vertical. After it ships, M10 closes at wave-29 N-block."
```

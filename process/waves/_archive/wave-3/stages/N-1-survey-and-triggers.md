# N-1 — Survey & triggers (wave 3 close)

## Survey signals (Actions 1–4)

- **Action 1 — active milestone:** M1 (`2c79236a-ffc0-43e2-b406-a5aa56413882` — Foundation: auth, roles, app shell, data model, CI), `status=in_progress`. Invariant OK (exactly 1 `in_progress`).
- **Action 2 — todo queue head:** M2 (`2f116b9b-0338-421d-a9ad-899a11403aff` — Compliance backbone: tamper-evident audit log + rules engine). Read prose: `## Tier T1`, `## Class platform-foundation`, `## Bet source Compliance-first outreach wedge`, `## Required by M6, M10`. Highest tier in the todo queue (M3 is T2). Oldest `created_at`. → `next_todo_id = 2f116b9b…`.
- **Action 3 — M1 child-task summary:** `open=3`, `done=7`, `seed_candidates=0`.
- **Action 4 — unassigned queue depth:** 1.

## Trigger phase (Actions 6–10)

### Action 6 — M1 closure check → CLOSE

M1 `open_count=3` but all 3 open rows are non-core follow-ups (bfadcec1 test-fixture typing; 6fe232e3 auth-hardening rate-limit/input-validation/logout-CSRF; d7f716b4 AppShell placeholder pages for unbuilt nav routes). M1's core `## Scope` (monorepo scaffold, NestJS+Next.js 15, Postgres+Drizzle schema+migration pipeline, SuperTokens invite-only auth, RBAC 4 roles, shared AppShell, auth screens, role-aware dashboard shell, CI real-Postgres) maps 1:1 to the 7 done tasks. M1's `## Success metric` (invited user → set password → sign in → role-aware dashboard shell; CI green on main with real-Postgres test job; Railway dev deploy) is SHIPPED + live-verified in wave-3 (935b847, real-browser E2E 7/7, C-2 APPROVED). None of the 3 follow-ups is required by the success metric — polish/hardening only.

**Judgment: M1 shipped.** Transition applied: `UPDATE milestones SET status='done' WHERE id='2c79236a…'`. Decision-log entry appended to `command-center/product/product-decisions.md`.

**Follow-up disposition:** the 3 open M1 follow-ups re-parented `milestone_id M1 → M2` (retain original `wave_id`; `parent_task_id` stays NULL) so they remain claimable and re-triaged under the now-active compliance milestone. They are candidate seeds for a future wave; they do not gate M2's own scope.

### Action 8 — slot promotion

Active slot empty after Action 6 → promote highest-tier `todo` = M2. `UPDATE milestones SET status='in_progress' WHERE id='2f116b9b…'`. Decision-log entry appended. `active_milestone = M2`. No stockout cascade (11 todo milestones remained; now 10).

### Action 7 (re-evaluated against M2) — per-wave decomposition → FIRED

M2 active, `seed_candidates=0` (the 3 re-parented follow-ups all carry a `wave_id`, so none is a valid top-level seed), M2 `## Scope` not shipped (brand-new milestone, nothing built). → fired milestone-decomposition, reason `decomposition-needed`, caller `next-bundle`. Mode `automatic` → spawned `milestone-decomposer` sub-agent inline. Returned `decomposition-complete`: 1 seed + 3 siblings (audit-log vertical slice). Bundle now exists under M2.

### Action 9 — daily-checkpoint → NOT fired

Decomposition produced a seed this tick → checkpoint precondition (no seed candidate) not met. Not fired.

### Action 10 — routing

`automatic` mode: decomposition spawned as `milestone-decomposer` sub-agent (inline). Roadmap-planning not needed (todo milestones present). Daily-checkpoint not needed.

```yaml
n_stage_verdict: COMPLETE
verdict_evidence:
  - "active milestone (entry): 2c79236a-ffc0-43e2-b406-a5aa56413882 (M1, in_progress)"
  - "todo queue head: 2f116b9b-0338-421d-a9ad-899a11403aff (M2, T1)"
  - "active child tasks: open=3 done=7 seed_candidates=0"
  - "unassigned queue depth: 1"
  - "closure: M1 in_progress→done (scope shipped + success-metric live-verified wave-3 935b847)"
  - "promotion: 2f116b9b (M2) todo→in_progress"
  - "follow-up re-parent: bfadcec1,6fe232e3,d7f716b4 milestone_id M1→M2"
  - "decomposition fired: true (milestone-decomposer, decomposition-complete, 1 seed + 3 siblings)"
prev_wave: 3
active_milestone_id: 2f116b9b-0338-421d-a9ad-899a11403aff
active_milestone_child_summary:
  open: 4          # 3 re-parented follow-ups + 1 fresh seed (siblings not counted as top-level)
  done: 0
  seed_candidates: 1
next_todo_id: b372bbf7-09f3-4eb0-87df-28b5ec52bfc2   # M3, next after M2 promoted
unassigned_queue_depth: 1
state_transitions_applied:
  - {milestone: "M1 (2c79236a)", from: in_progress, to: done, recorded_in_decisions_log: true}
  - {milestone: "M2 (2f116b9b)", from: todo, to: in_progress, recorded_in_decisions_log: true}
slot_promotion:
  promoted_id: 2f116b9b-0338-421d-a9ad-899a11403aff
  prior_active_id: 2c79236a-ffc0-43e2-b406-a5aa56413882
decomposition_fired: true
proposals_fired:
  - {ritual: milestone-decomposition, target_milestone: 2f116b9b-0338-421d-a9ad-899a11403aff, reason: decomposition-needed, decision: fired, by: milestone-decomposer, fired_at: 2026-07-03}
ritual_outcomes:
  - {ritual: milestone-decomposition, outcome_summary: "1 seed + 3 siblings — audit-log vertical slice (table+grant/trigger → HMAC hash-chain service → integrity verifier+endpoint → compliance-settings UI)", decision: decomposition-complete, by: milestone-decomposer}
loop_state: ready
note: "M1 closed on shipped-scope judgment despite 3 open non-core follow-ups; follow-ups re-parented to M2 (not orphaned, not blocking M2 scope). M2 (compliance wedge) promoted + decomposed."
```

## head_signoff

```yaml
head_signoff:
  verdict: APPROVED
  stage: N-1
  reviewers: {}
  failed_checks: []
  rationale: "All survey signals captured; invariant clean (1 in_progress at entry). M1 closure judged against ## Scope + ## Success metric prose + 7 done tasks + live wave-3 verification (935b847, E2E 7/7) — core scope + success metric shipped, the 3 open rows are non-core polish/hardening, so in_progress→done is correct not premature. Follow-ups re-parented to M2 rather than orphaned. M2 promoted as the highest-tier T1 compliance-first wedge (Customer Problem Stack Rank + LNO: Leverage), not the easiest option. Decomposition fired inline via milestone-decomposer, returned a proper vertical slice (audit-log service first, its dependents deferred) — no horizontal-layer bundle, no ghost deps."
  next_action: PROCEED_TO_N-2
```

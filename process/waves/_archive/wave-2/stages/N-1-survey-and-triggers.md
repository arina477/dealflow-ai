# N-1 — Survey & triggers (wave 2)

Head: head-next (spawn-pattern, owns N-block lifetime). Mode: `automatic`.

## Survey signals (Actions 1–4)

- **Action 1 — active milestone:** exactly one `in_progress` → M1 `2c79236a-ffc0-43e2-b406-a5aa56413882` ("Foundation: auth, roles, app shell, data model, CI"). No invariant violation (≤1 active).
- **Action 2 — todo queue head:** 11 `todo` milestones; highest-tier / next in sequence = M2 `2f116b9b-0338-421d-a9ad-899a11403aff` (compliance backbone). Not promoted this wave (M1 not closed).
- **Action 3 — active child-task summary:** open=2, done=4, seed_candidates=2 (both existing open tasks are top-level `todo`, `wave_id NULL`: `bfadcec1` test-fixture typing, `6fe232e3` auth-hardening).
- **Action 4 — unassigned queue depth:** 1.

## Trigger phase (Actions 6–10)

### Action 6 — Closure check → NO CLOSE
M1 stays `in_progress`. Two reasons:
1. `open_count = 2 ≠ 0`.
2. Scope NOT shipped. M1 `## Scope` explicitly lists the shared **AppShell** (sidebar + top bar + base primitives per DESIGN-SYSTEM.md §10) and the **role-aware dashboard shell**; `## Success metric` requires the invited user to "land on a role-aware dashboard shell." Wave 2 shipped only a dashboard *placeholder* (checklist B-3) — the milestone's defining success-metric surface is unbuilt. Full per-route RBAC enforcement is also unshipped (wave 2 shipped a guard *primitive* only).

### Action 7 — Per-wave decomposition → FIRED (judgment override)
Strict Action 7 trigger (`seed_candidates = 0`) did NOT fire (2 candidates exist). Decomposition was fired anyway under the N-2 Action 1 re-ordering allowance + N-1 Action 7 next-scope-slice discretion:

- `bfadcec1` (test-fixture typing) — cosmetic test-code discipline, no production impact. Pure Overhead (LNO). Rejected as a wave seed (Placebo Productivity Trap avoidance).
- `6fe232e3` (auth-hardening: rate-limit / input-validation / anti-CSRF) — valuable robustness follow-up on *already-shipped* auth, but does not advance M1's defining unshipped scope.

Neither candidate closes the M1 success-metric gap (AppShell + role-aware dashboard + per-route RBAC). That gap is the highest-leverage, most vertically-sliceable next slice. Fired `milestone-decomposer` sub-agent inline (automatic mode → Agent tool, single-threaded per ritual). Both follow-ups left untouched in the queue for later waves.

**Decomposition outcome:** `decomposition-complete`. One bundle authored under M1 (`milestone_id=2c79236a…`, `wave_id=NULL`, `status='todo'`):
- SEED `1931b452-c7d5-43a0-9657-7e7cd1728203` — "Build shared AppShell chrome + role-aware dashboard shell"
- SIBLING `2ecc4a7b-2972-4a95-a36b-44e7112dd54b` — "Enforce per-route RBAC across API and web routes"
- SIBLING `2dc00409-7c01-43fc-8fc1-4438330de7fb` — "Make AppShell navigation role-aware for the 4 roles"

Vertical slice confirmed (UI shell + API guard + web route protection + role-gated nav), ~2800 LOC / ~35 files — within rubric. Siblings share one canonical route→allowed-roles mapping (no shown-vs-reachable drift). Decision-log entry appended + committed (`9eeed24`).

### Action 8 — Slot promotion / stockout → N/A
`active_milestone != null` (M1 stays active). No promotion. `todo` queue is deep (11 milestones) → no stockout cascade.

### Action 9 — Daily-checkpoint → NOT FIRED
A seed candidate now exists (decomposition produced the bundle); decomposition fired successfully this tick. Trigger conditions not met.

### Action 10 — Routing
Under `automatic`: decomposition → spawned `milestone-decomposer` sub-agent inline. Applied outcome directly (bundle INSERTed, decision-log recorded). No BOARD/founder escalation needed (routine bundle authoring, `decomposition-complete`).

---

```yaml
n_stage_verdict: COMPLETE
verdict_evidence:
  - "active milestone: 2c79236a-ffc0-43e2-b406-a5aa56413882 (M1, in_progress)"
  - "todo queue head: 2f116b9b-0338-421d-a9ad-899a11403aff (M2)"
  - "active child tasks: open=2 done=4 seed_candidates=2"
  - "unassigned queue depth: 1"
  - "closure: none (M1 scope not shipped — AppShell/dashboard/RBAC unbuilt)"
  - "promotion: none"
  - "decomposition fired: true (judgment override; bundle authored)"
  - "rituals fired: [milestone-decomposition]"
prev_wave: 2
active_milestone_id: 2c79236a-ffc0-43e2-b406-a5aa56413882
active_milestone_child_summary:
  open: 2
  done: 4
  seed_candidates: 2
next_todo_id: 2f116b9b-0338-421d-a9ad-899a11403aff
unassigned_queue_depth: 1
state_transitions_applied: []
slot_promotion:
  promoted_id: null
  prior_active_id: null
decomposition_fired: true
proposals_fired:
  - {ritual: milestone-decomposition, target_milestone: 2c79236a-ffc0-43e2-b406-a5aa56413882, reason: next-bundle-judgment-override, decision: applied, by: milestone-decomposer-subagent, fired_at: 2026-07-03}
ritual_outcomes:
  - {ritual: milestone-decomposition, outcome_summary: "3-task vertical bundle (AppShell+dashboard shell seed + per-route RBAC + role-aware nav siblings); committed 9eeed24", decision: applied, by: milestone-decomposer-subagent}
loop_state: ready
note: "M1 stays in_progress; success-metric gap (AppShell + role-aware dashboard + per-route RBAC) is the next bundle. Two open follow-ups (bfadcec1 test-fixture typing, 6fe232e3 auth-hardening) left in queue for later waves."
```

## head_signoff

```yaml
head_signoff:
  verdict: APPROVED
  stage: N-1
  reviewers: {}
  failed_checks: []
  rationale: >
    All survey signals captured (Actions 1–4). No invariant violation (one in_progress milestone).
    Closure correctly withheld — M1 success-metric scope (AppShell + role-aware dashboard shell +
    per-route RBAC) is demonstrably unshipped, only a placeholder exists. Decomposition fired under
    the N-1 Action 7 / N-2 Action 1 judgment allowance to author the milestone's main-thrust slice
    rather than pick an Overhead cleanup or a robustness follow-up as the seed (Placebo-Productivity
    and Horizontal-Layer anti-patterns both avoided). Bundle verified in DB: vertical slice, correct
    parenting, wave_id NULL, within size rubric. No ghost deps (no open unmerged PRs referenced).
  next_action: PROCEED_TO_N-2
```

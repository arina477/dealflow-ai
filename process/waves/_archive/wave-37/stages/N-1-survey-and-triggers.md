# N-1 — Survey & triggers (wave-37)

Head-next N-block. Mode: automatic. Wave-37 = self-serve firm setup + admin role-grant (shipped, merged 47a5bcd, deployed, E2E-verified live). L-2 APPROVED → PROCEED_TO_N.

## Survey phase (Actions 1–4)

**Action 1 — active milestone:** one `in_progress` row → M7 (Admin & settings, `08d3053a-48fb-4562-a25b-6d99d40b0f62`). No invariant violation (exactly one in_progress).

**Action 2 — todo queue:** M11 (`4636e74e`, multi-tenant SaaS+billing) and M12 (`ede6e8a2`, deal network & predictive models), both `todo`. Both founder-HELD for H3 (post-pilot) per the 2026-07-09 roadmap refresh. `next_todo_id` not consumed this tick — slot is NOT empty (M7 active).

**Action 3 — M7 child-task summary (post-reconcile):** `open_count=4`, `done_count=13`, `seed_candidates=1`.
- Data-integrity reconcile executed FIRST: wave-37 seed `6235baf7` (self-serve firm + grant-admin) was found `status='todo'` / `wave_id=NULL` despite being merged (47a5bcd), deployed, and E2E-verified live, and despite L-2 recording it as the "claimed seed bundle marked done." The L-2 Action-1 UPDATE never landed in the DB (`tasks_marked_done: []`). Reconciled: `UPDATE tasks SET status='done', wave_id='6ab4638c...' WHERE id='6235baf7' AND status='todo'` (RETURNING 1 row). This closes the shipped work L-2 intended to close and removes a stale/ghost seed candidate.

**Action 4 — unassigned queue depth:** 1 (`milestone_id IS NULL`, `status='todo'`). Orthogonal; does not force checkpoint (seed exists).

## Trigger phase (Actions 6–10)

**Action 6 — closure check:** M7 has `open_count=4 > 0` → NOT closed. Independent confirmation of scope-not-shipped: M7 `## Success metric` requires the admin to "verify a sending domain (DKIM/SPF/DMARC) that gates outreach" — the sending-domain verification is still OWED (no done task delivers it). **M7 stays `in_progress`. Not force-closed.**

**Action 7 — per-wave decomposition:** `seed_candidates=1 > 0` → decomposition NOT needed. No `milestone-decomposer` spawn. M7 has genuinely-buildable top-level open work already authored.

**Action 8 — slot promotion + stockout:** `active_milestone != null` (M7 active) → no promotion, no stockout cascade. M11/M12 remain founder-HELD `todo`; not force-promoted.

**Action 9 — daily-checkpoint:** NOT fired. Requires `seed_candidates=0`; we have 1. A buildable seed exists.

**Action 10 — routing:** No ritual proposals fired (no decomposition, no roadmap-planning, no checkpoint). Nothing to route.

## Head-next N-1 stage-exit checklist

- [x] Active milestone (M7) has a clearly-defined unparented seed candidate with documented acceptance criteria (`7f4d150b`, root-cause + fix migrate-on-boot).
- [x] M7 exit criteria cross-referenced vs archived-wave outputs — DKIM/SPF/DMARC domain-verify NOT delivered → milestone transition NOT required (stays in_progress).
- [x] [STABLE] LNO framework applied: migrate-fix = Leverage (unblocks EVERY future migration/deploy; already bit wave-37 + rate_limit_hits) vs the 3 deferred siblings = Neutral/Overhead polish. Seed is the highest-leverage open item.
- [x] No legacy tasks rely on deprecated schemas/APIs (seed fixes the deploy mechanism itself).
- [x] Roadmap phase matches strategic mandate: pilot-hardening ahead of the advisor-firm pilot; M11/M12 correctly held.
- [x] Shared lib/version constraints unchanged (infra fix, no dep bump implied).
- [x] No unresolved ESCALATE-flagged blocks carried in.

```yaml
n_stage_verdict: COMPLETE
verdict_evidence:
  - "active milestone: 08d3053a-48fb-4562-a25b-6d99d40b0f62 (M7, in_progress)"
  - "todo queue head: M11 4636e74e (founder-HELD H3), M12 ede6e8a2 (founder-HELD H3) — not promoted; M7 slot active"
  - "active child tasks: open=4 done=13 seed_candidates=1"
  - "unassigned queue depth: 1"
  - "closure: none (M7 stays in_progress; DKIM/SPF/DMARC domain-verify metric owed)"
  - "promotion: none (M7 active)"
  - "decomposition fired: false (seed_candidates=1)"
  - "reconcile: 6235baf7 todo->done + wave_id=wave-37 (shipped seed L-2 meant to close)"
  - "rituals fired: []"
prev_wave: 37
active_milestone_id: 08d3053a-48fb-4562-a25b-6d99d40b0f62
active_milestone_child_summary:
  open: 4
  done: 13
  seed_candidates: 1
next_todo_id: null            # M11/M12 exist as todo but founder-HELD; not consumed (M7 slot active)
unassigned_queue_depth: 1
state_transitions_applied:
  - {milestone: M7, from: in_progress, to: in_progress, recorded_in_decisions_log: false}   # no transition; stays in_progress
decomposition_fired: false
proposals_fired: []
ritual_outcomes: []
loop_state: ready
note: >
  Data-integrity reconcile: wave-37 shipped seed 6235baf7 was still todo/wave_id-NULL despite being
  merged (47a5bcd) + deployed + E2E-verified live; L-2 recorded it as the closed seed bundle but its
  Action-1 UPDATE never landed. Reconciled to done + wave_id=wave-37. M7 stays in_progress (DKIM/SPF/
  DMARC sending-domain verify metric still owed; 4 open tasks). Clean single seed candidate 7f4d150b
  remains. No decomposition, no promotion, no checkpoint. Automatic mode; buildable seed present.

head_signoff:
  verdict: APPROVED
  stage: N-1
  reviewers: {}
  failed_checks: []
  rationale: >
    Survey signals captured and reconciled against DB ground truth (not the stale FS anchor, which
    still referenced wave-34/36 core-complete state). Caught + fixed a stale/ghost seed: the shipped-and-
    merged wave-37 seed 6235baf7 sat todo/unclaimed, which would have re-seeded already-live work; L-2
    explicitly intended to close it so this is reconciliation of a landed wave, not new scope. M7 correctly
    held in_progress — the DKIM/SPF/DMARC domain-verify metric is genuinely unshipped, so hallucinated-
    milestone-completion is avoided. Exactly one clean top-level seed candidate (7f4d150b) survives; no
    decomposition/promotion/checkpoint warranted. No invariant violations.
  next_action: PROCEED_TO_N-2
```

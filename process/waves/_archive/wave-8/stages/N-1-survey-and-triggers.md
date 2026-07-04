# N-1 — Survey & triggers (wave 8)

## Survey (Actions 1–4)

- **Action 0 — head-next:** spawned as the N-block head (this agent). ACK.
- **Action 1 — active milestone:** `c67b1610-9cc3-4cad-bcfa-1bee0573da72` — M4 "Mandates & buyer universe", `in_progress`. Invariant check: exactly 1 `in_progress` milestone. OK.
- **Action 2 — todo queue head:** `d72b4510` (M5 — AI buyer-seller matching), highest-priority next todo (H1/T2, flagship differentiator). 8 todo milestones total (M5–M12). No stockout.
- **Action 3 — active child-task summary:** `open=3, done=3, seed_candidates=0`. The 3 done = the wave-8 mandate-spine bundle (ba0edebf spine + c070ca23 list + 50227055 detail). The 3 "open" are re-homed M1/M2 backlog carry-overs (bfadcec1 test-fixture typing, 6fe232e3 auth-hardening, d7f716b4 AppShell placeholders) — each already carries a non-null `wave_id` (claimed into prior waves, still `todo`) so NONE is a seed candidate. Seed-candidate count = **0** (verified by the exact query). Real seed stockout under M4.
- **Action 4 — unassigned queue depth:** 1 (b1a0b2ac — /health spec wording; a P-0 walk candidate, not blocking).

## Triggers (Actions 6–10)

- **Action 6 — closure check:** M4 `open_count` is non-zero (3 dangling backlog tasks), but the load-bearing signal is scope. M4 `## Success metric` = "advisor creates a mandate with buyer criteria + compliance profile (DONE) AND an analyst can assemble+enrich a buyer universe for it, ready to rank (NOT built)." The buyer-universe builder is the second half of M4 Scope and is NOT shipped. **M4 scope NOT shipped → do NOT close M4. No `in_progress → done` transition.** This is the correct anti-Hallucinated-Milestone-Completion call: shipped surface is create/list/detail only; the buyer-universe builder module has zero tasks and zero code.
- **Action 7 — per-wave decomposition (FIRED):** `active_milestone` exists AND `seed_candidates=0` AND scope NOT shipped → fired milestone-decomposition, reason `decomposition-needed`, `next-bundle` caller mode. Mode `automatic` → spawned `milestone-decomposer` sub-agent (always inline). Returned `decomposition-complete`: ONE bundle authored under M4 — seed `92a8ff3f` (buyer-universe data spine + assemble-and-filter service) + siblings `394a60ba` (/buyer-universe page) + `c907731f` (enrich contacts / flag gaps / mark ready-to-rank submit-to-matching handoff). Vertical slice DB→service→API→UI; M4/M5 boundary held (NO scoring/ranking/LLM); all additive schema; reuses M3 canonical companies+contacts, M4 mandate_buyer_criteria, M1 RolesGuard, M2 AuditService. ~3,000–4,500 LOC. Validated in DB: 1 seed candidate now, 2 siblings both `parent_task_id=92a8ff3f`, all `todo`/`wave_id NULL`/under M4.
- **Action 8 — slot promotion + stockout:** `active_milestone != null` (M4 NOT closed) → no promotion. `next_todo_id != null` → no stockout cascade. Skipped.
- **Action 9 — daily-checkpoint:** does NOT fire — a seed candidate now exists (Action 7 authored one), so the "no seed candidate" precondition is false.
- **Action 10 — routing:** decomposition routed per `automatic` mode → `milestone-decomposer` sub-agent, inline. Decision-log entry appended + committed (`79242e1`).

## Other N-1 surveys (non-blocking)

- **Roadmap integrity:** clean. 1 in_progress / 3 done / 8 todo / 1 cancelled. Single-active invariant holds.
- **M9 deferred vendor task:** `345dfbc6` (first real DataSourceAdapter — vendor selection + account-issued API key + spend gate) sits under M9 `todo` with parent cleared; founder-blocked, surfaced non-blocking. Not on M4 critical path — no action.
- **No pause/resume markers.** `.loop-paused.yaml` / `.loop-resume.yaml` absent. Loop RUNNING.

## head-next N-1 stage-exit checklist

- [x] Active milestone queue has a clearly-defined unparented seed with acceptance criteria (authored via decomposition: 92a8ff3f + prose ACs).
- [x] Milestone exit criteria cross-referenced against archived-wave outputs — M4 metric second half (buyer-universe) NOT shipped → transition NOT warranted.
- [x] [STABLE] Backlog LNO-prioritized: buyer-universe builder is Leverage (completes M4's user-value metric), not Overhead. Chosen as seed over the 3 backlog Overhead tasks.
- [x] No legacy tasks rely on deprecated schemas/APIs — bundle reuses shipped M3/M4 tables.
- [x] Roadmap phase matches strategic mandate (M4 is the founder-bet current milestone; M5 flagship next).
- [x] Shared library/version constraints consistent (reuse-only bundle; no new dep/SDK).
- [x] No ESCALATE-flagged blocks outstanding (M9 vendor decision surfaced non-blocking; not an ESCALATE).

**head_signoff N-1: APPROVED.** All checkboxes ticked from concrete DB/FS artifacts. No ambiguity, no escalation.

```yaml
n_stage_verdict: COMPLETE
verdict_evidence:
  - "active milestone: c67b1610-9cc3-4cad-bcfa-1bee0573da72 (M4, in_progress — NOT closed)"
  - "todo queue head: d72b4510 (M5)"
  - "active child tasks: open=3 done=3 seed_candidates=0 (pre-decomposition)"
  - "unassigned queue depth: 1"
  - "closure: none (M4 scope not shipped — buyer-universe builder remains)"
  - "promotion: none (M4 stays active)"
  - "decomposition fired: true → seed 92a8ff3f + siblings 394a60ba, c907731f"
  - "rituals fired: [milestone-decomposition]"
prev_wave: 8
active_milestone_id: c67b1610-9cc3-4cad-bcfa-1bee0573da72
active_milestone_child_summary:
  open: 3
  done: 3
  seed_candidates: 0
next_todo_id: d72b4510-0ddb-4cf6-b494-ccbaa64aa633
unassigned_queue_depth: 1
state_transitions_applied: []
slot_promotion:
  promoted_id: null
  prior_active_id: c67b1610-9cc3-4cad-bcfa-1bee0573da72
decomposition_fired: true
proposals_fired:
  - {ritual: milestone-decomposition, target_milestone: c67b1610-9cc3-4cad-bcfa-1bee0573da72, reason: decomposition-needed, decision: decomposition-complete, by: milestone-decomposer, fired_at: 2026-07-04T14:22:00Z}
ritual_outcomes:
  - {ritual: milestone-decomposition, outcome_summary: "1 bundle: seed 92a8ff3f (buyer-universe spine+assemble/filter service) + 2 siblings (394a60ba /buyer-universe page, c907731f enrich/flag-gaps/submit-to-matching); ~3000-4500 LOC; vertical slice; M4/M5 boundary held; additive", decision: applied, by: milestone-decomposer}
loop_state: ready
note: "M4 stays in_progress — buyer-universe builder (M4 metric second half) not shipped. This is the FINAL M4 bundle: with the wave-8 mandate spine + this buyer-universe builder, M4 Scope is fully decomposed. N-1 after wave-9 ships can evaluate M4 for in_progress->done."
```

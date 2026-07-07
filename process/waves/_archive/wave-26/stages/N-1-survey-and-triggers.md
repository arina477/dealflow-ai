# N-1 — Survey & triggers (wave-26)

Mode: automatic. Active milestone: M10 (033f97e0). Survey resolved from the DB (canonical per always-on rule 15), not from the wave-25 handoff anchor.

## Survey signals (Actions 1–4)

- **Action 1 — active milestone:** `SELECT ... WHERE status='in_progress'` → exactly one row: `033f97e0` (M10 — Advanced compliance & recordkeeping, SOX/FINRA artifacts). Invariant 1 holds (≤1 in_progress).
- **Action 2 — todo queue:** M11 (`4636e74e`), M12 (`ede6e8a2`) are `status='todo'`. Both carry `_TBD` success metrics (founder-reserved). `next_todo_id` is only consulted on a promotion, which does not fire this tick (M10 did not close).
- **Action 3 — M10 child summary:** `open_count=0`, `done_count=3`, `seed_candidates=0`. The 3 done tasks are all hardening/debt: auth-hardening (`6fe232e3`), WORM-migration-proof AC (`fd8f2860`), RLS connection-split docs + coupled rollback (`1a1c5855`, this wave).
- **Action 4 — unassigned queue depth:** not the deciding signal this tick (decomposition path fired, then refused — see Action 9).

## Trigger phase (Actions 6–10)

- **Action 6 — closure check:** `open_count=0` is met. LLM-judged scope: M10 `## Scope` names four SOX/FINRA verticals (retention-policy locks, formal attestation/certification report generation, extended recordkeeping exports, regime-review posture). ZERO of the four have an implementing task — all shipped work is hardening/debt. Per Invariant 3 (`done` requires scope-shipped), scope is NOT shipped → **M10 CANNOT close. Stays `in_progress`. No mechanical transition.** This is NOT a BOARD matter: the wave-25 BOARD 7/7 disposition (c) already ruled the recordkeeping decision founder-reserved; re-escalating would re-litigate a settled decision. Fall through to Action 7.
- **Action 7 — decomposition:** `active_milestone` exists AND `seed_candidates=0` AND scope-not-shipped → fire milestone-decomposition (`next-bundle`). Under `automatic` mode, spawned `milestone-decomposer` sub-agent (mandatory in-stage spawn per rule 3; not self-substituted). **Sub-agent returned `incomplete-scope`** — Step 1 validation fails at clause 3 (`## Success metric` = `_TBD by founder`) and Step 2 scope-too-vague guard fires. No DB writes, no bundle, no commit. There is NO legal buildable seed for wave-27 on M10.
- **Action 8 — promotion + stockout:** `active_milestone != null` (M10 did not close) → 8a promotion does NOT apply. M10 remains active. Switching to M11/M12 also hits `_TBD` founder-reserved metrics AND would abandon active M10 mid-milestone — not a mechanical agent decision. No stockout cascade (a `todo` milestone exists; the block is decomposition-scope, not milestone-stockout).
- **Action 9 — daily-checkpoint:** not fired as the resolution path; the decomposition refusal is the binding signal and routes to the enforced founder pause (N-3), which subsumes checkpoint surfacing into the digest.
- **Action 10 — routing:** `automatic`. Decomposition is inline (spawned, refused). The `incomplete-scope` outcome + the founder-reserved recordkeeping decision route to the founder digest via the enforced pause (N-3). This is NOT BOARD-routed — the substantive decisions (concrete regulator-ready success metric + compliance-classification raise) are Rule-17 founder-reserved; the wave-25 BOARD already ratified this path 7/7.

```yaml
n_stage_verdict: DEFERRED
verdict_evidence:
  - "active milestone: 033f97e0 (M10, in_progress)"
  - "todo queue head: 4636e74e (M11) — not promoted (M10 active, did not close)"
  - "active child tasks: open=0 done=3 seed_candidates=0"
  - "closure: none (open=0 but LLM-judged scope NOT shipped — 0/4 Scope verticals implemented; Invariant 3 blocks done)"
  - "promotion: none (M10 remains in_progress)"
  - "decomposition fired: true → milestone-decomposer returned incomplete-scope (_TBD success metric)"
  - "rituals fired: [milestone-decomposition → incomplete-scope]"
prev_wave: 26
active_milestone_id: 033f97e0-bc25-48dd-bb5a-b2f2be5b056a
active_milestone_child_summary:
  open: 0
  done: 3
  seed_candidates: 0
next_todo_id: 4636e74e-7a25-4a23-a237-9b7ec13a3bf1
unassigned_queue_depth: not-deciding
state_transitions_applied:
  - {milestone: M10, from: in_progress, to: in_progress, recorded_in_decisions_log: false}   # no transition
slot_promotion:
  promoted_id: null
  prior_active_id: 033f97e0-bc25-48dd-bb5a-b2f2be5b056a
decomposition_fired: true
proposals_fired:
  - {ritual: milestone-decomposition, target_milestone: 033f97e0-bc25-48dd-bb5a-b2f2be5b056a, reason: no-seed-candidate-scope-not-shipped, decision: incomplete-scope, by: milestone-decomposer, fired_at: "2026-07-07"}
ritual_outcomes:
  - {ritual: milestone-decomposition, outcome_summary: "incomplete-scope — M10 ## Success metric is _TBD by founder; four ## Scope verticals cannot anchor a testable bundle without the founder-reserved compliance-regime decision; no DB writes, no bundle, no commit", decision: incomplete-scope, by: milestone-decomposer}
loop_state: paused
note: "Framework-enforced circuit-breaker (wave-25 BOARD 7/7 disposition c). M10 stays in_progress (scope-unshipped + _TBD metric — no mechanical close/transition). Decomposition REFUSED on _TBD. Loop pauses pending founder M10 recordkeeping direction."
```

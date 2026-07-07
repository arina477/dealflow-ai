# N-1 — Survey & triggers (wave-25 close)

Head: head-next (spawn-pattern, owns N-block). Mode: automatic.

## Survey signals (Actions 1–4, verified against DB)

- **Active milestone (Action 1):** `033f97e0-bc25-48dd-bb5a-b2f2be5b056a` — M10 "Advanced compliance & recordkeeping (SOX/FINRA artifacts)", `in_progress`. Exactly one `in_progress` row (invariant OK).
- **todo queue (Action 2):** M11 "Multi-tenant SaaS platform + billing" (`4636e74e`), M12 "Deal network & predictive models" (`ede6e8a2`). `next_todo_id` not consumed (slot occupied).
- **M10 child summary (Action 3):** open=1, done=2, seed_candidates=1.
  - done: 6fe232e3 (auth-hardening), fd8f2860 (WORM-migration-proof standing AC) — BOTH hardening/debt.
  - todo/seed candidate: 1a1c5855 (RLS connection-split doc + coupled rollback) — ALSO hardening/debt.
- **Unassigned queue depth (Action 4):** 1 (b1a0b2ac /health-spec wording, low-value — carried).
- **Current running wave:** 25 under M10 (waves row, status=running).

## Trigger evaluation (Actions 6–10)

- **Action 6 — closure check:** M10 open_count=1 (not 0) → no closure. Scope NOT shipped (0 recordkeeping verticals built). M10 stays `in_progress`.
- **Action 7 — decomposition:** seed_candidates=1 (≠0) → mechanical decomposition trigger does NOT fire. BUT the sole candidate is a 3rd consecutive hardening/debt task, not a recordkeeping vertical — the wave-26 milestone-integrity TRIPWIRE condition (set by the wave-24 + wave-25 N-blocks). Escalated to BOARD instead of mechanically seeded.
- **Action 8 — promotion/stockout:** active milestone non-null → no promotion; `todo` milestones exist (M11, M12) → no stockout cascade.
- **Action 9 — daily-checkpoint:** Action 7 DID find a seed candidate → daily-checkpoint precondition not met; founder pile-up folded into the digest surfacing below instead.
- **Action 10 — routing (automatic):** strategic milestone disposition → BOARD, slug `N-1-M10-recordkeeping-integrity-wave-25`.

## Ritual outcome — BOARD 7/7 APPROVE disposition (c)

Full record: `process/waves/wave-25/escalations/board-N-1-M10-recordkeeping-integrity-wave-25.md`.

- **Refused** a 3rd consecutive hardening seed as "milestone progress" — the drift is now surfaced, not silent.
- **Did NOT** run roadmap-planning autonomously (cannot finalize `_TBD` metric; compliance-classification raise is rule-17 founder-reserved).
- **Surfaced** the recordkeeping SCOPE + `_TBD` metric + compliance-classification-raise to the founder as a non-blocking product decision (digest below).
- **Seeded** wave-26 = 1a1c5855 as the explicitly-final bounded hardening/debt-closure wave (N-2).
- **Committed** the enforced wave-27 pause (framework-structural: decomposition ritual refuses `_TBD` → `incomplete-scope` → `.loop-paused.yaml` unless the founder has scoped recordkeeping by then).

## head_signoff (N-1)

```yaml
head_signoff:
  verdict: APPROVED
  stage: N-1
  reviewers: { board: "7/7 APPROVE disposition (c); no hard-stop veto" }
  failed_checks: []
  rationale: >
    Tripwire fired correctly. M10's sole seed candidate is a 3rd consecutive hardening/debt task
    on a milestone themed for SOX/FINRA recordkeeping, with ZERO recordkeeping verticals ever
    decomposed and a _TBD success metric. Rather than mechanically seed a 3rd hardening wave
    (silent drift) or idle the loop, the BOARD (7/7) surfaced the founder-reserved recordkeeping
    scope + metric + compliance-raise decision non-blocking, seeded the explicitly-final bounded
    debt-closure task, and committed a framework-enforced wave-27 pause. All survey signals
    captured; no invariant violations; disposition recorded.
  next_action: PROCEED_TO_N-2
```

---

```yaml
n_stage_verdict: COMPLETE
verdict_evidence:
  - "active milestone: 033f97e0-bc25-48dd-bb5a-b2f2be5b056a (M10, in_progress)"
  - "todo queue head: 4636e74e (M11) [slot occupied — not promoted]"
  - "active child tasks: open=1 done=2 seed_candidates=1"
  - "unassigned queue depth: 1"
  - "closure: none (open=1, scope not shipped)"
  - "promotion: none (slot occupied)"
  - "decomposition fired: false (seed_candidates=1; sole candidate is hardening — escalated to BOARD)"
  - "rituals fired: [BOARD N-1-M10-recordkeeping-integrity-wave-25 → 7/7 APPROVE (c)]"
prev_wave: 25
active_milestone_id: 033f97e0-bc25-48dd-bb5a-b2f2be5b056a
active_milestone_child_summary:
  open: 1
  done: 2
  seed_candidates: 1
next_todo_id: 4636e74e-7a25-4a23-a237-9b7ec13a3bf1
unassigned_queue_depth: 1
state_transitions_applied:
  - {milestone: none, from: null, to: null, recorded_in_decisions_log: false}
slot_promotion:
  promoted_id: null
  prior_active_id: 033f97e0-bc25-48dd-bb5a-b2f2be5b056a
decomposition_fired: false
proposals_fired:
  - {ritual: board-milestone-disposition, target_milestone: 033f97e0, reason: recordkeeping-integrity-tripwire, decision: "APPROVE disposition (c) 7/7", by: BOARD, fired_at: "2026-07-07"}
ritual_outcomes:
  - {ritual: board-milestone-disposition, outcome_summary: "surface recordkeeping scope+metric+compliance-raise to founder non-blocking; seed 1a1c5855 as explicitly-final hardening wave; enforced wave-27 pause", decision: APPROVE, by: "BOARD 7/7"}
loop_state: ready
note: >
  Tripwire fired. 3rd-consecutive-hardening seed REFUSED as milestone progress; BOARD-resolved
  disposition (c). M10 recordkeeping decomposition remains blocked on the founder-reserved _TBD
  metric + compliance-classification-raise (surfaced non-blocking to digest). wave-27 will pause
  structurally if unscoped by then.
```

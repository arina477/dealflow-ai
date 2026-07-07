# N-1 — Survey & triggers (wave-24)

head-next spawned + owned the N-block (Action 0). L-1 (APPROVED) + L-2 (COMPLETE) both exited — prerequisite met. Mode: automatic.

## Survey signals (Actions 1–4, verified against Postgres this turn)

- **Action 1 — active milestone:** M10 — Advanced compliance & recordkeeping (SOX/FINRA), id `033f97e0-bc25-48dd-bb5a-b2f2be5b056a`, status `in_progress`. Exactly one `in_progress` row (Invariant 1 OK).
- **Action 2 — todo queue:** M11 `4636e74e` (Multi-tenant SaaS + billing), M12 `ede6e8a2` (Deal network & predictive). `next_todo_id` = M11 (highest-tier todo head). No stockout.
- **Action 3 — M10 child summary:** `open_count=2`, `done_count=1`, `seed_candidates=2`.
  - done: `fd8f2860` (wave-24 seed, WORM/audit-migration populated-DB proof AC — compliance-HARDENING, shipped + CI-enforced, V-block APPROVED).
  - open todo top-level: `6fe232e3` (auth-hardening, created 2026-07-03, OLDEST) + `1a1c5855` (RLS-connection-split doc, created 2026-07-06). Both DEBT/HARDENING.
- **Action 4 — unassigned queue depth:** 1 (`b1a0b2ac`, trivial /health-spec wording — left unassigned).

## Trigger phase (Actions 6–10)

- **Action 6 — closure check:** M10 does NOT close. Invariant 3 fails on both limbs — `open_count=2` (not all children terminal) AND `## Scope` names four unshipped recordkeeping verticals (retention-policy locks, attestation/certification report generation, extended recordkeeping exports, regime-review posture) with `## Success metric = _TBD by founder_`. No `in_progress → done`. No promotion.
- **Action 7 — decomposition:** MECHANICALLY BLOCKED. `seed_candidates=2 (≠0)`; milestone-decomposition ritual Step 1.4 refuses next-bundle when a seed candidate exists. No `milestone-decomposer` spawn.
- **Action 8 — promotion/stockout:** N/A. Active slot occupied (M10 in_progress); no promotion, no stockout cascade.
- **Action 9 — daily-checkpoint:** NOT fired. A claimable seed exists (Action 7 did not run + a top-level todo seed candidate is available), so the checkpoint trigger (null next-claimable) does not hold.
- **Action 10 — routing:** No ritual fired this N-block.

## Milestone-integrity JUDGE (head-next, gated APPROVED)

The recordkeeping-decomposition (authoring M10's real SOX/FINRA recordkeeping verticals) is a roadmap-PLANNING concern (new scope/verticals), NOT milestone-decomposition (mechanically blocked at seed_candidates=2). **Disposition: Option A — mechanical-seed-now, flag-integrity-DUE-next.**

Reasoning: 2 legal buildable candidates keep the loop fed; the recordkeeping flag is aged DUE-within-1-2-waves (raised by wave-23 BOARD + wave-24 ceo-reviewer + head-learn + L-1) — not breached; roadmap-planning is heavyweight (60-90min + founder checkpoint); debt-drift risk is bounded + hard-scheduled (FLAG(a)), not silent.

**TRIPWIRE (binding on next N-block):** wave-25 seeds `6fe232e3`, leaving exactly ONE buildable candidate (`1a1c5855`). At wave-26 N-1, if only debt/hardening candidates remain AND the M10 recordkeeping-decomposition still has not fired, disposition FLIPS to Option B — BOARD-escalate the integrity question + REFUSE to seed a third consecutive hardening wave. Option A is correct once, not a license to defer indefinitely.

## Founder-digest surfacings (rule 17 — carried, non-blocking)

- **FLAG(b): M10 `_TBD_` success-metric founder poll** — batch with carried **M9 `_TBD_` metric poll** (open since wave-18). Both product decisions, both DUE.
- **Founder-gated pile-up:** M5 (LLM-spend), M6/M7 (#141 email-DKIM), M9 (CRM adapter `345dfbc6`, vendor + API key).
- **FLAG(a): M10 recordkeeping-decomposition DUE within 1-2 waves** (roadmap-planning to author real SOX/FINRA verticals).

```yaml
n_stage_verdict: COMPLETE
verdict_evidence:
  - "active milestone: 033f97e0 (M10) in_progress — exactly 1 in_progress (Invariant 1 OK)"
  - "todo queue head: 4636e74e (M11) — no stockout"
  - "active child tasks: open=2 done=1 seed_candidates=2"
  - "unassigned queue depth: 1 (b1a0b2ac trivial — left unassigned)"
  - "closure: none (Invariant 3 fails: open_count=2, scope unshipped, _TBD metric)"
  - "promotion: none (active slot occupied)"
  - "decomposition fired: false (mechanically blocked, seed_candidates=2)"
  - "rituals fired: []"
prev_wave: 24
active_milestone_id: 033f97e0-bc25-48dd-bb5a-b2f2be5b056a
active_milestone_child_summary:
  open: 2
  done: 1
  seed_candidates: 2
next_todo_id: 4636e74e-7a25-4a23-a237-9b7ec13a3bf1
unassigned_queue_depth: 1
state_transitions_applied: []
slot_promotion:
  promoted_id: null
  prior_active_id: 033f97e0-bc25-48dd-bb5a-b2f2be5b056a
decomposition_fired: false
proposals_fired: []
ritual_outcomes: []
loop_state: ready
note: "Milestone-integrity JUDGE: Option A (mechanical-seed-now, flag DUE-next). Tripwire: wave-26 flips to Option B if only debt/hardening candidates remain + recordkeeping-decomposition still unfired. FLAG(a) recordkeeping-decomp DUE + FLAG(b) M10 _TBD metric poll (batch w/ M9) carried to founder digest."
head_signoff:
  verdict: APPROVED
  stage: N-1-survey-and-triggers
  reviewers: {}
  failed_checks: []
  rationale: "M10 cannot close (open_count=2, scope unshipped, _TBD metric) and decomposition is mechanically blocked (seed_candidates=2) — both confirmed. Integrity routing = Option A: 2 legal buildable candidates keep the loop fed; recordkeeping flag aged-DUE-within-1-2-waves not breached; roadmap-planning heavyweight; debt-drift bounded + hard-scheduled via FLAG(a) + wave-26 tripwire (not silent)."
  next_action: PROCEED_TO_N-2
```

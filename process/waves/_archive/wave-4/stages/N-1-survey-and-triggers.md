# N-1 — Survey & triggers (wave 4)

Head-next owns the N-block. Mode: `automatic`. All survey signals read from the DB (Postgres canonical).

## Survey phase (Actions 1–4)

- **Action 1 — active milestone:** exactly one `in_progress` → M2 `2f116b9b-0338-421d-a9ad-899a11403aff` ("Compliance backbone: tamper-evident audit log + rules engine"). No invariant violation (≤1 active).
- **Action 2 — todo queue head:** highest-tier `todo` = M3 `b372bbf7-09f3-4eb0-87df-28b5ec52bfc2` (Deal sourcing). 10 `todo` milestones present — no stockout. `next_todo_id` irrelevant this tick (active slot occupied).
- **Action 3 — M2 child summary:** `open=3 done=4 seed_candidates=0`. Done set = the wave-4 audit-log backbone bundle (ec1f279d table, a8b2b5a2 append service, e6a4cbfe verifier, 031d79fc settings screen). Open set = the 3 re-parented M1 follow-ups (6fe232e3 auth-hardening, bfadcec1 test-fixture, d7f716b4 AppShell-polish) — each carries a `wave_id` from waves 1/2/3, so NONE qualifies as a seed candidate (`wave_id IS NULL` required). Hence `seed_candidates=0`.
- **Action 4 — unassigned queue depth:** 1 (a single unassigned task; drives next-wave P-0 walk + daily-checkpoint eval, not fired this tick — see Action 9).

## Trigger phase (Actions 6–10)

### Action 6 — Active milestone closure check → NO CLOSE
`open_count=3` ≠ 0, so the strict closure precondition (all child tasks terminal) already fails. Independent of that: M2 `## Scope` names TWO deliverables — (1) the tamper-evident audit-log service, SHIPPED this wave; and (2) the **compliance rules engine + callable pre-send compliance check** (tables `suppression_list`, `disclaimer_templates`, `compliance_rules`, `compliance_approvals`), UNSHIPPED. `## Success metric` explicitly requires "suppression/disclaimer/approval rules are configurable and enforced by a callable pre-send check used by outreach (M6)" — no task delivers this yet. LLM judgment: **scope NOT shipped**. M2 stays `in_progress`. Fall through to Action 7.

### Action 7 — Per-wave decomposition trigger → FIRED
Preconditions met: active milestone exists AND `seed_candidates=0` AND scope not shipped. Fired milestone-decomposition (reason `decomposition-needed`, caller mode `next-bundle`) against M2. Under `automatic` mode, routed by spawning the `milestone-decomposer` sub-agent (inline; brain single-threaded). Sub-agent returned `decomposition-complete`.

Authored bundle (independently re-validated in DB by head-next):
- **Seed** `0595a835-db62-4685-b451-1cd6c06416bf` — "Build compliance rules engine schema + non-bypassable pre-send compliance gate service" (4 rules-engine tables + the sole `ComplianceGateService.evaluate()` send-eligibility authority that writes every pass/block verdict to the audit log via the shipped `AuditService.append` a8b2b5a2, in-transaction; non-bypassability a stated acceptance criterion).
- **Sibling** `95adac6c-25cb-4c67-bd78-a401477143ad` — suppression-list re-check + approval-SoD (sender≠approver) inside the gate.
- **Sibling** `034463b1-7abb-4417-8e34-7f6184a0c8db` — per-jurisdiction disclaimer enforcement + approval-version content-hash binding.
- **Sibling** `34cb1d18-9bff-4302-8f7e-c508ac5fef99` — wire compliance-settings screen (031d79fc shell) to CRUD rules/suppression/disclaimers.

Vertical slice (DB → service → config UI), ~3,000–4,000 net LOC, ≤~40 files. Buildable now because it depends on the audit log shipped this wave (the gate writes to it). Compliance-critical + non-bypassable gate → acceptance criteria demand non-bypassability + SoD/RBAC; a security-scope-tightened + SoD/RBAC gate is expected at wave-5 P-4 (gate not built here — decomposer only authored the tasks). The 3 M1 follow-ups were left untouched (backlog; not bundled).

### Action 8 — Slot promotion + stockout cascade → N/A
`active_milestone != null` (M2 unchanged). No promotion. `todo` queue non-empty (10) → no stockout cascade.

### Action 9 — Daily-checkpoint → NOT fired
Decomposition WAS fired this tick and produced a seed candidate, so the "no seed candidate AND decomposition not fired" precondition is false. No checkpoint.

### Action 10 — Routing
`automatic` mode → decomposition spawned `milestone-decomposer` sub-agent (inline, no BOARD needed for routine bundle authoring; the sub-agent exited `decomposition-complete` without escalation). Bundle INSERTed; product-decisions.md appended (committed with the archive at N-3).

## Head-next gate — N-1 stage-exit checklist

- Seed candidate with documented acceptance criteria aligned to business objective (compliance-first wedge) — PASS (bundle authored).
- M2 exit criteria cross-referenced vs archived-wave outputs — PASS (audit-log half shipped; rules-engine half not).
- LNO framing — PASS (rules engine = Leverage: unblocks M6 outreach + closes the compliance wedge; not Overhead UI polish).
- No legacy tasks on deprecated schemas/APIs blocking — PASS.
- Roadmap phase matches strategic mandate (compliance-first override, H1) — PASS.
- Shared library/version constraints consistent (NestJS/Next.js 15, existing) — PASS.
- No unresolved ESCALATE from prior wave — PASS (wave 4 all gates APPROVED).

```yaml
n_stage_verdict: COMPLETE
verdict_evidence:
  - "active milestone: 2f116b9b-0338-421d-a9ad-899a11403aff (M2, in_progress)"
  - "todo queue head: b372bbf7-09f3-4eb0-87df-28b5ec52bfc2 (M3)"
  - "active child tasks: open=3 done=4 seed_candidates=0"
  - "unassigned queue depth: 1"
  - "closure: none (open_count=3; rules-engine + pre-send-gate scope unshipped)"
  - "promotion: none"
  - "decomposition fired: true (milestone-decomposer → decomposition-complete)"
  - "rituals fired: [milestone-decomposition]"
prev_wave: 4
active_milestone_id: 2f116b9b-0338-421d-a9ad-899a11403aff
active_milestone_child_summary:
  open: 3
  done: 4
  seed_candidates: 0
next_todo_id: b372bbf7-09f3-4eb0-87df-28b5ec52bfc2
unassigned_queue_depth: 1
state_transitions_applied: []
slot_promotion:
  promoted_id: null
  prior_active_id: 2f116b9b-0338-421d-a9ad-899a11403aff
decomposition_fired: true
proposals_fired:
  - {ritual: milestone-decomposition, target_milestone: 2f116b9b-0338-421d-a9ad-899a11403aff, reason: decomposition-needed, decision: fired, by: milestone-decomposer, fired_at: 2026-07-03}
ritual_outcomes:
  - {ritual: milestone-decomposition, outcome_summary: "1 seed + 3 siblings authored — compliance rules engine + non-bypassable pre-send gate (vertical DB→service→UI, ~3-4k LOC)", decision: decomposition-complete, by: milestone-decomposer}
loop_state: ready
note: "M2 stays in_progress — audit-log half shipped wave 4; rules-engine + callable pre-send compliance check remain unshipped per ## Scope / ## Success metric."

head_signoff:
  verdict: APPROVED
  stage: N-1
  reviewers: {milestone-decomposer: decomposition-complete}
  failed_checks: []
  rationale: "M2 closure correctly rejected — open_count=3 and the rules-engine/pre-send-gate half of M2 scope is explicitly unshipped (deferred from wave 4 per spec + product-decisions). Decomposition fired (seed_candidates=0, scope not shipped) and produced a clean vertical-slice bundle: rules-engine schema + the single non-bypassable pre-send gate that writes to the shipped audit log, spanning DB→service→config UI. Independently re-validated in DB: seed 0595a835 parent_task_id NULL / wave_id NULL, 3 siblings correctly parented, all todo, under M2; M1 follow-ups untouched. No horizontal bundle, no ghost deps (the gate's audit-log dependency shipped LIVE this wave), no premature closure."
  next_action: PROCEED_TO_N-2
```

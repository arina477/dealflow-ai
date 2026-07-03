# N-1 — Survey & triggers (wave 5 close)

Head: head-next (spawn-pattern, owns N-block for wave 5). Mode: `automatic`.

## Survey phase (Actions 1–4)

- **Action 1 — active milestone:** M2 `2f116b9b-0338-421d-a9ad-899a11403aff` ("Compliance backbone: tamper-evident audit log + rules engine"), `status=in_progress`. Exactly one `in_progress` (invariant OK).
- **Action 2 — todo queue:** 10 milestones M3..M12. Head-of-queue by tier/dependency judgment = M3 `b372bbf7-09f3-4eb0-87df-28b5ec52bfc2` (see Action 8 rationale — M6 is T1 but dependency-blocked).
- **Action 3 — M2 child-task summary:** `open=3, done=8, seed_candidates=0`. The 3 open rows are the re-parented M1 non-core follow-ups (bfadcec1 test-fixture typing, 6fe232e3 auth-hardening, d7f716b4 AppShell-polish), each carrying a wave-1/2/3 `wave_id` — NOT M2-scope. seed_candidates=0 because those rows carry a wave_id.
- **Action 4 — unassigned queue depth:** 1.

## Trigger phase (Actions 6–10)

### Action 6 — closure check (THE key judgment)

M2 `open_count=3` but all 3 open rows are non-M2-scope re-parented M1 follow-ups. M2's own `## Scope` names three components, ALL delivered across the 8 done tasks:
1. Tamper-evident append-only audit-log service (HMAC-SHA256 hash-chain, INSERT-only grant + BEFORE UPDATE/DELETE trigger, content/payload hash distinct) — wave 4: ec1f279d, a8b2b5a2, e6a4cbfe.
2. Compliance rules engine (suppression_list, disclaimer_templates per-jurisdiction, compliance_rules, approval-gating + callable non-bypassable pre-send check) — wave 5: 0595a835, 95adac6c, 034463b1.
3. Compliance-settings screen — 031d79fc, 34cb1d18.

`## Success metric` fully met: audit writes hash-chained + integrity-verifiable w/ tamper detection (UPDATE/DELETE blocked); suppression/disclaimer/approval rules configurable + enforced by a callable pre-send check. Wave 5 LIVE (13e55ef), all gates APPROVED, real-browser 33/33, SoD admin-approver-BLOCKED live-verified. The "used by outreach (M6)" clause is an M6 forward dependency (gate is a callable contract; M6 `## Depends on: M2, M5`), NOT M2 scope.

**Verdict: M2 shipped → closed `in_progress → done`.** Before closing, the 3 M1-follow-ups were re-parented `M2 → M3` so M2's own child set is fully terminal (0 open / 8 done) — closure invariant 3 satisfied honestly. Decision-log entry appended to `command-center/product/product-decisions.md`.

### Action 7 — per-wave decomposition trigger

M3 (newly active) has `seed_candidates=0` and scope NOT shipped (0 done tasks). Fired milestone-decomposition (reason `decomposition-needed`, `next-bundle`) via `Agent(subagent_type=milestone-decomposer)` per Action 10 `automatic` route. Returned `decomposition-complete`: seed ff378a95 + 3 siblings (data-source-connections store + DataSourceAdapter interface → ingestion/ETL SourceSyncJob → dedupe engine w/ provenance → companies-contacts screen). Verified in DB: seed_candidates now = 1.

### Action 8 — slot promotion

`active_milestone` became null after Action 6 close. Promoted M3 `b372bbf7-...` `todo → in_progress` (Action 8a). Rationale: M3 is the front of the deal-flow pipeline (sourcing → mandates M4 → matching M5 → outreach M6) with NO `## Depends on` — the earliest un-blocked milestone. M6 is T1 but dependency-blocked (`## Depends on: M2, M5`; chain M5←M4←M3). With M1+M2 (compliance foundation) shipped, M3 advances the roadmap to the actual deal-flow product. M3 `## Class product-feature` → wave-6 P-0 runs mvp-thinner. No stockout (10 todo milestones remain).

### Action 9 — daily-checkpoint

Not fired: Action 7 DID find/produce a seed candidate (decomposition succeeded), so the first daily-checkpoint condition (no seed candidate) does not hold.

### Action 10 — routing

`automatic` mode: decomposition → milestone-decomposer sub-agent (inline). No BOARD/roadmap-planning needed (todo queue non-empty; decomposition succeeded).

```yaml
n_stage_verdict: COMPLETE
verdict_evidence:
  - "active milestone: 2f116b9b-0338-421d-a9ad-899a11403aff (M2) → closed done"
  - "todo queue head: b372bbf7-09f3-4eb0-87df-28b5ec52bfc2 (M3)"
  - "active child tasks (M2 pre-reparent): open=3 done=8 seed_candidates=0"
  - "unassigned queue depth: 1"
  - "closure: M2 in_progress→done"
  - "promotion: M3 (b372bbf7) todo→in_progress"
  - "decomposition fired: true (M3 first bundle: seed ff378a95 + 3 siblings)"
  - "rituals fired: [milestone-decomposition]"
prev_wave: 5
active_milestone_id: b372bbf7-09f3-4eb0-87df-28b5ec52bfc2
active_milestone_child_summary:
  open: 4          # 3 re-parented M1-followups + 0 (bundle is seed_candidate)  → post-reparent M3 open=4 incl bundle
  done: 0
  seed_candidates: 1
next_todo_id: c67b1610-9cc3-4cad-bcfa-1bee0573da72   # M4 (next after M3 promoted)
unassigned_queue_depth: 1
state_transitions_applied:
  - {milestone: M2 (2f116b9b), from: in_progress, to: done, recorded_in_decisions_log: true}
  - {milestone: M3 (b372bbf7), from: todo, to: in_progress, recorded_in_decisions_log: true}
slot_promotion:
  promoted_id: b372bbf7-09f3-4eb0-87df-28b5ec52bfc2
  prior_active_id: 2f116b9b-0338-421d-a9ad-899a11403aff
decomposition_fired: true
proposals_fired:
  - {ritual: milestone-decomposition, target_milestone: b372bbf7-09f3-4eb0-87df-28b5ec52bfc2, reason: decomposition-needed, decision: complete, by: milestone-decomposer, fired_at: 2026-07-03T23:10:00Z}
ritual_outcomes:
  - {ritual: milestone-decomposition, outcome_summary: "M3 first bundle authored — seed ff378a95 (data-source-connections store + DataSourceAdapter) + 3 siblings (ingestion/ETL, dedupe w/ provenance, companies-contacts screen); ~4-4.8k LOC", decision: decomposition-complete, by: milestone-decomposer}
loop_state: ready
note: "M2 disposition = CLOSE. 3 M1-followups re-parented M2→M3 (retain wave_id, stay claimable backlog). M3 first bundle authored. M3 product-feature → wave-6 P-0 runs mvp-thinner + D-block + likely SDK-research (deal-source providers)."
```

## Exit
All survey signals captured; no invariant violations; closure applied (M2→done); decomposition fired (M3 bundle); promotion applied (M3); daily-checkpoint not triggered; all routed per `automatic`. `n_stage_verdict: COMPLETE`.

---

```yaml
head_signoff:
  verdict: APPROVED
  stage: N-1
  reviewers: {}
  failed_checks: []
  rationale: >
    M2 disposition rests on all three named ## Scope components being delivered + live-verified and the ## Success metric fully met, with the only open children being non-M2-scope re-parented M1 follow-ups; re-parenting them to M3 before close makes M2's own child set fully terminal so closure invariant 3 is honored honestly rather than force-closed. M3 promotion is correct: it is the earliest un-blocked pipeline milestone (M6 is T1 but dependency-blocked on M5←M4←M3). Decomposition produced a coherent DB→service→job→UI vertical (not a horizontal layer), verified in DB (seed_candidates=1). No ghost deps, no stockout, no invariant violation.
  next_action: PROCEED_TO_N-2
```

# N-1 — Survey & triggers (wave 18 → 19)

Survey signals captured from the DB (Postgres, `CLAUDOMAT_DB_URL`), triggers evaluated, decomposition fired.

## Survey (Actions 1–4)

- **Action 1 — active milestone:** `099cee10-562d-4e56-9a57-0dade2914760` — M9 — Integrations & insight (`in_progress`). Exactly one `in_progress` row (invariant holds).
- **Action 2 — todo queue (created_at order):** M10 Advanced compliance/recordkeeping (`033f97e0`), M11 Multi-tenant SaaS+billing (`4636e74e`), M12 Deal network & predictive (`ede6e8a2`). `next_todo_id` not used this tick (active slot occupied).
- **Action 3 — M9 child summary:** `open=2, done=3, seed_candidates=1`. The single seed candidate is `345dfbc6` (founder-gated CRM DataSourceAdapter). Open siblings: `345dfbc6` (todo, unclaimed) + `1d95cac0` (todo, `wave_id=0f32f35c` set — current-wave V-2 process follow-up, not a candidate).
- **Action 4 — unassigned queue depth:** 1.

## Triggers (Actions 6–10)

- **Action 6 — closure check:** M9 `open_count != 0` (2 open) → NOT eligible for closure. Separately, LLM-judged scope NOT shipped: M9 `## Scope` has 5 threads — advanced analytics SHIPPED this wave (3 done tasks), CRM adapters exist only as the founder-gated seed, and multi-channel outreach / seller intent signals / matching feedback loop are unauthored. **M9 STAYS `in_progress`.** Fall through to Action 7.
- **Action 7 — per-wave decomposition:** `seed_candidates=1` but the sole candidate `345dfbc6` is FOUNDER-GATED (deal-source vendor selection + account-issued API key — a founder hard-stop; seeding it deadlocks the wave). No *claimable/buildable* seed exists. LLM judges scope NOT shipped. → **FIRED milestone-decomposition** (`next-bundle` caller, automatic mode → spawned `milestone-decomposer` sub-agent inline per Action 10 table). Founder-credential/spend guard enforced in the brief.
  - **Outcome:** `decomposition-complete`. Chose the **matching feedback loop** thread (learn from accept/reject on the already-live `match_candidates.disposition` + `fit_score` + `score_breakdown` data — RLS/workspace-scoped, mirrors the shipped analytics vertical, buildable now, zero founder credential). Bundle: seed `5568ad44` + 3 siblings (`69387b56`, `e206a56a`, `077974a2`). ~2,400 LOC, ≤60 files. Guard HELD — no task needs a vendor key/spend/SDK/LLM cost. Decision-log committed (`47c10b4`). DB-verified: all 4 rows present, correctly parented, M9/todo/unclaimed.
- **Action 8 — promotion / stockout:** active slot occupied (M9) → no promotion, no stockout cascade.
- **Action 9 — daily-checkpoint:** NOT fired — decomposition produced a seed this tick (Action 9 requires "no seed candidate AND decomposition not fired").
- **Action 10 — routing:** automatic mode → decomposition spawned `milestone-decomposer` inline (routine authoring, no BOARD escalation needed).

## Founder-gated pile-up (surface to digest)

Buildable work continues; these await founder decisions and are NOT blocking the loop:
- **M5** — AI matching (`blocked`, LLM-spend decision).
- **M6** — Compliant outreach (`blocked`, #141 email/ESP).
- **M7** — Admin & settings (`blocked`, #141 sending-domain).
- **M9 CRM DataSourceAdapter** (`345dfbc6`, todo) — deal-source vendor selection + account API key (deferred, not seeded).

```yaml
n_stage_verdict: COMPLETE
verdict_evidence:
  - "active milestone: 099cee10-562d-4e56-9a57-0dade2914760 (M9, in_progress)"
  - "todo queue head: 033f97e0 (M10) — not used, slot occupied"
  - "active child tasks: open=2 done=3 seed_candidates=1 (sole candidate founder-gated)"
  - "unassigned queue depth: 1"
  - "closure: none (M9 stays in_progress — 2 open, scope not shipped)"
  - "promotion: none (slot occupied)"
  - "decomposition fired: true → decomposition-complete (matching feedback loop)"
  - "rituals fired: [milestone-decomposition]"
prev_wave: 18
active_milestone_id: 099cee10-562d-4e56-9a57-0dade2914760
active_milestone_child_summary:
  open: 2
  done: 3
  seed_candidates: 1
next_todo_id: 033f97e0-bc25-48dd-bb5a-b2f2be5b056a
unassigned_queue_depth: 1
state_transitions_applied: []
slot_promotion:
  promoted_id: null
  prior_active_id: 099cee10-562d-4e56-9a57-0dade2914760
decomposition_fired: true
proposals_fired:
  - {ritual: milestone-decomposition, target_milestone: 099cee10-562d-4e56-9a57-0dade2914760, reason: decomposition-needed (sole seed candidate founder-gated), decision: fired-inline, by: milestone-decomposer, fired_at: 2026-07-07T00:51Z}
ritual_outcomes:
  - {ritual: milestone-decomposition, outcome_summary: "decomposition-complete — matching feedback loop bundle (seed 5568ad44 + 3 siblings, ~2400 LOC, founder-credential guard held)", decision: applied, by: milestone-decomposer}
loop_state: ready
note: "M9 stays in_progress. Founder-gated CRM seed 345dfbc6 deliberately NOT seeded (would deadlock). Founder-gated pile-up (M5/M6/M7 + M9 CRM) surfaced to digest."
```

## head_signoff

```yaml
head_signoff:
  verdict: APPROVED
  stage: N-1
  reviewers: {}
  failed_checks: []
  rationale: >
    Milestone queue verified against DB; the sole seed candidate is founder-gated so N-1 correctly
    fired decomposition (LNO Leverage work — feedback-loop insight, not an Overhead UI tweak) rather
    than seeding a deadlock. M9 closure correctly rejected (2 open + scope not shipped). The authored
    bundle is a credential-free vertical slice over already-live match_candidates data — no ghost
    dependency on the gated CRM or any unmerged PR. Founder-credential/spend guard enforced and held.
    Founder-gated pile-up surfaced to the digest; loop continues on buildable work.
  next_action: PROCEED_TO_N-2
```

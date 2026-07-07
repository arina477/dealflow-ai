# N-1 — Survey & triggers (wave 19)

Head: head-next (spawn-pattern, automatic mode). Iron Law honored; DB is canonical.

## Survey signals (verified against Postgres this tick)

- **Action 1 — active milestone:** `099cee10-562d-4e56-9a57-0dade2914760` — M9 "Integrations & insight" (H2/T4, product-feature, `in_progress`). Exactly one `in_progress` row (invariant #1 holds).
- **Action 2 — todo queue (created_at order):** M10 Advanced compliance & recordkeeping (`033f97e0`), M11 Multi-tenant SaaS + billing (`4636e74e`), M12 Deal network & predictive (`ede6e8a2`). `next_todo_id` = M10.
- **Action 3 — M9 child-task summary:** open=2, done=7, seed_candidates=1.
  - The 2 open: `345dfbc6` (real DataSourceAdapter/CRM — FOUNDER-GATED, wave_id NULL → a *technical* seed candidate but deadlock-inducing) and `1d95cac0` (spec/test-fixture process hardening — wave_id=wave-18 set, so NOT a valid seed per the `wave_id IS NULL` rule; a wave-18 V-2 follow-up left open).
  - seed_candidates=1 reflects only `345dfbc6` (the only parent-NULL + wave_id-NULL + todo row). It is founder-gated.
- **Action 4 — unassigned queue depth:** 1.

## Trigger phase

- **Action 6 — closure check:** M9 NOT closed. open_count=2 (invariant #3 requires ALL children terminal). Also ## Scope not fully shipped (analytics + matching-feedback shipped; CRM thread gated; multi-channel-outreach + seller-intent threads unauthored). M9 STAYS `in_progress`. No promotion (slot occupied — legal per lifecycle: an in_progress milestone with open founder-gated work stays in_progress/parked; do NOT close with open tasks).
- **Action 7 — per-wave decomposition:** FIRED (reason `decomposition-needed`). The sole clean seed_candidate `345dfbc6` is FOUNDER-GATED (deal-source vendor selection = spend hard-stop → founder, + account-issued API key). Seeding it would DEADLOCK wave 20 on a founder decision → treated as "no buildable seed" → decomposition fired to author the next credential-free bundle. Route (automatic) → milestone-decomposer inline.
  - **Outcome: `decomposition-complete`.** Authored M9 thread-4 (multi-channel outreach) INTERNAL carve-out — a manual outreach-activity/task tracker (log call/email/LinkedIn touches as internal records; NO external send). Seed `d45c73b5` + 3 siblings (`5c12ac3a` service, `c3776cac` shared-Zod contract, `b2acf4ce` API+UI panel). ~2,500–4,000 LOC, ≤~30 files. Additive-only (rollback = DROP table + DROP enums). Credential-free guard HELD (no vendor key / spend / LLM / SDK / external send / webhook). Audit-logged mutations (M2 HMAC chain). Committed `8c04672` (product-decisions) + `8c04672`-adjacent bundle INSERT.
- **Action 8 — promotion / stockout:** N/A. active_milestone still M9 (not closed). `todo` queue non-empty (M10/M11/M12) — no stockout cascade.
- **Action 9 — daily-checkpoint:** NOT fired. A buildable seed now exists (decomposition produced it); Action 7 did not return incomplete-scope.
- **Action 10 — routing:** decomposition routed inline per automatic mode. No BOARD/founder escalation needed (routine, credential-free).

## Founder-facing surfaced (non-blocking, to digest)

- M9 `## Success metric` reads `_TBD by founder_` — surfaced to `process/session/updates/digest-2026-07-07-M9-metric-and-gated-pileup.md` for a founder poll (product/taste decision, rule 17). Must be set before M9 can close; NOT blocking (M9 not closing this tick).
- Founder-gated pile-up re-surfaced: M5 LLM-spend; M6/M7 #141 email/sending-domain; M9 CRM vendor+API key (`345dfbc6`). Same digest.

```yaml
n_stage_verdict: COMPLETE
verdict_evidence:
  - "active milestone: 099cee10-562d-4e56-9a57-0dade2914760 (M9, in_progress)"
  - "todo queue head: 033f97e0 (M10)"
  - "active child tasks: open=2 done=7 seed_candidates=1"
  - "unassigned queue depth: 1"
  - "closure: none (open_count=2; scope not shipped; M9 stays in_progress)"
  - "promotion: none (slot occupied)"
  - "decomposition fired: true (decomposition-complete — buildable credential-free outreach-activity bundle)"
  - "rituals fired: [milestone-decomposition]"
prev_wave: 19
active_milestone_id: 099cee10-562d-4e56-9a57-0dade2914760
active_milestone_child_summary:
  open: 2
  done: 7
  seed_candidates: 1
next_todo_id: 033f97e0-bc25-48dd-bb5a-b2f2be5b056a
unassigned_queue_depth: 1
state_transitions_applied: []
slot_promotion:
  promoted_id: null
  prior_active_id: 099cee10-562d-4e56-9a57-0dade2914760
decomposition_fired: true
proposals_fired:
  - {ritual: milestone-decomposition, target_milestone: 099cee10-562d-4e56-9a57-0dade2914760, reason: decomposition-needed, decision: decomposition-complete, by: milestone-decomposer, fired_at: "2026-07-07"}
ritual_outcomes:
  - {ritual: milestone-decomposition, outcome_summary: "seed d45c73b5 (outreach_activity table + additive migration) + 3 siblings (service / shared-Zod contract / API+UI panel); credential-free guard HELD; additive-only rollback", decision: decomposition-complete, by: milestone-decomposer}
loop_state: ready
note: "M9 disposition = decompose-M9-more (thread 4 internal outreach-activity, credential-free) — chosen over promote-M10 because a buildable credential-free thread still exists under the active milestone (brief guidance: prefer decompose-M9 IF buildable thread exists). Founder-gated 345dfbc6 (CRM) deliberately NOT seeded (deadlock avoidance). M9 _TBD success metric + gated pile-up surfaced to founder digest (non-blocking)."
```

head_signoff:
  verdict: APPROVED
  stage: N-1
  reviewers: {}
  failed_checks: []
  rationale: "M9 stays in_progress (correct — open_count=2, scope not shipped, no closure). A buildable credential-free thread (internal outreach-activity tracker) remains under the active milestone, so decompose-M9-more is preferred over promoting M10 per lifecycle + brief guidance; the sole gated seed (345dfbc6 CRM) was correctly excluded to avoid a founder-decision deadlock. Decomposition returned a clean vertical bundle. Founder-gated pile-up + the _TBD metric surfaced non-blockingly to the digest. No pause trigger (b/d/e/f) fired."
  next_action: PROCEED_TO_N-2

# N-1 — Survey & triggers (wave-31)

head-next (fresh N-block instance) owns N-1 → N-2 → N-3. Mode: automatic. Action 0 (spawn head-next) is satisfied by this instance.

## Survey phase (Actions 1–4) — DB-grounded

### Action 1 — Active milestone
```sql
SELECT id, title, status FROM milestones WHERE status='in_progress';
```
One row → `active_milestone = M9 (099cee10-562d-4e56-9a57-0dade2914760)` "Integrations & insight". No invariant violation (exactly one in_progress).

### Action 2 — todo queue
```sql
SELECT id, title, status FROM milestones WHERE status='todo' ORDER BY created_at;
```
Two rows: **M11 (4636e74e)** Multi-tenant SaaS + billing (H3/T5), **M12 (ede6e8a2)** Deal network & predictive models (H3/T6). Both `## Success metric = _TBD by founder_`. `next_todo_id` candidate = M11 (higher tier), BUT see Action 8 — both are _TBD-refused.

### Action 3 — M9 open child-task summary
```sql
SELECT count(*) FILTER (WHERE status IN ('todo','in_progress','blocked')) AS open_count,
       count(*) FILTER (WHERE status='done') AS done_count,
       count(*) FILTER (WHERE status='todo' AND wave_id IS NULL AND parent_task_id IS NULL) AS seed_candidates
FROM tasks WHERE milestone_id='099cee10-...';
```
Result: **open_count=0, done_count=19, seed_candidates=0** (0 cancelled; 19 total). Both CRM adapters done: Affinity `345dfbc6` (wave-30), Twenty `1eb63a40` (wave-31), plus 4 credential-free insight verticals (analytics, calibration, outreach-log, seller-intent).

### Action 4 — Unassigned queue depth
```sql
SELECT count(*)::int FROM tasks WHERE status='todo' AND milestone_id IS NULL;
```
Result: **1** — a single tiny doc-polish task `b1a0b2ac` ("Tighten /health spec wording"). Not milestone-scale.

## Trigger phase (Actions 6–10)

### Action 6 — M9 closure check — NOT closed (leave in_progress)
`active_milestone` exists AND `open_count=0`. LLM scope-shipped judgment: **NOT shipped.**
- M9 `## Success metric = _TBD by founder_` — target "advisors sync to their existing CRM and see response/throughput analytics." This REQUIRES a LIVE CRM connection.
- Both adapters (Affinity + Twenty) are built + deployed **DORMANT / key-gated** — no LIVE verify without founder-issued keys (`TWENTY_API_KEY`+`TWENTY_BASE_URL` OR `AFFINITY_API_KEY`). The success target is therefore structurally unverifiable-live AND founder-reserved (`_TBD`).
- M9 `## Scope` also lists founder-credential/spend-gated remainder: external multi-channel send/ESP (#141), matching-model retraining/LLM-spend.
→ **M9 stays `in_progress`.** Do NOT force-close. `open_count=0` falls through to Action 7.

### Action 7 — Per-wave decomposition trigger — CANNOT fire
`active_milestone=M9` AND `seed_candidates=0` AND scope NOT shipped → decomposition would normally fire. BUT M9's remaining unshipped scope is entirely founder-credential/spend-gated (live CRM keys, ESP #141, LLM-spend). There is NO coherent credential-free next bundle to author — the milestone-decomposition ritual has no buildable slice (mirrors M9's own historical block-reason: "buildable scope exhausted at wave-23"). Decomposition **not fired** (no autonomously-buildable slice under M9).

### Action 8 — Slot promotion + stockout cascade — NOT applicable
`active_milestone != null` (M9 still in_progress) → 8a promotion does NOT apply (no empty slot). Even hypothetically: `next_todo_id` M11/M12 both `_TBD` success metric → decomposition ritual Step 1 REFUSES → not promotable into buildable work. 8b stockout does NOT apply (`todo` milestones exist). No roadmap-planning fired.

### Action 9 — Daily-checkpoint — NOT fired
Condition requires "no seed + decomposition not fired + unassigned_queue_depth>0 + no stockout in flight." unassigned_queue_depth=1 (>0) BUT the lone task is a tiny doc-polish, not milestone-advancing; the next-slot question is a STRATEGIC transition (buildable scope exhausted), routed to BOARD (Action 10), not to a daily-checkpoint. Checkpoint not fired — BOARD supersedes.

### Action 10 — Route the next-slot proposal (mode = automatic)
The real proposal this tick: **is there any autonomously-buildable next seed under the active roadmap?** Answer from Actions 6–8: **no** — M9 unshippable-scope is founder-gated; M11/M12 `_TBD`-refused; only a tiny doc task remains. This is a strategic transition at a wave boundary → route to **BOARD** (automatic mode), decision slug `next-milestone-slot-wave-31` (Tier-3-strict 6+/7 bar). Record → `process/waves/wave-31/escalations/board-next-milestone-slot-wave-31.md`.

## Deliverable footer

```yaml
n_stage_verdict: COMPLETE
verdict_evidence:
  - "active milestone: 099cee10 (M9 Integrations & insight, in_progress)"
  - "todo queue head: 4636e74e (M11) / ede6e8a2 (M12) — both _TBD success metric"
  - "active child tasks: open=0 done=19 seed_candidates=0"
  - "unassigned queue depth: 1 (b1a0b2ac /health doc-polish — not milestone-scale)"
  - "closure: none (M9 stays in_progress — _TBD metric + both CRM adapters dormant/key-gated, unverifiable-live)"
  - "promotion: none (M11/M12 both _TBD → decomposition refuses)"
  - "decomposition fired: false (M9 remaining scope founder-credential/spend-gated; no buildable slice)"
  - "rituals fired: [next-slot → BOARD (strategic transition)]"
prev_wave: 31
active_milestone_id: 099cee10-562d-4e56-9a57-0dade2914760
active_milestone_child_summary:
  open: 0
  done: 19
  seed_candidates: 0
next_todo_id: 4636e74e-7a25-4a23-a237-9b7ec13a3bf1   # M11 (candidate; _TBD-refused, not promotable)
unassigned_queue_depth: 1
state_transitions_applied: []                          # M9 NOT closed; no promotion
slot_promotion:
  promoted_id: null
  prior_active_id: 099cee10-562d-4e56-9a57-0dade2914760
decomposition_fired: false
proposals_fired:
  - {ritual: next-milestone-slot, target: roadmap, reason: buildable-scope-exhausted-founder-gated, decision: routed-to-BOARD, by: head-next, mode: automatic}
ritual_outcomes: []      # BOARD tally recorded in N-2/N-3 + escalations record
loop_state: pending-board
note: >
  M9 cannot close (founder-reserved _TBD metric + both CRM adapters dormant/key-gated, no live verify without
  founder keys). No autonomously-buildable next seed anywhere on the roadmap (M9 remaining scope founder-gated;
  M11/M12 _TBD-refused). 3rd consecutive founder-gated scope-exhaustion edge (w29 paused → w30 Affinity →
  w31 Twenty → now). Next-slot routed to BOARD per automatic mode.

head_signoff:
  verdict: APPROVED
  stage: N-1
  reviewers: {}
  failed_checks: []
  rationale: >
    All survey signals captured from the live DB (not the stale state files, which still narrate wave-29/30).
    Closure check correctly leaves M9 in_progress — the Hallucinated-Milestone-Completion anti-pattern is
    avoided: 19 done tasks do NOT equal a shipped milestone when the success metric is founder-reserved _TBD
    and both connectors are dormant/key-gated (unverifiable-live). Decomposition correctly not fired (no
    credential-free slice). No forced promotion of _TBD-refused M11/M12. Next-slot is a genuine strategic
    transition routed to BOARD — not an anticipatory pause.
  next_action: PROCEED_TO_N-2
```

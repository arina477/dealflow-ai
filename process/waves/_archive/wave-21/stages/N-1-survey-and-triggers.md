# N-1 — Survey & triggers (wave-21 close)

Survey of milestone state at wave-21 close, all signals DB-verified (`CLAUDOMAT_DB_URL`, psql).

## Survey signals (Actions 1–4)

- **Action 1 — active milestone:** `099cee10-562d-4e56-9a57-0dade2914760` — M9 (Integrations & insight), `status=in_progress`. Exactly one `in_progress` row (invariant holds).
- **Action 2 — todo queue:** M10 (`033f97e0` — Advanced compliance & recordkeeping), M11 (`4636e74e` — Multi-tenant SaaS + billing), M12 (`ede6e8a2` — Deal network & predictive models), created_at order. `next_todo_id` = M10 (highest-tier todo) — NOT consumed this wave (M9 still active).
- **Action 3 — M9 child-task summary:** `open_count=2, done_count=12, seed_candidates=1`.
  - Open tasks: `345dfbc6` (status=**blocked** — founder-gated CRM DataSourceAdapter: vendor spend + account-issued API key; excluded from seed predicate), `02f4e6a1` (status=**todo**, wave_id NULL, parent_task_id NULL — the seed candidate).
- **Action 4 — unassigned queue depth:** 1.

## Trigger phase (Actions 6–10)

- **Action 6 — closure check:** M9 `open_count=2 ≠ 0` → NOT closure-eligible. M9 stays `in_progress`. No transition. (Scope also not shipped: `## Scope` still has the founder-gated CRM thread (blocked) + the buildable seller-intent thread (unauthored). `## Success metric` still `_TBD by founder`.)
- **Action 7 — per-wave decomposition:** `seed_candidates=1 ≠ 0` → milestone-decomposition does **NOT** fire. The decomposition ritual's Step-1 gate requires seed-candidate count = 0; a claimable seed (`02f4e6a1`) already exists. Firing now would be a contract violation. Seller-intent (M9 `## Scope` remaining buildable thread) becomes the **wave-23** seed: once `02f4e6a1` is claimed at wave-22 B-0 (its `wave_id` set), M9's seed-candidate count reaches 0 and wave-23 N-1 will legitimately fire the decomposer for the credential-free seller-intent vertical.
- **Action 8 — promotion + stockout:** `active_milestone != null` → no promotion. `next_todo_id != null` (M10/M11/M12 exist) → no stockout cascade.
- **Action 9 — daily-checkpoint:** Requires "Action 7 found no seed candidate." A seed candidate exists (`02f4e6a1`) → the AND-condition fails → daily-checkpoint does **NOT** fire.
- **Action 10 — routing:** No rituals fired → nothing to route.

## Gate

head-next (fresh spawn, automatic mode) gated the wave-22 seed disposition: **APPROVED** — seeding the ready test-hygiene fix-forward is the contract-correct call (decomposer forbidden while a seed candidate exists); single-task test-hygiene wave is legitimate (mirrors wave-21 docs wave); no ghost dependency / horizontal-bundle / scope-creep concern. Non-blocking flag: seed description says ~4 assertion sites while L-1 OBS-W21-2 says 8 — reconcile at wave-22 P-2 against the actual file (the seed mandates the whole class regardless).

## Founder-facing surfacings (non-blocking)

- **M9 `## Success metric` = `_TBD by founder`** — carried w18→w21; must be set before M9 can ever close (product/taste poll).
- **Founder-gated pile-up** (buildable work continues; all non-blocking): M5 LLM-spend; M6/M7 email/DKIM credential (product-decision #141); M9 CRM vendor + API key (`345dfbc6`, now blocked).

```yaml
n_stage_verdict: COMPLETE
verdict_evidence:
  - "active milestone: 099cee10-562d-4e56-9a57-0dade2914760 (M9, in_progress)"
  - "todo queue head: 033f97e0 (M10) — not consumed (M9 still active)"
  - "active child tasks: open=2 done=12 seed_candidates=1"
  - "unassigned queue depth: 1"
  - "closure: none (open_count=2)"
  - "promotion: none (active slot occupied)"
  - "decomposition fired: false (seed_candidates=1, not 0)"
  - "rituals fired: []"
prev_wave: 21
active_milestone_id: 099cee10-562d-4e56-9a57-0dade2914760
active_milestone_child_summary:
  open: 2
  done: 12
  seed_candidates: 1
next_todo_id: 033f97e0-bc25-48dd-bb5a-b2f2be5b056a
unassigned_queue_depth: 1
state_transitions_applied: []
slot_promotion:
  promoted_id: null
  prior_active_id: 099cee10-562d-4e56-9a57-0dade2914760
decomposition_fired: false
proposals_fired: []
ritual_outcomes: []
loop_state: ready
note: "M9 stays in_progress. Seed 02f4e6a1 (test-hygiene fix-forward) is the sole claimable seed candidate → decomposer correctly NOT fired; seller-intent is the wave-23 seed. head-next APPROVED the disposition. M9 _TBD metric + founder-gated pile-up surfaced (non-blocking)."
```

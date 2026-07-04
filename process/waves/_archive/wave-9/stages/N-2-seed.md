# N-2 — Seed (wave 9 → wave 10)

**Head:** head-next. **Mode:** automatic.

## Actions

- **Action 1 — pick the seed:** under active milestone M5 (`d72b4510-...`), `parent_task_id IS NULL AND wave_id IS NULL AND status='todo'` → exactly one row: `47ed7ddd-f384-490c-9529-6143dd4701da` — "Build deterministic match spine + rule-based pre-score service" (oldest; the only seed candidate; authored by N-1 Action 7 decomposition).
- **Action 2 — load siblings:** `parent_task_id = 47ed7ddd...` → `fb82d339-27dd-4c5d-9819-9bf72e3baa9b` (/matches-shortlist ranked-list page) + `f74dce45-a644-4ffc-a931-44383fcebe24` (accept/reject/flag shortlist + ready-for-outreach handoff).
- **Action 3 — validate bundle:** all 3 rows confirmed `status='todo'`, `wave_id IS NULL`, `milestone_id=d72b4510` (M5); siblings' `parent_task_id=47ed7ddd`. PASS.
- **Action 5 — claimed_task_ids:** `[47ed7ddd, fb82d339, f74dce45]` (same array B-0 claims + L-2 closes).

## Vertical-slice / anti-pattern checks (head-next gate)
- **Vertical slice, not horizontal:** DB (match_run + match_candidates additive tables) → service (deterministic MatchingService) → API (shared-Zod) → UI (/matches-shortlist page). Tied to ONE advisor workflow (rank → view/explain → accept/reject/flag → shortlist → mark-ready). PASS — not a DB-only or layer-fragmented bundle.
- **No ghost dependency:** reads the SHIPPED wave-9 buyer_universe (merged to main @ 937ae18); reuses M3 companies/contacts + M4 mandate_buyer_criteria + M1 RBAC + M2 AuditService. No unmerged-PR dependency. PASS.
- **No dependency deadlock:** seed (match spine) is read by both siblings; siblings do not require each other out of order; the deterministic score is computed by the seed's service before the page renders it. PASS.
- **Tightly-coupled siblings, same module:** all 3 in the matching-engine module. PASS.
- **M5/M6 + LLM boundary enforced in descriptions:** deterministic-only (no LLM/SDK/BullMQ/spend this bundle); shortlist→outreach is a handoff marker only (no send). PASS.
- **Size:** est 2,800–4,200 net LOC, ≤~50 files, 1 seed + 2 siblings — within a single logical execution session. PASS.

```yaml
n_stage_verdict: COMPLETE
verdict_evidence:
  - "seed task id: 47ed7ddd-f384-490c-9529-6143dd4701da"
  - "bundled siblings: 2"
  - "validation: pass"
seed_task_id: 47ed7ddd-f384-490c-9529-6143dd4701da
seed_task_title: "Build deterministic match spine + rule-based pre-score service"
bundled_sibling_ids:
  - fb82d339-27dd-4c5d-9819-9bf72e3baa9b
  - f74dce45-a644-4ffc-a931-44383fcebe24
claimed_task_ids:
  - 47ed7ddd-f384-490c-9529-6143dd4701da
  - fb82d339-27dd-4c5d-9819-9bf72e3baa9b
  - f74dce45-a644-4ffc-a931-44383fcebe24
active_milestone_id: d72b4510-0ddb-4cf6-b494-ccbaa64aa633
queue_exhausted: false
validation_failed: false
note: "M5 first vertical (deterministic matching). Buildable end-to-end against shipped wave-9 buyer_universe."
```

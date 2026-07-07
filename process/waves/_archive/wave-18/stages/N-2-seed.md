# N-2 — Seed (wave 19 bundle)

## Action 1 — Pick the seed

Two `parent_task_id IS NULL, wave_id IS NULL, status='todo'` candidates under M9:
1. `345dfbc6` (created 2026-07-04) — real DataSourceAdapter / CRM. **FOUNDER-GATED** (deal-source vendor selection + account-issued API key). Seeding it would trigger a founder hard-stop mid-build → wave deadlock.
2. `5568ad44` (created 2026-07-07) — match-calibration feedback aggregation service. Buildable NOW, zero founder credential.

Strict oldest-`created_at` would pick `345dfbc6`. N-2 Action 1 explicitly permits LLM re-ordering when equivalent candidates exist, preferring "whichever the milestone scope needs next." The gated CRM cannot ship autonomously; the feedback-loop seed is the buildable next-insight slice M9 needs. **Selected seed: `5568ad44`** — "Build match-calibration feedback aggregation service (workspace-scoped, RLS)". The gated CRM remains a candidate for a future founder-unblocked wave.

## Action 2 — Load siblings

`WHERE parent_task_id = 5568ad44 AND status='todo' AND wave_id IS NULL`:
- `69387b56` — Add shared-Zod match-feedback contracts to packages/shared
- `e206a56a` — Expose RBAC-scoped match-feedback API endpoint (advisor+admin read)
- `077974a2` — Add score-calibration feedback section to the /insights dashboard

## Action 3 — Validate the bundle (DB-confirmed)

All 4 rows re-queried against DB: `status='todo'`, `wave_id IS NULL`, `milestone_id=099cee10...`, siblings' `parent_task_id=5568ad44`. **Validation PASS.**

Bundle-health checks (head-next gate):
- **Vertical slice:** DB/service (`5568ad44`) + shared Zod contract (`69387b56`) + API (`e206a56a`) + UI (`077974a2`) — spans stack, not a horizontal layer bundle. PASS.
- **No ghost deps:** reads already-live `match_candidates.disposition`/`fit_score`/`score_breakdown` (verified live by decomposer against `apps/api/src/db/schema/matching.ts`); no dependency on gated CRM `345dfbc6` or any unmerged PR. PASS.
- **RLS-honoring / workspace-scoped:** mirrors the shipped analytics vertical. PASS.
- **Coupling:** all four siblings target one feature (match-calibration insight) within one modular component (analytics/insights surface) — no mutually-exclusive workflows. PASS.
- **Sizing:** ~2,400 LOC, ≤60 files, single ~4h session. PASS.
- **Founder-credential guard:** no vendor key / spend / SDK / LLM cost. PASS.

## Action 5 — claimed_task_ids

```yaml
n_stage_verdict: COMPLETE
verdict_evidence:
  - "seed task id: 5568ad44-3702-46d5-809a-40c1de0a2035"
  - "bundled siblings: 3"
  - "validation: pass"
seed_task_id: 5568ad44-3702-46d5-809a-40c1de0a2035
seed_task_title: "Build match-calibration feedback aggregation service (workspace-scoped, RLS)"
bundled_sibling_ids:
  - 69387b56-2366-4343-809d-3a6e75129753
  - e206a56a-b98a-4533-b31e-ba91fae6327e
  - 077974a2-9be9-4a29-a13e-6ac1d7b78e35
claimed_task_ids:
  - 5568ad44-3702-46d5-809a-40c1de0a2035
  - 69387b56-2366-4343-809d-3a6e75129753
  - e206a56a-b98a-4533-b31e-ba91fae6327e
  - 077974a2-9be9-4a29-a13e-6ac1d7b78e35
active_milestone_id: 099cee10-562d-4e56-9a57-0dade2914760
queue_exhausted: false
validation_failed: false
note: "Seed re-ordered off strict oldest-created_at: skipped founder-gated CRM 345dfbc6 (deadlock) for buildable feedback-loop seed 5568ad44 per N-2 Action 1 scope-needs allowance."
```

## head_signoff

```yaml
head_signoff:
  verdict: APPROVED
  stage: N-2
  reviewers: {}
  failed_checks: []
  rationale: >
    Bundle is a complete vertical slice (DB/service + shared contract + API + UI) for one feature,
    no horizontal-layer fragmentation. No ghost dependencies — reads only already-live match_candidates
    data, zero coupling to the gated CRM or any open PR. RLS/workspace-scoped consistent with the shipped
    analytics. Sized to one logical session. Seed deliberately re-ordered off the strict oldest row to
    avoid seeding the founder-gated CRM (deadlock), taking the buildable Leverage slice M9 needs next.
  next_action: PROCEED_TO_N-3
```

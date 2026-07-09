# N-2 — Seed (wave-38)

Mode: automatic. head-next N-2 head_signoff: APPROVED (all 10 exit criteria PASS). Bundle authored by milestone-decomposer (N-1 Action 7), DB-validated by orchestrator.

## Bundle (next wave = wave-39, under M7)

- **Seed** `69cd8ce4-fb06-4b4a-ace9-1d3ffc828707` — "Admin role transfer + self-demote with race-safe last-admin guard" (parent_task_id NULL).
- **Sibling** `3ebd6610-f149-4834-b8bb-0f91b2396da0` — "Full member-management CRUD UI over the shipped role/deactivate services" (parent 69cd8ce4).
- **Sibling** `9e37eeef-33fd-4f2b-bf2d-047f3bc1b3d0` — "Confirm-modal for destructive role changes + surface transfer/demote in admin activity view" (parent 69cd8ce4).

All rows: `status=todo`, `wave_id=NULL`, `milestone_id=08d3053a` (M7). Estimated ~2800 LOC, ≤~40 files.

Validation: exactly 1 seed candidate under M7 (no partial-commit duplicate from decomposer's first-attempt 57014 timeout; clean rollback confirmed via dupe-check — exactly 3 M7 tasks in the insert window). Seed encodes all 7 hard constraints (vertical slice, race-safe last-admin guard with named failing case, enumerated privilege-escalation edges, immutable hash-chained audit per M6, RLS/tenant isolation per M8, static test spec before code, additive-only/rollback). Domain-verification DKIM/SPF/DMARC deliberately excluded (separate M7 slice).

```yaml
n_stage_verdict: COMPLETE
verdict_evidence:
  - "seed task id: 69cd8ce4-fb06-4b4a-ace9-1d3ffc828707"
  - "bundled siblings: 2"
  - "validation: pass"
seed_task_id: 69cd8ce4-fb06-4b4a-ace9-1d3ffc828707
seed_task_title: "Admin role transfer + self-demote with race-safe last-admin guard"
bundled_sibling_ids:
  - 3ebd6610-f149-4834-b8bb-0f91b2396da0
  - 9e37eeef-33fd-4f2b-bf2d-047f3bc1b3d0
claimed_task_ids:
  - 69cd8ce4-fb06-4b4a-ace9-1d3ffc828707
  - 3ebd6610-f149-4834-b8bb-0f91b2396da0
  - 9e37eeef-33fd-4f2b-bf2d-047f3bc1b3d0
active_milestone_id: 08d3053a-48fb-4562-a25b-6d99d40b0f62
queue_exhausted: false
validation_failed: false
note: "head-next N-2 APPROVED; claimed_task_ids emitted for wave-39 B-0 / L-2."
```

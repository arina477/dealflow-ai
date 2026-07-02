# N-2 — Seed (wave 1)

Pick the next bundle under the active milestone M1 (`2c79236a-ffc0-43e2-b406-a5aa56413882`). Mode: **automatic**.

## Actions

- **Action 1 — Pick seed:** `SELECT … WHERE milestone_id=M1 AND status='todo' AND wave_id IS NULL AND parent_task_id IS NULL ORDER BY created_at LIMIT 1` → `e15f71dd-8f61-441c-904a-bdfa108bd6e1` "Integrate SuperTokens auth + user/role data model" (oldest + only candidate).
- **Action 2 — Load siblings:** `WHERE parent_task_id=e15f71dd AND status='todo' AND wave_id IS NULL` → `e1c0e81e` ("Build invite-only auth API: signup, session, reset") + `af6cbc59` ("Wire login, accept-invite, reset-password screens end-to-end").
- **Action 3 — Validate:** all 3 rows confirmed `status='todo'`, `wave_id=NULL`, `milestone_id=2c79236a-…`; seed `parent_task_id=NULL`; both siblings `parent_task_id=e15f71dd-…`. **Validation PASS.**
- **Action 5 — claimed_task_ids:** `[e15f71dd-8f61-441c-904a-bdfa108bd6e1, e1c0e81e-41b8-4b49-9d6c-8b1ed5c33e38, af6cbc59-ffcb-43ca-810d-4860d6e6bf64]`.

## Bundle shape (vertical slice — authentication)

| Role | id | title | layer |
|---|---|---|---|
| seed | `e15f71dd` | Integrate SuperTokens auth + user/role data model | DB / auth-core |
| sibling | `e1c0e81e` | Build invite-only auth API: signup, session, reset | API |
| sibling | `af6cbc59` | Wire login, accept-invite, reset-password screens end-to-end | UI |

Serves one coherent workflow (invite → password → sign-in → landing). No ghost deps (builds only on merged 4cad017 + in-bundle work). Explicit in-description ordering (seed lands schema/SDK first; siblings consume). AppShell + dashboard shell + full per-route RBAC deferred to a follow-up M1 bundle.

```yaml
n_stage_verdict: COMPLETE
verdict_evidence:
  - "seed task id: e15f71dd-8f61-441c-904a-bdfa108bd6e1"
  - "bundled siblings: 2"
  - "validation: pass"
seed_task_id: e15f71dd-8f61-441c-904a-bdfa108bd6e1
seed_task_title: "Integrate SuperTokens auth + user/role data model"
bundled_sibling_ids: [e1c0e81e-41b8-4b49-9d6c-8b1ed5c33e38, af6cbc59-ffcb-43ca-810d-4860d6e6bf64]
claimed_task_ids: [e15f71dd-8f61-441c-904a-bdfa108bd6e1, e1c0e81e-41b8-4b49-9d6c-8b1ed5c33e38, af6cbc59-ffcb-43ca-810d-4860d6e6bf64]
active_milestone_id: 2c79236a-ffc0-43e2-b406-a5aa56413882
queue_exhausted: false
validation_failed: false
head_signoff:
  verdict: APPROVED
  stage: N-2
  reviewers: {}
  failed_checks: []
  rationale: >
    Bundle integrity verified live in DB — all three rows status=todo, wave_id NULL,
    milestone_id=M1; seed parent_task_id NULL; both siblings parent_task_id=seed.
    Genuine vertical slice: SuperTokens+Drizzle schema (DB) → NestJS endpoints (API)
    → Next.js pages + Playwright E2E (UI), all serving one invite→password→sign-in
    workflow. No horizontal bundling, no ghost cross-PR deps (builds only on merged
    4cad017 + in-bundle work), no dependency deadlock — ordering explicit per
    description. Highest-leverage T1 foundation slice per LNO/Customer-Problem-Stack-
    Rank — auth IS M1's success metric. RBAC/SoD seeded (4 roles day-one + guard
    primitive) with full per-route enforcement deferred. Pre-code deterministic test
    specs mandated; additive migration with down-migration + destructive-step
    rollback clause. Sizing (~3,200 LOC / 30–40 files) within the ~4h/context rubric.
  next_action: PROCEED_TO_N-3
note: ""
```

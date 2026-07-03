# N-2 — Seed (wave 2)

Head: head-next. Mode: `automatic`. Active milestone: M1 `2c79236a-ffc0-43e2-b406-a5aa56413882`.

## Action 1 — Seed pick
Seed predicate (`milestone_id=M1 AND status='todo' AND wave_id IS NULL AND parent_task_id IS NULL`) returns exactly ONE row → unambiguous pick. Note: the two previously-open follow-ups (`bfadcec1` test-fixture typing, `6fe232e3` auth-hardening) are correctly EXCLUDED from the seed set because both carry a `wave_id` (waves 1 and 2) — they fail the `wave_id IS NULL` predicate and are not eligible seeds. The N-1 decomposition bundle is the only clean seed.

- **Seed:** `1931b452-c7d5-43a0-9657-7e7cd1728203` — "Build shared AppShell chrome + role-aware dashboard shell"

## Action 2 — Siblings
`WHERE parent_task_id = seed AND status='todo' AND wave_id IS NULL` → 2 siblings:
- `2ecc4a7b-2972-4a95-a36b-44e7112dd54b` — "Enforce per-route RBAC across API and web routes"
- `2dc00409-7c01-43fc-8fc1-4438330de7fb` — "Make AppShell navigation role-aware for the 4 roles"

## Action 3 — Validation → PASS
All 3 rows verified against DB: `status='todo'`, `wave_id IS NULL`, `milestone_id=2c79236a…`; siblings `parent_task_id = seed`. No concurrent-write race. Bundle is a coherent VERTICAL slice (UI shell + API guard + web route protection + role-gated nav) delivering M1's success-metric gap — no horizontal-layer bundling, no mutually-exclusive workflows, no ghost deps on open PRs.

## Action 5 — claimed_task_ids
`[1931b452-c7d5-43a0-9657-7e7cd1728203, 2ecc4a7b-2972-4a95-a36b-44e7112dd54b, 2dc00409-7c01-43fc-8fc1-4438330de7fb]`

---

```yaml
n_stage_verdict: COMPLETE
verdict_evidence:
  - "seed task id: 1931b452-c7d5-43a0-9657-7e7cd1728203"
  - "bundled siblings: 2"
  - "validation: pass"
seed_task_id: 1931b452-c7d5-43a0-9657-7e7cd1728203
seed_task_title: "Build shared AppShell chrome + role-aware dashboard shell"
bundled_sibling_ids: [2ecc4a7b-2972-4a95-a36b-44e7112dd54b, 2dc00409-7c01-43fc-8fc1-4438330de7fb]
claimed_task_ids: [1931b452-c7d5-43a0-9657-7e7cd1728203, 2ecc4a7b-2972-4a95-a36b-44e7112dd54b, 2dc00409-7c01-43fc-8fc1-4438330de7fb]
active_milestone_id: 2c79236a-ffc0-43e2-b406-a5aa56413882
queue_exhausted: false
validation_failed: false
note: "Wave 3 = M1 shell + RBAC vertical. UI wave (AppShell chrome) → D-block likely runs unless P-1 decides mockups exist. bfadcec1/6fe232e3 remain in queue (carry wave_id, not eligible seeds)."
```

## head_signoff

```yaml
head_signoff:
  verdict: APPROVED
  stage: N-2
  reviewers: {}
  failed_checks: []
  rationale: >
    Seed pick unambiguous (single clean seed candidate). Bundle is a complete end-to-end vertical
    slice spanning UI (AppShell + dashboard shell), API (per-route guard), and web route protection
    + role-aware nav — no horizontal layer, no mutually-exclusive workflows, no ghost dependency on
    an open unmerged PR. Bundle size (~2800 LOC / ~35 files) fits a single execution session. RBAC/
    separation-of-duties across the 4 roles is explicit in the sibling scope (compliance requirement).
    Validation PASS on all three rows in the DB. claimed_task_ids populated for B-0 claim + L-2 close.
  next_action: PROCEED_TO_N-3
```

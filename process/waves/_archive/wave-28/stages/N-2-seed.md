# N-2 — Seed (wave-28 → wave-29)

## Bundle pick + validation (verified against DB)

- **Action 1 — seed:** `d573e7bf-30e8-4eb2-9bba-2b1588f69578` — "Build firm-admin Records view page + deal-activity list read API" (oldest top-level todo under M10, `parent_task_id IS NULL`, `wave_id IS NULL`, `status='todo'`).
- **Action 2 — siblings:**
  - `6f86b594-569c-43fa-87d2-4294833bf7c9` — "Add shared-Zod records-view / deal-activity list filter contract"
  - `770ab1c4-6e22-493c-9184-b63722b24d1b` — "Author deterministic RLS-isolation + RBAC-deny tests for the Records read"
- **Action 3 — validation: PASS.** All 3 rows: `status='todo'`, `wave_id IS NULL`, `milestone_id=033f97e0-...` (M10); both siblings `parent_task_id = d573e7bf` (seed). No concurrent-write race.

## Vertical-slice + anti-pattern review (head-next N-2 checklist)
- Vertical slice, NOT horizontal: one end-to-end records-view workflow = page (UI) + deal-activity list read API + shared-Zod filter contract + tests. Reuses shipped `GET /compliance/audit-log` for the audit half. Passes the anti-Horizontal-Layer-Bundling gate.
- Siblings belong to the SAME workflow (filter contract + tests for the same read) — no mutually-exclusive workflows.
- READ-ONLY / WORM-preserving — no mutation/delete/purge surface (a mutation surface would be a REJECT signal). No data-destructive migration → no rollback mechanism required (none exists to guard).
- Workspace-RLS-scoped (getDb/FORCE RLS as tenant guard) + RBAC compliance/admin — matches shipped export + retention verticals.
- Static deterministic test specs authored as a sibling BEFORE code (RLS-isolation read + RBAC-deny) — satisfies the pre-code test-spec requirement; guards against sycophantic test generation.
- No ghost dependencies on unmerged PRs — reuses already-shipped audit-log read + export/retention patterns (all on main).
- Bundle sized for a single logical session (~1,500–3,000 net LOC, ≤~25 files).

```yaml
n_stage_verdict: COMPLETE
verdict_evidence:
  - "seed task id: d573e7bf-30e8-4eb2-9bba-2b1588f69578"
  - "bundled siblings: 2"
  - "validation: pass"
seed_task_id: d573e7bf-30e8-4eb2-9bba-2b1588f69578
seed_task_title: "Build firm-admin Records view page + deal-activity list read API"
bundled_sibling_ids: [6f86b594-569c-43fa-87d2-4294833bf7c9, 770ab1c4-6e22-493c-9184-b63722b24d1b]
claimed_task_ids: [d573e7bf-30e8-4eb2-9bba-2b1588f69578, 6f86b594-569c-43fa-87d2-4294833bf7c9, 770ab1c4-6e22-493c-9184-b63722b24d1b]
active_milestone_id: 033f97e0-bc25-48dd-bb5a-b2f2be5b056a
queue_exhausted: false
validation_failed: false
note: "records-VIEW = M10's LAST light vertical. Read-only/WORM, RLS-scoped, RBAC compliance/admin, no new migration."
```

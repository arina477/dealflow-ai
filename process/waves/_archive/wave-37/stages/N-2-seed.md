# N-2 — Seed (wave-37 → wave-38)

Head-next N-block. Active milestone M7 (`08d3053a`). Seed the next bundle.

## Actions

**Action 1 — pick seed:** query `WHERE milestone_id=M7 AND status='todo' AND wave_id IS NULL AND parent_task_id IS NULL ORDER BY created_at`. Post-reconcile, exactly one row: `7f4d150b` (FIX: prod migrations do not auto-apply on deploy). The older row `6235baf7` was reconciled to `done` at N-1 (shipped seed), so it no longer surfaces — correctly avoiding a re-seed of already-merged work. **Seed = `7f4d150b`.**

**Action 2 — siblings:** `WHERE parent_task_id='7f4d150b' AND status='todo' AND wave_id IS NULL` → 0 rows. Single-task bundle (valid). The 3 deferred M7 backlog tasks (role-transfer `0ef436c3`, member-CRUD `81e06ff3`, onboarding-polish `dd5ff64b`) are children of the now-closed `6235baf7` — NOT siblings of this seed, correctly excluded (no scope-creep-by-association, no horizontal bundling).

**Action 3 — validate:** `7f4d150b` → `status=todo`, `wave_id=NULL`, `milestone_id=08d3053a`, `parent_task_id=NULL`. PASS.

**Action 5 — claimed_task_ids:** `[7f4d150b-409f-4936-a09f-12fe46d5b90c]`.

## Head-next N-2 seed-pick checklist

- [x] [STABLE] Vertical slice: N/A for a pure deploy-mechanism/infra-hardening seed (no UI/API/DB feature layers to fragment). The horizontal-bundling anti-pattern (DB migrations bundled away from UI/API) does not apply — this seed fixes the migration *application* pipeline itself.
- [x] No mutually-exclusive workflows (single task).
- [x] RBAC/SoD separation: N/A — no auth/permissions surface touched. No security-auditor gate required.
- [x] Bundle size fits the executor context window (single focused fix).
- [x] Tightly-coupled component: migrate-on-boot mechanism in `apps/api` (main.ts + drizzle-kit migrate journal + MIGRATE_DATABASE_URL wiring) — one component, no API/worker jumps.
- [x] [STABLE] Customer Problem Stack Rank: highest-ranked open M7 problem — a pilot-BLOCKER (every future migration silently won't deploy; already bit wave-37's 0021 + rate_limit_hits). Ranked above the 3 deferred polish siblings. Not the easiest-implementation pick.
- [x] No ghost dependencies on open/unmerged PRs — 0021 is already merged (47a5bcd); this fixes the deploy MECHANISM, not the migration content.
- [x] Seed requires root-cause the migrate-on-boot before fixing (Iron Law; test spec: confirm a fresh migration auto-applies on deploy without manual intervention).
- [x] Rollback/fallback for data-destructive ORM op: N/A — seed authors no destructive migration; it repairs migration APPLICATION (make the drift-detection + journal-apply reliable). B-0 will still gate any new migration additively.
- [x] [STABLE] Sized to build + verify + merge in a single ~4h session.

```yaml
n_stage_verdict: COMPLETE
verdict_evidence:
  - "seed task id: 7f4d150b-409f-4936-a09f-12fe46d5b90c"
  - "bundled siblings: 0"
  - "validation: pass"
seed_task_id: 7f4d150b-409f-4936-a09f-12fe46d5b90c
seed_task_title: "FIX: prod migrations do not auto-apply on deploy (0021 + rate_limit_hits un-applied)"
bundled_sibling_ids: []
claimed_task_ids: [7f4d150b-409f-4936-a09f-12fe46d5b90c]
active_milestone_id: 08d3053a-48fb-4562-a25b-6d99d40b0f62
queue_exhausted: false
validation_failed: false
note: >
  Oldest-first strict pick would have been the shipped 6235baf7; N-1 reconciled that to done (it merged +
  deployed + verified live), leaving 7f4d150b as the sole clean candidate — the correct pick on both
  oldest-of-remaining and Customer-Problem-Stack-Rank. Single-task bundle. Deferred M7 siblings stay
  backlog, not bundled.

head_signoff:
  verdict: APPROVED
  stage: N-2
  reviewers: {}
  failed_checks: []
  rationale: >
    Clean single-task seed pick. The seed is the highest-leverage buildable M7 item — a pilot-blocking
    deploy-pipeline fault that already silently dropped two migrations (0021, rate_limit_hits) and puts
    every future migration at risk. Root-cause-first per Iron Law. No ghost deps (0021 merged), no
    horizontal bundle, no scope-creep from the deferred siblings, no RBAC/destructive-migration surface.
    Validation passed against live DB.
  next_action: PROCEED_TO_N-3
```

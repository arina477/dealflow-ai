# Wave 39 — B-block review artifacts

**Block:** B (Build)
**Wave topic:** Admin role transfer + self-demote (race-safe last-admin guard) + destructive-change confirm modal + activity-view surfacing
**Block exit gate:** B-6
**Status:** gate-passed

```yaml
build_block_status:    complete
branch:                wave-39-admin-role-transfer
stages_run:            [B-0, B-1, B-2, B-3, B-4, B-5, B-6]
stages_skipped:        [D-block (design_gap_flag=false), B-0-schema (no migration)]
review_verdict:        APPROVE
deviations_logged:     [activity-labels-cant-distinguish-transfer-vs-promote (accepted, security read-projection)]
last_commit_sha:       4e2da55
ready_for_ci:          true
```

## Stage deliverables

| Stage | Deliverable file | Status | Notes |
|---|---|---|---|
| B-0 | process/waves/wave-39/stages/B-0-branch-and-schema.md | done | branch created; no schema/env/deps; tasks claimed |
| B-1 | process/waves/wave-39/stages/B-1-contracts.md | done | transferAdminRequestSchema; commit 16c086a |
| B-2 | process/waves/wave-39/stages/B-2-backend.md | done | transferAdminAsActor + endpoint; 15 tests; commit 4c2052c |
| B-3 | process/waves/wave-39/stages/B-3-frontend.md | done | ConfirmDialog+transfer UI+activity; 3880cb0/eb279d4/811d680/daa9f69 |
| B-4 | process/waves/wave-39/stages/B-4-wiring.md | done | repo typecheck 4/4 clean |
| B-5 | process/waves/wave-39/stages/B-5-verify.md | done | api 1092 / web 1041 pass; lint 0 err |
| B-6 | process/waves/wave-39/stages/B-6-review.md | done | head-builder APPROVED + /review ship-as-is; F2/F4 fixed (4e2da55) |

## Block-specific context

- **Spec contract:** task 69cd8ce4 (DB); spec at process/waves/wave-39/stages/P-2-spec.md
- **Branch name:** wave-39-admin-role-transfer
- **claimed_task_ids:** [69cd8ce4, 9e37eeef]
- **New deps added this wave:** none
- **New env vars added this wave:** none
- **Schema changes this wave:** none (reuses users.role_id/roles, users.deactivated_at, immutable audit; no migration)
- **B-1 fast-path approved:** false (B-1 has a real contract change — transferAdminRequestSchema)
- **Files implemented (cumulative):** (updated at B-2, B-3, B-4)
- **Deviations from plan logged this block:** none yet

## B-block acceptance conditions carried from P-4 (MUST be built + tested)
1. **[High]** `transferAdminAsActor` independently rejects a DEACTIVATED target (404) BEFORE promote — not via runLastAdminGuard (guard counts only active admins on the demote side). Dedicated test.
2. **[Med]** Atomicity: guard-trip AND two-audit-last-in-txn roll back together on audit failure (single transaction).
3. **[Low]** `POST /admin/users/:id/transfer-admin` uses `@Roles(...ADMIN_USERS_ROLES)` (matrix-sourced) + registers pattern in roleRoutes (rbac.ts); identical guard/Zod/audit as reused path.
4. **[Low]** Edit the real `/admin/activity` ActivityTable (GET /admin/activity-data), not a duplicate.

## Open escalations carried into gate

none

## Gate verdict log

<appended by fresh head-builder spawn at B-6 Action 1>

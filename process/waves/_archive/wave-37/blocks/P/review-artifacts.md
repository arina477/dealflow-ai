# Wave 37 — P-block review artifacts
**Block:** P (Product) | **Wave topic:** Self-serve firm setup + admin role-grant in the UI (create workspace + name firm + first admin; admin promotes teammates to admin). Founder directive; pilot onboarding. | **Block exit gate:** P-4
| Stage | Deliverable | Status |
|---|---|---|
| P-0 | done |
| P-1 | done |
| P-2 | done |
| P-3 | done |
## Block-specific context
- **claimed_task_ids:** [6235baf7]
- **Milestone:** M7 (Admin & settings, in_progress).
- **Founder directive (2026-07-09):** (1) self-serve UI: create firm workspace + set firm name + become FIRST ADMIN (no manual provisioning); invited users JOIN via the existing invite+signup flow. (2) arina@claudomat.dev = admin (already provisioned). (3) admin role-management UI: grant admin to another user (promote/transfer/share).
- **SECURITY (compliance-first M&A):** workspace-create MUST preserve RLS workspace isolation (M8 — cross-firm read = 0 rows); role-grant = privilege-escalation surface → admin-ONLY + audited (tamper-evident log) + cannot orphan/demote the last admin.
- **Scope boundary:** this is the self-serve-onboarding + role-mgmt SLICE. M11-held scope (billing, strict Chinese-Wall hardening beyond M8 RLS) stays OUT. design_gap_flag likely TRUE (new onboarding UI + members/roles UI) → D-block.
- Autonomous mode: automatic.
## Gate verdict log
<appended at P-4>

## P-4 Phase 1: head-product APPROVED (thinned + reuse-not-rebuild + self-serve-create-atomic+RLS-safe + grant-admin-via-existing + no-invite-regression + M11-out + D-block).
## P-4 Phase 2: karen APPROVE (5/5 VERIFIED — role-change endpoint admin-users.controller.ts:122, assignRoleAsActor user-management.service.ts:255 [audit :317, runLastAdminGuard 409 :503], members UI AdminUsersClient.tsx, M8 RLS 0014 [FORCE 28 tables deny-by-default], signup-requires-invite auth.service.ts:120 — thin scope HONEST, wave = 1 new signup path + 2 UIs; web→api role route is /admin/users-data/:id/role via a Next rewrite) + jenny APPROVE (5 MATCHES 0 DRIFT — all 3 asks covered, transfer/share=later deferrable, M11-held consistent) + security-auditor APPROVE.
## MERGED P-4 VERDICT: APPROVED. → D-block (design_gap TRUE) then B.
## BINDING B-block SECURITY INVARIANTS (security-auditor + jenny):
1. **RLS-safe ATOMIC first-user bootstrap:** the new workspace_id is SERVER-MINTED (gen_random_uuid) — NEVER client-supplied; firmName is DATA not identity. All-or-nothing (STuser + workspace + admin users-row + session) with compensate-delete-Core-user on any DB failure (mirror the existing signup atomicity). The SECURITY-DEFINER bootstrap writes ONLY into the just-minted workspace (cannot be steered into another firm). Mirror resolve_invite / runInTransactionWithWorkspace.
2. **grant-admin via the EXISTING assignRoleAsActor ONLY** (no new/bypass path): admin-only (403 non-admin via RolesGuard), own-workspace-scoped (cross-firm target → RLS-filtered 404), WORM-audited last-in-txn, runLastAdminGuard no-orphan-last-admin (409).
3. **M8 RLS holds for the new workspace + ZERO regression:** cross-firm read = 0 rows (fail-closed GUC); no change to the invite+signup JOIN flow, the role-change backend, M6 SoD, or M8 policies. Every write in the new path stamps workspace_id server-side from the session/new-id (never client). [jenny note: this is the repo's 2ND INSERT INTO workspaces — write-path hardening beyond this stays M11-held/task 2867d087; read-isolation IS delivered here.]
4. **Non-blocking hardening:** apply rate-limit middleware to the self-serve-create endpoint (unbounded workspace-creation vector; note the rate_limit_hits prod gap).
**Status:** gate-passed

# Wave 37 — P-0 Frame
## Discover
- wave 37, M7 (Admin & settings, in_progress, product-feature). Task 6235baf7-a1d5-4949-854a-5541dd3de3c3 (self-serve firm setup + admin role-grant).
- Prior work (problem-framer verified): role-change endpoint PATCH /admin/users/:id/role EXISTS (wave-15) via assignRoleAsActor (AUDITED) + own-workspace-scoped + runLastAdminGuard (no-orphan-last-admin, 409); member role-assign shipped (task 82ec8724); workspace-settings-edit shipped (648a86a6); M8 RLS FORCE deny-by-default across 28 tenant tables. → most of the directive already exists.
## Reframe
### problem-framer — PROCEED
Real gap = the UI FLOW + the ONE missing backend path: auth.service.signup currently HARD-REQUIRES inviteToken → NO self-serve workspace-creating signup exists. Genuinely-new = (a) a non-invite signup that CREATES a workspace + assigns the signer as first-admin (atomic: workspace_id + users row + admin role; pre-membership bootstrap via the resolve_user_workspace SECURITY-DEFINER pattern); (b) the create-firm onboarding UI; (c) the grant-admin UI control (on the EXISTING role-change endpoint via assignRoleAsActor — NOT a bypass). Reuse all existing auth/RLS/audit machinery. LOAD-BEARING: reuse-existing-auth; RLS-isolation-on-workspace-create (M8 holds); role-grant privilege-escalation controls (admin-only + audited + no-orphan-last-admin — ALL exist, wire don't rebuild); M11-billing OUT. design_gap TRUE → D-block (reuse v9 admin-users.html / admin-workspace-settings.html).
### ceo-reviewer — PROCEED (HOLD-SCOPE)
Right slice for pilot (traces to integrated-platform bet); M11 (billing + strict Chinese-Wall isolation-hardening) stays HELD at H3 — this wave rides the existing M8 RLS baseline, must NOT become the multi-tenant milestone. ~7/10.
### mvp-thinner — THIN (accepted)
mvp core: self-serve workspace-create + first-admin; RLS-isolation on create; grant-admin control; last-admin no-orphan guard; arina-admin confirm. SPLIT to siblings (created under 6235baf7-a1d5-4949-854a-5541dd3de3c3): (1) admin transfer/demote-self + role-sharing; (2) full member-CRUD UI; (3) onboarding polish (wizard/logo/branding).
### Disposition: PROCEED (thinned). Final framing → P-1/P-2/P-3:
1. **Backend:** a self-serve signup path that CREATES a workspace + firm name + assigns the signer as FIRST ADMIN (atomic, RLS-safe bootstrap). Reuse the SuperTokens signup + the users/workspaces/roles model; do NOT touch the invite+signup(join) path (works).
2. **Backend:** wire the grant-admin action to the EXISTING PATCH /admin/users/:id/role (assignRoleAsActor — audited + own-workspace + last-admin-guard). No new role-change logic.
3. **Frontend (D-block):** (a) a minimal create-firm onboarding screen (firm name → create → land in the app as admin); (b) a grant-admin control in the members/admin settings UI.
4. arina@claudomat.dev = admin — already provisioned; confirm the flow supports her (no-op).
## SECURITY load-bearing: workspace-create preserves M8 RLS (cross-firm read = 0 rows); role-grant admin-only + audited + no-orphan-last-admin (reuse assignRoleAsActor + runLastAdminGuard). M11 billing/isolation-hardening OUT.
## design_gap_flag: TRUE → D-block.
claimed_task_ids: [6235baf7-a1d5-4949-854a-5541dd3de3c3]

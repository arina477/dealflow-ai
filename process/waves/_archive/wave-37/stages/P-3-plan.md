# Wave 37 — P-3 Plan (self-serve firm setup + admin role-grant)
## Approach — reuse existing auth/RLS/audit; build only the new self-serve-create path + 2 UIs
### Action 1 — Deliverables
**Backend:**
1. **Self-serve workspace-creating signup** — a NEW path (do NOT alter the invite+signup JOIN flow). Options for the specialist to pick (P-4/B decides): (a) a new endpoint POST /auth/signup-firm {firmName, email, password}, or (b) extend signup to accept a firm-create branch. It must ATOMICALLY: create the SuperTokens user (EmailPassword.signUp) + create a workspace (name=firmName) + INSERT the users row (supertokens_user_id, email, role_id=admin, workspace_id=new) + mint the session with the admin role claim. The pre-membership bootstrap (no workspace context yet for a brand-new user) uses the SECURITY-DEFINER pattern (mirror resolve_user_workspace / the invite bootstrap) so the RLS-scoped INSERT succeeds for the first user of a new workspace. Compensate (delete the Core user) on failure — mirror the existing signup atomicity.
2. **Grant-admin** — REUSE the existing PATCH /admin/users/:id/role (assignRoleAsActor: admin-only + own-workspace-scoped + AUDITED in the tamper-evident log + runLastAdminGuard no-orphan-last-admin/409). NO new role-change logic. The frontend calls it with role='admin'.
**Frontend (after D-block designs):**
3. **Create-firm onboarding screen** — a new user with no workspace lands here: firm name field → submit → calls the self-serve-create path → lands in the app as admin. (Distinct from the login page; a "create your firm" entry.)
4. **Grant-admin control** — in the members/admin settings UI (which already lists members + assigns roles per task 82ec8724), ensure an admin can promote a member to 'admin' (the role-select includes admin; the last-admin guard's 409 is surfaced as a friendly message).
### Action 2 — Data model: NONE new (workspaces/users/roles exist). No migration (the self-serve-create INSERTs into existing tables via the bootstrap). Confirm no schema change.
### Action 3 — API: 1 new endpoint (self-serve firm signup) OR a signup branch; the role-change endpoint is REUSED.
### Action 4 — Deps: none new (SuperTokens + existing model).
## Plan (by stage)
**D-block:** D-1 brief + D-2 variants + D-3 adopt for (a) create-firm onboarding screen, (b) grant-admin control (reuse v9 admin-users.html / the existing members UI + design tokens). **B-0:** schema SKIP. **B-1/B-2 (backend-developer):** the self-serve-create signup path (atomic + RLS-safe bootstrap + session mint) + confirm grant-admin wires to assignRoleAsActor. **B-3 (frontend):** the create-firm screen + grant-admin control per the adopted designs. **B-6:** head-builder polices reuse-existing-auth + RLS-isolation + role-grant-controls-reused + no-invite-flow-regression.
### Action 6 — Specialists: backend-developer + frontend-developer. Action 8 — Self-consistency CLEAN.
```yaml
deps_new: []
schema_change: false
new_secret: false
new_endpoint: [self-serve-firm-signup]  # role-change REUSED
specialists: [backend-developer, frontend-developer]
compliance_invariants: [reuse-existing-auth-invite-signup-session, self-serve-create-atomic+RLS-safe-bootstrap (M8 isolation holds, cross-firm read=0), grant-admin-via-existing-assignRoleAsActor (admin-only+audited+no-orphan-last-admin), NO-regression-to-invite-join-flow, M11-billing/isolation-hardening-OUT]
hard_boundaries: "build ONLY: a self-serve workspace-creating signup (atomic: STuser+workspace+admin users-row+session; RLS-safe first-user bootstrap) + the create-firm onboarding UI + the grant-admin UI control (on the EXISTING role-change endpoint). REUSE all existing auth/RLS/audit; do NOT alter the invite+signup JOIN flow, the role-change backend, or M8 RLS. NO billing, NO subscription, NO isolation-hardening beyond M8 (M11-held). Siblings deferred: admin-transfer/demote, full-member-CRUD, onboarding-polish."
design_gap_flag: true
self_consistency: clean

# Wave 37 — P-2 Spec (pointer). Source of truth: task 6235baf7 description + P-2 SCOPE head. single-spec. design_gap TRUE → D-block.
## AC (self-serve firm setup + admin role-grant):
1. **Self-serve create:** a new user can, from the UI, sign up + create a firm workspace + set the firm name + become the FIRST ADMIN — atomic (STuser + workspace + admin users-row + session), RLS-safe first-user bootstrap. Verified: the new admin lands in the app; their workspace is isolated (cross-firm read = 0 rows).
2. **Join (reused):** an invited user still JOINS an existing firm via the existing invite+signup flow (NO regression).
3. **Grant admin:** an admin can promote a teammate to admin from the members/settings UI — via the EXISTING PATCH /admin/users/:id/role (assignRoleAsActor: admin-only + own-workspace + AUDITED + no-orphan-last-admin 409). Non-admin cannot. Cannot demote the last admin (friendly 409).
4. **arina@claudomat.dev = admin** (already provisioned) — the flow supports her; no-op confirm.
5. **Security:** M8 RLS holds for every new workspace; role-grant is audited in the tamper-evident log; NO billing/isolation-hardening (M11-held).
## design_gap TRUE → D-block: (a) create-firm onboarding screen, (b) grant-admin control (reuse v9 admin-users.html + design tokens).

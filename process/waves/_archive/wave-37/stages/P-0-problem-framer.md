verdict: PROCEED
verdict_source: problem-framer
matched_antipatterns: []
reasoning: |
  Symptom-vs-cause check PASSES: the founder directive is a real FLOW gap (no
  self-serve workspace-create path + no members/roles UI in the product), not a
  one-off ("make arina admin" is already done in the DB and is explicitly the
  provisioned baseline, not the ask). The frame builds the missing flow, at the
  right layer (new signup/workspace-create API path + new UI), and correctly
  scopes out M11 billing. Codebase verification confirms the four load-bearing
  security constraints are already satisfied or correctly named as reuse: M8 RLS
  (FORCE + deny-by-default, 28 tenant tables) is production-live; the role-grant
  endpoint (PATCH /admin/users/:id/role, admin-only, audited) exists from wave-15;
  the last-admin orphan guard (runLastAdminGuard, advisory-lock + count-excluding-
  self, throws 409) exists and is workspace-scoped via the GUC. Frame is sound;
  no antipattern match. Sizing and the new-path sharp edge belong to P-1/P-2.
proposed_reframe: |
  (n/a - PROCEED)
escalation_reason: |
  (n/a - PROCEED)
load_bearing_frame_constraints:
  - REUSE-EXISTING-AUTH: invite (POST /auth/invite) + invite-consuming signup +
    session + workspace-context ALS/interceptor + role-enum are wave-35/wave-15
    assets and MUST be reused, not re-implemented. Genuinely-new surface is
    narrower than the directive states - ONLY (a) a NON-invite signup +
    workspace-create path (auth.service.signup currently HARD-REQUIRES
    inviteToken; no self-serve endpoint exists) and (b) the onboarding UI +
    members/roles UI. The role-CHANGE endpoint already exists (backend reuse;
    only its UI is new).
  - RLS-ISOLATION-ON-WORKSPACE-CREATE: M8 RLS is already workspace-scoped and
    FORCE/deny-by-default. The new workspace-create path MUST assign workspace_id
    + the creator's users row (workspace_id FK, NOT NULL) + admin role atomically,
    so every subsequent data access resolves via the existing GUC/ALS and stays
    RLS-scoped. Sharp edge for P-2/P-3: a brand-new self-serve user is
    mid-create with no workspace_id yet - the WorkspaceInterceptor fail-closed
    path assumes an existing workspace membership, so the create-workspace call
    itself runs pre-membership (bootstrap, like resolve_user_workspace's
    SECURITY DEFINER pattern). Frame must not leak cross-firm on create.
  - ROLE-GRANT-PRIVILEGE-ESCALATION-CONTROLS: grant-admin is the
    highest-privilege action. All four controls are in-frame and already
    enforced by existing code: admin-ONLY (guard on the endpoint), audited in
    the tamper-evident log (assignRoleAsActor emits a role-change audit entry),
    scoped to the admin's OWN workspace (GUC + RLS + roles-table-global but
    users.roleId workspace-bound), and NO-ORPHAN-LAST-ADMIN (runLastAdminGuard,
    409 on demote/deactivate of the last active admin). Any UI/API added this
    wave MUST route through assignRoleAsActor, not a new bypass path.
  - M11-BILLING-OUT-OF-SCOPE: this is the self-serve-onboarding + role-mgmt
    SLICE. NO billing/subscription/metering, and NO isolation hardening beyond
    the existing M8 RLS (strict Chinese-Wall hardening stays M11-held). Watch
    premature-scaling at P-1/P-2.
design_gap: true
design_gap_note: |
  New onboarding UI (create-firm / name-firm / first-admin) + new members/settings
  roles-management UI. Neither exists as an approved design. D-block required.
  (Note: v9 approved an admin-users.html + admin-workspace-settings.html screen set
  - P-1/D-1 should check reuse before net-new design.)
sibling_visible: false

verdict: THIN
verdict_source: mvp-thinner
milestone_id: 08d3053a-48fb-4562-a25b-6d99d40b0f62
milestone_title: M7 — Admin & settings
milestone_class: product-feature
milestone_success_metric: |
  An admin can connect a data source, invite users and assign roles, and verify
  a sending domain so the firm can send compliant outreach.
mvp_critical_status: |
  M7 was closed done (10 tasks + 4-polish cancelled) then reopened for this
  founder directive. Of the milestone's original success-metric surface, "invite
  users and assign roles" is ALREADY shipped (task 82ec8724 done: invite /
  assignRole / deactivate + race-safe last-admin guard + SoD + RBAC + audit).
  This wave adds the SELF-SERVE ONBOARDING surface (workspace-create + first-admin)
  which the metric's "an admin ... [exists to] ... so the firm can send compliant
  outreach" clause presumes but never had a UI for. Seed = 6235baf7 (todo).

proposed_split:
  acs_to_keep:
    - ac: "Self-serve setup UI — new user signs up, creates a firm workspace, sets firm name, becomes FIRST ADMIN (invited users still JOIN via the existing /auth/invite+signup flow)."
      rationale: "This is the only path by which 'an admin' comes to exist self-serve; without it the firm cannot self-onboard, and the metric's whole 'an admin can ...' precondition is unmet. mvp-critical."
    - ac: "Workspace-create preserves RLS workspace isolation (M8 — cross-firm read = 0 rows)."
      rationale: "Compliance-first M&A invariant; a new-workspace path that leaks across firms guts the metric's 'compliant' clause and M8. Non-negotiable, not a nice-to-have."
    - ac: "Grant-admin control — an admin promotes an existing teammate to admin (role-update endpoint + members/roles admin page control), admin-only + audited in the tamper-evident log."
      rationale: "Directly the founder's ask #3 and the 'assign roles' half of the metric extended to the admin role; a firm cannot self-manage its own admins without it. mvp-critical."
    - ac: "No-orphan / last-admin guard holds on the role-grant path (cannot remove/demote the last admin)."
      rationale: "Role-grant is privilege-escalation; the guard already exists for demote/deactivate (task 82ec8724) and MUST cover any new role-mutation path or the workspace can be orphaned. Cutting it guts the security clause of the metric. mvp-critical."
    - ac: "arina@claudomat.dev = admin with full rights (confirm the self-serve flow supports her; already provisioned)."
      rationale: "Near-no-op confirmation, but it is the pilot's single live admin account; verifying the flow doesn't regress her is cheap and load-bearing for the pilot. Keep (trivial cost, not worth a sibling)."

  acs_to_split:
    - ac: "Full admin TRANSFER / demote-self-while-promoting-other + role-SHARING semantics (the 'transfer/share' phrasing in the directive, beyond plain grant-admin)."
      rationale: "The metric needs 'assign roles' — satisfied by GRANT-admin (promote a teammate, keeping >=1 admin). Full transfer (atomic demote-self + promote-other) and multi-admin role-sharing UX are depth on a surface whose first-pass (grant-admin) isn't shipped yet; a pilot firm self-manages fine with grant-admin + the existing demote path. If absent, the metric is STILL satisfiable. Deferring avoids building the self-demote-with-handoff atomic dance ahead of demand."
      sibling_task_seed:
        title: "Admin transfer + role-sharing: atomic demote-self-while-promoting-successor + multi-admin handoff UX"
        description: |
          After self-serve grant-admin ships, add first-class admin TRANSFER: an
          admin promotes a successor AND demotes themselves in one atomic,
          last-admin-guard-safe transaction (never zero admins mid-transfer), plus
          any role-sharing UX beyond simple grant. Acceptance sketch: a transfer
          endpoint/flow that promotes B then demotes A atomically under the existing
          pg_advisory_xact_lock admin-guard, rejected if it would orphan the
          workspace; audited last-in-txn. Grant-admin (this wave) is the prerequisite.
          INSERT as tasks row: milestone_id = 08d3053a-48fb-4562-a25b-6d99d40b0f62,
          wave_id = NULL, parent_task_id = 6235baf7-a1d5-4949-854a-5541dd3de3c3.
    - ac: "Full members-management page = list ALL users + change ANY role (compliance/analyst/etc.) + deactivate, as new scope in THIS wave."
      rationale: "The metric's 'assign roles' is met by the ALREADY-DONE user-management vertical (task 82ec8724: list/invite/assignRole/deactivate on the admin-users page). The founder's NEW ask is specifically the GRANT-ADMIN control. Rebuilding or widening a full member-CRUD surface here is polish ahead of demand — the existing admin-users page already carries list + role-change; this wave only needs the grant-admin control wired onto it. Any NET-NEW member-CRUD beyond that is deferrable without touching the metric."
      sibling_task_seed:
        title: "Members-management surface consolidation: unify grant-admin control into the existing admin-users page + any net-new full-CRUD"
        description: |
          If the grant-admin control this wave adds turns out to warrant a
          consolidated members page beyond the existing admin-users vertical
          (task 82ec8724), capture that here rather than expanding this wave.
          Acceptance sketch: reconcile the new grant-admin control with the shipped
          admin-users list/role/deactivate surface; add any net-new full-CRUD only
          if a pilot need surfaces. INSERT as tasks row: milestone_id =
          08d3053a-48fb-4562-a25b-6d99d40b0f62, wave_id = NULL,
          parent_task_id = 6235baf7-a1d5-4949-854a-5541dd3de3c3.
    - ac: "Fancy onboarding — logo upload, multi-step wizard, branding, workspace-settings-EDIT after creation."
      rationale: "Firm-name-on-create is the metric-critical field. Post-create workspace-settings EDIT already exists (task 648a86a6 done: admin-workspace-settings page + firm-profile CRUD), so re-editing name is covered there — the create screen needs only a minimal create-firm form (name + first-admin). Logo/wizard/branding polish does not touch 'an admin can ... send compliant outreach.' Deferrable."
      sibling_task_seed:
        title: "Create-firm onboarding polish: multi-step wizard + logo/branding upload"
        description: |
          Enrich the minimal create-firm form (this wave = firm name + first-admin)
          with a guided multi-step wizard, logo/branding upload, and richer
          first-run onboarding once the core self-serve path is live. Acceptance
          sketch: wizard flow + asset upload wired to the existing
          admin-workspace-settings surface; no change to the create endpoint's
          metric-critical fields. INSERT as tasks row: milestone_id =
          08d3053a-48fb-4562-a25b-6d99d40b0f62, wave_id = NULL,
          parent_task_id = 6235baf7-a1d5-4949-854a-5541dd3de3c3.

over_cut_rationale: |

ok_rationale: |

floor_constraint_active: false
floor_constraint_detail: |

sibling_visible: false

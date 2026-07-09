verdict: THIN
verdict_source: mvp-thinner
milestone_id: 08d3053a-48fb-4562-a25b-6d99d40b0f62
milestone_title: M7 — Admin & settings
milestone_class: product-feature
milestone_success_metric: |
  An admin can connect a data source, invite users and assign roles, and verify a
  sending domain so the firm can send compliant outreach.
mvp_critical_status: |
  M7 in_progress. The success-metric spine is largely shipped across prior waves —
  data-source connection admin (done 41c017f7), invite + assign-role + deactivate
  vertical with last-admin guard + SoD (done 82ec8724), reactivate path (done 042cf4e6),
  workspace/firm-profile + default-compliance cascade (done 648a86a6 / 904a3c25),
  self-serve firm setup + grant-admin/promote (done 6235baf7). This wave's mvp-critical
  gap is the remaining privilege-sensitive role-mutation slice: TRANSFER admin +
  SELF-DEMOTE, gated by a race-safe last-admin guard, audited, with a confirm step on
  the destructive action. That spine (seed 69cd8ce4 + the confirm-modal AC of 9e37eeef)
  is mvp-critical. The full member-CRUD grid and the activity-view surfacing are
  nice-to-have relative to the success metric.

# THIN — proposed sibling split
proposed_split:
  acs_to_keep:
    - ac: "SEED 69cd8ce4 — admin TRANSFER + SELF-DEMOTE vertical (settings UI → authz-gated assignRoleAsActor mutation → persisted role change + immutable audit entry)"
      rationale: "Directly serves 'assign roles' in the success metric and M7 Scope 'user management (invite, assign role, deactivate)'; completes the role-mutation surface beyond promote."
    - ac: "SEED 69cd8ce4 — race-safe last-admin guard (transactional count-then-mutate; sole-admin self-demote/transfer-away blocked, workspace never orphaned)"
      rationale: "M7 Scope names 'last-admin guard' explicitly; without it the role-mutation slice can orphan the workspace of its last admin — the metric ('an admin can ... assign roles') is not safely satisfiable."
    - ac: "SEED 69cd8ce4 — RBAC/SoD edge matrix (non-admin 403, self-elevation rejected, cross-workspace rejected, demote-self-while-last-admin rejected) + immutable hash-chained audit per mutation + RLS/tenant isolation"
      rationale: "Compliance-first invariants (SoD, HMAC-SHA256 audit chain, RLS) are load-bearing for this project; a privilege-escalation-sensitive mutation without them is unusable at pilot."
    - ac: "Sibling 9e37eeef PART 1 — confirm-modal before the DESTRUCTIVE role changes (self-demote, transfer, deactivate); cancel is a no-op (no mutation, no audit)"
      rationale: "Safety control for an irreversible privilege drop. Cutting it leaves a fat-finger-able self-demote/transfer path in a compliance-first tool; the metric's implicit 'an admin can safely manage roles' is not met without it. Keep with the seed."
  acs_to_split:
    - ac: "Sibling 9e37eeef PART 2 — surface the new role-transfer / self-demote audit events in the already-shipped admin activity view (read-only recent-admin-actions page 8bb0a22f)"
      rationale: "The success metric is satisfiable without it: the seed already WRITES the immutable audit entries (mvp-critical); surfacing them in the read-only activity view is oversight polish. Trace test = yes (metric holds if absent)."
      sibling_task_seed:
        title: "Surface admin role-transfer / self-demote events in the admin activity view"
        description: |
          The seed (69cd8ce4) writes immutable audit entries for admin TRANSFER and
          SELF-DEMOTE via the existing hash-chained audit path. This surfaces those new
          event types in the already-shipped read-only admin activity view
          (recent-admin-actions page + endpoint, done task 8bb0a22f) so an admin can see
          who transferred/demoted whom.
          Acceptance sketch: the admin activity view lists role-transfer + self-demote
          events (actor, target, from-role, to-role) read from the existing audit-log read
          path; read-only, admin-only, own-workspace-scoped (RLS preserved); non-admin → 403.
          No new mutation privilege. Additive-only, no schema migration expected.
          Orchestrator INSERTs as a tasks row with milestone_id = 08d3053a-48fb-4562-a25b-6d99d40b0f62,
          wave_id = NULL, parent_task_id = 69cd8ce4-fb06-4b4a-ace9-1d3ffc828707.
    - ac: "Sibling 3ebd6610 — full member-management CRUD grid: list ALL workspace users with roles+status, change ANY user's role, deactivate/reactivate for all users"
      rationale: "Broader than the founder's named ask (transfer/share admin) and broader than the mvp-critical spine. The success-metric verbs 'invite users and assign roles' are already satisfiable via the shipped invite/grant-admin/deactivate/reactivate verticals PLUS the seed's transfer/demote. For a first pilot firm (few users) the consolidated CRUD grid is day-to-day convenience, not the safety spine. Trace test = yes (metric holds if absent)."
      sibling_task_seed:
        title: "Full member-management CRUD UI over the shipped role/deactivate services"
        description: |
          A complete admin members page on the admin/settings surface: list all workspace
          users with roles + status, change ANY user's role, and deactivate/reactivate — a
          UI layer over already-shipped audited backend (assignRoleAsActor; deactivate via
          users.deactivated_at soft-delete; reactivate endpoint). This is the broader
          day-to-day member table beyond the transfer/demote control shipped by the seed;
          it closes the consolidated-members-view convenience gap once the pilot firm grows
          past a handful of users.
          Acceptance sketch: members list is admin-only (RBAC web route + API), own-workspace
          scoped (RLS, no cross-workspace rows); change-role / deactivate / reactivate route
          through the EXISTING audited services (no new privilege path) and inherit the
          seed's race-safe last-admin guard; every mutation writes an immutable audit entry;
          test spec before code (own-workspace-only list, admin-only mutations, last-admin
          guard holds from this UI, audited). Additive-only, reuse existing endpoints.
          Orchestrator INSERTs as a tasks row with milestone_id = 08d3053a-48fb-4562-a25b-6d99d40b0f62,
          wave_id = NULL, parent_task_id = 69cd8ce4-fb06-4b4a-ace9-1d3ffc828707.

floor_constraint_active: false
floor_constraint_detail: |
  N/A — floor did not block. Residual after peel-off = seed 69cd8ce4 (transfer +
  self-demote vertical: settings UI + authz-gated service mutation + persisted role
  change + immutable audit) + race-safe last-admin guard (transactional count-then-mutate)
  + full RBAC/SoD edge matrix (four enumerated privilege-escalation cases) + RLS +
  deterministic-test-spec-before-code, PLUS the confirm-modal safety AC. This is a
  coherent privilege-sensitive vertical slice with a full SoD/edge test matrix on a
  product-feature UI wave — comfortably above a sub-floor sliver. The two split-out ACs
  (a read-only activity-view surfacing over an existing page, and a CRUD grid over
  already-shipped audited services) are the incremental, non-spine portions; removing
  them does not push the wave below a coherent-slice floor.

sibling_visible: false

notes: |
  - OVER-CUT boundary observed and respected: the confirm-modal on destructive role
    changes (9e37eeef PART 1) is treated as mvp-critical SAFETY and KEPT with the seed.
    Splitting it would leave the wave unsafe (fat-finger-able privilege drop with no
    deliberate confirmation) — that would be the OVER-CUT failure mode, and it is avoided.
  - Cross-milestone note: none. All keep + split ACs remain under M7 (milestone_id
    08d3053a). No AC belongs elsewhere.
  - Founder-named-ask boundary: the founder's wave-37 directive named "transfer/share
    admin" (the seed) as the explicit pilot ask; the full member-CRUD grid is broader
    than that ask, reinforcing its nice-to-have classification.
  - No new ACs proposed (that is ceo-reviewer's SCOPE-EXPANSION lane). No wave-size
    reduction proposed — total scope is preserved; the two split ACs move to sibling
    tasks under the same milestone for a future wave.

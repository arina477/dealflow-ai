verdict: PROCEED
verdict_source: problem-framer
matched_antipatterns: []
symptom_vs_cause_check: |
  MANDATORY CHECK — PASS. This wave is cause-level, not symptom-level.
  The surface "symptom" would be: users land on a bare placeholder dashboard and any
  authenticated user can hit any route. The CAUSE is that M1's foundation is incomplete —
  (a) no shared authed frame exists (only a placeholder), and (b) wave-2 shipped the
  RolesGuard as an unapplied PRIMITIVE (confirmed: apps/api/src/modules/auth/guards/roles.guard.ts
  + @Roles() decorator are DI-registered but applied to ZERO routes; auth.controller.ts
  explicitly documents "no @Roles()/@UseGuards(RolesGuard) appears on ANY handler").
  The wave fixes the cause (build the frame once + wire the existing primitive to routes),
  not a symptom. Confirmed correct layer at each seam: RBAC enforcement lives in the API
  guard + web route protection (correct layers), driven by ONE canonical route->allowed-roles
  mapping consumed by API, web protection, AND nav visibility — no per-layer duplication.

reasoning: |
  This is the RIGHT next problem, framed at the cause level, and correctly sequenced.
  (1) Sequencing: the RolesGuard primitive, the 4-role model, and the role-as-session-claim
  all exist from wave-2 (verified in code), so per-route enforcement is the natural completion
  step — not premature abstraction. The deferral was a deliberate, pre-planned P-1 sizing
  decision (product-decisions.md 2026-07-02 auth-vertical entry), not scope drift.
  (2) No premature abstraction: RBAC is framed as a coherent guard applied via @Roles()
  metadata off ONE canonical mapping, not scattered per-route checks; role logic is NOT
  duplicated frontend+backend — both layers plus nav read the SAME mapping (this is the
  correct anti-drift pattern, directly avoiding catalog antipattern #2).
  (3) AppShell built ONCE as shared <AppShell>=<Sidebar>+<TopBar> per DESIGN-SYSTEM §10 —
  seed quotes the "implemented once, never per-page" contract verbatim; no monolith risk.
  (4) Dashboard SHELL correctly scoped as a role-aware LANDING (frame + role-adaptive
  content), NOT full dashboard feature content — those are later product-feature waves (M2-M7).
  Milestone class is platform-foundation, so mvp-thinner is correctly not spawned.
  This completes M1's success metric ("land on a role-aware dashboard shell" + per-route RBAC).

demo_path_note: |
  NOT a framing defect (mitigation already present in the seed) — but flag forward to P-2/P-3
  as mandatory acceptance criteria to avoid a demo-path lockout of the just-shipped login flow:
  - Auth routes (/auth/*, /login, /accept-invite, /reset-password) must NOT receive a @Roles()
    pairing — they run pre-role (SessionGuard/none), and gating them would break the LIVE login
    flow. RolesGuard already no-ops when no @Roles() metadata is present (verified in guard code:
    empty required-roles => returns true) — so the safe default is allowlist-by-decoration, not
    deny-by-default-everywhere. P-2 should assert this explicitly.
  - The shell landing route (/) must be reachable by all 4 roles (it is "All (role-aware)" per
    the journey map) — enforcement must gate deeper routes, not the landing.
  - Rollout shape is inherently allowlist (a route is restricted only where @Roles() is added),
    which is the low-blast-radius approach — no enforce-everywhere flip. P-3 plan should confirm
    the route->roles mapping covers /mandates, /sourcing, /compliance/*, /admin/* and leaves /
    open, matching the journey-map persona column.
  - Security-scope-tightened P-4 gate applies (wave touches sessions/RBAC) — head-product should
    require T-8 coverage of a 403-on-wrong-role + 200-on-right-role invariant per restricted route.

proposed_reframe: |
  (n/a — PROCEED)
escalation_reason: |
  (n/a — PROCEED)
sibling_visible: false

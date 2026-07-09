verdict: PROCEED
verdict_source: problem-framer
matched_antipatterns: []
reasoning: |
  Symptom-vs-cause check (mandatory): the stated problem — "an admin can't transfer admin
  or self-demote" — is a GENUINE capability gap, not a symptom papering over a deeper
  RBAC-model defect. Verified against shipped code: the RBAC model (4 roles, roleRoutes
  single-source, per-route @Roles guard, RLS tenant isolation, HMAC hash-chained WORM audit,
  race-safe last-admin guard) is intact and correctly layered. The gap is the absence of a
  UI + the transfer semantic on top of an already-correct backend — exactly where the seed
  places it. No wrong-layer, no premature abstraction, no config-drift, no validation-theater,
  no backwards-compat shim, no spec contradiction with product-decisions (the founder's
  2026-07-09 self-serve entry explicitly names transfer/self-demote as the remaining half).

  The load-bearing invariant is correctly identified: the race-safe last-admin guard
  (runLastAdminGuard, user-management.service.ts:476) already exists, already fires on
  admin→non-admin demote (line 288-290) and on deactivate (line 362), and closes write-skew
  via pg_advisory_xact_lock(ADMIN_GUARD_LOCK_KEY) — NOT a naive count(*) FOR UPDATE. Self-demote
  is mechanically assignRoleAsActor(self, non-admin) which routes through this guard today.
  The seed correctly treats the guard as reuse ("consistent with the wave-15 guard"), not
  reinvention. Reuse discipline is strong throughout: audit write path, RLS scoping, existing
  service + controller, existing test files are all cited by path.

  Destructive-action safety is correctly scoped as the real risk-reducer: sibling 9e37eeef
  pairs the confirm modal (fat-finger protection) with surfacing transfer/demote events in the
  shipped read-only activity view — closing the review loop. The demo-path tunnel-vision check
  passes: every privilege-escalation edge is enumerated in the seed's acceptance sketch
  (non-admin 403, self-elevation, cross-workspace, demote-self-while-last-admin, race-safe
  concurrency), and static-test-spec-before-code is mandated.

  Cross-workspace isolation is structurally enforced by Postgres RLS (getDb() ALS handle sets
  app.workspace_id per-request); the eq(users.id, userId) lookup with no explicit workspace
  predicate is safe because RLS filters visible rows, so a cross-workspace target resolves to
  NotFound. The seed names this as an edge to TEST rather than logic to build — correct framing.

  Two non-blocking notes for P-2 (spec-level, not framing defects):
  1. "Transfer admin" is not atomic in shipped code — it is semantically promote-B then
     demote-A (two assignRoleAsActor calls). P-2 must decide: single-tx atomic transfer
     (promote-B + demote-A in one transaction, guard evaluated on the post-state) vs. two
     sequential audited mutations. The atomic path is preferable so the last-admin guard sees
     the correct intermediate state and the transfer is all-or-nothing; flag for the spec.
  2. Bundle coupling is coherent, NOT scope-creep-by-coupling (antipattern #5 does NOT match):
     seed = the mutation vertical; sibling 3ebd6610 = the members-CRUD UI over the same
     already-shipped services; sibling 9e37eeef = confirm-modal + activity-view surfacing of
     the seed's own events. All three share the admin-users surface and the seed's guard/audit
     invariants — a genuine vertical slice, correctly parented under the seed. No auto-split
     trigger.
proposed_reframe: |
  (n/a — PROCEED)
escalation_reason: |
  (n/a — PROCEED)
sibling_visible: false

# Wave 37 — P-4 Gate Verdict (Phase 1)

**Block:** P (Product) | **Stage:** P-4 Gate | **Wave:** M7 self-serve firm setup + admin role-grant (thinned; product-feature; design_gap TRUE)
**Gate author:** head-product (fresh spawn) | **Phase:** 1 (head verdict; Phase 2 = cross-review) | **Mode:** automatic

---

## VERDICT: APPROVED (Phase 1) — pending Phase-2 cross-review

Every P-4 stage-exit check ticks against concrete artifacts (P-0 frame + 3 reviewers, P-1, P-2 pointer + authoritative task 6235baf7 `description` P-2 SCOPE head, P-3 plan). Scope is correctly thinned, reuse-not-rebuild is explicit, and every load-bearing security invariant is a named AC/plan invariant. Phase 2 (karen + jenny + security-auditor) must reality-check the reuse claims and the tightened privilege-escalation gate before this becomes final.

---

## Judge criteria — findings

1. **Thinned + reuse-not-rebuild — PASS.** Genuinely-new surface = (a) self-serve workspace-creating signup path (auth.service.signup currently HARD-REQUIRES inviteToken; no self-serve endpoint exists), (b) create-firm onboarding UI, (c) grant-admin UI control on the EXISTING role-change endpoint. REUSED, not rebuilt: role-change backend (PATCH /admin/users/:id/role via assignRoleAsActor), member role-assign (task 82ec8724), workspace-settings (task 648a86a6), M8 RLS (28 tenant tables, FORCE deny-by-default). P-3 Action 2 = "Data model: NONE new" / no migration; Action 3 = "role-change endpoint is REUSED". Invite+signup JOIN flow explicitly NOT altered (hard_boundaries + AC #2 no-regression).

2. **Self-serve create atomic + RLS-safe — PASS (AC/plan invariant).** Atomic: SuperTokens user + workspace(firmName) + admin users-row + session mint. Pre-membership bootstrap via SECURITY-DEFINER pattern (mirror resolve_user_workspace / invite bootstrap) so the first-user RLS-scoped INSERT succeeds. Compensating delete of the Core user on failure (mirrors existing signup atomicity). M8 isolation asserted: new workspace's data isolated, cross-firm read = 0 rows. AC #1 + compliance_invariants[self-serve-create-atomic+RLS-safe-bootstrap].

3. **Grant-admin via existing assignRoleAsActor — PASS.** Routes through the existing PATCH /admin/users/:id/role: admin-only + own-workspace-scoped + AUDITED in the tamper-evident log + runLastAdminGuard (no-orphan-last-admin, 409). NO new role-change logic; frontend calls the existing endpoint with role='admin'. AC #3. This is a security-scope-tightened gate -> security-auditor routed into Phase 2.

4. **Scope boundary M11-held — PASS.** No billing/subscription/metering; no isolation-hardening beyond M8 RLS (strict Chinese-Wall hardening stays M11-held, H3 post-pilot). ceo-reviewer HOLD-SCOPE + scope_boundary_flags confirm. Siblings deferred as seeds under 6235baf7: admin-transfer/demote + role-sharing, full-member-CRUD consolidation, onboarding-polish (wizard/logo/branding). No premature scaling.

5. **design_gap TRUE -> D-block — PASS.** d_block: run. Surfaces: create-firm onboarding screen + grant-admin control. Reuse directive: v9 admin-users.html + admin-workspace-settings.html + design tokens (check reuse before net-new). D-block runs D-1 brief -> D-2 variants -> D-3 adopt.

6. **AC testability — PASS.** Each AC is a concrete observable: self-serve create -> new admin lands + workspace isolated (cross-firm read = 0); grant-admin via existing endpoint (admin-only + audited + last-admin 409); non-admin denied; invite-join no-regression. AC #4 (arina admin) is a verification-only no-op confirm — acceptable, load-bearing for the single live pilot admin.

---

## P-4 stage-exit checklist

- [x] Audit-log / pre-send-compliance / RBAC-suppression ACs are binary, observable, machine-readable — role-grant AC asserts admin-only + audited-in-tamper-evident-log + no-orphan-last-admin 409; RLS AC asserts cross-firm read = 0 rows. (pre-send compliance gate: N/A this wave — no outreach surface touched.)
- [x] Cross-review responses logged/resolved — DEFERRED to Phase 2 (karen + jenny + security-auditor). This is the ONLY open item; verdict is Phase-1 conditional.
- [x] [STABLE] Traceability back to P-0 frame — every claimed_task_id (6235baf7) and every AC traces to the P-0 frame; bet-traced ("Integrated platform beats stitched-together tools") + milestone M7. No orphan ACs.

## Note carried into Phase 2 (non-blocking)
- P-3 leaves the endpoint SHAPE negotiable ("new POST /auth/signup-firm" vs "signup branch"; P-4/B decides). This is INVEST-Negotiable implementation detail, NOT a spec gap — the observable contract (atomic, RLS-safe bootstrap, admin lands, workspace isolated, no invite-flow regression) is fixed. Flagged for jenny's spec-vs-existing consistency pass.

---

## Phase-2 routing (mandatory cross-review before final APPROVED)

- **karen** — reuse-not-rebuild reality-check: do the role-change endpoint (PATCH /admin/users/:id/role) + assignRoleAsActor + runLastAdminGuard + M8 RLS (28 tables, FORCE) actually EXIST in the codebase as claimed? Reject if any "reuse" is aspirational.
- **jenny** — spec-vs-directive + spec-vs-existing consistency: does the P-2 contract faithfully implement the founder directive AND wire to the existing assets (invite/signup, session, ALS/interceptor, roles enum) without re-implementing them? Confirm the endpoint-shape ambiguity does not leak into a second role-change path.
- **security-auditor** — the tightened privilege-escalation gate: (a) self-serve workspace-create atomicity + RLS-safe pre-membership bootstrap (does the SECURITY-DEFINER path leak cross-firm on create? is compensation on failure sound?); (b) grant-admin cannot bypass assignRoleAsActor (admin-only + audited + last-admin guard on the new UI path).

---

```yaml
head_signoff:
  verdict: APPROVED   # Phase 1 (conditional on Phase-2 cross-review)
  stage: P-4
  phase: 1
  reviewers_phase2: [karen, jenny, security-auditor]
  failed_checks: []
  open_items: [phase-2-cross-review-pending]
  rationale: >
    Scope correctly thinned at P-0 (3 siblings deferred); reuse-not-rebuild explicit across
    P-1/P-2/P-3 (role-change backend + member role-assign + workspace-settings + M8 RLS all
    reused, no migration); self-serve-create is an atomic + RLS-safe-bootstrap AC/plan invariant;
    grant-admin routes through the existing assignRoleAsActor (admin-only + audited + no-orphan-
    last-admin); invite-join flow un-touched (no regression); M11 billing/isolation-hardening OUT;
    design_gap TRUE -> D-block runs. Every AC is a concrete observable and traces to the P-0 frame.
    Only open item is the mandatory Phase-2 cross-review.
  next_action: PROCEED_TO_PHASE2_CROSS_REVIEW
  security_scope_tightened: true
  design_gap_flag: true
  d_block: run
```

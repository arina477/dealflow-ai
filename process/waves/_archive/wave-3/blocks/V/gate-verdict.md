# Wave 3 — V-3 Verdict

**Reviewer:** head-verifier (fresh spawn, agentId head-verifier-wave3-v3)
**Reviewed against:** process/waves/wave-3/blocks/V/review-artifacts.md
**Attempt:** 1  (1 = first gate)

## Verdict
APPROVED

## Rationale
Both V-1 reviewers APPROVE and — critically — both traced their APPROVE to observable
deployed state at 935b847, not to green tests or clean diffs: Karen (source-claim) minted
fresh cookie-jar users via /auth/invite+/auth/signup and independently re-ran the RBAC
matrix (7/7 load-bearing claim-groups TRUE, no Done-Theater); jenny (spec-semantic) minted
4 real role sessions and confirmed 0 drift across all three blocks (AppShell built once via
the (app) route-group layout, per-role nav EXACT-matching the pinned matrix, /compliance/summary
gating both directions, /auth reconciliation with unauth→/login). I did not take either on
faith. I independently re-verified against LIVE 935b847: /health version == 935b847 (deployed
code IS reviewed code — no health-mirage); minted a fresh compliance + advisor user via the
invite-bound signup flow; and observed the compliance-first invariant hold in both directions —
compliance→200 {"pendingCount":0,"items":[]}, advisor→403 {"message":"Forbidden"} (no resource
data, no role leak), unauth→401. Login is genuinely functional (invite-bound signup 201 with
role stamped from the token; /auth/me returns correct identity+role; public self-signup is
disabled — my initial email/password payload was rejected, confirming the invite-binding is
real rather than a rubber-stamp). Enforcement is fail-closed (unauth=401 not a 403-leak;
empty-@Roles throws) and DB-authoritative (roles.guard.ts re-resolves role via
resolveRoleBySupertokensUserId off app-DB users.role — proven executing because the advisor's
DB role was read and denied). The 4-role SoD substrate is genuinely enforced live: nav and
enforcement both derive from the single roleRoutes array (nav⊆RBAC by construction, cannot
drift), and no nav item is shown that RBAC would 403. This wave went through one deploy
fix-cycle (RolesGuard DI wiring: AuthModule now exports AuthRepository) and a B-6 pass that
caught two CRITICAL RBAC bugs (fail-open, stale-privilege); I scrutinized the FINAL state and
it is genuinely correct — the DB-authoritative fail-closed guard is present in code, honestly
recorded as a superseded FAIL, and live-verified. V-2 triage is sound: no load-bearing finding
was downgraded. The two LOW gaps are correctly non-blocking — GAP-1 (unbuilt M3+ nav routes
return 404 not →/login) concerns pages that do not exist this wave, so no AppShell guard is
bypassed; GAP-2 (DB role re-verify not black-box-proven) is code-verified and consistent with
the live matrix, and the only unproven edge — downgrade-takes-effect-next-guarded-request —
requires a role-mutation flow that does not ship until M3+, so deferring the black-box test to
when that flow exists is correct triage, not a downgrade of a load-bearing claim. The T-8
micro-perf note (1 DB read/guarded-request) and T-1 icon/test-fixture casts are correctly
suppressed as noise (correctness over micro-perf; no functional impact). Fast-fix queue is
EMPTY (0 blocking) → Phase 2 correctly skips. Every compliance invariant in scope this wave
(RBAC deny no-leak, fail-closed, DB-authoritative, allowlist-safe login, nav⊆RBAC, 4-role SoD
substrate) is structurally intact and observable in the deployed state. No invisible trust.

## Footer
- verdict_complete: true
- rework_attempt_cap_remaining: 3

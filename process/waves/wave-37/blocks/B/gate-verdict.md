# Wave 37 — B-6 Verdict

**Reviewer:** head-builder (fresh spawn)
**Reviewed against:** built code at commits 48d3480 (design) / b91c717 (backend) / 8093f87 (frontend) / 8fa3544 (test-align); P-4 BINDING SECURITY INVARIANTS in `process/waves/wave-37/blocks/P/gate-verdict.md`
**Attempt:** 1 (first gate)
**Wave:** M7 self-serve firm setup + admin role-grant (single-spec; task 6235baf7; design_gap TRUE)

## Verdict
APPROVED

## Rationale
Every P-4 binding security invariant is verified true in the actual built code, not inferred from green tests. The self-serve workspace-creating signup mints `workspace_id` server-side inside the SECURITY-DEFINER function `create_firm_workspace` (migration 0021) via `gen_random_uuid()`; there is no `p_workspace_id` parameter anywhere in the function signature, the repository method (`createFirmWorkspace` passes only `supertokensUserId, email, firmName`), or the shared Zod contract (`signupFirmRequestSchema.strict()` rejects `workspace_id` and every other extra field). The service (`AuthService.signupFirm`) mirrors the invite-signup atomicity exactly — Core user → DB function → compensate-delete-Core-user on any DB failure AND on null return — so no orphaned SuperTokens users survive a partial write. Grant-admin adds ZERO new backend: the frontend calls the existing `PATCH /admin/users/:id/role` (via the pre-existing `/admin/users-data/*` proxy) which routes through the untouched `assignRoleAsActor` (admin-only SessionGuard+RolesGuard + own-workspace RLS + WORM audit + `runLastAdminGuard` 409 incl. demote) — `user-management.service.ts` and `admin-users.controller.ts` were not touched this wave (confirmed by git). Migration 0021 is strictly additive (CREATE FUNCTION + GRANT EXECUTE only; no ALTER/DROP; clean `.down`), and the RBAC source-of-truth (`packages/shared/src/rbac.ts`) was not touched — so M8 RLS and the invite+signup JOIN flow carry zero regression. The endpoint is rate-limited (scope `signup-firm`: 3/60s + 5/hr, stricter than signup, and correctly placed in `FAIL_CLOSED_SOFT_SCOPES` for fail-closed-soft on DB error). The frontend is correct and reuses AuthCard/FormField/InlineAlert/SubmitButton + design tokens. The 7 stale web RBAC tests are a legitimate alignment to the wave-36-shipped admin read-oversight (rbac.ts already grants admin `/sourcing` + `/pipeline`; the tests asserted the pre-wave-36 redirect), NOT a masked regression. No secrets, no `.env` in the diff.

## Invariant-by-invariant findings

1. **RLS-safe ATOMIC first-user bootstrap — PASS.** Migration 0021 `create_firm_workspace(p_supertokens_user_id, p_email, p_firm_name)` — no workspace_id param; `v_workspace_id := gen_random_uuid()` server-minted; both INSERTs (workspaces + users) use the same minted uuid; SECURITY DEFINER + `SET search_path=''`; role resolved to 'admin' internally (never passed in). `signupFirmRequestSchema.strict()` structurally rejects a client `workspace_id`. Service compensates (`compensateCoreUser`) on DB error and on null return — atomicity mirrors the existing invite-signup.

2. **grant-admin via EXISTING assignRoleAsActor ONLY — PASS.** No new/bypass role endpoint. `AdminUsersClient` PATCHes the existing role route; controller `assignRole` → `assignRoleAsActor` → `runLastAdminGuard(tx, userId, 'demote')` → 409. Both admin backend files untouched this wave (git-confirmed). Admin selectable from `roleEnum.options`; friendly last-admin-409 message present.

3. **M8 RLS holds + ZERO regression — PASS.** New firm writes stamp workspace_id server-side (function-minted). Migration 0021 additive-only (CREATE FUNCTION + GRANT; no ALTER/DROP of tables/policies). `rbac.ts`, invite+signup JOIN flow, role-change backend, M6 SoD, M8 policies all untouched.

4. **Rate-limit — PASS.** `signup-firm` scope: short 3/60s, coarse 5/hr; `resolveScope` maps `/auth/signup-firm`; in `FAIL_CLOSED_SOFT_SCOPES` (fail-closed-soft on DB error), not fail-open.

5. **Frontend correctness — PASS.** `/create-firm` POSTs `/auth/signup-firm`, `router.replace('/')` on 201, friendly 409/429/generic/network errors; login has the `/create-firm` entry link; grant-admin control has admin selectable + friendly last-admin-409 copy; reuses existing auth components + design tokens (matches design/create-firm.html).

6. **Quality + aligned-test legitimacy — PASS.** Reported api pass / web 1004 pass / web build emits /create-firm. The 7 wave-36-stale web RBAC tests correctly align to the already-shipped authoritative matrix (`rbac.ts` line 308 + `rbac.test.ts` canonical: `/pipeline → [advisor,compliance,admin]`, `/sourcing → [analyst,admin]`, `canAccess('admin','/sourcing')===true`). Production RBAC logic unchanged this wave — this is stale-test correction, not regression-masking.

7. **/simplify pass + no secrets — PASS.** Secret scan across the wave diff clean; no `.env` committed. Implementation reuses existing patterns (SECURITY-DEFINER bootstrap mirroring resolve_invite; auth components; rate-limit scope table) with no speculative generality.

## One-line
APPROVED — server-minted-workspace-id (no `p_workspace_id`/`.strict()` rejects it) + atomic-compensate + grant-admin-reuse-no-bypass + M8-RLS-holds + additive-migration + rate-limited(fail-closed-soft) + frontend-correct + no-regression (7 aligned tests are a legitimate wave-36 read-oversight correction, not a masked regression).

## Footer
- verdict_complete: true
- rework_attempt_cap_remaining: 3

```yaml
head_signoff:
  verdict: APPROVED
  stage: B-6
  phase: 1
  reviewers: {}
  failed_checks: []
  rationale: >
    All 7 P-4 binding security invariants verified in the built code. Self-serve create mints
    workspace_id server-side inside SECURITY-DEFINER create_firm_workspace (no client param; .strict()
    rejects it); atomic with compensate-delete-Core-user. Grant-admin reuses the untouched
    assignRoleAsActor (admin-only + own-workspace RLS + WORM audit + runLastAdminGuard 409 incl demote).
    Migration 0021 additive-only. RBAC source-of-truth + invite/JOIN flow + M6 SoD + M8 policies untouched.
    Endpoint rate-limited fail-closed-soft. Frontend correct + reuses design tokens. 7 aligned web tests
    are a legitimate correction to wave-36-shipped admin read-oversight, not a masked regression.
    No secrets, no .env in diff.
  next_action: PROCEED_TO_PHASE2_REVIEW_SKILL
```

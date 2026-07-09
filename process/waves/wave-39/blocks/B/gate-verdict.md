# Wave 39 — B-6 Verdict

**Reviewer:** head-builder (fresh spawn)
**Reviewed against:** process/waves/wave-39/blocks/B/review-artifacts.md
**Attempt:** 1  (1 = first gate)

## Verdict
APPROVED

## Rationale
Every load-bearing compliance and privilege-escalation invariant is verified to hold in the actual
code, not merely claimed in the deliverables. (1) The race-safe last-admin guard is reused, not
re-implemented: `transferAdminAsActor` calls `runLastAdminGuard`, which acquires
`pg_advisory_xact_lock(ADMIN_GUARD_LOCK_KEY)` as its first statement and counts active admins
excluding the mutated user — closing the write-skew that a bare `count(*) FOR UPDATE` would leave
open; the just-promoted target keeps the workspace at ≥1 admin so a transfer never opens a
zero-admin window (user-management.service.ts:406-536, 628-660). (2) The mutation is atomic: promote,
guard, demote, and BOTH audit appends run inside a single `transaction()` with audit written
last-in-txn, so any audit failure rolls the role changes back — proven by T-3, which forces
`auditService.append` to throw and asserts the second audit is never reached. (3) Authz is admin-only
and fail-closed: the endpoint carries `@UseGuards(SessionGuard, RolesGuard) @Roles(...ADMIN_USERS_ROLES)`,
the route is registered in the shared roleRoutes matrix, and I executed the resolver to confirm
`rolesForRoute('/admin/users/:id/transfer-admin')` returns exactly `['admin']` with no sibling-pattern
collision and `canAccess('advisor', …)` = false; the controller throws at boot if the matrix ever
drifts to `[]`. (4) Both mutations write immutable hash-chain `role-change` audit rows (target promote
+ actor demote). (5) The P-4 High condition — deactivated target rejected BEFORE any promote — is
enforced at Step 3 (line 442) ahead of every write and covered by T-2, which asserts `update` and
`append` are never called. (6) Cross-workspace targets 404 via the RLS-scoped lookup (T-7). The actor
is always resolved server-side from the session (`resolveActor` → `getUserWithRole`), never from a
client-supplied id, so the Next.js rewrite proxy carries no IDOR exposure. The 15 backend tests are
genuine behavioral assertions (update/audit call-counts, ordering, exception types, no-mutation-on-guard-
trip) — not tautological coverage inflation; I ran them through the apps/api vitest config (SWC
decorator-metadata enabled) and confirmed 15/15 pass, corroborating B-5's "api 1092 pass". The shared
`transferAdminRequestSchema` is `z.infer`-typed, `.strict()`, and consumed identically by the NestJS
controller and the frontend confirm flow — no contract drift. The ConfirmDialog meets the a11y ACs
(role=dialog, aria-modal, labelledby/describedby, Esc closes, Tab/Shift+Tab focus-trap wrap, focus
returns to trigger on close) and the confirm mutation fires only on explicit confirm, with a server 409
surfaced in-modal as a blocked reason (never a silent success). The accepted deviation — the admin
activity view cannot distinguish a transfer from a plain promote — is sound, not a gap: the
`AdminActivityRow` projection is a pre-existing, reviewed P-4-Finding-3 safe projection
(`{sequenceNumber, actor, target, action, timestamp}`) that deliberately omits payload/hash detail; the
full before/after role and the `transfer:true` marker remain in the immutable audit payload and are
verifiable on the /compliance/audit-log surface. Widening the activity read-projection to surface
before/after role would require a P-block spec amendment, not a silent B-block widening. No
over-engineering, no direct-SDK coupling, no unaudited mutation path, no schema/env/dep changes.

## Notes carried to Phase 2 (non-blocking)

- **MEDIUM — commit hygiene (multi-spec Action 6):** The feature commits are cleanly spec-isolated —
  69cd8ce4 owns 16c086a (contracts), 4c2052c (backend), eb279d4 (transfer UI + proxy + tests);
  9e37eeef owns 3880cb0 (ConfirmDialog + ActivityTable). Both task_ids have feature commits. The B-5
  fix-up commit `daa9f69` (cited as 9e37eeef) touches ConfirmDialog (spec-2) AND AdminUsersClient
  (spec-1) files in one commit. This is a lint/a11y cleanup fixup, explicitly outside Action 6's
  feature-commit scope ("pre-B-6 fix-up commits"), and ConfirmDialog is shared infrastructure consumed
  by both slices — so it is a cosmetic cross-boundary touch, not feature cross-contamination. Recorded
  as accepted-debt; does not warrant a rebase.

- **Deviation confirmed sound:** activity-view transfer-vs-promote indistinguishability — accepted per
  the reasoning above. Log in review-artifacts `deviations_logged`.

## Footer
- verdict_complete: true
- rework_attempt_cap_remaining: 3

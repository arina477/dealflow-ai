# P-4 karen — wave-39 reality check (spec + plan vs shipped code)

**Verdict: APPROVE (with one MUST-BUILD condition carried into B-block acceptance)**

Scope: verify the load-bearing reuse claims in the P-3 plan + P-2 spec against actual
shipped code. Spot-checked 6 file paths, 5 line-number citations, 3 function/symbol names,
1 schema assertion. Antipattern lens: PRODUCT-PRINCIPLES.md "reuse claim that isn't real".

---

## Per-claim results

### Claim 1 — assignRoleAsActor runs guard on admin→non-admin, count EXCLUDES mutated user → VERIFIED
- `apps/api/src/modules/admin/user-management.service.ts:255` — `assignRoleAsActor(userId, newRole, actorUserId, actorRole)` present.
- Line 288 (head-product cited 288): `if (currentRoleName === 'admin' && newRole !== 'admin')` → line 289 `runLastAdminGuard(tx, userId, 'demote')`. Guard fires on exactly the admin→non-admin transition claimed.
- Count exclusion: `runLastAdminGuard` at line 489-496 counts `WHERE r.name='admin' AND u.deactivated_at IS NULL AND u.id != <excludeUserId>` → line 503 `if (remaining === 0) throw ConflictException` (409). Sole-admin self-demote → remaining 0 → 409. Confirmed.
- head-product's second citation "line 495" lands on the `u.id != excludeUserId` exclusion predicate. Accurate.

### Claim 2 — advisory lock is first statement, single global key → VERIFIED
- Line 484 (cited 484): `await tx.execute(sql\`SELECT pg_advisory_xact_lock(${ADMIN_GUARD_LOCK_KEY})\`)` — literally the first statement in `runLastAdminGuard` (line 476 signature, 484 body-first). Doc comment 469-474 explicitly forbids re-ordering.
- `ADMIN_GUARD_LOCK_KEY = 4_200_500_500` defined at line 88 (cited ~88). Single global const, not per-email — the per-email lock (`hashtext(email)`, line 166) is a separate mechanism on a different path. Race-safe single-key claim holds.

### Claim 3 — PATCH /admin/users/:id/role exists, admin-guarded, ADMIN_USERS_ROLES = ['admin'] → VERIFIED (with a precision note)
- `admin-users.controller.ts:122` — `@Patch('users/:id/role')` with `@UseGuards(SessionGuard, RolesGuard) @Roles(...ADMIN_USERS_ROLES)` (lines 123-124). Present + admin-guarded.
- NUANCE (not a defect): `ADMIN_USERS_ROLES` is NOT a hardcoded `['admin']` literal — it is `[...rolesForRoute('/admin/users')]` (line 55), sourced from the shared roleRoutes matrix, with a fail-closed boot guard (line 57-62: throws if []). Verified the matrix resolves to admin-only: `rbac.ts:648-650` `pattern:'/admin/users', allowedRoles:['admin']`. So the effective value IS `['admin']` — the plan's assertion is functionally correct; the value is dynamically sourced + fail-closed, which is stronger than a literal. No broader set leaks in.
- Build note for B-block: the new `POST users/:id/transfer-admin` must reuse `@Roles(...ADMIN_USERS_ROLES)` (same constant) — do NOT hand-write `@Roles('admin')` as the plan's API-contract prose (line 24) loosely suggests, or it drifts from the matrix-sourced pattern. Low severity, flagged for the builder.

### Claim 4 — 'role-change' is a valid auditActionEnum value → VERIFIED
- `packages/shared/src/audit.ts:199` — `'role-change'` is a member of the `z.enum([...])` at line 31. Service already emits `action:'role-change'` (service line 310). ActivityTable already filters/pills it (see claim 5). Transfer + self-demote writing role-change rows is real reuse, not aspirational.

### Claim 5 — UI reuse targets exist and already do change-role + 409 + role-change ingest → VERIFIED
- `apps/web/app/(app)/admin/users/_components/AdminUsersClient.tsx` present. Line 174 PATCH `/admin/users-data/:id/role`; lines 182-184 handle `res.status === 409` with a last-admin message. Change-role + last-admin-409 handling both real.
- `apps/web/app/(app)/admin/activity/_components/ActivityTable.tsx` present. Line 39 `{ value:'role-change', label:'Role Change' }` filter option; line 59 pill styling for `role-change`. View already ingests role-change rows — plan's claim holds.
- The plan's DELTA (distinguish transfer / self-demote / promote / demote via context labels) is genuinely NEW: current `actionLabel` (line 81-83) renders the flat "Role Change" for all. Correctly scoped as new work, not falsely claimed as done.

### Claim 6 — NO schema change; reuses role_id/roles, deactivated_at, audit table → VERIFIED
- `apps/api/src/db/schema/users-roles.ts`: `roleId uuid('role_id')` line 52, `deactivatedAt timestamp('deactivated_at')` line 61, `roles` pgTable line 31. All present.
- No step in the P-3 file-level table touches a schema file or adds a migration; single migrations dir at `apps/api/src/db/migrations` untouched by plan. "No migration → no drizzle-journal risk" holds.

---

## Antipattern watch — findings

### A. "Reuse claim that isn't real" → CLEAN
Every cited function/line does what the plan says. `transferAdminAsActor` + `transferAdminRequestSchema` correctly do NOT exist yet (grep empty) — the plan presents them as NEW B-block work, not as already-shipped. No fabricated-reuse antipattern.

### B. Atomic-transfer ordering soundness → SOUND for the active-target case
Plan's design (single tx: promote target → workspace has ≥2 admins → demote actor is guard-safe → 2 audits last-in-txn) is correct in principle. The guard at line 484-507 holds the advisory lock to commit and counts post-mutation-remaining admins excluding the demoted actor; after the target is promoted, the count sees the target as the surviving admin → demote passes. Atomicity via one `getDb().transaction` is the existing proven pattern (assignRoleAsActor line 261). Reasoning is NOT hand-wavy for an ACTIVE target.

### C. Deactivated-target independent block → UNVERIFIED as a REQUIRED BUILD STEP (this is the one gap)
head-product's flag is CORRECT and load-bearing, not cosmetic:
- The reused promote path (`assignRoleAsActor`, and by extension the planned `transferAdminAsActor`) does NOT check `target.deactivatedAt` before promoting. The field is SELECTed (service line 268) but never gates the promote — the guard only fires on the demote branch (line 288), never on promote.
- `runLastAdminGuard` counts admins `WHERE deactivated_at IS NULL` (line 494). So promoting a DEACTIVATED target to admin produces a *deactivated admin the guard will not count*. In a transfer, the actor then demotes and the guard sees zero remaining ACTIVE admins → the transfer either 409s confusingly (masking the real bug) or, depending on order, risks a workspace whose sole nominal admin is deactivated. Either way the invariant "≥1 ACTIVE admin retained" is not protected by the reused guard alone.
- Spec captures it as an EDGE ("deactivated target rejected", spec line 16) and puts `404 ... deactivated` in the transfer endpoint response contract (plan line 24). But the plan's `transferAdminAsActor` METHOD description (plan line 8) does NOT list a deactivated-target rejection as a build step, and the reused `assignRoleAsActor` provides none. => the check is specified as an OUTCOME but not assigned as an INDEPENDENT build task. That is the exact gap head-product named.

**Severity: High.** Not a blocker for the plan's shape (the endpoint contract already promises the 404), but it MUST be an explicit, tested build step — an independent `target.deactivatedAt IS NULL` guard inside `transferAdminAsActor` BEFORE the promote, returning 404 (per contract). Relying on the last-admin guard to "catch" it is unsound (wrong error, wrong layer, and the guard's null-filter is exactly what makes a deactivated promote invisible).

---

## Conditions carried to B-block (acceptance criteria, must be tested at T-block)

1. **[High]** `transferAdminAsActor` MUST independently reject a deactivated target with 404 (or 400 per final choice) BEFORE promoting — do NOT rely on `runLastAdminGuard`. Add a dedicated test: transfer to a `deactivated_at IS NOT NULL` member → rejected, zero role/audit rows written.
2. **[Low]** New `POST users/:id/transfer-admin` guards via `@Roles(...ADMIN_USERS_ROLES)` (matrix-sourced), not a hand-written `@Roles('admin')`; and its route pattern is added to `roleRoutes` in `rbac.ts` so `rolesForRoute` stays authoritative + fail-closed.
3. **[Med]** Transfer atomicity test must assert BOTH the guard-trip path (would-be 0-active-admin) AND the two-audit-last-in-txn pairing roll back together on audit failure — the plan claims it, T-block must prove it.

## PRODUCT-PRINCIPLES check
No new principle triggered. Rule 1 (spec metrics) N/A. Contract format not being edited. No violation.

---

**APPROVE.** All six load-bearing reuse claims VERIFIED against shipped code; no fabricated-reuse
antipattern. The transfer ordering design is sound for the active-target case. The single real gap —
deactivated-target rejection as an independent, tested build step (not delegated to the last-admin guard) —
is a High-severity B-block acceptance condition, not a plan-shape defect: the endpoint contract already
promises the behavior, the plan just under-assigns the mechanism. Carry conditions 1-3 into B-block.

# Wave 39 — P-2 Spec (pointer)

> Source of truth: `tasks.description` of primary task `69cd8ce4-fb06-4b4a-ace9-1d3ffc828707`
> (fenced YAML head + `---` + prose). This file is a convenience copy of the acceptance criteria.

**wave_type:** multi-spec · **claimed_task_ids:** [69cd8ce4, 9e37eeef] · **design_gap_flag:** false

## Spec 1 — 69cd8ce4 (Admin role transfer + self-demote, race-safe last-admin guard)
- Admin transfers admin to another ACTIVE own-workspace member → target role=admin, ≥1 admin retained.
- Admin self-demotes to a non-admin role → actor role changes, ≥1 admin retained.
- Action leaving 0 admins → 409, no role/audit change (race-safe under concurrency).
- Each success → one immutable hash-chain audit entry (actor/target/before/after/action), last-in-tx.
- Admin-only (403 non-admin); cross-workspace target → 404 (RLS); no cross-tenant leak.
- Atomic — guard trip or DB error leaves no partial role change / dangling audit.
- Contracts: PATCH /admin/users/:id/role (extended); reuse assignRoleAsActor + runLastAdminGuard (advisory-lock); RoleEnum (rbac.ts); audit.ts hash-chain. No schema change. Transfer post-state (≥1 admin) must hold atomically — P-3 picks mechanism.
- Edges: sole-admin self-demote 409; deactivated target rejected; self-target no-op/reject; concurrent last-two demotes serialized; non-admin 403; cross-ws 404; invalid role 400.

## Spec 2 — 9e37eeef (Confirm modal + activity-view surfacing)
- Destructive changes (self-demote, transfer, deactivate) gated by a confirm modal; fires only on confirm; cancel/Esc aborts, no call.
- Modal names the specific consequence; last-admin block surfaced (no succeed-able confirm / 409-in-modal, never silent success).
- Modal a11y per DESIGN-SYSTEM (focus-trap, Esc, role=dialog+aria-modal, return focus).
- Admin activity view lists new role-transfer/self-demote events (actor/target/before/after/ts), read-only, recent-first, own-workspace.
- Contracts: existing admin activity endpoint (task 8bb0a22f) + ActivityTable.tsx render new types; confirm modal = DESIGN-SYSTEM Modal. No schema change.
- Edges: guard trips during confirm → in-modal error; zero events → empty state; non-admin can't reach; stale modal re-validates server-side.

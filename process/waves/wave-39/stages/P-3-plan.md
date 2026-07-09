# Wave 39 — P-3 Plan

## Approach

### Architecture deltas

**admin/user-management (apps/api/src/modules/admin) — NEW atomic transfer path.**
- What changes: add `transferAdminAsActor(newAdminUserId, actorUserId, actorNewRole, actorRole)` to `UserManagementService` — a SINGLE `getDb().transaction` that (1) promotes the target to `admin`, (2) demotes the actor to `actorNewRole`, (3) writes the audit entries last-in-txn. The last-admin guard is satisfied by ordering (promote target → workspace has ≥2 admins → demote actor is safe), and atomicity guarantees no partial state (either both role changes + audit commit, or none).
- Why this over alternatives: (a) *two sequential PATCH calls from the client* — rejected: non-atomic (a crash between calls leaves the actor still admin, or a 2-admin state the founder didn't intend; no single audit unit). (b) *reuse `assignRoleAsActor` twice server-side in one method* — acceptable and chosen as the internal mechanism, wrapped in ONE transaction so the guard + both audits are one atomic unit. Trade-off: one new service method + endpoint vs. leaning on the client to sequence — atomicity + a single reviewable audit pair wins for a privilege mutation.
- Failure-domain: stays within the admin module + one DB transaction; expands no service boundary. The permission check is unchanged (admin-only via existing `@Roles` + `RolesGuard`). RLS tenant scoping unchanged (all queries go through the per-request `getDb()` ALS handle; cross-workspace target → NotFound).

**Self-demote — no new backend.** `assignRoleAsActor(self, non-admin, self, 'admin')` already demotes the actor through `runLastAdminGuard` (blocks sole-admin self-demote with the guard's 409). B-block VERIFIES the existing `PATCH /admin/users/:id/role` accepts `:id == actor` (it is admin-guarded; self-target is a normal target). If a self-target block exists, remove it; otherwise backend is unchanged and only the UI + confirm gate are new.

**admin/users web surface — destructive-action confirm gate + transfer/self-demote controls.**
- What changes: `AdminUsersClient.tsx` gains a "Transfer admin" action (per-member) and a self-role-change (self-demote) control, both routed through a NEW reusable `ConfirmDialog` before firing. New `/admin/users-data/:id/transfer-admin` proxy mirrors the existing `/admin/users-data/*` proxy pattern.
- Why: the members list is already rendered — the transfer target is picked from the existing rows (no separate member-picker page needed; satisfies ceo-reviewer's "need a transfer target" with zero new page). The confirm gate is the compliance-critical safety layer.

**admin/activity — surface new events.** `role-change` is an existing `auditActionEnum`; transfer/self-demote write `role-change` rows, so `ActivityTable.tsx` already ingests them. Delta: add human-readable context labels distinguishing transfer / self-demote / promote / demote from the `from`/`to` payload. Read-path only.

### Data model
No schema change. Reuses `users.role_id` / `roles`, `users.deactivated_at`, the immutable hash-chained audit table, and `ADMIN_GUARD_LOCK_KEY` advisory lock. No migration → no drizzle-journal risk this wave.

### API contracts (concrete)
- `POST /admin/users/:id/transfer-admin` — NEW. `:id` = the member receiving admin. Auth: admin-only (`@UseGuards(SessionGuard, RolesGuard) @Roles('admin')`). Req: `{ actorNewRole: RoleEnum }` (role the stepping-down admin takes; must be non-admin, else 400). Res: `200 { newAdmin, formerAdmin }`; `409` if the transaction would violate the ≥1-admin invariant (defense-in-depth, should not trigger given ordering); `403` non-admin; `404` target outside workspace / not found / deactivated; `400` invalid/admin `actorNewRole` or self-target.
- `PATCH /admin/users/:id/role` — EXISTING, reused for self-demote (`:id == actor`, `role` non-admin). Guard already blocks sole-admin self-demote (409).
- New shared Zod: `transferAdminRequestSchema = z.object({ actorNewRole: roleEnum.refine(r => r !== 'admin') }).strict()` in `packages/shared/src/` (rbac.ts or auth.ts), exported for controller + web.

### New deps
None.

### SDK pre-build checklist
N/A (no external SDK).

## Plan

### File-level steps (grouped by B-stage)

**B-1 Contracts (packages/shared)**
| Path | Op | Change | Specialist |
|---|---|---|---|
| packages/shared/src/rbac.ts (or auth.ts) | modify | add `transferAdminRequestSchema` (`.strict()`, `actorNewRole` non-admin) + type export | backend-developer |

**B-2 Backend (apps/api)**
| Path | Op | Change | Specialist |
|---|---|---|---|
| apps/api/src/modules/admin/user-management.service.ts | modify | add `transferAdminAsActor` (single-tx promote-target + demote-actor + 2 audit entries last-in-txn; reuse guard) | backend-developer |
| apps/api/src/modules/admin/admin-users.controller.ts | modify | add `POST users/:id/transfer-admin` (admin-guarded, Zod body); verify self-target allowed on existing role PATCH | backend-developer |

**B-3 Frontend (apps/web)**
| Path | Op | Change | Specialist |
|---|---|---|---|
| apps/web/app/(app)/admin/users/_components/ConfirmDialog.tsx | create | reusable destructive-action confirm modal — DESIGN-SYSTEM Modal a11y (focus-trap, Esc, role=dialog+aria-modal, return focus); named-consequence + last-admin-block states | nextjs-developer |
| apps/web/app/(app)/admin/users/_components/AdminUsersClient.tsx | modify | add Transfer-admin + self-demote controls, route destructive mutations through ConfirmDialog, call transfer proxy, keep 409 handling | nextjs-developer |
| apps/web/app/(app)/admin/users/_data proxy (mirror existing /admin/users-data/*) | modify/create | add `:id/transfer-admin` proxy route | nextjs-developer |
| apps/web/app/(app)/admin/activity/_components/ActivityTable.tsx | modify | context labels for transfer / self-demote / promote / demote from role-change payload | nextjs-developer |

**B-4 Wiring**
| Path | Op | Change | Specialist |
|---|---|---|---|
| (controller auto-registration + typecheck) | verify | new endpoint registered via existing admin.module; `pnpm typecheck` green | orchestrator/backend-developer |

**B-5 Verify (tests authored with build; run at T-block)**
| Path | Op | Change | Specialist |
|---|---|---|---|
| apps/api/src/modules/admin/*.spec.ts | modify/create | transfer atomicity, last-admin guard on transfer + self-demote, SoD/RBAC matrix (non-admin 403, cross-ws 404, invalid role 400), audit-pair-last-in-txn | backend-developer + security-engineer (review) |
| apps/web admin users/activity component tests | modify/create | confirm-modal fires before destructive mutation; cancel/Esc aborts; transfer flow; activity labels | nextjs-developer |

### Specialist routing (validated against AGENTS.md)
- `backend-developer` ✓ (NestJS/TS service + controller + shared Zod)
- `nextjs-developer` ✓ (Next.js App Router web)
- `security-engineer` ✓ (SoD/RBAC/audit review pair on the privilege-mutation backend — B-6 / T-8)
- `test-automator` ✓ (T-block support if needed)

### Parallelization map
- Serial spine: **B-1 shared contract** → **B-2 backend endpoint** → **B-3 AdminUsersClient wiring** (frontend needs the endpoint + shared type).
- Parallel with the spine: **ConfirmDialog.tsx** (no backend dep) and **ActivityTable.tsx labels** (reads existing role-change payload) run concurrently with B-2.
- B-2 service method + controller: same file-owner (backend-developer), sequential within the agent.

### Self-consistency sweep
1. Every P-2 AC maps to ≥1 step: transfer→B-2 service/controller+B-3; self-demote→existing PATCH+B-3; last-admin 409→B-2 guard reuse+tests; audit→B-2 last-in-txn; admin-only/cross-ws→controller guard+tests; confirm modal→ConfirmDialog+AdminUsersClient; activity surfacing→ActivityTable. ✓
2. Every step has a specialist. ✓
3. No file in multiple parallel batches. ✓
4. `design_gap_flag: false` referenced. ✓
5. Architecture deltas have explicit alternative trade-offs (transfer atomicity: sequential-client vs single-tx). ✓
6. Data + API contracts concrete (no schema change; transfer endpoint fully specified). ✓
7. No new deps. ✓
8. No SDK. ✓
Sweep clean.

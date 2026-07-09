# P-4 Phase-2 — jenny drift review — wave-39 (DealFlow AI)

**Reviewer:** jenny (spec-vs-prior-decision drift auditor)
**Gate:** P-4 Phase-2 — spec + plan drift cross-reference
**Scope under review:** Admin role TRANSFER (promote target + demote acting admin, atomic single-tx) + admin SELF-DEMOTE; race-safe last-admin guard; immutable audit; admin-only; RLS isolation; destructive-action confirm modal + surfacing new events in the admin activity view. Reuses shipped grant-admin/role-assign path. `claimed_task_ids = [69cd8ce4, 9e37eeef]`. Member-CRUD grid deferred (3ebd6610). No schema change.

**Sources cross-referenced:**
- Authoritative spec: `tasks.description` YAML head of `69cd8ce4-fb06-4b4a-ace9-1d3ffc828707` (read live via pg) + task `9e37eeef`.
- Plan: `process/waves/wave-39/stages/P-3-plan.md`
- `command-center/artifacts/user-journey-map.md` (rows 18-20 admin surface; wave-16 admin-activity block)
- `command-center/product/product-decisions.md` (#573-579 self-serve directive; #196-201 SoD; #346-349 admin-oversight view; #331/#336/#340-344 M7 last-admin-guard+SoD contract; M8 RLS entries)
- Shipped code the wave reuses: `apps/api/src/modules/admin/user-management.service.ts` (`assignRoleAsActor`, `runLastAdminGuard`, `ADMIN_GUARD_LOCK_KEY`), `admin-users.controller.ts` (`PATCH /admin/users/:id/role`), `packages/shared/src/rbac.ts` (`roleRoutes`), `packages/shared/src/admin-activity.ts` / `audit.ts` (`role-change` action).

---

# TOP-LINE VERDICT: APPROVE

The spec and plan are **coherent with every prior decision they touch** and extend the shipped grant-admin surface without contradicting it. No CRITICAL or HIGH drift found. Two LOW advisory notes (endpoint-shape divergence rationale + activity-view route naming) are documented for B-block hygiene, neither blocking.

---

## Per-spec-item MATCHES / DRIFTS

### Spec-1 (69cd8ce4) — Admin role transfer + self-demote with race-safe last-admin guard

| # | Spec item (AC / contract / edge) | Verdict | Prior decision cross-ref |
|---|---|---|---|
| 1 | Transfer admin to another ACTIVE member of OWN workspace; post-state ≥1 admin (persisted in `users.role`) | **MATCH** | Extends #574(3)/#579 "transfer/share admin"; reuses shipped `assignRoleAsActor` (`user-management.service.ts:255`). Post-≥1-admin invariant is the #340 M7 last-admin-guard contract. |
| 2 | Admin can SELF-DEMOTE to a non-admin role; post-state ≥1 admin | **MATCH** | #340/#344 last-admin guard "no self-demote below threshold, reusing wave-5 admin-cannot-self-approve precedent (#199-201)". Guard already fires on `demote` path (`assignRoleAsActor:288` → `runLastAdminGuard(...,'demote')`). |
| 3 | Zero-admin transfer/self-demote BLOCKED → **409, no role/audit change persists, race-safe** | **MATCH** | Exactly the shipped `runLastAdminGuard` contract: `pg_advisory_xact_lock(ADMIN_GUARD_LOCK_KEY)` FIRST-in-txn → count remaining active admins → `409 ConflictException` if 0 (`user-management.service.ts:476-508`). Spec's 409 code + race-safety = the wave-16/M7 P-4 LOAD-BEARING guard verbatim. No drift. |
| 4 | Every success appends exactly ONE immutable audit entry (actor, target, before/after role, action), hash-chained, **written last-in-txn**; chain verifiable | **MATCH** | M6/M2 immutable-audit invariant (#133-135 HMAC-SHA256 chain; #147 "append-only audit" crown jewel). Shipped `assignRoleAsActor:306-317` appends `role-change` LAST-IN-TXN via `AuditService.append`. Spec-1 AC "written last-in-transaction; chain stays verifiable" reproduces the WORM invariant. **Note:** transfer = 2 role changes; plan (P-3:8, :46) correctly specifies a single-tx pair of audit entries — consistent with "audit failure rolls back the mutation." |
| 5 | Role mutation admin-only: non-admin → **403**; cross-workspace target → **404 (RLS), no leakage** | **MATCH** | admin-only = `roleRoutes` `'/admin/users' → ['admin']` (`rbac.ts:105-108`), unchanged. 404-via-RLS = M8 tenant guard: shipped `assignRoleAsActor` looks up target with `getDb(this.db)` (RLS-scoped), no explicit workspace filter — a foreign-workspace id returns no row → `NotFoundException` (`:274`). Spec asserts M8 RLS 404 explicitly (AC-5 + edge "Cross-workspace target id: 404 via RLS; no existence oracle"). **This directly satisfies the M8 drift-focus requirement.** |
| 6 | Atomic — on guard trip / DB error, no partial role change, no dangling audit | **MATCH** | `getDb(this.db).transaction(...)` wraps guard + update + audit (`:261`). Plan (P-3:8-9) makes transfer a SINGLE `getDb().transaction` promote→demote→audit unit — the correct atomicity mechanism, explicitly chosen over non-atomic sequential-client PATCH (P-3:9 trade-off named). No drift from the shipped single-tx pattern. |
| E | Edge: sole-admin self-demote → 409 | **MATCH** | = AC-3 guard. |
| E | Edge: transfer target deactivated (`deactivated_at` set) → 400/409 rejected, target must be active | **MATCH** | Consistent with #340 "active-admin count" semantics + shipped guard counting `deactivated_at IS NULL`. Correctly adds an active-target precondition; no contradiction. |
| E | Edge: transfer/assign to self / same-role → rejected or idempotent no-op, never orphans admin | **MATCH** | No prior decision contradicts; preserves the ≥1-admin invariant. |
| E | Edge: concurrent last-two-admin self-demotes → `pg_advisory_xact_lock` serializes, exactly one succeeds | **MATCH** | Verbatim the shipped write-skew rationale (`user-management.service.ts:30-32`, :481-484). |
| E | Edge: non-admin caller 403 before any target DB read | **MATCH** | `RolesGuard` @ `@Roles('admin')` runs before the controller body (`admin-users.controller.ts:124`). Consistent with fail-closed RBAC. |
| E | Edge: invalid role → 400 (Zod) before mutation | **MATCH** | Plan adds `transferAdminRequestSchema` `.strict()` `actorNewRole` non-admin (P-3:26,41); mirrors shipped Zod-validated `PATCH .../role`. |

### Spec-2 (9e37eeef) — Confirm-modal + surface transfer/self-demote in admin activity view

| # | Spec item | Verdict | Prior decision cross-ref |
|---|---|---|---|
| 7 | Destructive changes (self-demote, transfer, deactivate) present a confirm modal; mutation fires ONLY on explicit confirm; cancel/Esc aborts with no API call | **MATCH** | New safety layer; consistent with the compliance-first "deliberate + reviewable destructive privilege changes" posture (#42-48 compliance-first; #574 "role-grant is a privilege-escalation surface"). No prior decision loosened. |
| 8 | Modal names the specific consequence (who gains/loses admin; self-demote removes own access) | **MATCH** | Reinforces compliance-first governance; no conflict. |
| 9 | Last-admin block surfaces the reason in-modal; a server 409 during confirm is shown as an in-modal error, never a silent success | **MATCH** | Aligns confirm UX with the AC-3 409 guard; no silent-success = consistent with WORM/audit-integrity posture. |
| 10 | Modal meets DESIGN-SYSTEM Modal a11y (focus-trap, Esc, role=dialog + aria-modal, focus return) | **MATCH** | Design-system Modal pattern (#68-72; DESIGN-SYSTEM §10). Plan routes it through a new reusable `ConfirmDialog` (P-3:52). |
| 11 | Admin activity view lists new role-transfer + self-demote audit events (actor, target, before/after, timestamp), read-only, most-recent-first, workspace-scoped | **MATCH** | Extends the wave-16 admin-activity oversight view (#346-349; journey-map "Admin activity view (M7 wave-16)"). `role-change` is an existing `auditActionEnum` (`audit.ts:199`) already ingested by the shipped activity endpoint — surfacing = rendering new context labels only. Read-only + workspace-scoped preserves the oversight-view contract (writes 0 rows). |
| E | Edge: server guard trips during confirm (race after modal open) → error in-modal, no silent success | **MATCH** | = AC-9; re-validates server-side. |
| E | Edge: zero-event empty state consistent with existing table; non-admin cannot reach view/controls | **MATCH** | Preserves shipped admin-activity RBAC (`'/admin/activity' → ['admin']`, `rbac.ts:125-128`). |

---

## Drift-focus checklist (explicitly required by the gate)

1. **wave-37 grant-admin contract (endpoint shape, last-admin guard, audit, 409):** **CONSISTENT.**
   - grant-admin/promote shipped as `assignRoleAsActor(target,'admin',...)` over the existing **`PATCH /admin/users/:id/role`** — there is NO separate promote endpoint in the codebase (verified: no `transfer-admin`/`promote` endpoint exists today).
   - The transfer/self-demote wave keeps the SAME guard (`runLastAdminGuard`), SAME 409 `ConflictException`, SAME last-in-txn `role-change` audit. Self-demote reuses `PATCH .../role` verbatim (P-3:12,25).
   - **LOW advisory (not drift):** the plan introduces a NEW `POST /admin/users/:id/transfer-admin` endpoint (P-3:24) rather than expressing transfer as two `PATCH .../role` calls. This is a *deliberate, well-justified* divergence — atomicity of the two-actor mutation requires a single-tx two-actor endpoint, and the plan names the rejected sequential-PATCH alternative (P-3:9). It ADDS a sibling endpoint to the same admin-guarded surface; it does not alter or contradict the shipped `PATCH .../role` contract. Endpoint-shape divergence is a consequence of the atomicity invariant, not a contract break. No conflicting prior decision. Flagged only so B-block keeps the new endpoint's guard/Zod/audit identical to the reused path.

2. **wave-36 admin read-oversight RBAC matrix (role-mutation stays admin-only, no non-admin write):** **NOT LOOSENED.**
   - wave-36 (`rbac.ts:83-92,234-244,307-351`) added admin to READ routes only (`/sourcing`, `/pipeline` GET, event timeline); write actions (`POST /pipeline` enroll `:322`, notes `:345`) explicitly keep **admin DENIED**.
   - This wave touches ONLY `/admin/users` (already `['admin']`, `:105-108`) and the read-only `/admin/activity`. It grants no new mutation right to any non-admin role and does not touch the sourcing/pipeline matrix. The RBAC/SoD matrix is preserved unchanged.

3. **M6 separation-of-duties + immutable audit invariants:** **PRESERVED.**
   - SoD precedent (#199-201: admin cannot self-approve a send; #340: no self-demote below threshold) is respected — the last-admin guard *is* the SoD-style structural control here (an admin cannot unilaterally orphan the workspace). Every transfer/self-demote appends exactly one (transfer: paired) immutable `role-change` entry last-in-txn to the M2 HMAC-SHA256 hash-chain; the WORM append-only invariant (#133-135, #147) is untouched (no schema change, no chain-format change).

4. **M8 RLS tenant isolation (cross-workspace mutation impossible → 404):** **ASSERTED IN SPEC.**
   - Spec-1 AC-5 + edge-case explicitly require cross-workspace target → 404 via RLS, "no existence oracle," "no cross-tenant leakage." This matches the shipped `getDb`/FORCE-RLS tenant guard the reused `assignRoleAsActor` already runs through. The spec correctly relies on RLS (not app-level workspace filtering) as the load-bearing guard, consistent with every M8/M10 RLS decision. No drift.

5. **Confirm-modal + activity-surfacing vs compliance-first oversight posture:** **CONSISTENT.** Both reinforce the "deliberate + reviewable destructive privilege change" posture (#42-48, #574). The activity surfacing extends, not alters, the wave-16 read-only oversight view (#346-349).

6. **Journey-map coherence (admin/users + admin/activity flows):** **COHERENT, no dead-end.**
   - Journey-map row 19 (`/admin/users`, F14 Manage users & roles) + the wave-16 admin-activity block are the exact surfaces this wave extends. Transfer/self-demote controls live on the already-rendered members list (transfer target picked from existing rows — no orphan picker page, P-3:16), and new events surface in the existing activity table. The flow fits F14 without introducing a dead-end.
   - **LOW advisory (journey-map hygiene, not drift):** the plan references the activity surface as `admin/activity/_components/ActivityTable.tsx` (P-3:18,55) and the journey-map/product-decisions name the route `/admin/activity` (wave-16). Spec-2's contract says "the existing admin activity endpoint" (`GET /admin/activity-data`) with no new endpoint. Consistent. B-block should confirm the ActivityTable it edits is the one backing `/admin/activity` (not a stray duplicate) — a one-line verification, not a drift.

---

## Scope-boundary confirmation
- Member-CRUD grid (change ANY role, bulk deactivate/reactivate) correctly DEFERRED (3ebd6610; matches #579 "Full member-management CRUD UI" as a SEPARATE sibling, not this seed's scope). **Note:** P-3 header text mentions the member-CRUD sibling in reuse prose (P-3:15 "members list is already rendered") but the two claimed tasks are transfer/self-demote (69cd8ce4) + confirm-modal/activity (9e37eeef) — the CRUD grid is out of the claimed set. No scope creep into the deferred grid.
- DKIM/SPF/DMARC sending-domain verification correctly excluded (#331(1), #579; credential-gated).
- No schema change asserted and consistent (reuses `users.role`, `deactivated_at`, `audit_log_entries`).

---

## Recommendations for B-block (non-blocking)
1. The new `POST .../transfer-admin` endpoint MUST carry the identical `@UseGuards(SessionGuard, RolesGuard) @Roles('admin')` + Zod-strict body + last-in-txn audit as the reused `PATCH .../role` — do not fork the guard/audit discipline (@security-engineer review pair per P-3:71).
2. Transfer's paired audit entries: confirm the single-tx writes exactly TWO `role-change` rows (promote-target + demote-actor) and the chain still `verifyChain ok:true` after — assert in the B-5 spec (P-3:65).
3. B-block confirm the edited `ActivityTable.tsx` is the one serving `/admin/activity` (`GET /admin/activity-data`), per LOW advisory 6.

---

## Collaboration
- @security-engineer: verify the new transfer endpoint's SoD/RBAC/audit parity at B-6 / T-8 (privilege-escalation surface).
- @task-completion-validator: at V-block, confirm the last-admin guard + cross-workspace 404 are black-box-proven live (per #344 "last-admin guard + SoD must be black-box-proven live").

**Gate result: APPROVE** — spec + plan match all prior decisions; the two LOW advisories are B-block hygiene, not contract drift.

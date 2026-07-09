# Wave 39 — P-4 Verdict

**Reviewer:** head-product (fresh spawn, agentId head-product-w39-p4)
**Reviewed against:** process/waves/wave-39/blocks/P/review-artifacts.md
**Attempt:** 1  (1 = first gate, 2+ = post-rework)
**Phase:** 1 (head-product)

## Verdict
APPROVED

## Rationale
This wave ships exactly the founder's outstanding ask — let an admin hand off admin to a teammate and step themselves down — and it does so as a tight, well-guarded slice rather than a bloated grid. Every safety rule that matters for a compliance-first product is written as a checkable pass/fail, not a hope: you can never end up with zero admins (the app blocks it, even if two people try at once), the change and the audit record either both save or neither does, only admins can do it, and one workspace can never touch another's people. I verified the two claims the whole plan leans on directly in the shipped code — stepping yourself down already routes through the "keep at least one admin" guard, and that guard is genuinely race-proof — so the "no new backend for self-demote" and "transfer is one atomic step" decisions are correct, not assumed. The scope trim (defer the full member grid, keep the confirm-before-a-destructive-change dialog) is the right call: the dialog is the safety net on an irreversible privilege drop and must stay; the grid is genuinely beyond this slice. Approved to Phase 2, with named conditions for the security and compliance reviewers to confirm against the deployed behavior.

## Checklist resolution (P-4 stage-exit + cross-stage traceability)

**Falsifiable / observable acceptance criteria — PASS.** Each security invariant is a binary, externally observable contract: last-admin guard → `409` + zero persisted role/audit change (race-safe, proven by `pg_advisory_xact_lock(ADMIN_GUARD_LOCK_KEY)` as the first tx statement, verified at `user-management.service.ts:484`); atomic transfer → no partial role/audit on guard-trip or DB error (single `getDb().transaction`); admin-only → `403` non-admin; cross-workspace → `404` via RLS with no existence oracle; one immutable hash-chain audit entry per mutation, last-in-txn. All testable as written.

**SoD / RBAC / audit-log completeness — PASS (security-scope-tightened gate applies; wave mutates user roles/auth).** Negative RBAC constraints are explicit: non-admin `403` *before* any target DB read; cross-workspace `404`; invalid role `400` (Zod) before mutation; self-target and deactivated-target rejection paths named. Audit AC mandates actor/target/before/after/action, hash-chain-verifiable, last-in-txn — matching the shipped `assignRoleAsActor` Step 6 (`user-management.service.ts:306-317`) and, per the plan, both mutations of the transfer as one atomic audit unit. Tamper-evidence is inherited from the shipped immutable hash-chain (audit failure rolls back the role change).

**Scope discipline (mvp-thin soundness) — PASS.** Deferring the full member-CRUD grid (3ebd6610) does not cut anything mvp-critical: transfer picks its target from the already-rendered members list, so ceo-reviewer's "no transfer target" objection is satisfied with zero new surface. The confirm modal (9e37eeef) is correctly retained as safety-critical — splitting it out would leave a one-click, un-guarded privilege drop, an over-cut boundary the P-0 mediation correctly avoided. No scope smuggle: every claimed_task_id (69cd8ce4, 9e37eeef) traces to the founder's wave-37 admin-role ask (product-decisions entry 573).

**Plan quality — PASS.** The atomic-transfer approach (single-tx promote-target → demote-actor → audit-pair last-in-txn) provably preserves the ≥1-admin invariant: promoting the target first makes the demote-actor step's guard observe ≥1 remaining admin, and xact-scoped locking prevents any concurrent 0-admin window. The "self-demote reuses existing PATCH, no new backend" claim is **verified sound in code**: `assignRoleAsActor` runs the guard on *any* admin→non-admin transition (`user-management.service.ts:288`), and the guard counts admins EXCLUDING the mutated user (`:495`), so a sole-admin self-target yields `remaining==0 → 409`. Migrations-before-API ordering is moot (no schema change). Specialist routing (backend-developer, nextjs-developer, security-engineer review pair) is correct; UI state work is on the Next.js specialist, not the backend builder.

**No anti-patterns fired.** No Framework Theater (grounded in a real founder ask + shipped invariant), no Compliance Vibe-Check (all compliance ACs binary), no Implementation Leakage (ACs are external behaviors/status codes; P-3 owns mechanism), no Orphaned Edge Case (unhappy paths — sole-admin, deactivated target, concurrent last-two demotes, non-admin, cross-ws, invalid role, in-modal 409, empty activity state — all enumerated), no Unverifiable Logs (reuses immutable hash-chain), no RBAC Assumption (negative matrix explicit).

## Conditions for Phase 2 (karen / jenny / gemini to verify)

These are the highest-leverage claims the Phase-1 review flagged as load-bearing; Phase-2 reviewers must confirm them against actual code/journey-map, not accept the plan's assertion:

1. **`transferAdminAsActor` must reuse the guarded demote path inside the single tx** — the actor-demote leg of the transfer must go through `runLastAdminGuard` (or an equivalent inline guard acquiring `ADMIN_GUARD_LOCK_KEY` first), so the defense-in-depth `409` and the race-lock hold even though ordering makes the guard-trip unreachable on the happy path. Do NOT let the transfer bypass the guard on the assumption "promote-first makes it safe." (karen: verify in the implemented service method at B-block; at P-4 this is a spec/plan intent check.)

2. **Verify the existing `PATCH /admin/users/:id/role` accepts `:id == actor`** with no self-target block, and if a self-target block exists, remove it — the self-demote AC depends entirely on the existing endpoint accepting a self-target. (karen: confirm no guard/decorator rejects self-target on the controller.)

3. **Transfer of admin to a DEACTIVATED target must be rejected** (`400`/`409`) — the spec names it as an edge; confirm the transfer path re-checks `deactivated_at IS NULL` on the promotion target (the shipped guard only counts active admins on the demote side; promotion of a deactivated user to admin must be independently blocked, else a transfer could hand admin to an inactive account).

4. **jenny drift check** — confirm the transfer endpoint and the confirm-modal/activity surfacing do not contradict any prior product-decision (esp. the wave-37 grant-admin contract and the admin read-oversight RBAC matrix from wave-36); the new `role-change` audit rows must render in the existing ActivityTable without a schema change, as claimed.

## Footer
- verdict_complete: true
- rework_attempt_cap_remaining: 3

---

## Phase 2 — Karen + jenny + Gemini (merged)

**Phase 2 verdict: PASS** (Karen APPROVE + jenny APPROVE; Gemini UNAVAILABLE → degraded, non-blocking).

| Reviewer | Verdict | Notes |
|---|---|---|
| Karen | APPROVE | All 6 reuse claims VERIFIED against shipped code (guard line 288/495, advisory lock 484, PATCH admin-only, role-change audit enum, UI targets, no schema change). Atomic-transfer ordering SOUND for active target. |
| jenny | APPROVE | No CRITICAL/HIGH drift. Consistent with wave-37 grant-admin contract, wave-36 read-oversight RBAC matrix (not loosened), M6 SoD + immutable audit preserved, M8 RLS 404 asserted. Journey coherent (F14). |
| Gemini | UNAVAILABLE | Helper exit=3, HTTP 429 (prepayment credits depleted). Degraded per gate rules — does not block; gate proceeds on Karen + jenny. |

### B-block acceptance conditions (from head-product + Karen; tested at T-block)
1. **[High]** `transferAdminAsActor` MUST independently reject a deactivated target (404) BEFORE promote — NOT via `runLastAdminGuard` (the guard counts only active admins on the demote side; promoting a deactivated account creates an admin the guard can't see). Dedicated test required.
2. **[Med]** Atomicity test: guard-trip AND two-audit-last-in-txn roll back together on audit failure (single transaction).
3. **[Low]** New `POST /admin/users/:id/transfer-admin` uses `@Roles(...ADMIN_USERS_ROLES)` (matrix-sourced) and registers its pattern in `roleRoutes` (rbac.ts); identical guard/Zod/audit as the reused role path.
4. **[Low]** Confirm the edited `ActivityTable.tsx` is the one backing `/admin/activity` (`GET /admin/activity-data`), not a duplicate.

### Gate result
Phase 1 APPROVED + Phase 2 PASS → **P-block gate-passed**. design_gap_flag=false → next block = B-0. Spec contract lives in task 69cd8ce4 `description` (YAML head). The 4 conditions above are B-block build requirements, carried in the manifest.

- verdict_complete: true
- rework_attempt_cap_remaining: 3

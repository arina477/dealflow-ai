# Wave 29 — V-1 jenny (spec-vs-deliverable verification)

**Stage:** V-1 · **Reviewer:** jenny (fresh spawn) · **Wave:** M10 records-VIEW deal-activity browse (light) · **Branch:** `wave-29-records-view`
**Spec source of truth:** seed `d573e7bf` (DB `tasks.description`, the P-2 SCOPE) + P-3-plan.md. Verified line-by-line against the actual shipped source (repository/service/controller/shared/UI), NOT the B-6 gate summary.

---

## VERDICT: APPROVE

**Tally: 6 MATCHES / 0 DRIFTS.**

---

## Per-check findings (each verified in source)

### 1. REUSE-not-rebuild — MATCH
- `findDealRowsPaginated` (`recordkeeping.repository.ts:467-542`) reuses the *identical* `FROM pipeline LEFT JOIN mandates ON mandates.id = pipeline.mandate_id` RLS join + column projection as `findDealRowsBounded`. Deltas are browse-shaped and justified (documented repository.ts:449-466): `getDb` not `tx`, `ORDER BY ... DESC`, `LIMIT/OFFSET` not `EXPORT_ROW_CAP`, added `deal_source_type` filter, returns `{rows,total}`. A genuine paginated *variant* of the export join — not a divergent second query surface.
- UI: `DealActivityTable.tsx` is a thin sibling that mirrors `AuditLogTable`'s shell/tokens/filter-bar/pagination. Consistent with the wave-27 duplicate-surface lesson — no parallel browse surface; the deal-activity path plugs into the *existing* `/compliance/audit-log` page via `RecordsPanel` + `ScopeToggle`. The thin-table-vs-parametric deviation is the correct pragmatic call (AuditLogTable is coupled to audit hash-chain columns; forcing parametric reuse would be premature abstraction).

### 2. Workspace-RLS-scoped + READ-ONLY (WORM-preserving) — MATCH
- Read runs via `const db = getDb(this.db)` (repository.ts:521) — RLS-scoped, NOT a raw/admin/superuser path. Both the browse SELECT and the pagination `COUNT(*)` (repository.ts:515-519) run over the same RLS-scoped handle, so the total cannot leak a cross-tenant count. SEC-10 comment confirms JOIN only over RLS-covered tenant tables (pipeline, mandates). Consistent with M8 isolation posture.
- `listDealActivityAsActor` (`recordkeeping.service.ts:219-247`) emits ZERO `AuditService.append` — documented READ-ONLY invariant mirroring `listAsActor`. No mutation/insert/delete anywhere in the browse chain; `findDealRowsPaginated` is pure SELECT.
- UI has NO mutation affordance: every `<button>` in `DealActivityTable.tsx` is Reset / Apply / Prev / Next (filter + pagination only). No edit/delete/purge/export control. Consistent with the export/retention read-only WORM-preserving posture and the seed's "any mutation affordance is a spec violation" line.

### 3. RBAC compliance/admin (compliance records lens, advisor DENIED) — MATCH
- Route `/compliance/records/deal-activity` = `['compliance','admin']` in the single-source `roleRoutes` (`rbac.ts:488-489`); advisor/analyst absent. Mirrors the export deal-scope precedent (`EXPORT_ALLOWED_ROLES`), NOT the `/pipeline` advisor lens.
- Boot-fail-closed: `DEAL_ACTIVITY_ROLES = [...rolesForRoute('/compliance/records/deal-activity')]` with a non-empty assertion that throws "Refusing to boot" on RBAC drift (`recordkeeping.controller.ts:132-138`); controller gated `@Roles(...DEAL_ACTIVITY_ROLES)` (controller.ts:290).
- Defence-in-depth: service ALSO re-checks `EXPORT_ALLOWED_ROLES.has(actor.roleName)` → `ForbiddenException` (service.ts:229-231). Correct compliance-lens split preserved: advisor CAN see `/compliance/audit-log` but is DENIED deal-activity (UI double-gates via `canSeeDealActivity`).

### 4. LIGHT posture (clean browse, unification descoped) — MATCH
- Consistent with the founder 2026-07-07 "keep it light" decision. **Note (not a drift):** the seed `d573e7bf` body prose sketches a "unified firm-admin Records page tying BOTH record types under one browse+filter UX." The P-2 SCOPE head and P-3 plan explicitly **DESCOPE unification** ("UNIFICATION descoped"; "the deal-activity BROWSE half only"). The shipped deliverable correctly lands the *descoped* form — a deal-activity scope/tab reusing `AuditLogTable` on the existing `/compliance/audit-log` page — NOT a new unified `/compliance/records` page. This resolves the intra-seed tension in favour of the authoritative P-2/P-3 scope (light, no over-build). No new page, no redesign, no speculative generality.

### 5. Last M10 light vertical / bundle order / no scope-creep — MATCH
- Bundle order honoured (product-decisions 2026-07-08 + 2026-07-07): (1) EXPORTS shipped wave-27, (2) RETENTION shipped wave-28, (3) records-VIEW = THIS wave. This is the 3rd/last of M10's 3 light verticals.
- No scope-creep: NO new migration (reuses existing pipeline+mandates RLS tables — B-0 SKIP correct); NO purge/delete/mutation; NO export path added (the `exportDeal*` symbols in service.ts:415-492 are the pre-existing wave-27 export vertical, untouched and correctly separate from the browse path); NO analytics; NO LLM/email. Page-size capped at `DEAL_ACTIVITY_BROWSE_MAX_LIMIT=50` via `.strict()` schema (recordkeeping.ts:233,248-272), never `EXPORT_ROW_CAP`; `.strict()` rejects client `workspace_id`/`firmId` (SEC-2). Formal attestation/named-regime (SOX/FINRA) correctly remains DEFERRED per LIGHT posture.

### 6. M10 light metric + M10→M11 transition — MATCH
- The M10 light success metric "retained records viewable in-app" is met by the shipped audit-log browse + this deal-activity browse (the two-scope "retained records" model = audit-log + deal/pipeline activity, same as the export vertical). This wave closes the deal/pipeline half — the metric is now satisfied across both record types.
- Spec-gap for the N-block transition (informational, not blocking V-1): after this vertical M10's 3 light verticals are DONE and M10's ## Scope is shipped → N-1 should detect M10 closure and dispose it (todo→... / close), and either promote the next milestone or fire the roadmap-planning ritual. M9 remains `blocked` with a `_TBD` success-metric (carried since wave-18) — the N-block milestone-disposition should surface the M9 `_TBD` + the M9-vs-M11 next-slot call to the BOARD/founder rather than mechanically promoting. Flag for head-next at N-1; no V-block action.

---

## Cross-checks
- No spec/principles/project.yaml conflict. Compliance-first posture (audit WORM untouched, RLS the load-bearing tenant guard) upheld.
- B-6 gate verdict claims independently re-verified in source at V-1 — every file:line the gate cited was confirmed accurate; no done-theater, no spec-vs-code drift.

**Recommendation:** proceed. If any residual doubt on runtime behaviour, @task-completion-validator can confirm the DB-gated RLS-isolation e2e (DA-ISO-1/2, skip-guarded locally) runs green against real Postgres in CI/C-block — but the test code is fault-killing by inspection (`SET ROLE dealflow_app`, bidirectional zero-leak).

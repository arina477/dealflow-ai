# Wave 29 — B-6 Review gate verdict (Phase 1)

**Block:** B (Build) · **Stage:** B-6 Review · **Wave topic:** M10 records-VIEW deal-activity browse (paginated RLS-scoped READ-ONLY deal/pipeline browse — API + scope-tab UI on `/compliance/audit-log`) · **Branch:** `wave-29-records-view` · **Gate author:** head-builder (fresh spawn)

Verdict issued against the actual shipped code (not the deliverable summaries). Every binding obligation was read line-by-line in the source and cross-checked against the e2e test harness, RBAC matrix, and the frontend gating path.

---

## Binding-obligation verification (EACH verified in code)

### 1. RLS-browse-isolation (CRUX — cross-tenant leak) — PASS
- `findDealRowsPaginated` (`recordkeeping.repository.ts:467-542`) reads via `const db = getDb(this.db)` (repository.ts:521) — the RLS-scoped connection, **NOT** a raw/admin/superuser path. It reuses the *identical* `pipeline LEFT JOIN mandates` projection as `findDealRowsBounded` (both are RLS-covered tenant tables; SEC-10 comment at :492-494). No `read_*_rls_exempt` helper anywhere in the browse path.
- `SELECT COUNT(*)` for the total (repository.ts:515-519) runs over the SAME RLS-scoped `db` handle → the pagination total cannot leak a cross-tenant count.
- **Fault-killing test confirmed genuine:** `runBrowseInAls` (test:284-330) issues `SET ROLE dealflow_app` (test:287) — explicitly NOT `postgres` (the FORCE-RLS-bypass false-green trap; called out at test:286). DA-ISO-1 (test:512-527) asserts firm A browse contains ZERO firm B pipeline IDs AND firm A's own rows are present; DA-ISO-2 (test:531-545) proves the reverse (firm B sees zero firm A rows). Bidirectional negative+positive — a real RLS regression would fail this. The harness reuses the recordkeeping-export-isolation pattern (workspaceAls + GUC + real repo, only auth/verifier/audit mocked).

### 2. READ-ONLY (WORM) — PASS
- `listDealActivityAsActor` (`recordkeeping.service.ts:219-246`) emits ZERO `AuditService.append`. It only awaits `repository.findDealRowsPaginated` and returns `{rows, total, limit, offset}`. No mutation/deletion/insert path exists in the browse chain.
- `findDealRowsPaginated` is pure SELECT (browse + count) — no `tx`, no `INSERT`, documented READ-ONLY at repository.ts:465.
- DA-RO-1 (test:588-608) counts `audit_log_entries` before/after the browse and asserts the count is unchanged — genuinely proves no audit row is written on a browse.
- **UI READ-ONLY confirmed:** `DealActivityTable.tsx` has no edit/delete/send/compose/email/AI/export affordance. Rows are display-only (`<td>` cells + a source-type pill); the only interactive controls are filter inputs, Apply/Reset, and Prev/Next pagination. RecordsPanel documents "no mutation control in either table view" (RecordsPanel.tsx:18).

### 3. PAGINATED-not-export-cap (problem-framer catch) — PASS
- `findDealRowsPaginated` uses `LIMIT ${filter.limit} OFFSET ${filter.offset}` (repository.ts:511-512) — **NOT** `EXPORT_ROW_CAP` (50 000). The 50k cap is confined to the export methods (`findForExportBounded`, `findDealRowsBounded`); the browse path never references it.
- Schema (`dealActivityBrowseFilterSchema`, shared/recordkeeping.ts:248-272) caps `limit` at `DEAL_ACTIVITY_BROWSE_MAX_LIMIT = 50` (`.max(50)`), default 25. `.coerce.number().int().positive()`. DA-PAGE-2 (test:349-359) proves `limit=51` → parse failure, `limit=50` and `limit=1` valid.
- UI paginates at `PAGE_SIZE = 25` (DealActivityTable.tsx:51). No 50k unbounded load is reachable via the browse API or UI.

### 4. RBAC — PASS
- Route `/compliance/records/deal-activity` = `['compliance', 'admin']` in the single-source-of-truth matrix (`rbac.ts:488-489`). Advisor and analyst are absent.
- Boot-fail-closed: `DEAL_ACTIVITY_ROLES = [...rolesForRoute('/compliance/records/deal-activity')]` with a non-empty assertion that throws "Refusing to boot" on drift (`recordkeeping.controller.ts:132-138`). Controller gates `@Roles(...DEAL_ACTIVITY_ROLES)` (controller.ts:290).
- Defence-in-depth: the service ALSO re-checks `EXPORT_ALLOWED_ROLES.has(actor.roleName)` → `ForbiddenException` (service.ts:229-231). DA-RBAC-3/4 (test:570-584) prove advisor/analyst → 403; DA-RBAC-5 (test:338-347) proves the route resolves to exactly `{compliance, admin}` and excludes advisor/analyst.
- **The correct compliance lens is preserved:** advisor CAN see `/compliance/audit-log` (rbac.ts:453-455, `['compliance','admin','advisor']`) but CANNOT see deal-activity. The UI enforces this cleanly — see obligation 4 below.
- `.strict()` on the filter schema rejects a client-supplied `workspace_id`/`firmId` → 400 (SEC-2); DA-PAGE-4 (test:361-371) proves it. Workspace is server-resolved via getDb/ALS, never a client param.

### 5. REUSE-not-rebuild — PASS
- `findDealRowsPaginated` reuses `findDealRowsBounded`'s exact `pipeline LEFT JOIN mandates` RLS join and column projection; the only deltas are browse-shaped and justified (getDb-not-tx, DESC-not-ASC, LIMIT/OFFSET-not-cap, added `type` filter, returns `{rows,total}`). Documented at repository.ts:449-466. A genuine extension of the recordkeeping surface, not a divergent second query surface.
- `DealActivityTable` mirrors `AuditLogTable`'s shell/tokens/filter-bar/pagination/empty-state exactly (zinc/emerald palette, 4px grid, focus rings, no new tokens). The thin-table-vs-parametric-reuse deviation is justified: `AuditLogTable` is tightly coupled to audit hash-chain columns (sequenceNumber/prevHash/entryHash), so a thin sibling table that reuses the pattern/tokens is the correct call — not premature parametric abstraction (code-quality-pragmatist heuristic satisfied). D-SKIP is satisfied (design reused, not rebuilt).
- End-to-end wiring verified: the `/compliance/records-deal-activity-data` → `/compliance/records/deal-activity` proxy rewrite exists in `next.config.ts:586-587` (afterFiles, page-collision-safe), so client-side filter/paginate refetch resolves correctly.
- **Frontend double-gate confirmed:** `canSeeDealActivity = role === 'compliance' || role === 'admin'` resolved server-side (page.tsx:225); advisor's deal-activity SSR fetch is skipped entirely (page.tsx:234-236, `Promise.resolve({rows:[],total:0})`); the tab is conditionally rendered (`{canSeeDealActivity && ...}`, ScopeToggle.tsx:68); and the table branch itself re-requires `canSeeDealActivity` (`activeScope === 'audit' || !canSeeDealActivity ? AuditLogTable : DealActivityTable`, RecordsPanel.tsx:67) so an advisor can never reach DealActivityTable even if scope state were forced.

### 6. No migration + greens — PASS (independently re-verified by the gate)
- **No migration:** `git diff --stat main...HEAD` contains no migration/drizzle/.sql file. The feature reuses existing `pipeline` + `mandates` RLS tables — zero schema change (correctly, B-0 schema SKIP).
- **typecheck 4/4** — re-ran `pnpm -w typecheck` → "4 successful, 4 total".
- **lint exit 0** — re-ran `pnpm -w lint` → 3 tasks successful, exit 0 (17 warnings / 5 infos are pre-existing, non-blocking).
- **deal-activity e2e 14/14** — re-ran the suite → "Tests 14 passed (14)". The 4 no-DB schema/RBAC tests (DA-RBAC-5, DA-PAGE-2/3/4) execute for real; the 10 DB-gated tests (DA-ISO-1/2, DA-RBAC-1..4, DA-RO-1, DA-PAGE-1/5, DA-ORDER) are skip-guarded locally (`TEST_DATABASE_URL` unset) — **standard local posture; the RLS-isolation crux is exercised against a real Postgres in CI (B-5/C-block).** The test code is fault-killing by inspection.
- api 1017 / web 989 unit-suite totals are carried from B-5 (not re-run in full at this gate); the wave-topic suite that matters for the binding obligations was re-run green here.

---

## Anti-pattern scan (B-block failure modes) — none present
- Silent Audit Bypass: N/A — this is a browse with no mutation; READ-ONLY is the correct posture and DA-RO-1 proves zero audit writes.
- Hollow AI Test Suite: assertions are semantic (bidirectional zero-leak, audit-count-unchanged, disjoint-pages, total≠page-count, DESC-order) — not coverage theater.
- Direct Provider SDK Coupling / Unbounded LLM Trust: N/A — no Anthropic/Resend/LLM/email in this path (hard boundary held).
- Client-Side Authorization Trust: NOT present — UI gating is UX; the backend controller (RolesGuard + boot-fail-closed DEAL_ACTIVITY_ROLES) AND the service (EXPORT_ALLOWED_ROLES re-check) are the real boundary.
- Over-Engineered / Premature Abstraction: avoided — thin sibling table is the pragmatic choice; no speculative generality introduced.

---

```yaml
head_signoff:
  verdict: APPROVED
  stage: B-6
  reviewers: {}   # Phase-1 gate — head-builder direct verification; no specialist re-delegation required (all obligations tickable from concrete artifacts)
  failed_checks: []
  rationale: >
    All six binding obligations verified line-by-line in the actual shipped code, not the deliverable
    summaries. RLS-browse-isolation is genuine and fault-killing: findDealRowsPaginated reads via getDb
    (RLS-scoped, reuses findDealRowsBounded's pipeline LEFT JOIN mandates), and DA-ISO-1/2 run as
    SET ROLE dealflow_app (NOT postgres — the false-green trap is explicitly avoided) proving firm A
    browse = zero firm B rows bidirectionally. READ-ONLY holds: listDealActivityAsActor emits no
    AuditService.append (DA-RO-1 proves audit-count unchanged) and the UI has no edit/delete/export/
    mutation affordance. PAGINATED-not-export-cap holds: LIMIT/OFFSET bounded at 50 by the .strict
    schema (DA-PAGE-2), never EXPORT_ROW_CAP; UI paginates 25/page. RBAC is correct and boot-fail-closed:
    deal-activity = [compliance, admin] with a non-empty DEAL_ACTIVITY_ROLES boot assertion, service-layer
    re-check, and .strict rejecting client workspace_id — advisor (who CAN see the audit-log page) is
    denied deal-activity in both the API (DA-RBAC-3) and the double-gated UI (SSR fetch skipped + tab hidden
    + table branch re-guarded). REUSE-not-rebuild is a genuine extension: the repository reuses the export
    RLS join; DealActivityTable mirrors AuditLogTable's shell/tokens (thin-table deviation justified by
    audit-column coupling), and the next.config proxy rewrite wires the client refetch end-to-end. No
    migration (reuses existing pipeline+mandates RLS tables). Greens independently re-verified at the gate:
    typecheck 4/4, lint exit 0, deal-activity e2e 14/14 (DB-gated isolation tests skip-guarded locally per
    standard posture; exercised against real Postgres in CI). No compliance-audit bypass, no cross-tenant
    leak, no unbounded load, no advisor deal-activity exposure. Clean pass.
  next_action: PROCEED_TO_C-1
```

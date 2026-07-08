# V-1 Karen — Wave 29 (M10 records-VIEW: deal-activity browse)

**Verdict: APPROVE**
**Findings: 0 blocking (0 critical, 0 high, 0 medium, 0 low)**
**Deployed state verified: LIVE @ `8526999` (api + web)**
**Independent /health confirmation: YES — 200 `{status:ok,db:ok,version:8526999...}`**

---

## Scope
Security-adjacent product-feature: read-only, RLS-scoped, RBAC-gated paginated
browse of deal/pipeline activity. "Deployed state" = commit `8526999`
(HEAD is `30f4ddc`, a `[skip ci]` T-deliverables commit that does NOT change
shipped code — deployed hash remains `8526999`, confirmed against live `/health`).

## 1. REAL — all claimed artifacts exist on `8526999`
- API repo: `apps/api/src/modules/recordkeeping/recordkeeping.repository.ts:467` `findDealRowsPaginated`
- API service: `apps/api/src/modules/recordkeeping/recordkeeping.service.ts:219` `listDealActivityAsActor`
- API controller: `recordkeeping.controller.ts:288` `@Get('records/deal-activity')`
- Shared schema: `packages/shared/src/recordkeeping.ts:248` `dealActivityBrowseFilterSchema` (+ `DEAL_ACTIVITY_BROWSE_MAX_LIMIT=50`)
- E2E: `apps/api/test/recordkeeping-deal-activity-isolation.e2e-spec.ts` (14 `it()` blocks — DA-ISO/RBAC/RO/PAGE)
- Web: `ScopeToggle.tsx`, `RecordsPanel.tsx`, `DealActivityTable.tsx` under `apps/web/app/(app)/compliance/audit-log/_components/`

## 2. RLS-browse-isolation — CONFIRMED
- `findDealRowsPaginated` reads via `getDb(this.db)` (`repository.ts:521`), NOT a raw pool / admin / superuser connection. Reuses the export pipeline pattern: `FROM pipeline LEFT JOIN mandates` (`repository.ts:507-508`) — joins ONLY RLS-covered tenant tables (SEC-10). FORCE RLS `workspace_isolation` policy applies.
- E2E runs `SET ROLE dealflow_app` (`e2e:288`), NOT `postgres` (the FORCE-RLS-bypass trap), with `RESET ROLE` in finally (`e2e:326`). DA-ISO-1/DA-ISO-2 assert cross-firm browse returns ZERO foreign-firm pipeline rows (`e2e:513`, `e2e:532`).

## 3. READ-ONLY — CONFIRMED
- `listDealActivityAsActor` (`service.ts:219-246`): zero `AuditService.append`, zero INSERT/UPDATE/DELETE. Only reads via `findDealRowsPaginated` and returns an envelope. Documented READ-ONLY INVARIANT (`service.ts:212-214`) — a browse emits NO audit row.
- `findDealRowsPaginated` is SELECT/COUNT only — no writes.
- UI (`DealActivityTable.tsx`): filter inputs (from/to/mandate/type) + page-nav buttons only; explicit "NO edit/delete affordance on any row" (`:29`). No export/download/mutation control. Data fetched via `apiFetch(...)` GET-only wrapper (`apiFetch.ts` — no method/body override) through the Next rewrite `/compliance/records-deal-activity-data` → API `GET /compliance/records/deal-activity` (`next.config.ts:586-587`).

## 4. advisor-RBAC — API is the real gate — CONFIRMED
- Controller boot-fail-closed: `DEAL_ACTIVITY_ROLES = [...rolesForRoute('/compliance/records/deal-activity')]` and throws on `length === 0` at module load (`controller.ts:132-135`). Route guarded `@UseGuards(SessionGuard, RolesGuard)` + `@Roles(...DEAL_ACTIVITY_ROLES)` (`controller.ts:289-290`).
- Service defense-in-depth: `EXPORT_ALLOWED_ROLES = {compliance, admin}` (`service.ts:156`); advisor/analyst → `ForbiddenException` 403 (`service.ts:229-231`).
- RBAC source of truth: `rbac.ts:488-489` `pattern: '/compliance/records/deal-activity', allowedRoles: ['compliance','admin']`. Matches the mirror. Advisor is genuinely denied at the API, not just hidden in the UI.

## 5. LIVE — independently confirmed
- `GET /health` → 200 `{"status":"ok","db":"ok","version":"8526999f0cc34da68aad945b9ab2a4dbee4fe892"}` — version == deployed hash.
- Unauthed `GET /compliance/records/deal-activity?limit=5` → **HTTP 401** (SessionGuard enforced pre-RBAC).
- No prod firm-admin creds → isolation + advisor-403 proof relies on CI DA-ISO/DA-RBAC (14 tests as `dealflow_app` on `8526999`), which is the correct proof surface.

## 6. Secrets — CLEAN
- Secret scan over the wave-29 diff (`86c697d~1..8526999`, apps/ + packages/, 14 files / +2517): no keys, tokens, private keys, or hardcoded credentials.

## Conclusion
Genuinely REAL + LIVE + isolated (RLS via getDb, dealflow_app e2e) + read-only (no audit append, no UI mutation) + RBAC-gated at the API (boot-fail-closed + service + shared roleRoutes). No Done-Theater, no spec-vs-deployed drift. **APPROVE.**

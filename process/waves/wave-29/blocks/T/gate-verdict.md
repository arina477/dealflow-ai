# Wave 29 — T-8 Security + T-9 Journey gate verdict

**Block:** T (Test) · **Stages:** T-8 Security + T-9 Journey (block-exit gate) · **Wave topic:** M10 records-VIEW deal-activity browse — paginated RLS-scoped READ-ONLY API + scope/tab on `/compliance/audit-log` · **Deployed:** LIVE @`8526999` · **Gate author:** head-tester (fresh spawn) · **Mode:** automatic

Verdict issued against **independently re-verified evidence** — the load-bearing test file, repository/service source, the CI run conclusion, AND the raw CI test-job log (not the deliverable summaries). Every DB-gated crux was confirmed to have EXECUTED against real Postgres in CI, not silently skipped.

---

## T-8 Security — EACH crux verified GENUINE (fault-killing + ran-not-skipped)

### 1. RLS-browse-isolation (CRUX) — PASS (genuine, fault-killing, ran in CI)
- **Read path is RLS-scoped, not superuser:** `findDealRowsPaginated` (`recordkeeping.repository.ts`) reads via `const db = getDb(this.db)` — BOTH the browse SELECT and the `COUNT(*)` total run over the same RLS-scoped handle. JOINs only RLS-covered tenant tables (`pipeline LEFT JOIN mandates`, SEC-10). No `rls_exempt`/admin/raw path anywhere in the browse chain. The pagination total cannot leak a cross-tenant count.
- **Test is fault-killing, NOT the false-green trap:** `runBrowseInAls` (test:285-331) issues `SET ROLE dealflow_app` (test:288) — explicitly **NOT** `postgres` (the FORCE-RLS-bypass trap, called out at test:287). It instantiates the **REAL** `RecordkeepingRepository` + `RecordkeepingService` (test:308-317); only the unmanaged boundaries (authRepository, auditVerifier, auditService) are mocked. DA-ISO-1 (test:513-528) asserts firm A browse contains ZERO firm B pipeline IDs **AND** firm A's own seeded rows are present (bidirectional negative+positive). DA-ISO-2 (test:532-546) proves the reverse. A real RLS regression WOULD fail this — not coverage theater.
- **Ran in CI (not skipped/ghost-green):** raw CI log (run 28931715146, headSha 8526999) shows `Create test database → CREATE DATABASE dealflow_test` ran AND `✓ test/recordkeeping-deal-activity-isolation.e2e-spec.ts (14 tests) 1501ms`. The suite's own skip-warning strings (`TEST_DATABASE_URL is not set` / `Postgres unreachable`) are **ABSENT** from the log ⇒ the `if (!dbReachable) return;` guard did NOT short-circuit ⇒ DA-ISO ran against real Postgres as `dealflow_app`. 1501ms real-DB timing, not ~0ms skip.

### 2. READ-ONLY (WORM boundary) — PASS
- `listDealActivityAsActor` (`recordkeeping.service.ts:219-247`) emits ZERO `AuditService.append` — awaits `findDealRowsPaginated` and returns `{rows, total, limit, offset}`. `findDealRowsPaginated` is pure SELECT + COUNT (no `tx`, no INSERT/UPDATE/DELETE). No mutation/deletion path exists in the browse chain.
- DA-RO-1 (test:589-609) counts `audit_log_entries` before/after a real browse and asserts the count is unchanged — genuinely proves no audit row is written (not a tautological mock assertion).
- UI has no mutation affordance (B-6 verified: `DealActivityTable` is display-only; controls are filter/pagination only). WORM boundary holds.

### 3. advisor-RBAC (CRUX — compliance lens) — PASS (at the API, not just UI)
- **Real gate is the API, boot-fail-closed:** service throws `ForbiddenException` when `!EXPORT_ALLOWED_ROLES.has(actor.roleName)` (`service.ts:229-231`) — defence-in-depth beyond the controller `@Roles(...DEAL_ACTIVITY_ROLES)` guard (boot-fail-closed non-empty assertion). Route matrix = `[compliance, admin]`; advisor/analyst absent.
- **Tested at the API by exception type:** DA-RBAC-3 (advisor) + DA-RBAC-4 (analyst) → `.rejects.toBeInstanceOf(ForbiddenException)` (test:576/584) — the C-1 fix-up (assert-by-type, not brittle message-string; see below). DA-RBAC-5 (test:339-348) asserts the route resolves to include `compliance`+`admin` and EXCLUDE `advisor`+`analyst`. This is the correct compliance lens: an advisor who CAN see `/compliance/audit-log` is DENIED deal-activity — proven at the service, not merely tab-hidden.
- `.strict()` schema rejects a client-supplied `workspace_id`/`firmId` (DA-PAGE-4, test:362-372) — workspace is server-resolved, never a client param.

### 4. paginated-not-export-cap — PASS
- `findDealRowsPaginated` uses `LIMIT ${filter.limit} OFFSET ${filter.offset}` — NOT `EXPORT_ROW_CAP` (50k). Schema (`dealActivityBrowseFilterSchema`, `shared/recordkeeping.ts:248-268`) caps `limit` at `DEAL_ACTIVITY_BROWSE_MAX_LIMIT = 50` (`.max(50)`), default 25, `.strict()`.
- DA-PAGE-2 (test:350-360): limit=51 → parse failure; limit=50/1 valid. DA-PAGE-1 (test:613-633): disjoint pages + shared full-filter total (`total` is COUNT(*), not page count). No 50k unbounded load reachable via API or UI (UI paginates 25/page).

### 5. No coverage gap / no regression — PASS
- CI run 28931715146 @`8526999`: `conclusion=success`, all 5 jobs green (lint, typecheck, **test**, audit, build). api 1017 + web 989 unit totals carried; deal-activity suite 14/14 in CI.
- DB-gated DA-ISO/RBAC/RO/PAGE **confirmed executed** (real-DB 1501ms, skip-warnings absent — §1 proof).
- **C-1 RED resolved genuinely:** the single fix-up was a test-author defect (DA-RBAC-3/4 asserted 403 by message-string `/forbidden|403/i` vs the service's genuine `ForbiddenException` whose message lacks those literals). Classified per Iron Law, routed to backend-developer, fixed to `.rejects.toBeInstanceOf(ForbiddenException)` — an authoritative 403-by-type contract, product behavior was correct throughout. 3-line test-only diff.
- Secret grep across shipped source (`apps` + `packages`, 775cd67..8526999) clean: no passwords/API keys/bearer tokens/hardcoded HMAC. Sole HMAC ref is the labelled `test-audit-hmac-key-dummy-do-not-use-in-prod` test fallback. No migration in diff (reuses existing pipeline+mandates RLS tables).

## T-9 Journey — PASS
- **journey delta:** NEW deal-activity browse scope/tab on `/compliance/audit-log` (RBAC-gated to compliance/admin; advisor sees the audit-log page but not the deal-activity tab — SSR fetch skipped + tab hidden + table branch re-guarded, B-6 double-gate). Route `/compliance/records/deal-activity` (proxy `/compliance/records-deal-activity-data`). READ-ONLY browse, no new mutation surface. `user-journey-map.md` regenerated with this delta at gate close.
- End-to-end disposition: perimeter (unauthed 401) live @8526999; authed RBAC/isolation contract is CI-e2e-authoritative (DA-RBAC/DA-ISO ran+passed against real Postgres) — no live prod creds exist, and attempting dev-seed creds vs prod auth is correctly avoided (false-BLOCKED / credential-leak anti-pattern). This is a READ-only browse with no BullMQ/Resend/LLM hand-off in scope, so the full ingest→outreach traversal is not this wave's surface.

## Anti-pattern scan (T-block failure modes) — none present
- Coverage Theater / Tautological Assertions: NOT present — assertions are semantic (bidirectional zero-leak, audit-count-unchanged, disjoint-pages, ForbiddenException-by-type, DESC-order), real repo+service exercised.
- Skipped-E2E-silently-passing / CI-blindness: NOT present — DB-gate confirmed did-not-fire via absence of skip-warning strings + 1501ms real-DB timing + explicit `✓ (14 tests)`. No Playwright browser-binary dependency in this backend-RLS crux (web scope/tab e2e reuse AuditLogTable, D-SKIP).
- Untested Compliance Invariants / Client-side-only guards: NOT present — RLS isolation + advisor-denial + READ-ONLY are all proven at the API/service against real Postgres, not via UI clicking.
- Flaky-test tolerance: N/A — single honest RED→fix (assertion-type correction), no auto-retry-until-green.

---

```yaml
head_signoff:
  verdict: APPROVED
  stage: T-9
  reviewers: {}   # head-tester direct verification; every crux tickable from source + raw CI log — no specialist re-delegation required
  failed_checks: []
  rationale: >
    All T-8 security cruxes and the T-9 journey gate verified against independently re-checked evidence
    (test source, repository/service source, CI run conclusion, AND the raw CI test-job log), not the
    deliverable summaries. RLS-browse-isolation is GENUINE and fault-killing: findDealRowsPaginated reads
    via getDb (RLS-scoped, JOINs only RLS-covered pipeline+mandates), and DA-ISO-1/2 run the REAL repo+service
    as SET ROLE dealflow_app (NOT postgres — the FORCE-RLS-bypass trap is explicitly avoided) proving firm A
    browse = zero firm B rows bidirectionally. The DB-gated cruxes RAN in CI, not skipped: the raw log shows
    CREATE DATABASE dealflow_test + "✓ recordkeeping-deal-activity-isolation.e2e-spec.ts (14 tests) 1501ms"
    with the suite's own skip-warning strings ABSENT (dbReachable-true branch taken, real-DB timing). READ-ONLY
    holds: listDealActivityAsActor emits no AuditService.append (DA-RO-1 proves audit-count unchanged) and the
    browse chain is pure SELECT+COUNT. advisor-RBAC is proven at the API, not just the UI: the service throws
    ForbiddenException on !EXPORT_ALLOWED_ROLES (defence-in-depth beyond the boot-fail-closed controller guard),
    DA-RBAC-3/4 assert 403 by exception TYPE (the C-1 fix from brittle message-string), and DA-RBAC-5 asserts
    the route excludes advisor/analyst — an advisor who can see the audit-log page is denied deal-activity.
    Pagination is bounded (LIMIT/OFFSET capped at 50 by the .strict schema, never EXPORT_ROW_CAP; DA-PAGE
    proves limit>50→400, disjoint pages, full-filter total). No coverage gap: CI 28931715146 @8526999 all 5
    jobs green (api 1017 + web 989), the single C-1 RED was a genuine test-only assertion-type fix routed per
    Iron Law, secret grep clean, no migration. Journey delta = the new deal-activity scope/tab on
    /compliance/audit-log (double-gated RBAC), READ-only, no new mutation surface; user-journey-map regenerated.
    No coverage theater, no tautological assertions, no silently-skipped E2E, no untested compliance invariant,
    no client-side-only guard. Clean pass — hand off to V-block.
  next_action: PROCEED_TO_V-block
```

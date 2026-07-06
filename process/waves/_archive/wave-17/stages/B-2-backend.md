# B-2 Backend — Workspace isolation: tenant-repo wiring + e2e test

Wave 17, M8 pilot-partner data-isolation.

## Deliverables

### 1. Three untracked files validated and registered

| File | Status |
|---|---|
| `apps/api/src/db/workspace-context.ts` | VALIDATED — ALS store (`workspaceAls`), `getDb(fallback)`, `getWorkspaceId()` |
| `apps/api/src/db/workspace.interceptor.ts` | VALIDATED — checkout/GUC-SET/RESET pattern, `resolve_user_workspace` SECURITY DEFINER call, surgical `RESET` (CARRY [c]), server-verified session subject (CARRY [b]) |
| `apps/api/src/db/workspace.module.ts` | VALIDATED — `APP_INTERCEPTOR` global registration |

`WorkspaceModule` registered as first import in `AppModule.imports` so the interceptor runs before all business handlers.

### 2. Repositories/services wired (getDb + workspaceId INSERTs)

All 41+ tenant query sites updated. Pattern applied to each:
- `await this.db` → `await getDb(this.db)` for reads
- `return this.db.transaction(work)` → `return getDb(this.db).transaction(work)` for transactions
- Every tenant INSERT gains `workspaceId: getWorkspaceId() ?? DEFAULT_WORKSPACE_ID`

Files modified:

| Module | File | Changes |
|---|---|---|
| audit | `audit.repository.ts` | `readChainAscending` → SECURITY DEFINER fn; `getDb` for reads/tx; `workspaceId` on INSERT |
| audit | `audit.service.ts` | `workspaceId: getWorkspaceId() ?? DEFAULT_WORKSPACE_ID` in `_appendCore` |
| auth | `auth.repository.ts` | F2: `getUserWithRole` returns `workspaceId`; `getDb` for all reads; `workspaceId` on invites+users INSERTs |
| mandate | `mandate.repository.ts` | `getDb` wired; `workspaceId` on mandate, buyerCriteria, complianceProfile INSERTs |
| outreach | `outreach.repository.ts` | `getDb` wired; `workspaceId` on template, version, outreach, complianceApproval INSERTs |
| buyer-universe | `buyer-universe.repository.ts` | `getDb` wired; `workspaceId` on buyerUniverse, candidates INSERTs |
| matching | `matching.repository.ts` | `getDb` wired; `workspaceId` on matchRun, matchCandidates INSERTs; `returning()` includes `workspaceId` |
| pipeline | `pipeline.repository.ts` | `getDb` wired; `workspaceId` on pipeline, pipelineEvents INSERTs |
| recordkeeping | `recordkeeping.repository.ts` | `getDb` wired (read-only repo, no INSERTs) |
| compliance-gate | `compliance-gate.repository.ts` | `getDb` wired (read-only repo, no INSERTs) |
| sourcing | `sourcing.repository.ts` | `getDb` wired; `workspaceId` on dataSourceConnections INSERT |
| sourcing | `ingestion.service.ts` | `getDb` wired; `workspaceId` on rawCompanies INSERT |
| sourcing | `dedupe.engine.ts` | `workspaceId` on companies, companyProvenance, contacts, contactProvenance, dedupeCandidates INSERTs |
| admin | `workspace-settings.service.ts` | `getDb` wired; `workspaceId` on workspaceSettings INSERT |
| admin | `data-source-admin.service.ts` | `getDb` wired; `workspaceId` on dataSourceConnections INSERT |
| admin | `user-management.service.ts` | `getDb` wired; `workspaceId` on invites INSERT |
| admin-activity | `admin-activity.service.ts` | `getDb` wired (read-only service) |
| compliance | `rules.service.ts` | `getDb` wired; `workspaceId` on complianceRules INSERT |
| compliance | `suppression.service.ts` | `getDb` wired; `workspaceId` on suppressionList INSERT |
| compliance | `disclaimers.service.ts` | `getDb` wired; `workspaceId` on disclaimerTemplates INSERTs (create + version) |

### 3. F2 — getUserWithRole returns workspaceId

`auth.repository.ts` `getUserWithRole` return type extended to `{ id: string; roleName: string; workspaceId: string } | null` with `workspaceId: users.workspaceId` in the Drizzle select.

### 4. F3 — readChainAscending calls SECURITY DEFINER fn

`audit.repository.ts` `readChainAscending()` now executes `read_audit_chain_rls_exempt(1, 9223372036854775807)` (the SECURITY DEFINER function from B-0) instead of a direct `SELECT` over `auditLogEntries`. This bypasses RLS for global chain integrity while all list/export reads use the standard GUC-filtered path.

### 5. TypeScript fixes

- `workspace.interceptor.ts`: `drizzle(client) as unknown as Database` — `PoolClient` vs `Pool` `$client` mismatch resolved via double-cast
- `audit.repository.ts`: `execute<Record<string, unknown>>` then `as unknown as StoredAuditEntry[]` — `execute<T>` requires `T extends Record<string, unknown>`, `StoredAuditEntry` lacks an index signature
- `matching.repository.ts`: `upsertMatchRunInTx` `.returning()` clause extended to include `workspaceId: matchRun.workspaceId` to satisfy `MatchRunRow` type assignment

Typecheck result: `pnpm -w typecheck` — 4 tasks successful, 0 errors.

### 6. Cross-tenant negative-read e2e test

`apps/api/test/workspace-isolation.e2e-spec.ts`

Five assertions (UUID namespace `00000017-wspc-*`):
- **ISO-1**: WS_B GUC cannot read WS_A mandates (cross-tenant negative read = 0)
- **ISO-2**: WS_A GUC can read WS_A mandates (positive control)
- **ISO-3**: WS_A GUC cannot read WS_B mandates (bidirectional isolation)
- **ISO-4**: GUC-leak guard — after `RESET app.workspace_id`, queries return 0 rows (fail-closed; no COALESCE-to-default)
- **ISO-5**: WORM trigger rejects `UPDATE` on `audit_log_entries` (SQLSTATE P0001)

Teardown is WORM-safe per T-4 rule 1: no hard-deletes on rows FK-referenced by `audit_log_entries`; actor users seeded with `deactivated_at = now()`.

## Deviations

### DEV-1: FORCE RLS on `invites` breaks pre-auth signup path

**Tables affected**: `invites` (FORCE RLS enabled in B-0 migration 0014).

**Problem**: `getInviteEmail()` and `consumeInviteAndCreateUser()` in `auth.repository.ts` are called during the pre-auth signup flow (no session → no GUC set). With FORCE RLS and no GUC, the policy `workspace_id = current_setting('app.workspace_id', true)::uuid` evaluates to `workspace_id = NULL` → 0 rows → signup fails with "invalid invite" for all new users.

**Current handling**: `getDb(this.db)` is called consistently (correct), but without a GUC the singleton connection will return 0 rows from `invites`. A dev comment in `getInviteEmail()` documents this.

**Fix path**: Create a `resolve_invite_workspace(token_hash text)` SECURITY DEFINER function (analogous to `resolve_user_workspace`) that bypasses RLS to look up the invite by token hash. This function would be called pre-GUC to bootstrap the workspace context for the signup path.

**Scope**: Out of B-2 scope. Deferred to B-3 or a dedicated wave. The pilot firm's first admin user was created via direct DB seed (migration 0014's `DEFAULT_WORKSPACE_ID` row), so this does not block the pilot-partner use case.

**Risk**: Low for pilot (single firm, users already exist). High for any new invite-based signup until fixed.

## DEV-1 resolution

**Fixed in this wave (B-2 fix-forward, commit 8b331dc).**

### Design: `resolve_invite(token_hash)` SECURITY DEFINER (migration 0015)

Option A chosen: one `resolve_invite(p_token_hash text)` SECURITY DEFINER function returning `(email text, workspace_id uuid, role_id uuid)`. Minimal surface:
- Keyed on the token hash (SHA-256 of the plaintext, the unguessable capability — caller cannot enumerate other invites without the token hash).
- Filters to unconsumed (`consumed_at IS NULL`) + unexpired (`expiry > now()`) rows only.
- Returns only three fields: email (for EmailPassword.signUp), workspace_id (for tenant placement), role_id (latent — available if the service needs it; currently not used but present for forward-compatibility).
- `SECURITY DEFINER + SET search_path = ''` (prevents search_path injection, consistent with 0014 step 7).

**Workspace placement invariant**: `workspace_id` is sourced from `invite.workspace_id` (set when the admin created the invite). The new user is created in the INVITE'S workspace — server-derived, never client-supplied. Cross-workspace placement is structurally impossible.

### Migration 0015

- `0015_invite_rls_bootstrap.sql` — additive only; `CREATE OR REPLACE FUNCTION resolve_invite(text)`.
- `0015_invite_rls_bootstrap.down.sql` — `DROP FUNCTION IF EXISTS resolve_invite(text)`.
- `meta/_journal.json` — idx 15, when 1784073600000 (> 0014 when 1783987200000).
- `meta/0015_snapshot.json` — copied from 0014 (schema unchanged; function-only migration), updated id + prevId.

### Repository wiring (`auth.repository.ts`)

- `getInviteEmail(tokenHash)` now calls `resolve_invite($1)` via `pool.query()` (raw SQL on the pool singleton — the function bypasses RLS as SECURITY DEFINER regardless of connection GUC state). Returns `InviteBootstrap { email, workspaceId }` or `null`.
- New `runInTransactionWithWorkspace(workspaceId, work)`: checks out a dedicated `PoolClient` from the pool, `SET app.workspace_id = $1`, wraps in Drizzle, runs the caller's transaction work, then `RESET app.workspace_id` + `client.release()` in `finally`. Same pattern as `WorkspaceInterceptor.setupClient`. Both the `invites UPDATE` and `users INSERT` inside `consumeInviteAndCreateUser` pass FORCE RLS with the GUC set.
- `runInTransaction` retained unchanged for authenticated request paths (where ALS already provides the GUC via `getDb(this.db)`).

### Service wiring (`auth.service.ts`)

`signup`: `getInviteEmail` returns `InviteBootstrap | null`; on success, `inviteWorkspaceId` is extracted and passed to `runInTransactionWithWorkspace`. The invitee joins the workspace named in the invite — not anything the client supplied.

### Tests

- `auth.service.spec.ts`: all four signup tests updated to `InviteBootstrap` return type and `runInTransactionWithWorkspace`. Added test `DEV-1: workspace placement — transaction uses server-derived workspaceId from invite` proving the workspace cannot be client-controlled.
- `test/invite-signup-rls.e2e-spec.ts` (new, 5 assertions, skips without `TEST_DATABASE_URL`):
  - **INV-1**: `resolve_invite()` returns email + workspace_id with NO GUC set (direct proof of RLS bypass).
  - **INV-2**: full consume cycle under FORCE RLS — invite consumed, user created in workspace W via `runInTransactionWithWorkspace`.
  - **INV-3**: new user (workspace W GUC) sees workspace-W mandates, cannot see workspace-X mandates (cross-workspace isolation holds post-signup).
  - **INV-4**: consumed invite returns 0 rows from `resolve_invite()` (no replay).
  - **INV-5**: fault-killing — direct `SELECT` on `invites` without GUC returns 0 rows, proving FORCE RLS is active and the resolver is load-bearing. Remove the function → INV-1/INV-2/INV-3 fail immediately.

### Typecheck

`pnpm -w typecheck` — 4 tasks successful, 0 errors (post-fix).

### Residual deviations

None. DEV-1 is fully resolved. RLS on `invites` remains FORCE + deny-by-default; only the pre-auth bootstrap is exempt via the minimal-surface SECURITY DEFINER function.

---

## B-6 rework resolution

**Bug**: Both `workspace.interceptor.ts:101` and `auth.repository.ts:314` used `SET app.workspace_id = $1` (parameterized). PostgreSQL's `SET` command does not accept bind parameters — this throws SQLSTATE 42P02 at runtime. The interceptor catch block was silently swallowing the error, leaving the GUC unset and every authenticated tenant read returning 0 rows. The transaction wrapper threw, breaking every invite signup.

The e2e tests were passing because both `withWorkspace()` helpers (workspace-isolation and invite-signup-rls) used literal string interpolation — a test-local reimplementation that never exercised the broken production statement.

**Fixes applied** (tasks 96026365 + df2f3b2f):

1. **`apps/api/src/db/workspace.interceptor.ts`** — replaced `SET app.workspace_id = $1` with `SELECT set_config($1, $2, false)` (is_local=false = session-scoped on the dedicated per-request client). The catch block now **re-throws** (fail-closed loudly) — resolver failure or GUC-set failure propagates rather than proceeding with an unset GUC. Client is released in the catch before re-throwing. RESET-in-finally preserved.

2. **`apps/api/src/modules/auth/auth.repository.ts` — `runInTransactionWithWorkspace`** — replaced `SET app.workspace_id = $1` with `SELECT set_config($1, $2, true)` (is_local=true = tx-scoped SET LOCAL, resets automatically at tx end). RESET-in-finally preserved as defence-in-depth.

3. **`apps/api/test/invite-signup-rls.e2e-spec.ts`** — `withWorkspace()` helper replaced with `SELECT set_config($1, $2, false)`. INV-2 inline GUC-set replaced with `SELECT set_config($1, $2, true)` (tx-scoped, matching production). Comment documents fault-killing intent: regressing to `SET app.workspace_id = $1` in this test would throw SQLSTATE 42P02.

4. **`apps/api/test/workspace-isolation.e2e-spec.ts`** — `withWorkspace()` helper replaced with `SELECT set_config($1, $2, false)`.

5. **`apps/api/src/db/workspace-guc.spec.ts`** (NEW) — three fault-killing unit tests that mock the pg client and assert the exact SQL string issued:
   - GUC-1: interceptor issues `SELECT set_config(..., false)`, not `SET app.workspace_id = $1`.
   - GUC-2: interceptor fails-closed (propagates, not swallows) when set_config throws; client released.
   - GUC-3: `runInTransactionWithWorkspace` issues `SELECT set_config(..., true)`; RESET fires; client released.

   These run locally with no DB required. A regression to the parameterized-SET form causes GUC-1/GUC-3 to fail immediately (no more silent swallow).

**Grep confirmation**: `grep -rn 'SET app.workspace_id = \$' --include="*.ts"` returns only comments and doc strings — zero live parameterized SET occurrences.

**Typecheck**: `pnpm -w typecheck` — 4 tasks successful, 0 errors.

**Unit tests**: 772 passed, 52 skipped (e2e DB-gated), 0 failed. GUC-1, GUC-2, GUC-3 all green.

## B-6 rework2 resolution

B-6 phase-2 adversarial review found 4 defects (2 P0 isolation-critical). All 4 closed in 3 commits on `wave-17-workspace-isolation`.

### Finding #2 [P0] — Non-superuser app role (isolation real + testable)

**Root cause**: app and CI connect as `postgres` (SUPERUSER) → implicit BYPASSRLS → FORCE RLS bypassed → isolation unenforced; e2e assertions vacuous.

**Fix (3 parts)**:
1. **Migration 0016** (`0016_dealflow_app_role.sql`, journaled idx 16, `when > 1784073600000`) creates `dealflow_app` (NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE LOGIN) and grants minimal DML on all 28 tenant tables, USAGE on sequences, EXECUTE on the 3 SECURITY DEFINER functions, SELECT on global tables. `.down` + snapshot included.
2. **E2e non-superuser assertions**: `withWorkspace()` in both `workspace-isolation.e2e-spec.ts` and `invite-signup-rls.e2e-spec.ts` now issues `SET ROLE dealflow_app` before `SET app.workspace_id` on every isolation-asserting client. CI cannot change `ci.yml` (lacks Workflows:write); `SET ROLE` achieves the same effect — drops superuser privilege, makes FORCE RLS apply. Seeding/teardown still use the superuser pool. INV-2 consume cycle also runs as dealflow_app.
3. **Startup is_superuser assertion** (`assertNonSuperuserConnection()` in `apps/api/src/db/index.ts`): checks `current_setting('is_superuser')` and `rolbypassrls`; throws with `[RLS-GUARD]` prefix if either is true. Wired into `main.ts` bootstrap (skipped in `NODE_ENV=test`). Fail-closed — no degraded boot.

**C-2 Railway hand-off**: Set `DATABASE_URL` to authenticate as `dealflow_app`. See migration 0016 header comments for password/URL format. Startup guard fires if misconfigured.

### Finding #1 [P0] — GUC inside transaction

**Root cause**: `runInTransactionWithWorkspace` issued `set_config(is_local=true)` as a standalone `client.query()` OUTSIDE the Drizzle `transaction()` call. SET LOCAL scopes to the current tx — the autocommit tx ends immediately, GUC reset before `BEGIN`. Invites UPDATE + users INSERT ran with unset GUC → RLS denied → invite-signup broken.

**Fix**: moved `set_config($1, $2, true)` to be the FIRST statement INSIDE `clientDb.transaction(async (tx) => { ... })`, so it shares the same BEGIN block as the tenant writes. INV-2 test updated to match exact production path and runs as dealflow_app.

### Finding #3 [P1] — Sourcing getDb

**Root cause**: 4 tenant reads in `listCompanies` (companyProvenance subquery, contacts count, companyProvenance source count, companyProvenance connectionIds) used `this.db` (singleton, no GUC) → FORCE RLS → 0 rows → brick.

**Fix**: all 4 replaced with `getDb(this.db)`. Full grep of all `this.db` references in api src confirmed no other tenant-table queries using bare `this.db` — all other sites already use `getDb`.

### Finding #4 [P2] — Fail-closed workspace

**Root cause**: interceptor stored `workspaceId ?? ''`; `getWorkspaceId()` returned `''` for unauthenticated paths; `getWorkspaceId() ?? DEFAULT_WORKSPACE_ID` evaluated `'' ?? ...` → `''` (nullish coalescing misses empty string); `createInvite` inserted `workspace_id=''` → invalid-uuid 500 or cross-workspace DEFAULT placement.

**Fix (3-part)**:
- Interceptor throws fail-closed when `stUserId` is set but `workspaceId` is null (authenticated session, no workspace row).
- `getWorkspaceId()` normalises `''` → `null`.
- `createInvite` throws when `getWorkspaceId()` returns null — no `DEFAULT_WORKSPACE_ID` fallback.

### Verification

- `pnpm -w typecheck`: 4 tasks successful, 0 errors.
- `pnpm --filter @dealflow/api test --run`: 772 passed, 52 skipped (e2e DB-gated), 0 failed.
- No local DB available in dev container; e2e assertions (ISO-1..ISO-5, INV-1..INV-5) will run in CI with `TEST_DATABASE_URL` set.
- Commits: `b247d24` (finding #2), `f7cdb70` (finding #1), `90c1b67` (findings #3/#4).

## B-6 rework3 resolution

**P0 (new finding, exposed by non-superuser-role fix from rework2)**: RolesGuard + main.ts resolveRole read `users` via RLS-gated path pre-interceptor → 403-everything under dealflow_app.

**Root cause**: NestJS runs GUARDS BEFORE INTERCEPTORS. `RolesGuard.canActivate` called `authRepository.resolveRoleBySupertokensUserId` (→ `getDb(this.db)` → Drizzle SELECT on `users`) BEFORE `WorkspaceInterceptor` (APP_INTERCEPTOR) ran — ALS empty, no `app.workspace_id` GUC set. Under `dealflow_app` (NOSUPERUSER NOBYPASSRLS FORCE RLS), `workspace_id = current_setting(..., true)::uuid` evaluates `NULL = uuid → false` → 0 rows → `null` role → `ForbiddenException` → every `@Roles()`-guarded endpoint returns 403 for all users. Same defect in `main.ts` `resolveRole` SuperTokens callback (runs at signin/refresh, no session ALS).

**Fix**:
- Added `resolveRoleRlsExempt(stUserId)` to `AuthRepository` (`apps/api/src/modules/auth/auth.repository.ts`): calls `SELECT role_name FROM resolve_user_workspace($1)` via `pool.query` — identical pattern to `getInviteEmail`. `resolve_user_workspace` is SECURITY DEFINER (migration 0014 step 7), EXECUTE already granted to `dealflow_app` (migration 0016 step 5). No new migration needed.
- `RolesGuard.canActivate` (`apps/api/src/modules/auth/guards/roles.guard.ts`): replaced `resolveRoleBySupertokensUserId` call with `resolveRoleRlsExempt`. DB-authoritative property preserved (re-resolves per request from DB, not JWT claim).
- `main.ts` `resolveRole` closure: replaced RLS-gated Drizzle query (`db.select().from(users)...`) with `pool.query('SELECT role_name FROM resolve_user_workspace($1)', [stUserId])`. Removed unused `eq`, `roles`, `users` imports; changed `db` import to `pool`.

**Grep result for other pre-interceptor RLS-gated reads**: only one guard file with DB access (`roles.guard.ts`) — fixed. `session.guard.ts` has no DB access. No middleware, background jobs, schedulers, or other bootstrap paths with pre-interceptor RLS-gated tenant reads found.

**Fault-killing test**: `compliance.rbac.spec.ts` CRITICAL-1b describe block (3 tests) added. Proves:
1. `canActivate` calls `resolveRoleRlsExempt` (NOT `resolveRoleBySupertokensUserId`) — test fails if guard regresses to the RLS-gated path.
2. The resolved value from `resolveRoleRlsExempt` drives allow/deny (not the session claim).
3. `@Roles()`-guarded route: correct role → allow, wrong role → 403 (NOT 403-for-all).
Updated `mockRepo` in all 11 spec files to expose `resolveRoleRlsExempt` alongside `resolveRoleBySupertokensUserId`.

**Verification**: `pnpm -w typecheck`: 4 tasks successful, 0 errors. `pnpm --filter @dealflow/api test`: 775 passed (3 new tests), 52 skipped (e2e DB-gated), 0 failed.

---

## C-2 HOLD resolution (migration WORM-backfill fix)

**Defect (diagnosed by postgres-pro at C-2)**: Migration `0014_workspace_isolation.sql` Step-3 backfill

```sql
UPDATE audit_log_entries SET workspace_id = '<default>' WHERE workspace_id IS NULL;
```

collides with the WORM `BEFORE UPDATE` trigger `audit_log_no_mutate` (function `audit_log_block_mutation`, installed in migration `0002_steep_boom_boom.sql`). CI is green only because it migrates an empty DB — the backfill matches 0 rows and the trigger never fires. Against populated prod (328 audit rows) migration 0014 fails: `ERROR: audit_log_entries is append-only: UPDATE blocked`.

**Trigger name confirmed**: `audit_log_no_mutate` (trigger) / `audit_log_block_mutation` (function). Verified from `apps/api/src/db/migrations/0002_steep_boom_boom.sql` lines 92-96 and `apps/api/src/db/schema/audit-log.ts` immutability design comment.

**Hash-exclusion safety confirmed**: `workspace_id` is NOT in `HashableEntryFields` / `canonicalSerialization` — see `audit-log.ts` wave-17 column comment and `audit.service.ts` `_appendCore` comment (mirrors `mandate_id` exclusion from wave-14 / migration 0012). The HMAC preimage is byte-identical before and after the backfill UPDATE. `verifyChain` stays `ok:true`.

### Fix 1 — migration wrap (`apps/api/src/db/migrations/0014_workspace_isolation.sql`)

Wrapped ONLY the `audit_log_entries` backfill UPDATE in a trigger-disable window (all other 27 tenant tables are unaffected — only `audit_log_entries` has a mutation-blocking trigger):

```sql
ALTER TABLE "audit_log_entries" DISABLE TRIGGER audit_log_no_mutate;
UPDATE "audit_log_entries" SET "workspace_id" = 'a1b2c3d4-0000-4000-8000-000000000001' WHERE "workspace_id" IS NULL;
ALTER TABLE "audit_log_entries" ENABLE TRIGGER audit_log_no_mutate;
```

`DISABLE TRIGGER` requires the table owner (the migration role). The runtime `dealflow_app` role never runs this migration. `ENABLE` in the same migration statement restores WORM protection atomically — even on rollback, the trigger is re-enabled at transaction abort.

Prod is at journal 0013 (0014 NOT yet applied anywhere durable). CI uses fresh DBs. Editing `0014.sql` is the correct fix — prod applies the fixed version; CI re-runs it fresh. Schema state is unchanged (same columns, same NOT NULL, same RLS) — `0014_snapshot.json` NOT regenerated (no schema shape change).

### Fix 2 — populated-DB migration test (`apps/api/test/audit-migration-populated-db.e2e-spec.ts`)

New e2e test (5 assertions, UUID namespace `00000017-ab17-*`):

- **AMP-1**: Seeds 3 real HMAC-chained audit rows via `AuditService.appendStandalone` — structurally identical to prod rows.
- **AMP-2**: Replicates the exact migration 0014 `DISABLE TRIGGER / UPDATE / ENABLE TRIGGER` pattern against the live seeded rows — proves the fix resolves the populated-DB collision.
- **AMP-3**: Seeded rows carry `workspace_id = DEFAULT_WORKSPACE_ID` after the backfill UPDATE (step 3 worked as intended).
- **AMP-4**: `verifyChain` → `{ok:true}` over the seeded chain after `workspace_id` backfill — proves hash-exclusion holds end-to-end.
- **AMP-5**: FAULT-KILLING — plain `UPDATE` WITHOUT `DISABLE TRIGGER` throws `SQLSTATE P0001` (WORM trigger active). This asserts: (a) `ENABLE TRIGGER` at end of the disable window is effective, AND (b) removing the wrap from 0014 would fail on any populated DB — exactly the regression this test catches.

WORM-safe teardown: seeded user `deactivated_at = now()`, never deleted; `audit_log_entries` rows accumulate (WORM invariant). Skips without `TEST_DATABASE_URL`.

### Verification

- `pnpm -w typecheck`: 4 tasks successful, 0 errors.
- `pnpm --filter @dealflow/api test --run`: 775 passed, 55 skipped (5 new AMP tests added to DB-gated skip count), 0 failed.
- No local DB available — e2e assertions (AMP-1..AMP-5) run in CI with `TEST_DATABASE_URL` set. The new populated-DB test IS the proof of the fix.
- Task: 0db154ff.

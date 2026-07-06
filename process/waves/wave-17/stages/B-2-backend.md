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

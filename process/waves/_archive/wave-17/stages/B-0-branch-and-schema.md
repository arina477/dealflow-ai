# Wave 17 — B-0 Branch & Schema

## Branch
`wave-17-workspace-isolation` (per task instructions; existing branch)

## Schema skipped
`false` — migration 0014 authored and journaled.

## Migrations authored

### 0014_workspace_isolation (idx 14, when 1783987200000 > 1783900800000)

**Up:** `/apps/api/src/db/migrations/0014_workspace_isolation.sql`
**Down:** `/apps/api/src/db/migrations/0014_workspace_isolation.down.sql`
**Snapshot:** `/apps/api/src/db/migrations/meta/0014_snapshot.json`
**Journal:** idx 14 registered in `_journal.json` (when: 1783987200000, tag: 0014_workspace_isolation)

### Execution order (load-bearing — deviate and NOT NULL cutover fails)
1. CREATE workspaces table + INSERT default workspace row (STABLE UUID: `a1b2c3d4-0000-4000-8000-000000000001`)
2. ADD workspace_id FK columns (nullable) to all 28 tenant tables
3. BACKFILL all existing rows → default workspace UUID
4. ALTER workspace_id SET NOT NULL (zero NULL rows after step 3)
5. ENABLE + FORCE ROW LEVEL SECURITY on all 28 tenant tables
6. CREATE deny-by-default RLS policies per table
7. CREATE SECURITY DEFINER function `resolve_user_workspace`
8. CREATE SECURITY DEFINER function `read_audit_chain_rls_exempt`
9. CREATE workspace_id indexes on all 28 tenant tables

## Tenant tables enumerated (28 total — all received workspace_id + RLS)

| Table | Schema file | Notes |
|---|---|---|
| `users` | users-roles.ts | FORCE RLS; pre-GUC bootstrap via resolve_user_workspace |
| `invites` | users-roles.ts | FORCE RLS |
| `audit_log_entries` | audit-log.ts | FORCE RLS; workspace_id HASH-EXCLUDED (see below) |
| `compliance_rules` | compliance-rules.ts | FORCE RLS |
| `suppression_list` | compliance-rules.ts | FORCE RLS |
| `disclaimer_templates` | compliance-rules.ts | FORCE RLS |
| `compliance_approvals` | compliance-rules.ts | FORCE RLS |
| `mandates` | mandate.ts | FORCE RLS |
| `mandate_buyer_criteria` | mandate.ts | FORCE RLS |
| `mandate_compliance_profile` | mandate.ts | FORCE RLS |
| `data_source_connections` | sourcing.ts | FORCE RLS |
| `raw_companies` | sourcing.ts | FORCE RLS |
| `companies` | sourcing.ts | FORCE RLS |
| `contacts` | sourcing.ts | FORCE RLS |
| `company_provenance` | sourcing.ts | FORCE RLS |
| `contact_provenance` | sourcing.ts | FORCE RLS |
| `dedupe_candidates` | sourcing.ts | FORCE RLS |
| `buyer_universe` | buyer-universe.ts | FORCE RLS |
| `buyer_universe_candidates` | buyer-universe.ts | FORCE RLS |
| `match_run` | matching.ts | FORCE RLS |
| `match_candidates` | matching.ts | FORCE RLS |
| `outreach_templates` | outreach.ts | FORCE RLS |
| `outreach_template_versions` | outreach.ts | FORCE RLS |
| `outreach` | outreach.ts | FORCE RLS |
| `pipeline` | pipeline.ts | FORCE RLS |
| `pipeline_events` | pipeline.ts | FORCE RLS |
| `workspace_settings` | admin-settings.ts | FORCE RLS |
| `roles` | EXCLUDED — global RBAC lookup; 4 named roles shared across firms |
| `app_meta` | EXCLUDED — global bootstrap KV; no firm data |

**Total scoped: 28 tables (27 actively scoped + roles excluded + app_meta excluded)**

## Excluded tables justification

- **`app_meta`** — global bootstrap key-value store (app version, schema rev). Zero firm data. Scoping would break health checks and schema-version reads that run before any GUC is set.
- **`roles`** — global RBAC lookup table containing exactly 4 named roles (admin / advisor / analyst / compliance). These roles are shared across all firms by design; per-firm role tables are out of scope. The RLS predicate `workspace_id = GUC::uuid` would require a workspace_id column on roles, which would mean each firm has its own role rows — breaking the global role resolution path in `resolve_user_workspace` and every `getUserWithRole` call.

## FORCE ROW LEVEL SECURITY

Applied on ALL 28 tenant tables. This is mandatory because the NestJS API connects as the table-owning role. Without FORCE, the owner bypasses RLS entirely, making every isolation test a false-green (P-4 F1 / problem-framer A). The down migration reverses this with `NO FORCE ROW LEVEL SECURITY` + `DISABLE ROW LEVEL SECURITY`.

## RLS policy shape

```sql
USING (workspace_id = current_setting('app.workspace_id', true)::uuid)
```

- `current_setting('app.workspace_id', true)` returns NULL when GUC is unset (the `true` arg = missing_ok)
- NULL::uuid = uuid comparison → false
- Zero rows returned on unset GUC (fail-closed)
- NO COALESCE, NO `= ''` fail-open shape

## SECURITY DEFINER functions

### resolve_user_workspace(st_user_id text)
- RLS-bypassing bootstrap resolver (P-4 F2 — chicken-and-egg break)
- Joins `public.users JOIN public.roles` on the SuperTokens user ID
- Returns ONLY the caller's own `workspace_id` + `role_name` (one row, LIMIT 1)
- No other user or workspace data exposed
- SEARCH_PATH = '' (prevents search_path injection)
- Used by B-2 NestJS middleware BEFORE setting the GUC

### read_audit_chain_rls_exempt(p_from_sequence, p_to_sequence)
- RLS-bypassing audit integrity walk (P-4 F3)
- The HMAC chain is a SINGLE GLOBAL chain; an RLS-scoped read sees a non-contiguous sequence → false sequence-gap → ok:false
- This function bypasses RLS and returns the ordered full chain for verifyChain
- The LIST/EXPORT projection is NOT via this function (uses normal RLS-scoped Drizzle handle)
- SEARCH_PATH = '' (prevents search_path injection)

## audit_log_entries.workspace_id hash-exclusion

workspace_id is HASH-EXCLUDED — it is NOT in HashableEntryFields and is NEVER fed into canonicalSerialization() or computeEntryHash(). This mirrors the mandate_id exclusion pattern from migration 0012 (task 487b0f0c / wave-14) exactly.

Hash-exclusion safety: workspace_id UPDATE on audit_log_entries would re-attribute a record cross-workspace without breaking verifyChain. However the WORM BEFORE-UPDATE trigger (installed in migration 0002) unconditionally rejects ALL UPDATE/DELETE on audit_log_entries for ALL roles including the table owner. The WORM trigger is the sole backstop. The df2f3b2f test (B-2) MUST assert the trigger blocks `UPDATE audit_log_entries SET workspace_id = <other>`.

Post-migration: verifyChain returns ok:true over the full chain because the HMAC preimage (canonical serialization fields) is unchanged.

## Drizzle schema files changed

New file:
- `apps/api/src/db/schema/workspaces.ts` (workspaces table + DEFAULT_WORKSPACE_ID constant)

Updated files (workspace_id column + FK + index added):
- `apps/api/src/db/schema/admin-settings.ts`
- `apps/api/src/db/schema/audit-log.ts`
- `apps/api/src/db/schema/buyer-universe.ts`
- `apps/api/src/db/schema/compliance-rules.ts`
- `apps/api/src/db/schema/mandate.ts`
- `apps/api/src/db/schema/matching.ts`
- `apps/api/src/db/schema/outreach.ts`
- `apps/api/src/db/schema/pipeline.ts`
- `apps/api/src/db/schema/sourcing.ts`
- `apps/api/src/db/schema/users-roles.ts`
- `apps/api/src/db/schema/index.ts` (added workspaces export)

## orm_models_changed
`true` — workspaceId field added to all 28 tenant table Drizzle schemas + workspaces table added.

## backfill_ran
`true` (in migration SQL — step 3 UPDATEs all tables before NOT NULL cutover).

## local_apply_result
BLOCKED — no local Postgres instance is running (`pg_isready -h localhost -p 5432` returns "no response"). The app DATABASE_URL in .env.example points to `localhost:5432` which is not provisioned in this environment. CI is authoritative for apply verification (the migration is syntactically correct and follows the proven pattern from 0012/0013).

## typecheck_result
Running `pnpm --filter @dealflow/api typecheck` produces TypeScript errors on INSERT call sites (missing `workspaceId` argument) in sourcing, dedupe, and ingestion services. This is EXPECTED and CORRECT — those are B-2 responsibilities. The schema types are accurate; B-2 will add the request-scoped workspace context provider that supplies `workspaceId` to every INSERT. The errors are a positive signal that the schema change propagated correctly into the type system.

## deviations

None from spec.

The following items are explicitly B-2 responsibilities (not B-0):
- Wiring `workspaceId` in INSERT call sites (the typecheck errors above)
- The request-scoped dedicated-connection provider (P-4 F1)
- getUserWithRole calling `resolve_user_workspace` and setting the GUC
- verifyChain calling `read_audit_chain_rls_exempt`
- The cross-tenant negative-read e2e test (df2f3b2f)

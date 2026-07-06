---
stage: B-1
wave: 17
skipped: false
commit: 1982aad
branch: wave-17-workspace-isolation
tasks_cited: [0db154ff, 96026365]
---

# Wave 17 — B-1 Contracts

## contracts_authored

### `packages/shared/src/workspace.ts`
- `WorkspaceId` — branded UUID string type (`& { readonly __brand: 'WorkspaceId' }`). Callers hold a WorkspaceId only after UUID validation at the DB or schema boundary.
- `workspaceIdSchema` — `z.string().uuid().transform(val => val as WorkspaceId)`. The canonical UUID-validating narrowing schema.
- `DEFAULT_WORKSPACE_ID` — `'a1b2c3d4-0000-4000-8000-000000000001' as WorkspaceId`. Mirrors B-0's DB constant at the shared boundary; backfill target + pilot firm fixture anchor.
- `workspaceSchema` — `{ id: WorkspaceId, name: string, createdAt: datetime }` strict Zod schema.
- `Workspace` — inferred type.

### `packages/shared/src/resolver-contract.ts`
- `resolveUserWorkspaceResultSchema` — `{ id: uuid, roleName: string, workspaceId: WorkspaceId }` strict Zod schema.
- `ResolveUserWorkspaceResult` — inferred type.

### `packages/shared/src/index.ts`
Re-exports for both new modules appended under the wave-17 comment block.

## resolver_return_contract

Shape: `{ id: string (uuid), roleName: string, workspaceId: WorkspaceId }`

This is the return type of BOTH:
1. The SECURITY DEFINER SQL function `resolve_user_workspace(st_user_id)` authored in migration 0014 (B-0) — RLS-bypassing pre-GUC bootstrap (P-4 F2).
2. `AuthRepository.getUserWithRole` — B-2 extends it to include `workspaceId` by querying `users.workspace_id` in the existing join.

The request-scoped workspace provider (B-2) imports `ResolveUserWorkspaceResult` from shared to: extract `workspaceId` → `SET app.workspace_id = $wsId` on the dedicated connection; extract `roleName` for DB-authoritative role claim; use `id` as FK-safe audit actor.

## request_context_type_decision

**Stays api-internal. Not authored in shared.**

The per-request `{ workspaceId: WorkspaceId }` shape carried by the NestJS `AsyncLocalStorage` / request-scoped provider is an implementation detail of the api module's workspace propagation mechanism (B-2, task 96026365). It is not consumed by any other package at the shared boundary — the frontend never sees it, and no other package depends on it. Placing it in shared would over-share an api-internal provider contract. B-2 defines it inline in the provider file.

## hash_exclusion_confirmation

**CONFIRMED — no defect.**

`packages/shared/src/audit.ts` `auditEntryInputSchema` fields (`.strict()`):
- actorUserId, actorRole, action, resourceType, resourceId, contentHash, payloadHash

`workspace_id` is NOT present. The `auditLogEntrySchema` (read shape) also omits `workspace_id` — it is not carried in the hash-input contract, consistent with B-0's DB-level hash-exclusion (the column exists in the DB row but is NOT in `HashableEntryFields` / `canonicalSerialization`). The HMAC chain remains byte-identical across the wave-17 isolation boundary change. No defect.

## typecheck_result

`pnpm --filter @dealflow/shared typecheck` → **0 errors, 0 warnings.** (tsc --noEmit exits 0)

Consumer breakage in apps/ is expected (B-0's schema changes add workspaceId columns not yet wired in 41 modules — B-2 responsibility).

## deviations

None. The plan called for a shared Workspace type, the resolver return contract, hash-exclusion confirmation, and a decision on the request-context type. All four delivered as specified. No additions, no omissions.

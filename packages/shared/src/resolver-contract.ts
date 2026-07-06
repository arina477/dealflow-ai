import { z } from 'zod';

import { workspaceIdSchema } from './workspace';

// ---------------------------------------------------------------------------
// Resolver return contract — Wave-17 workspace isolation (tasks 0db154ff / 96026365).
//
// resolve_user_workspace(st_user_id) is a SECURITY DEFINER PostgreSQL function
// (RLS-bypassing) that resolves the caller's own workspace_id + role BEFORE the
// app.workspace_id GUC is set, breaking the chicken-and-egg between users RLS
// and workspace resolution (P-4 F2 — HIGH).
//
// The NestJS AuthRepository.getUserWithRole method will be extended to return
// this shape (B-2 step). This shared type pins the contract so both the
// resolver function and getUserWithRole return the same shape, and B-2's
// request-scoped workspace provider can import it without depending on the
// api module directly.
// ---------------------------------------------------------------------------

/**
 * ResolveUserWorkspaceResult — the shape returned by:
 *   1. The SECURITY DEFINER SQL function resolve_user_workspace(st_user_id)
 *   2. AuthRepository.getUserWithRole (extended in B-2 to include workspaceId)
 *
 * Used by B-2's request-scoped workspace provider to:
 *   - extract workspaceId → set app.workspace_id GUC on the dedicated connection
 *   - extract roleName → supply the DB-authoritative role claim
 *   - extract id → FK-safe actor identity for audit writes
 *
 * NOTE: workspace_id is resolved server-side from the authenticated ST user id.
 * It is NEVER accepted from client input.
 */
export const resolveUserWorkspaceResultSchema = z
  .object({
    /** app-DB users.id — UUID FK-safe for audit actor_user_id, created_by, etc. */
    id: z.string().uuid(),
    /** DB-authoritative role name (replaces stale JWT claim). */
    roleName: z.string().min(1),
    /** Tenant boundary id for this user — used to set app.workspace_id GUC. */
    workspaceId: workspaceIdSchema,
  })
  .strict();

export type ResolveUserWorkspaceResult = z.infer<typeof resolveUserWorkspaceResultSchema>;

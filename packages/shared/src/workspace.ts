import { z } from 'zod';

// ---------------------------------------------------------------------------
// Workspace — top-level tenant boundary (Wave-17, task 0db154ff).
//
// One workspace = one pilot firm. All tenant tables carry a workspace_id FK
// enforced by RLS via the app.workspace_id GUC.
// ---------------------------------------------------------------------------

/**
 * Branded UUID type for workspace identifiers.
 *
 * Callers that hold a WorkspaceId are asserting the value has already been
 * validated as a UUID (by the DB layer or by workspaceIdSchema). Use the
 * plain `string` type at untrusted boundaries (request input, DB rows before
 * validation) and brand on the way out.
 */
export type WorkspaceId = string & { readonly __brand: 'WorkspaceId' };

/**
 * Zod schema for a workspace id. Validates UUID format and narrows to the
 * branded WorkspaceId type.
 */
export const workspaceIdSchema = z
  .string()
  .uuid()
  .transform((val) => val as WorkspaceId);

/**
 * The stable default workspace UUID seeded by migration 0014.
 * This is the backfill target for all existing rows and the pilot firm's
 * tenant boundary. Fixed constant — do not change without a new migration.
 */
export const DEFAULT_WORKSPACE_ID =
  'a1b2c3d4-0000-4000-8000-000000000001' as WorkspaceId;

// ---------------------------------------------------------------------------
// Workspace read shape — what a workspace record looks like at the API boundary.
//
// The workspaces table has exactly (id, name, created_at). This schema mirrors
// those columns and is the cross-package contract for any surface that needs to
// expose or receive a workspace record (e.g. a future admin workspace-list
// endpoint). For now it pins the shape so B-2 and downstream consumers share
// one definition.
// ---------------------------------------------------------------------------

export const workspaceSchema = z
  .object({
    id: workspaceIdSchema,
    /** Human-readable workspace name (e.g. 'Acme Capital'). */
    name: z.string().min(1),
    createdAt: z.string().datetime(),
  })
  .strict();

export type Workspace = z.infer<typeof workspaceSchema>;

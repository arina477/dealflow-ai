import { z } from 'zod';

// ---------------------------------------------------------------------------
// Workspace settings read shape
// ---------------------------------------------------------------------------

/**
 * WorkspaceSettings — what GET /admin/workspace-settings returns.
 * Single-row-per-firm; all fields are nullable (settings may be partially filled).
 */
export const workspaceSettingsSchema = z
  .object({
    id: z.string().uuid(),
    /** Legal firm name. */
    firmName: z.string().nullable(),
    /** Registered address. */
    firmAddress: z.string().nullable(),
    /** Regulatory identifiers (e.g. CRD number). */
    regulatoryIds: z.string().nullable(),
    /** Primary contact full name. */
    primaryContactName: z.string().nullable(),
    /** Primary contact email. */
    primaryContactEmail: z.string().email().nullable(),
    // ── Default compliance profile ────────────────────────────────────────
    /** Default jurisdiction for new mandates (ISO-3166 or label). */
    defaultJurisdiction: z.string().nullable(),
    /** FK into disclaimer_templates — the default disclaimer for new mandates. */
    defaultDisclaimerTemplateId: z.string().uuid().nullable(),
    /** Default suppression scope for new mandates ('firm' | 'mandate' | null). */
    defaultSuppressionScope: z.enum(['firm', 'mandate']).nullable(),
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime().nullable(),
  })
  .strict();

export type WorkspaceSettings = z.infer<typeof workspaceSettingsSchema>;

// ---------------------------------------------------------------------------
// Workspace settings update input
// ---------------------------------------------------------------------------

/**
 * WorkspaceSettingsUpdateInput — PUT /admin/workspace-settings body.
 * All fields are optional (partial update semantics — send only what changes).
 */
export const workspaceSettingsUpdateSchema = z
  .object({
    firmName: z.string().min(1).optional(),
    firmAddress: z.string().optional(),
    regulatoryIds: z.string().optional(),
    primaryContactName: z.string().optional(),
    primaryContactEmail: z.string().email().optional(),
    defaultJurisdiction: z.string().optional(),
    defaultDisclaimerTemplateId: z.string().uuid().optional().nullable(),
    defaultSuppressionScope: z.enum(['firm', 'mandate']).optional().nullable(),
  })
  .strict();

export type WorkspaceSettingsUpdateInput = z.infer<typeof workspaceSettingsUpdateSchema>;

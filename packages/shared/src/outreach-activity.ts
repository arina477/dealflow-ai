/**
 * Shared Zod contracts for wave-20 outreach_activity (task c3776cac).
 *
 * Shapes:
 *   - outreachActivityChannelEnum   — channel enum (call | email | linkedin | other)
 *   - outreachActivityStatusEnum    — status enum (planned | completed | cancelled)
 *   - outreachActivitySchema        — READ shape (passthrough — server may add fields)
 *   - createOutreachActivitySchema  — POST /outreach-activity input (strict)
 *   - updateOutreachActivitySchema  — PATCH /outreach-activity/:id input (strict)
 *   - listOutreachActivitySchema    — GET /outreach-activity response
 *
 * DESIGN INVARIANTS:
 *   - READ shapes use .passthrough() (rule 5 — forward-compat).
 *   - INPUT shapes use .strict() (mass-assignment guard).
 *   - Nullable fields represented explicitly (null, NOT undefined-only).
 *   - Timestamps use z.string() (ISO-8601 from Drizzle mode:'string').
 *   - The 0-or-1 deal-target FKs (outreachId, matchCandidateId, pipelineId,
 *     mandateId) are all nullable in both input and read shapes.
 *   - createdBy is NOT in the input schema — it is server-derived from ALS
 *     (SF4: never client-supplied). The read shape includes it for audit display.
 *   - workspaceId is NOT in the input schema — server-derived from GUC (SF1).
 */

import { z } from 'zod';

// ---------------------------------------------------------------------------
// Enum schemas
// ---------------------------------------------------------------------------

/** Outreach activity channel — pure record labels, no downstream dispatch. */
export const outreachActivityChannelEnum = z.enum(['call', 'email', 'linkedin', 'other']);
export type OutreachActivityChannel = z.infer<typeof outreachActivityChannelEnum>;

/** Outreach activity status lifecycle. */
export const outreachActivityStatusEnum = z.enum(['planned', 'completed', 'cancelled']);
export type OutreachActivityStatus = z.infer<typeof outreachActivityStatusEnum>;

// ---------------------------------------------------------------------------
// Read shape — one outreach_activity row (server response)
// ---------------------------------------------------------------------------

/**
 * outreachActivitySchema — READ shape for one outreach_activity row.
 * .passthrough() — forward-compat: server may add fields without breaking clients.
 * All nullable fields are represented as z.string().nullable() (NOT undefined).
 */
export const outreachActivitySchema = z
  .object({
    id: z.string().uuid(),
    workspaceId: z.string().uuid(),
    channel: outreachActivityChannelEnum,
    status: outreachActivityStatusEnum,
    subject: z.string().min(1),
    notes: z.string().nullable(),
    dueAt: z.string().nullable(),
    completedAt: z.string().nullable(),
    /** 0-or-1 deal-target link FKs — all nullable. */
    outreachId: z.string().uuid().nullable(),
    matchCandidateId: z.string().uuid().nullable(),
    pipelineId: z.string().uuid().nullable(),
    mandateId: z.string().uuid().nullable(),
    /** Server-derived — the app users.id of the creator. */
    createdBy: z.string().uuid(),
    createdAt: z.string(),
    updatedAt: z.string().nullable(),
  })
  .passthrough();

export type OutreachActivity = z.infer<typeof outreachActivitySchema>;

// ---------------------------------------------------------------------------
// Create input — POST /outreach-activity
// ---------------------------------------------------------------------------

/**
 * createOutreachActivitySchema — strict input for creating an activity.
 *
 * Mass-assignment guard: unknown keys are rejected (.strict()).
 * Server-derived fields excluded: workspaceId (GUC), createdBy (ALS actor).
 * All four deal-target FKs are optional (0-or-1 link — all may be null/absent).
 */
export const createOutreachActivitySchema = z
  .object({
    channel: outreachActivityChannelEnum,
    /** Status defaults to 'planned' on the server if omitted. */
    status: outreachActivityStatusEnum.optional(),
    subject: z.string().min(1, 'Subject is required'),
    notes: z.string().nullable().optional(),
    dueAt: z.string().nullable().optional(),
    /** Optional 0-or-1 deal-target FKs — all nullable/optional. */
    outreachId: z.string().uuid().nullable().optional(),
    matchCandidateId: z.string().uuid().nullable().optional(),
    pipelineId: z.string().uuid().nullable().optional(),
    mandateId: z.string().uuid().nullable().optional(),
  })
  .strict();

export type CreateOutreachActivityInput = z.infer<typeof createOutreachActivitySchema>;

// ---------------------------------------------------------------------------
// Update input — PATCH /outreach-activity/:id
// ---------------------------------------------------------------------------

/**
 * updateOutreachActivitySchema — strict partial input for updating an activity.
 *
 * Covers status transitions (planned → completed / cancelled) and field edits.
 * completedAt is set server-side when status transitions to 'completed'.
 * Unknown keys rejected (.strict()).
 */
export const updateOutreachActivitySchema = z
  .object({
    status: outreachActivityStatusEnum.optional(),
    subject: z.string().min(1).optional(),
    notes: z.string().nullable().optional(),
    dueAt: z.string().nullable().optional(),
    outreachId: z.string().uuid().nullable().optional(),
    matchCandidateId: z.string().uuid().nullable().optional(),
    pipelineId: z.string().uuid().nullable().optional(),
    mandateId: z.string().uuid().nullable().optional(),
  })
  .strict();

export type UpdateOutreachActivityInput = z.infer<typeof updateOutreachActivitySchema>;

// ---------------------------------------------------------------------------
// List response
// ---------------------------------------------------------------------------

/**
 * listOutreachActivityResponseSchema — GET /outreach-activity response.
 * Returns an array of outreach_activity rows for the caller's workspace.
 * The list is ordered by (status='planned' first, then due_at ASC).
 */
export const listOutreachActivityResponseSchema = z
  .object({
    activities: z.array(outreachActivitySchema),
  })
  .passthrough();

export type ListOutreachActivityResponse = z.infer<typeof listOutreachActivityResponseSchema>;

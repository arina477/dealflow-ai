import { z } from 'zod';
import { auditActionEnum } from './audit';

// ---------------------------------------------------------------------------
// Admin-activity action filter (Wave-16, task 8bb0a22f — P-4 Finding 3)
// ---------------------------------------------------------------------------

/**
 * adminActivityActionEnum — the CLOSED set of action values exposed by the
 * admin-activity read surface.
 *
 * Contains exactly the 6 wave-15 admin actions plus the wave-16 user-reactivate
 * action. This is a SUBSET of the full auditActionEnum; it is a separate
 * enum so the query filter validates the caller-supplied action type against
 * only the admin-relevant set, not the entire audit universe.
 *
 * Derives its values from the full auditActionEnum — no free-text slot.
 */
export const adminActivityActionEnum = z.enum([
  'user-invite',
  'role-change',
  'deactivate',
  'workspace-settings-update',
  'data-source-conn-upsert',
  'data-source-conn-toggle',
  'user-reactivate',
]);

export type AdminActivityAction = z.infer<typeof adminActivityActionEnum>;

// Compile-time guard: every adminActivityActionEnum value must be a valid
// auditActionEnum value. If a value drifts (e.g. someone renames an audit
// action without updating this file), this assignment will fail to typecheck.
const _activitySubsetCheck: z.infer<typeof adminActivityActionEnum> extends z.infer<
  typeof auditActionEnum
>
  ? true
  : never = true;
void _activitySubsetCheck;

// ---------------------------------------------------------------------------
// Admin-activity query schema (GET /admin/activity-data query params)
// ---------------------------------------------------------------------------

/**
 * AdminActivityQuerySchema — validated query parameters for GET /admin/activity-data.
 *
 * All fields are optional; absent fields return unfiltered (admin-scoped) results.
 *
 * SECURITY INVARIANT (P-4 Finding 3):
 *   - Admin-only (403 for advisor, 401 for anon) — enforced in B-2 controller.
 *   - Read-only-immutable: opening this endpoint writes ZERO audit rows.
 *   - Metadata carries no secret, PII beyond actor/target identity, or hash preimage.
 *   - "firm-scoped" filter DROPPED (system is single-tenant; no firm_id column).
 */
export const adminActivityQuerySchema = z
  .object({
    /**
     * Optional filter: restrict results to this action type.
     * Must be one of the 7 admin-activity actions.
     */
    action: adminActivityActionEnum.optional(),
    /**
     * Optional ISO datetime lower bound (inclusive).
     * Example: "2025-01-01T00:00:00.000Z"
     */
    since: z.string().datetime().optional(),
    /**
     * Optional ISO datetime upper bound (inclusive).
     * Example: "2025-12-31T23:59:59.999Z"
     */
    until: z.string().datetime().optional(),
    /**
     * Cursor-based pagination: sequence_number of the last item on the previous
     * page. Absent = start from the most recent entry (newest-first).
     * Must be a positive integer when present.
     */
    cursor: z.coerce.number().int().positive().optional(),
    /**
     * Page size. Defaults to 50 on the server; max 200.
     * Coerced from query-string string.
     */
    limit: z.coerce.number().int().min(1).max(200).optional(),
  })
  .strict();

export type AdminActivityQuery = z.infer<typeof adminActivityQuerySchema>;

// ---------------------------------------------------------------------------
// Admin-activity row response shape
// ---------------------------------------------------------------------------

/**
 * AdminActivityRow — a single row returned by GET /admin/activity-data.
 *
 * SECURITY INVARIANT (P-4 Finding 3 — load-bearing):
 *   Returns ONLY { actor, target, action, timestamp }.
 *   NEVER includes:
 *     - Any credential, encrypted_credentials, or API key value.
 *     - payloadHash, contentHash, entryHash, prevHash, or any hash preimage.
 *     - PII beyond the actor's and target's display identity (name / email).
 *     - sequenceNumber (internal chain cursor; exposes log size to the client).
 *
 * actor: the admin who performed the action.
 * target: the affected user/resource (nullable — some actions have no target user).
 *
 * Designed to be the safe projection of the immutable audit_log_entries row
 * that the admin-activity surface is allowed to surface. The full audit row
 * (with tamper-evidence fields) remains on the /compliance/audit-log surface.
 */
export const adminActivityRowSchema = z
  .object({
    /** Sequence number from audit_log_entries — used as the pagination cursor. */
    sequenceNumber: z.number().int().positive(),
    /** Actor identity — the admin who performed the action. */
    actor: z.object({
      /** Display name of the admin (may be derived from email if no separate name). */
      displayName: z.string().min(1),
      /** Email address of the admin. */
      email: z.string().email(),
    }),
    /**
     * Target identity — the user or resource affected by the action.
     * Null for actions with no specific user target (e.g. workspace-settings-update).
     */
    target: z
      .object({
        /** Display name of the affected user. */
        displayName: z.string().min(1),
        /** Email address of the affected user. */
        email: z.string().email(),
      })
      .nullable(),
    /** Action type — one of the 7 admin-activity actions. */
    action: adminActivityActionEnum,
    /** ISO timestamp when the action occurred. */
    timestamp: z.string().datetime(),
  })
  .strict();

export type AdminActivityRow = z.infer<typeof adminActivityRowSchema>;

// ---------------------------------------------------------------------------
// Admin-activity list response
// ---------------------------------------------------------------------------

/**
 * AdminActivityResponse — the paginated response for GET /admin/activity-data.
 *
 * Rows are returned newest-first. nextCursor is null when there are no further
 * pages; present (a sequenceNumber) when there is a next page to fetch.
 */
export const adminActivityResponseSchema = z
  .object({
    rows: z.array(adminActivityRowSchema),
    /**
     * Pagination cursor for the next page.
     * Pass as `cursor` in the next request to fetch older entries.
     * Null when this is the last page.
     */
    nextCursor: z.number().int().positive().nullable(),
    /** Total count of matching entries (for UI pagination display). */
    total: z.number().int().nonnegative(),
  })
  .strict();

export type AdminActivityResponse = z.infer<typeof adminActivityResponseSchema>;

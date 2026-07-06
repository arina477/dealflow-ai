import { z } from 'zod';
import { roleEnum } from './auth';

// ---------------------------------------------------------------------------
// User admin read shape
// ---------------------------------------------------------------------------

/**
 * UserAdminRecord — what GET /admin/users returns per user row.
 * Credentials are never included. deactivated_at exposes the soft-deactivation
 * state; UI maps it to active/inactive.
 */
export const userAdminRecordSchema = z
  .object({
    id: z.string().uuid(),
    email: z.string().email(),
    role: roleEnum,
    /** ISO timestamp or null — null = active user. */
    deactivatedAt: z.string().datetime().nullable(),
    createdAt: z.string().datetime(),
    /** App users.id of the user who invited this user; null for bootstrap invite. */
    invitedBy: z.string().uuid().nullable(),
  })
  .strict();

export type UserAdminRecord = z.infer<typeof userAdminRecordSchema>;

export const userAdminListResponseSchema = z
  .object({
    users: z.array(userAdminRecordSchema),
  })
  .strict();

export type UserAdminListResponse = z.infer<typeof userAdminListResponseSchema>;

// ---------------------------------------------------------------------------
// Invite input
// ---------------------------------------------------------------------------

/**
 * AdminInviteInput — POST /admin/users/invite body.
 * No email-send is triggered; only an invite record is created (record-only mode).
 */
export const adminInviteInputSchema = z
  .object({
    email: z.string().email(),
    /** Role to assign to the invited user when they sign up. */
    role: roleEnum,
  })
  .strict();

export type AdminInviteInput = z.infer<typeof adminInviteInputSchema>;

export const adminInviteResponseSchema = z
  .object({
    inviteId: z.string().uuid(),
    email: z.string().email(),
    role: roleEnum,
    /** ISO expiry timestamp. */
    expiry: z.string().datetime(),
  })
  .strict();

export type AdminInviteResponse = z.infer<typeof adminInviteResponseSchema>;

// ---------------------------------------------------------------------------
// Assign role input
// ---------------------------------------------------------------------------

/**
 * AdminAssignRoleInput — PATCH /admin/users/:id/role body.
 */
export const adminAssignRoleInputSchema = z
  .object({
    role: roleEnum,
  })
  .strict();

export type AdminAssignRoleInput = z.infer<typeof adminAssignRoleInputSchema>;

// ---------------------------------------------------------------------------
// Deactivate input (body is empty; signal is the POST to /deactivate)
// ---------------------------------------------------------------------------

/**
 * AdminDeactivateResponse — POST /admin/users/:id/deactivate response.
 */
export const adminDeactivateResponseSchema = z
  .object({
    id: z.string().uuid(),
    deactivatedAt: z.string().datetime(),
  })
  .strict();

export type AdminDeactivateResponse = z.infer<typeof adminDeactivateResponseSchema>;

// ---------------------------------------------------------------------------
// Reactivate input + response (Wave-16, task 042cf4e6)
// ---------------------------------------------------------------------------

/**
 * AdminReactivateInput — POST /admin/users/:id/reactivate path param only.
 * Body is empty; userId comes from the :id path parameter.
 * Defined here for symmetry with the deactivate contract and to give B-2
 * a Zod-validated param type.
 */
export const adminReactivateParamsSchema = z
  .object({
    /** The app users.id of the user to reactivate (UUID, from :id path param). */
    id: z.string().uuid(),
  })
  .strict();

export type AdminReactivateParams = z.infer<typeof adminReactivateParamsSchema>;

/**
 * AdminReactivateResponse — POST /admin/users/:id/reactivate response.
 *
 * Returns the full UserAdminRecord with deactivatedAt=null, confirming
 * the user is now active. Mirrors the AdminDeactivateResponse shape but
 * uses the full record so the frontend can refresh the row in-place.
 *
 * SECURITY: no credential, PII beyond the user's own stored fields, or
 * audit hash/preimage is included. deactivatedAt=null is the only state change.
 */
export const adminReactivateResponseSchema = z
  .object({
    id: z.string().uuid(),
    email: z.string().email(),
    /** null = user is now active (deactivated_at was set to NULL). */
    deactivatedAt: z.null(),
  })
  .strict();

export type AdminReactivateResponse = z.infer<typeof adminReactivateResponseSchema>;

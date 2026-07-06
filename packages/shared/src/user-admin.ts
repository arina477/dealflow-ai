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

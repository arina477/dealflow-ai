import { z } from 'zod';

// ---------------------------------------------------------------------------
// Role enum — single source of truth for role names across API and DB
// API validates at the boundary; roles table is authoritative for storage.
// ---------------------------------------------------------------------------

export const roleEnum = z.enum(['advisor', 'analyst', 'compliance', 'admin']);

export type Role = z.infer<typeof roleEnum>;

// ---------------------------------------------------------------------------
// Password policy — min 8 chars (applied at signup + reset/confirm)
// ---------------------------------------------------------------------------

const passwordSchema = z.string().min(8, 'Password must be at least 8 characters');

// ---------------------------------------------------------------------------
// POST /auth/invite
// Request:  { email, role }
// Response: { token, expiry }   → 201
// ---------------------------------------------------------------------------

export const inviteCreateRequestSchema = z
  .object({
    email: z.string().email(),
    role: roleEnum,
  })
  .strict();

export type InviteCreateRequest = z.infer<typeof inviteCreateRequestSchema>;

export const inviteCreateResponseSchema = z
  .object({
    token: z.string(),
    expiry: z.string().datetime(),
  })
  .strict();

export type InviteCreateResponse = z.infer<typeof inviteCreateResponseSchema>;

// ---------------------------------------------------------------------------
// POST /auth/signup   (invite-bound only — no public self-signup)
// Request:  { inviteToken, password }
// Response: { userId, email, role }   → 201 + Set-Cookie session (role claim)
// ---------------------------------------------------------------------------

export const signupRequestSchema = z
  .object({
    inviteToken: z.string().min(1),
    password: passwordSchema,
  })
  .strict();

export type SignupRequest = z.infer<typeof signupRequestSchema>;

export const signupResponseSchema = z
  .object({
    userId: z.string(),
    email: z.string().email(),
    role: roleEnum,
  })
  .strict();

export type SignupResponse = z.infer<typeof signupResponseSchema>;

// ---------------------------------------------------------------------------
// POST /auth/login  (SDK route alias: /auth/signin)
// Request:  { email, password }
// Response: session established via Set-Cookie; body carries user summary
// ---------------------------------------------------------------------------

export const loginRequestSchema = z
  .object({
    email: z.string().email(),
    password: z.string().min(1),
  })
  .strict();

export type LoginRequest = z.infer<typeof loginRequestSchema>;

// Login success body mirrors signupResponse — same user-summary shape.
export const loginResponseSchema = signupResponseSchema;

export type LoginResponse = z.infer<typeof loginResponseSchema>;

// ---------------------------------------------------------------------------
// GET /auth/me   (requires valid session)
// Response: { userId, email, role }   → 200 | 401
// ---------------------------------------------------------------------------

export const meResponseSchema = z
  .object({
    userId: z.string(),
    email: z.string().email(),
    role: roleEnum,
  })
  .strict();

export type MeResponse = z.infer<typeof meResponseSchema>;

// ---------------------------------------------------------------------------
// POST /auth/reset/request
// Request:  { email }
// Response: 202 always — NO user-enumeration (same body for existing / unknown)
// ---------------------------------------------------------------------------

export const resetRequestSchema = z
  .object({
    email: z.string().email(),
  })
  .strict();

export type ResetRequest = z.infer<typeof resetRequestSchema>;

// ---------------------------------------------------------------------------
// POST /auth/reset/confirm
// Request:  { token, password }
// Response: 200 | 4xx (invalid/expired token or weak password)
// ---------------------------------------------------------------------------

export const resetConfirmSchema = z
  .object({
    token: z.string().min(1),
    password: passwordSchema,
  })
  .strict();

export type ResetConfirm = z.infer<typeof resetConfirmSchema>;

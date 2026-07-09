/**
 * AuthService (wave-2, task e1c0e81e).
 *
 * Business logic for the six /auth endpoints. Owns the two-system write
 * (SuperTokens Core user + app-DB users row) with compensation, the invite
 * validation + concurrent-consumption ordering, and the no-user-enumeration
 * response discipline on reset + login-adjacent paths.
 *
 * Security invariants enforced here (cited per method):
 *   - invite-only: no valid invite → no Core user + no app user (signup)
 *   - no user-enumeration: reset/request always 202; failures are generic
 *   - role claim mirrored into the session (via createNewSession override)
 *   - no secrets logged (only opaque ids / counts ever logged)
 */

import { createHash, randomBytes } from 'node:crypto';

import type {
  InviteCreateRequest,
  InviteCreateResponse,
  MeResponse,
  ResetConfirm,
  ResetRequest,
  SignupFirmRequest,
  SignupFirmResponse,
  SignupRequest,
  SignupResponse,
} from '@dealflow/shared';
import {
  BadRequestException,
  Injectable,
  Logger,
  UnauthorizedException,
  UnprocessableEntityException,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import supertokens from 'supertokens-node';
import EmailPassword from 'supertokens-node/recipe/emailpassword';
import type { SessionContainer } from 'supertokens-node/recipe/session';
import Session from 'supertokens-node/recipe/session';
import type { InviteBootstrap } from './auth.repository';
// biome-ignore lint/style/useImportType: injected via DI, needs runtime metadata
import { AuthRepository } from './auth.repository';

const TENANT_ID = 'public';
/** Invite lifetime: 7 days. */
const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Postgres SQLSTATE class 23 = integrity_constraint_violation (23505 unique,
 * 23503 foreign_key, 23502 not_null, 23514 check). The node-postgres driver
 * surfaces these as an Error carrying a string `code`. A signup that trips one
 * of these is a client-observable conflict (e.g. the email / supertokens_user_id
 * uniqueness guard, or a lost invite race that slipped past the FOR UPDATE
 * predicate) — a "cannot complete signup" outcome, not a server fault, so it
 * must NOT surface as a raw 500 that could leak DB internals.
 */
function isExpectedSignupDbError(err: unknown): boolean {
  if (typeof err !== 'object' || err === null) {
    return false;
  }
  const code = (err as { code?: unknown }).code;
  return typeof code === 'string' && code.startsWith('23');
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(private readonly repository: AuthRepository) {}

  // ── POST /auth/invite ──────────────────────────────────────────────────
  /**
   * Create an invite row. The plaintext token is crypto-random and returned to
   * the caller ONCE; only its SHA-256 hash is persisted (token hashed at rest,
   * security.md). Role is validated against the roles table (defence-in-depth
   * on top of the Zod enum) → 422 if the name is not one of the 4 roles.
   *
   * wave-35 task 93179911: invitedByUserId is the admin's app-DB users.id (UUID),
   * resolved in the controller from the verified session. Attribution is now set
   * on every invite (was null/"later slice" before this fix).
   */
  async createInvite(
    input: InviteCreateRequest,
    invitedByUserId: string
  ): Promise<InviteCreateResponse> {
    const roleId = await this.repository.findRoleIdByName(input.role);
    if (roleId === null) {
      throw new UnprocessableEntityException('Unknown role');
    }

    const token = randomBytes(32).toString('base64url');
    const tokenHash = this.hashToken(token);
    const expiry = new Date(Date.now() + INVITE_TTL_MS).toISOString();

    await this.repository.createInvite({
      tokenHash,
      email: input.email,
      roleId,
      invitedBy: invitedByUserId,
      expiry,
    });

    return { token, expiry };
  }

  // ── POST /auth/signup (invite-bound) ───────────────────────────────────
  /**
   * Invite-only account creation. Ordering guarantees the invite-only
   * invariant AND atomicity:
   *
   *   1. Validate the invite is present/unexpired/unconsumed (cheap pre-check).
   *      If invalid → 4xx, and NOTHING is created (no Core user, no app user).
   *   2. Create the SuperTokens Core user (EmailPassword.signUp).
   *   3. In ONE app-DB transaction: row-lock + re-validate the invite, mark it
   *      consumed, and INSERT the app users row (1:1 supertokens_user_id).
   *   4. If step 3 yields null (lost the concurrent race / invalidated between
   *      1 and 3) → COMPENSATE by deleting the Core user just created, then
   *      4xx. Net effect: no orphaned Core user, exactly one winner.
   *   5. Mint the session — createNewSession override attaches the role claim.
   */
  async signup(input: SignupRequest, req: Request, res: Response): Promise<SignupResponse> {
    const tokenHash = this.hashToken(input.inviteToken);

    // (1) Pre-check: reject invalid invites BEFORE any Core user is created.
    // getInviteEmail calls the SECURITY DEFINER function resolve_invite() via
    // raw SQL — bypasses FORCE RLS on invites, which has no GUC at this point.
    // Returns { email, workspaceId } or null for absent/expired/consumed invites.
    // workspaceId is server-derived from the invite row (never client-supplied).
    const inviteBootstrap: InviteBootstrap | null = await this.repository.getInviteEmail(tokenHash);
    if (inviteBootstrap === null) {
      throw new BadRequestException('Invalid or expired invite');
    }
    const { email: inviteEmail, workspaceId: inviteWorkspaceId } = inviteBootstrap;

    // (2) Create the SuperTokens Core user.
    const signUpResult = await EmailPassword.signUp(TENANT_ID, inviteEmail, input.password);

    if (signUpResult.status !== 'OK') {
      // EMAIL_ALREADY_EXISTS_ERROR etc. — generic 4xx, no account state leaked.
      throw new BadRequestException('Unable to complete signup');
    }

    const supertokensUserId = signUpResult.recipeUserId.getAsString();

    // (3) Atomic consume + app-user create under a row lock.
    // runInTransactionWithWorkspace sets app.workspace_id = inviteWorkspaceId on
    // the dedicated transaction connection so FORCE RLS on invites + users passes.
    // The workspaceId is sourced from the invite row — invitee joins the INVITE'S
    // workspace (the admin's workspace that issued the invite).
    let created: Awaited<ReturnType<AuthRepository['consumeInviteAndCreateUser']>> | null = null;
    try {
      created = await this.repository.runInTransactionWithWorkspace(inviteWorkspaceId, (tx) =>
        this.repository.consumeInviteAndCreateUser(tx, {
          tokenHash,
          supertokensUserId,
        })
      );
    } catch (err) {
      // App-DB failure after the Core user was created → compensate first (so no
      // orphaned Core user survives), THEN decide how to surface the error.
      await this.compensateCoreUser(supertokensUserId);

      // Expected DB races/conflicts (e.g. users_email_unique /
      // users_supertokens_user_id_unique violation, or another constraint hit)
      // are a client-observable "cannot complete signup" outcome, NOT a server
      // fault. Map them to the SAME generic 4xx already used elsewhere on this
      // path (no enumeration: identical message whatever the underlying cause).
      // Only genuinely unexpected errors are rethrown — a global filter renders
      // those generically without leaking DB internals.
      if (isExpectedSignupDbError(err)) {
        throw new BadRequestException('Unable to complete signup');
      }
      throw err;
    }

    // (4) Lost the race / invite became invalid between (1) and (3).
    if (created === null) {
      await this.compensateCoreUser(supertokensUserId);
      throw new BadRequestException('Invalid or expired invite');
    }

    // (5) Mint the session; the createNewSession override attaches the role.
    await Session.createNewSession(
      req,
      res,
      TENANT_ID,
      supertokens.convertToRecipeUserId(supertokensUserId)
    );

    return {
      userId: supertokensUserId,
      email: created.email,
      role: created.roleName as SignupResponse['role'],
    };
  }

  // ── POST /auth/signup-firm (self-serve workspace-creating signup) ──────
  /**
   * Self-serve workspace creation. A brand-new user creates their own firm
   * workspace and becomes the FIRST ADMIN. This is DISTINCT from the invite-bound
   * signup (which joins an EXISTING workspace). Do NOT alter the invite+signup flow.
   *
   * Atomicity + compensation (mirrors the invite-bound signup):
   *   1. Validate input (Zod schema enforced at the controller boundary).
   *   2. Create the SuperTokens Core user (EmailPassword.signUp).
   *   3. Call create_firm_workspace SECURITY DEFINER function — atomically:
   *        a. server-mints a new workspace_id (gen_random_uuid()) — NEVER client-supplied
   *        b. INSERTs the workspaces row (name = firmName)
   *        c. INSERTs the users row (supertokens_user_id, email, role='admin', workspace_id)
   *      Cross-firm steering is structurally impossible: no parameter accepts a workspace_id.
   *   4. If step 3 fails after step 2 → COMPENSATE (delete the Core user) so no orphan.
   *   5. Mint the session — createNewSession override attaches the admin role claim.
   *
   * Security invariants:
   *   - workspace_id is SERVER-MINTED (inside the DB function); firmName is DATA.
   *   - The RLS-safe bootstrap uses the SECURITY DEFINER function (same pattern as
   *     resolve_invite / resolve_user_workspace in migrations 0014/0015).
   *   - Compensate-delete-Core-user on any DB failure — no orphaned Core users.
   *   - M8 RLS holds: the new workspace is isolated; cross-firm read = 0 rows.
   */
  async signupFirm(
    input: SignupFirmRequest,
    req: Request,
    res: Response
  ): Promise<SignupFirmResponse> {
    // (2) Create the SuperTokens Core user.
    const signUpResult = await EmailPassword.signUp(
      TENANT_ID,
      input.email.toLowerCase(),
      input.password
    );

    if (signUpResult.status !== 'OK') {
      // EMAIL_ALREADY_EXISTS_ERROR etc. — generic 4xx, no account state leaked.
      throw new BadRequestException('Unable to complete signup');
    }

    const supertokensUserId = signUpResult.recipeUserId.getAsString();

    // (3) Atomically create the workspace + admin users row via SECURITY DEFINER.
    // workspace_id is server-minted inside the function — never client-controlled.
    let created: Awaited<ReturnType<AuthRepository['createFirmWorkspace']>> | null = null;
    try {
      created = await this.repository.createFirmWorkspace({
        supertokensUserId,
        email: input.email.toLowerCase(),
        firmName: input.firmName,
      });
    } catch (err) {
      // DB failure after Core user created → compensate (delete Core user) then
      // surface the error appropriately. Mirrors the invite-bound signup atomicity.
      await this.compensateCoreUser(supertokensUserId);

      if (isExpectedSignupDbError(err)) {
        throw new BadRequestException('Unable to complete signup');
      }
      throw err;
    }

    // (4) Null means the DB function returned no row (admin role missing — invariant violation).
    if (created === null) {
      await this.compensateCoreUser(supertokensUserId);
      throw new BadRequestException('Unable to complete signup');
    }

    // (5) Mint the session; the createNewSession override attaches the admin role claim.
    await Session.createNewSession(
      req,
      res,
      TENANT_ID,
      supertokens.convertToRecipeUserId(supertokensUserId)
    );

    return {
      userId: supertokensUserId,
      email: input.email.toLowerCase(),
      role: created.roleName as SignupFirmResponse['role'],
    };
  }

  // ── GET /auth/me ───────────────────────────────────────────────────────
  /**
   * Identity + role for the current session. Called behind SessionGuard (401
   * for anon). The role is read from the authoritative app-DB users row (the
   * claim is a mirror; me returns the source-of-truth value).
   */
  async me(session: SessionContainer): Promise<MeResponse> {
    const supertokensUserId = session.getUserId();
    const user = await this.repository.findUserBySupertokensUserId(supertokensUserId);

    if (user === null) {
      // Valid session but no app-DB user (should not happen post-signup) —
      // treat as unauthenticated rather than leaking an inconsistent state.
      throw new UnauthorizedException();
    }

    return {
      userId: supertokensUserId,
      email: user.email,
      role: user.roleName as MeResponse['role'],
    };
  }

  // ── POST /auth/reset/request ───────────────────────────────────────────
  /**
   * NO USER-ENUMERATION: returns nothing meaningful to the caller either way;
   * the controller always responds 202. For an existing account a reset token
   * is created and (this slice) logged/stubbed — no live email provider yet.
   * For an unknown email we silently no-op. The response is identical.
   */
  async requestReset(input: ResetRequest): Promise<void> {
    const stUsers = await supertokens.listUsersByAccountInfo(TENANT_ID, {
      email: input.email.toLowerCase(),
    });

    const user = stUsers[0];
    if (!user) {
      // Unknown email → same outward behaviour (202). Do not log the address.
      return;
    }

    const loginMethod = user.loginMethods.find((m) => m.recipeId === 'emailpassword');
    if (!loginMethod) {
      return;
    }

    // NO USER-ENUMERATION (status-code oracle guard): the existing-account branch
    // does real work (createResetPasswordToken, and listUsersByAccountInfo above)
    // that can throw. If any of it propagated, only the account-EXISTS path could
    // 500 — a status-code oracle that reveals which emails have accounts. Wrap and
    // swallow so BOTH paths are observably identical (always resolve → 202). Log
    // an opaque failure id only; NEVER the email or the token.
    try {
      const tokenResult = await EmailPassword.createResetPasswordToken(
        TENANT_ID,
        user.id,
        input.email.toLowerCase()
      );

      if (tokenResult.status === 'OK') {
        // Delivery is stubbed this slice. Log only that a token was issued for an
        // opaque user id — NEVER the token value or the email address.
        this.logger.log(`Password-reset token issued for user ${user.id}`);
      }
    } catch {
      // Swallow: surfacing this error would make the existing-account path the
      // only one that can 500, defeating the no-enumeration invariant. Log an
      // opaque user id only (never the email) for operability.
      this.logger.error(`Password-reset token issuance failed for user ${user.id}`);
    }
  }

  // ── POST /auth/reset/confirm ───────────────────────────────────────────
  /**
   * Consume a reset token and set the new password. Invalid/expired token →
   * 4xx (generic). Password policy is enforced by the Zod DTO before we reach
   * here; a Core-side policy violation also maps to 4xx.
   */
  async confirmReset(input: ResetConfirm): Promise<void> {
    const result = await EmailPassword.resetPasswordUsingToken(
      TENANT_ID,
      input.token,
      input.password
    );

    if (result.status !== 'OK') {
      throw new BadRequestException('Invalid or expired reset token');
    }
  }

  // ── POST /auth/logout ──────────────────────────────────────────────────
  /**
   * Revoke the current session so a subsequent authenticated request → 401.
   * Runs behind SessionGuard.
   */
  async logout(session: SessionContainer): Promise<void> {
    await session.revokeSession();
  }

  // ── helpers ────────────────────────────────────────────────────────────

  /** SHA-256 of the plaintext invite token — only the hash is stored. */
  private hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  /**
   * Compensating delete of a Core user created during a signup that could not
   * complete the app-DB write. Best-effort: a failure here is logged (opaque
   * id only) but not surfaced, since the primary error is already being raised.
   */
  private async compensateCoreUser(supertokensUserId: string): Promise<void> {
    try {
      await supertokens.deleteUser(supertokensUserId);
    } catch {
      this.logger.error(
        `Compensation failed: could not delete orphaned Core user ${supertokensUserId}`
      );
    }
  }
}

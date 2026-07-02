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

import type { AuthRepository } from './auth.repository';

const TENANT_ID = 'public';
/** Invite lifetime: 7 days. */
const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

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
   */
  async createInvite(input: InviteCreateRequest): Promise<InviteCreateResponse> {
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
      invitedBy: null, // admin-only attribution is a later slice
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
    // getInviteEmail returns null for absent/expired/consumed invites, so a
    // single read both validates the invite AND yields the email for signUp.
    const inviteEmail = await this.repository.getInviteEmail(tokenHash);
    if (inviteEmail === null) {
      throw new BadRequestException('Invalid or expired invite');
    }

    // (2) Create the SuperTokens Core user.
    const signUpResult = await EmailPassword.signUp(TENANT_ID, inviteEmail, input.password);

    if (signUpResult.status !== 'OK') {
      // EMAIL_ALREADY_EXISTS_ERROR etc. — generic 4xx, no account state leaked.
      throw new BadRequestException('Unable to complete signup');
    }

    const supertokensUserId = signUpResult.recipeUserId.getAsString();

    // (3) Atomic consume + app-user create under a row lock.
    let created: Awaited<ReturnType<AuthRepository['consumeInviteAndCreateUser']>> | null = null;
    try {
      created = await this.repository.runInTransaction((tx) =>
        this.repository.consumeInviteAndCreateUser(tx, {
          tokenHash,
          supertokensUserId,
        })
      );
    } catch (err) {
      // App-DB failure after Core user created → compensate, then rethrow.
      await this.compensateCoreUser(supertokensUserId);
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

/**
 * T-2 Unit — AuthService pure logic (no DB, no Core).
 *
 * Covers the three security-critical response disciplines that are testable
 * without a live SuperTokens Core:
 *   - invite-only: invalid invite → 4xx, and NO Core user is created
 *   - invite-only compensation: lost-race → Core user deleted, 4xx
 *   - no user-enumeration: reset/request never throws + never signals existence
 *
 * The SuperTokens SDK modules and the repository are mocked at the module
 * boundary. Full runtime auth is exercised at C-2/T against a real Core.
 */

import { BadRequestException } from '@nestjs/common';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// ── Mock the SuperTokens SDK surface used by the service ────────────────────
const signUp = vi.fn();
const createResetPasswordToken = vi.fn();
const resetPasswordUsingToken = vi.fn();
const listUsersByAccountInfo = vi.fn();
const deleteUser = vi.fn();
const createNewSession = vi.fn();
const convertToRecipeUserId = vi.fn((id: string) => ({ getAsString: () => id }));

vi.mock('supertokens-node', () => ({
  default: {
    listUsersByAccountInfo: (...a: unknown[]) => listUsersByAccountInfo(...a),
    deleteUser: (...a: unknown[]) => deleteUser(...a),
    convertToRecipeUserId: (id: string) => convertToRecipeUserId(id),
  },
}));

vi.mock('supertokens-node/recipe/emailpassword', () => ({
  default: {
    signUp: (...a: unknown[]) => signUp(...a),
    createResetPasswordToken: (...a: unknown[]) => createResetPasswordToken(...a),
    resetPasswordUsingToken: (...a: unknown[]) => resetPasswordUsingToken(...a),
  },
}));

vi.mock('supertokens-node/recipe/session', () => ({
  default: {
    createNewSession: (...a: unknown[]) => createNewSession(...a),
  },
}));

import type { AuthRepository } from './auth.repository';
import { AuthService } from './auth.service';

function makeRepo(overrides: Partial<AuthRepository> = {}): AuthRepository {
  return {
    findRoleIdByName: vi.fn(),
    createInvite: vi.fn(),
    getInviteEmail: vi.fn(),
    resolveRoleRlsExempt: vi.fn(),
    resolveRoleBySupertokensUserId: vi.fn(),
    findUserBySupertokensUserId: vi.fn(),
    consumeInviteAndCreateUser: vi.fn(),
    runInTransaction: vi.fn(),
    runInTransactionWithWorkspace: vi.fn(),
    ...overrides,
  } as unknown as AuthRepository;
}

/** Default InviteBootstrap returned by a valid invite (wave-17 DEV-1 fix). */
const VALID_INVITE_BOOTSTRAP = {
  email: 'invitee@example.com',
  workspaceId: 'a1b2c3d4-0000-4000-8000-000000000001',
};

const fakeReq = {} as never;
const fakeRes = {} as never;

describe('AuthService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });
  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('signup — invite-only invariant', () => {
    it('rejects an invalid invite WITHOUT creating a Core user (4xx)', async () => {
      const repo = makeRepo({
        getInviteEmail: vi.fn().mockResolvedValue(null),
      });
      const service = new AuthService(repo);

      await expect(
        service.signup({ inviteToken: 'bad', password: 'password123' }, fakeReq, fakeRes)
      ).rejects.toBeInstanceOf(BadRequestException);

      // Security invariant: no Core user + no session on an invalid invite.
      expect(signUp).not.toHaveBeenCalled();
      expect(createNewSession).not.toHaveBeenCalled();
    });

    it('compensates (deletes the Core user) when the invite is lost in the race', async () => {
      const repo = makeRepo({
        getInviteEmail: vi.fn().mockResolvedValue(VALID_INVITE_BOOTSTRAP),
        // tx runs the work; consume returns null → lost the race.
        runInTransactionWithWorkspace: vi
          .fn()
          .mockImplementation(async (_wsId: string, work: (tx: unknown) => unknown) => work({})),
        consumeInviteAndCreateUser: vi.fn().mockResolvedValue(null),
      });
      signUp.mockResolvedValue({
        status: 'OK',
        recipeUserId: { getAsString: () => 'st-user-1' },
      });
      const service = new AuthService(repo);

      await expect(
        service.signup({ inviteToken: 'ok', password: 'password123' }, fakeReq, fakeRes)
      ).rejects.toBeInstanceOf(BadRequestException);

      // Compensation: the orphaned Core user is deleted; no session minted.
      expect(deleteUser).toHaveBeenCalledWith('st-user-1');
      expect(createNewSession).not.toHaveBeenCalled();
    });

    it('maps an app-DB unique violation to a generic 4xx (not a raw 500) and compensates', async () => {
      // Simulate the node-postgres shape for a unique_violation (SQLSTATE 23505),
      // e.g. users_email_unique / users_supertokens_user_id_unique tripping under
      // a concurrent signup. It must surface as the SAME generic BadRequest used
      // elsewhere on this path — never a raw error that could 500 + leak DB
      // internals (constraint names, SQL, etc.).
      const pgUniqueViolation = Object.assign(
        new Error('duplicate key value violates unique constraint "users_email_unique"'),
        { code: '23505', constraint: 'users_email_unique', detail: 'Key (email)=(x) exists.' }
      );
      const repo = makeRepo({
        getInviteEmail: vi.fn().mockResolvedValue(VALID_INVITE_BOOTSTRAP),
        runInTransactionWithWorkspace: vi
          .fn()
          .mockImplementation(async (_wsId: string, work: (tx: unknown) => unknown) => work({})),
        consumeInviteAndCreateUser: vi.fn().mockRejectedValue(pgUniqueViolation),
      });
      signUp.mockResolvedValue({
        status: 'OK',
        recipeUserId: { getAsString: () => 'st-user-1' },
      });
      const service = new AuthService(repo);

      const rejection = await service
        .signup({ inviteToken: 'ok', password: 'password123' }, fakeReq, fakeRes)
        .catch((e: unknown) => e);

      // Translated to the generic 4xx — NOT the raw pg error.
      expect(rejection).toBeInstanceOf(BadRequestException);
      expect((rejection as BadRequestException).getStatus()).toBe(400);
      expect((rejection as Error).message).toBe('Unable to complete signup');
      // The raw DB error (with constraint/detail internals) never escapes.
      expect((rejection as { code?: string }).code).toBeUndefined();
      // Compensation still runs so no orphaned Core user survives; no session.
      expect(deleteUser).toHaveBeenCalledWith('st-user-1');
      expect(createNewSession).not.toHaveBeenCalled();
    });

    it('rethrows a genuinely UNEXPECTED app-DB error (not a constraint violation) after compensating', async () => {
      // A non-integrity error (e.g. a driver/connection fault) is NOT a
      // client-observable conflict — it must propagate so a global filter renders
      // it generically, rather than being masked as a 4xx "bad request".
      const unexpected = new Error('connection terminated unexpectedly');
      const repo = makeRepo({
        getInviteEmail: vi.fn().mockResolvedValue(VALID_INVITE_BOOTSTRAP),
        runInTransactionWithWorkspace: vi
          .fn()
          .mockImplementation(async (_wsId: string, work: (tx: unknown) => unknown) => work({})),
        consumeInviteAndCreateUser: vi.fn().mockRejectedValue(unexpected),
      });
      signUp.mockResolvedValue({
        status: 'OK',
        recipeUserId: { getAsString: () => 'st-user-1' },
      });
      const service = new AuthService(repo);

      const rejection = await service
        .signup({ inviteToken: 'ok', password: 'password123' }, fakeReq, fakeRes)
        .catch((e: unknown) => e);

      expect(rejection).toBe(unexpected);
      expect(rejection).not.toBeInstanceOf(BadRequestException);
      // Compensation still ran even for the unexpected error.
      expect(deleteUser).toHaveBeenCalledWith('st-user-1');
      expect(createNewSession).not.toHaveBeenCalled();
    });

    it('happy path: consumes invite, mints session with role, returns summary', async () => {
      const repo = makeRepo({
        getInviteEmail: vi.fn().mockResolvedValue(VALID_INVITE_BOOTSTRAP),
        runInTransactionWithWorkspace: vi
          .fn()
          .mockImplementation(async (_wsId: string, work: (tx: unknown) => unknown) => work({})),
        consumeInviteAndCreateUser: vi.fn().mockResolvedValue({
          id: 'app-user-1',
          supertokensUserId: 'st-user-1',
          email: 'invitee@example.com',
          roleId: 'role-1',
          roleName: 'analyst',
        }),
      });
      signUp.mockResolvedValue({
        status: 'OK',
        recipeUserId: { getAsString: () => 'st-user-1' },
      });
      createNewSession.mockResolvedValue({});
      const service = new AuthService(repo);

      const result = await service.signup(
        { inviteToken: 'ok', password: 'password123' },
        fakeReq,
        fakeRes
      );

      expect(result).toEqual({
        userId: 'st-user-1',
        email: 'invitee@example.com',
        role: 'analyst',
      });
      expect(createNewSession).toHaveBeenCalledOnce();
      expect(deleteUser).not.toHaveBeenCalled();
      // Wave-17 DEV-1: transaction must run with the invite's workspaceId (server-derived).
      const txCall = (repo.runInTransactionWithWorkspace as ReturnType<typeof vi.fn>).mock.calls[0];
      expect(txCall[0]).toBe(VALID_INVITE_BOOTSTRAP.workspaceId);
    });

    it('DEV-1: workspace placement — transaction uses server-derived workspaceId from invite (never client)', async () => {
      // This test is the unit-level proof of the server-derived workspace placement
      // invariant. The workspaceId passed to runInTransactionWithWorkspace MUST be
      // the one returned by getInviteEmail (from resolve_invite SECURITY DEFINER),
      // not anything the client supplied (the client only supplied the token).
      const inviteWithWorkspace = {
        email: 'invitee@example.com',
        workspaceId: 'beef0000-0000-4000-8000-000000000099',
      };
      const runInTransactionWithWorkspace = vi
        .fn()
        .mockImplementation(async (_wsId: string, work: (tx: unknown) => unknown) => work({}));
      const repo = makeRepo({
        getInviteEmail: vi.fn().mockResolvedValue(inviteWithWorkspace),
        runInTransactionWithWorkspace,
        consumeInviteAndCreateUser: vi.fn().mockResolvedValue({
          id: 'app-user-2',
          supertokensUserId: 'st-user-2',
          email: 'invitee@example.com',
          roleId: 'role-1',
          roleName: 'analyst',
        }),
      });
      signUp.mockResolvedValue({
        status: 'OK',
        recipeUserId: { getAsString: () => 'st-user-2' },
      });
      createNewSession.mockResolvedValue({});
      const service = new AuthService(repo);

      await service.signup({ inviteToken: 'ok', password: 'password123' }, fakeReq, fakeRes);

      // The workspace passed to the transaction is exactly what the server resolved
      // from the invite row — not client-controlled.
      expect(runInTransactionWithWorkspace).toHaveBeenCalledOnce();
      expect(runInTransactionWithWorkspace.mock.calls[0][0]).toBe(inviteWithWorkspace.workspaceId);
    });
  });

  describe('requestReset — no user-enumeration', () => {
    it('returns void (never throws) for an UNKNOWN email and issues no token', async () => {
      listUsersByAccountInfo.mockResolvedValue([]);
      const service = new AuthService(makeRepo());

      await expect(service.requestReset({ email: 'nobody@example.com' })).resolves.toBeUndefined();
      expect(createResetPasswordToken).not.toHaveBeenCalled();
    });

    it('returns void for an EXISTING email (identical outward behaviour)', async () => {
      listUsersByAccountInfo.mockResolvedValue([
        { id: 'st-user-1', loginMethods: [{ recipeId: 'emailpassword' }] },
      ]);
      createResetPasswordToken.mockResolvedValue({ status: 'OK', token: 'secret' });
      const service = new AuthService(makeRepo());

      await expect(service.requestReset({ email: 'someone@example.com' })).resolves.toBeUndefined();
      expect(createResetPasswordToken).toHaveBeenCalledOnce();
    });

    it('SWALLOWS a token-creation failure so the EXISTING-email path stays a 202 (no status-code oracle)', async () => {
      // Status-code enumeration guard: token creation only runs on the
      // account-EXISTS branch. If it threw, that branch alone could 500 — a
      // side-channel revealing which emails have accounts. It must resolve void
      // (→ controller 202) exactly like the unknown-email path.
      listUsersByAccountInfo.mockResolvedValue([
        { id: 'st-user-1', loginMethods: [{ recipeId: 'emailpassword' }] },
      ]);
      createResetPasswordToken.mockRejectedValue(new Error('Core unreachable'));
      const service = new AuthService(makeRepo());

      await expect(service.requestReset({ email: 'someone@example.com' })).resolves.toBeUndefined();
      expect(createResetPasswordToken).toHaveBeenCalledOnce();
    });

    it('EXISTING (token throws) and UNKNOWN emails are observably identical: both resolve void', async () => {
      // Prove the two paths are indistinguishable to the caller even in the
      // worst case (token issuance failing for a real account). Same resolved
      // value (undefined → identical 202 body) whether or not the email exists.
      const service = new AuthService(makeRepo());

      listUsersByAccountInfo.mockResolvedValueOnce([]);
      const unknownOutcome = await service
        .requestReset({ email: 'nobody@example.com' })
        .then(() => 'resolved:undefined')
        .catch((e: unknown) => `threw:${String(e)}`);

      listUsersByAccountInfo.mockResolvedValueOnce([
        { id: 'st-user-1', loginMethods: [{ recipeId: 'emailpassword' }] },
      ]);
      createResetPasswordToken.mockRejectedValueOnce(new Error('Core unreachable'));
      const existingOutcome = await service
        .requestReset({ email: 'someone@example.com' })
        .then(() => 'resolved:undefined')
        .catch((e: unknown) => `threw:${String(e)}`);

      expect(existingOutcome).toBe(unknownOutcome);
      expect(existingOutcome).toBe('resolved:undefined');
    });
  });

  describe('confirmReset', () => {
    it('rejects an invalid/expired token with 4xx', async () => {
      resetPasswordUsingToken.mockResolvedValue({
        status: 'RESET_PASSWORD_INVALID_TOKEN_ERROR',
      });
      const service = new AuthService(makeRepo());

      await expect(
        service.confirmReset({ token: 'bad', password: 'password123' })
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('resolves on a valid token', async () => {
      resetPasswordUsingToken.mockResolvedValue({ status: 'OK' });
      const service = new AuthService(makeRepo());

      await expect(
        service.confirmReset({ token: 'good', password: 'password123' })
      ).resolves.toBeUndefined();
    });
  });

  describe('createInvite — role validation', () => {
    it('rejects a role not present in the roles table (422)', async () => {
      const repo = makeRepo({ findRoleIdByName: vi.fn().mockResolvedValue(null) });
      const service = new AuthService(repo);

      // roleEnum is validated at the DTO boundary; this asserts the service-layer
      // defence-in-depth against a role name missing from the seeded table.
      await expect(
        service.createInvite({ email: 'x@example.com', role: 'admin' })
      ).rejects.toThrowError();
    });

    it('creates an invite and returns a plaintext token + expiry', async () => {
      const repo = makeRepo({
        findRoleIdByName: vi.fn().mockResolvedValue('role-1'),
        createInvite: vi.fn().mockResolvedValue({ id: 'invite-1' }),
      });
      const service = new AuthService(repo);

      const result = await service.createInvite({ email: 'x@example.com', role: 'admin' });

      expect(typeof result.token).toBe('string');
      expect(result.token.length).toBeGreaterThan(20);
      expect(() => new Date(result.expiry).toISOString()).not.toThrow();
      // Only the HASH is persisted — the plaintext passed to the repo must NOT
      // equal the returned token.
      const call = (repo.createInvite as ReturnType<typeof vi.fn>).mock.calls[0][0];
      expect(call.tokenHash).not.toBe(result.token);
    });
  });
});

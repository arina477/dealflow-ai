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
    resolveRoleBySupertokensUserId: vi.fn(),
    findUserBySupertokensUserId: vi.fn(),
    consumeInviteAndCreateUser: vi.fn(),
    runInTransaction: vi.fn(),
    ...overrides,
  } as unknown as AuthRepository;
}

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
        getInviteEmail: vi.fn().mockResolvedValue('invitee@example.com'),
        // tx runs the work; consume returns null → lost the race.
        runInTransaction: vi
          .fn()
          .mockImplementation(async (work: (tx: unknown) => unknown) => work({})),
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

    it('happy path: consumes invite, mints session with role, returns summary', async () => {
      const repo = makeRepo({
        getInviteEmail: vi.fn().mockResolvedValue('invitee@example.com'),
        runInTransaction: vi
          .fn()
          .mockImplementation(async (work: (tx: unknown) => unknown) => work({})),
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

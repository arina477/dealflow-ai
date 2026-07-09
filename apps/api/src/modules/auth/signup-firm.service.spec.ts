/**
 * T-2 Unit — AuthService.signupFirm (wave-37, task 6235baf7)
 *
 * Security invariants tested:
 *   1. Happy path: creates workspace + admin user + mints session.
 *   2. Atomic: Core user creation failure → no DB writes attempted.
 *   3. Compensate: DB failure after Core user created → Core user deleted, no orphan.
 *   4. Compensate: repo returns null → Core user deleted, 4xx.
 *   5. client-supplied workspace_id is structurally absent from the input schema
 *      (no workspace_id field on SignupFirmRequest).
 *   6. Email is lowercased before being passed to ST + repo.
 *   7. DB constraint violation → generic 4xx (not a raw 500 with DB internals).
 *   8. Unexpected DB error → rethrown after compensate.
 *   9. Role claim in response is always 'admin' (the roleName from the repo).
 */

import { BadRequestException } from '@nestjs/common';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// ── Mock the SuperTokens SDK surface ─────────────────────────────────────────
const signUp = vi.fn();
const deleteUser = vi.fn();
const createNewSession = vi.fn();
const convertToRecipeUserId = vi.fn((id: string) => ({ getAsString: () => id }));

vi.mock('supertokens-node', () => ({
  default: {
    listUsersByAccountInfo: vi.fn(),
    deleteUser: (...a: unknown[]) => deleteUser(...a),
    convertToRecipeUserId: (id: string) => convertToRecipeUserId(id),
  },
}));

vi.mock('supertokens-node/recipe/emailpassword', () => ({
  default: {
    signUp: (...a: unknown[]) => signUp(...a),
    createResetPasswordToken: vi.fn(),
    resetPasswordUsingToken: vi.fn(),
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
    getUserWithRole: vi.fn(),
    consumeInviteAndCreateUser: vi.fn(),
    runInTransaction: vi.fn(),
    runInTransactionWithWorkspace: vi.fn(),
    createFirmWorkspace: vi.fn(),
    ...overrides,
  } as unknown as AuthRepository;
}

/** A successful createFirmWorkspace result — server-minted ids, always admin. */
const FIRM_CREATED = {
  workspaceId: 'new-ws-id-0000-0000-0000-000000000042',
  userId: 'new-user-id-0000-0000-0000-00000000abcd',
  roleName: 'admin',
} as const;

const fakeReq = {} as never;
const fakeRes = {} as never;

describe('AuthService.signupFirm — self-serve workspace creation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('1. happy path: creates workspace + admin users row + mints session, returns admin role', async () => {
    const createFirmWorkspace = vi.fn().mockResolvedValue(FIRM_CREATED);
    const repo = makeRepo({ createFirmWorkspace });
    signUp.mockResolvedValue({
      status: 'OK',
      recipeUserId: { getAsString: () => 'st-user-firm-1' },
    });
    createNewSession.mockResolvedValue({});
    const service = new AuthService(repo);

    const result = await service.signupFirm(
      { firmName: 'Acme Capital', email: 'founder@acme.com', password: 'password123' },
      fakeReq,
      fakeRes
    );

    expect(result).toEqual({
      userId: 'st-user-firm-1',
      email: 'founder@acme.com',
      role: 'admin',
    });
    // Core user created
    expect(signUp).toHaveBeenCalledOnce();
    // Workspace + users row created via SECURITY DEFINER path
    expect(createFirmWorkspace).toHaveBeenCalledOnce();
    // Session minted
    expect(createNewSession).toHaveBeenCalledOnce();
    // No compensation
    expect(deleteUser).not.toHaveBeenCalled();
  });

  it('2. Core user creation failure (EMAIL_ALREADY_EXISTS_ERROR) → 400, no DB writes', async () => {
    const createFirmWorkspace = vi.fn();
    const repo = makeRepo({ createFirmWorkspace });
    signUp.mockResolvedValue({ status: 'EMAIL_ALREADY_EXISTS_ERROR' });
    const service = new AuthService(repo);

    await expect(
      service.signupFirm(
        { firmName: 'Beta LLC', email: 'taken@example.com', password: 'password123' },
        fakeReq,
        fakeRes
      )
    ).rejects.toBeInstanceOf(BadRequestException);

    // DB function NOT called — Core user creation failed before it
    expect(createFirmWorkspace).not.toHaveBeenCalled();
    // No compensation needed (no Core user was created)
    expect(deleteUser).not.toHaveBeenCalled();
    expect(createNewSession).not.toHaveBeenCalled();
  });

  it('3. DB failure after Core user created → compensate (delete Core user), rethrow generic 4xx on constraint', async () => {
    const pgUniqueViolation = Object.assign(
      new Error(
        'duplicate key value violates unique constraint "users_supertokens_user_id_unique"'
      ),
      { code: '23505', constraint: 'users_supertokens_user_id_unique' }
    );
    const createFirmWorkspace = vi.fn().mockRejectedValue(pgUniqueViolation);
    const repo = makeRepo({ createFirmWorkspace });
    signUp.mockResolvedValue({
      status: 'OK',
      recipeUserId: { getAsString: () => 'st-user-firm-2' },
    });
    const service = new AuthService(repo);

    const rejection = await service
      .signupFirm(
        { firmName: 'Gamma Partners', email: 'founder@gamma.com', password: 'password123' },
        fakeReq,
        fakeRes
      )
      .catch((e: unknown) => e);

    // Translated to generic 4xx — DB internals not leaked
    expect(rejection).toBeInstanceOf(BadRequestException);
    expect((rejection as BadRequestException).getStatus()).toBe(400);
    // Core user compensated — no orphan
    expect(deleteUser).toHaveBeenCalledWith('st-user-firm-2');
    expect(createNewSession).not.toHaveBeenCalled();
  });

  it('4. repo returns null (admin role missing — invariant violation) → compensate, 4xx', async () => {
    const createFirmWorkspace = vi.fn().mockResolvedValue(null);
    const repo = makeRepo({ createFirmWorkspace });
    signUp.mockResolvedValue({
      status: 'OK',
      recipeUserId: { getAsString: () => 'st-user-firm-3' },
    });
    const service = new AuthService(repo);

    await expect(
      service.signupFirm(
        { firmName: 'Delta Capital', email: 'founder@delta.com', password: 'password123' },
        fakeReq,
        fakeRes
      )
    ).rejects.toBeInstanceOf(BadRequestException);

    // Compensate ran — no orphaned Core user
    expect(deleteUser).toHaveBeenCalledWith('st-user-firm-3');
    expect(createNewSession).not.toHaveBeenCalled();
  });

  it('5. client-supplied workspace_id is impossible: SignupFirmRequest has no workspace_id field', async () => {
    // Structural proof: the schema rejects unexpected fields (.strict()).
    // A caller that sends workspace_id in the body → Zod rejects at the controller
    // boundary before the service is reached. Here we verify the repo call does NOT
    // accept workspace_id at any point — it is server-minted inside the DB function.
    const createFirmWorkspace = vi.fn().mockResolvedValue(FIRM_CREATED);
    const repo = makeRepo({ createFirmWorkspace });
    signUp.mockResolvedValue({
      status: 'OK',
      recipeUserId: { getAsString: () => 'st-user-firm-4' },
    });
    createNewSession.mockResolvedValue({});
    const service = new AuthService(repo);

    await service.signupFirm(
      { firmName: 'Epsilon Fund', email: 'founder@epsilon.com', password: 'password123' },
      fakeReq,
      fakeRes
    );

    // The createFirmWorkspace call MUST NOT include a workspace_id parameter.
    const call = (createFirmWorkspace as ReturnType<typeof vi.fn>).mock.calls[0][0] as Record<
      string,
      unknown
    >;
    expect(call).not.toHaveProperty('workspaceId');
    expect(call).not.toHaveProperty('workspace_id');
    // Only supertokensUserId, email, firmName are passed
    expect(Object.keys(call).sort()).toEqual(['email', 'firmName', 'supertokensUserId'].sort());
  });

  it('6. email is lowercased before passing to ST signUp and repo', async () => {
    const createFirmWorkspace = vi.fn().mockResolvedValue(FIRM_CREATED);
    const repo = makeRepo({ createFirmWorkspace });
    signUp.mockResolvedValue({
      status: 'OK',
      recipeUserId: { getAsString: () => 'st-user-firm-5' },
    });
    createNewSession.mockResolvedValue({});
    const service = new AuthService(repo);

    await service.signupFirm(
      { firmName: 'Zeta Fund', email: 'Founder@ZETA.com', password: 'password123' },
      fakeReq,
      fakeRes
    );

    // SuperTokens signUp call uses lowercase email
    const [, stEmail] = (signUp as ReturnType<typeof vi.fn>).mock.calls[0] as [
      string,
      string,
      string,
    ];
    expect(stEmail).toBe('founder@zeta.com');

    // Repo call also uses lowercase email
    const call = (createFirmWorkspace as ReturnType<typeof vi.fn>).mock.calls[0][0] as Record<
      string,
      unknown
    >;
    expect(call.email).toBe('founder@zeta.com');
  });

  it('7. unexpected (non-constraint) DB error → rethrown after compensate', async () => {
    const unexpected = new Error('connection terminated unexpectedly');
    const createFirmWorkspace = vi.fn().mockRejectedValue(unexpected);
    const repo = makeRepo({ createFirmWorkspace });
    signUp.mockResolvedValue({
      status: 'OK',
      recipeUserId: { getAsString: () => 'st-user-firm-6' },
    });
    const service = new AuthService(repo);

    const rejection = await service
      .signupFirm(
        { firmName: 'Theta LLC', email: 'founder@theta.com', password: 'password123' },
        fakeReq,
        fakeRes
      )
      .catch((e: unknown) => e);

    // Original error is rethrown (not wrapped as BadRequest)
    expect(rejection).toBe(unexpected);
    expect(rejection).not.toBeInstanceOf(BadRequestException);
    // Compensation still ran
    expect(deleteUser).toHaveBeenCalledWith('st-user-firm-6');
    expect(createNewSession).not.toHaveBeenCalled();
  });

  it('9. response role is always admin (from repo roleName)', async () => {
    const createFirmWorkspace = vi.fn().mockResolvedValue({ ...FIRM_CREATED, roleName: 'admin' });
    const repo = makeRepo({ createFirmWorkspace });
    signUp.mockResolvedValue({
      status: 'OK',
      recipeUserId: { getAsString: () => 'st-user-firm-7' },
    });
    createNewSession.mockResolvedValue({});
    const service = new AuthService(repo);

    const result = await service.signupFirm(
      { firmName: 'Iota Ventures', email: 'founder@iota.com', password: 'password123' },
      fakeReq,
      fakeRes
    );

    expect(result.role).toBe('admin');
  });
});

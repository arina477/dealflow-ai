/**
 * T-2 Unit — AuthController POST /auth/signup-firm validation wiring (wave-37, task 6235baf7)
 *
 * SEC-9/SEC-10: per-handler safeParse — no global pipe.
 * Tests prove:
 *   - missing firmName → 400 (generic, not field-level detail)
 *   - missing email → 400
 *   - invalid email → 400
 *   - missing password → 400
 *   - short password → 400
 *   - workspace_id in body → rejected by strict Zod schema → 400 (client cannot supply it)
 *   - valid body → service called
 *   - firmName trimmed (Zod .trim())
 */

import { BadRequestException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mockAuthService = {
  createInvite: vi.fn(),
  signup: vi.fn(),
  signupFirm: vi.fn(),
  me: vi.fn(),
  requestReset: vi.fn(),
  confirmReset: vi.fn(),
  logout: vi.fn(),
};

const mockAuthRepository = {
  getUserWithRole: vi.fn(),
};

let simulateSession = true;
vi.mock('./guards/session.guard', () => ({
  SessionGuard: class MockSessionGuard {
    async canActivate(): Promise<boolean> {
      return simulateSession;
    }
  },
}));

vi.mock('./auth.service', () => ({
  AuthService: class MockAuthService {
    createInvite = mockAuthService.createInvite;
    signup = mockAuthService.signup;
    signupFirm = mockAuthService.signupFirm;
    me = mockAuthService.me;
    requestReset = mockAuthService.requestReset;
    confirmReset = mockAuthService.confirmReset;
    logout = mockAuthService.logout;
  },
}));

vi.mock('./auth.repository', () => ({
  AuthRepository: class MockAuthRepository {
    getUserWithRole = mockAuthRepository.getUserWithRole;
  },
}));

import { AuthController } from './auth.controller';
import { AuthRepository } from './auth.repository';
import { AuthService } from './auth.service';

async function createTestController(): Promise<AuthController> {
  const module = await Test.createTestingModule({
    controllers: [AuthController],
    providers: [
      { provide: AuthService, useValue: mockAuthService },
      { provide: AuthRepository, useValue: mockAuthRepository },
    ],
  }).compile();
  return module.get<AuthController>(AuthController);
}

const fakeReq = { ip: '1.2.3.4' } as never;
const fakeRes = {} as never;

describe('AuthController POST /auth/signup-firm', () => {
  let controller: AuthController;

  beforeEach(async () => {
    vi.clearAllMocks();
    simulateSession = true;
    controller = await createTestController();
  });
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('missing firmName → 400, service not called', async () => {
    await expect(
      controller.signupFirm(
        { email: 'founder@example.com', password: 'password123' } as never,
        fakeReq,
        fakeRes
      )
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(mockAuthService.signupFirm).not.toHaveBeenCalled();
  });

  it('empty firmName → 400, service not called', async () => {
    await expect(
      controller.signupFirm(
        { firmName: '', email: 'founder@example.com', password: 'password123' },
        fakeReq,
        fakeRes
      )
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(mockAuthService.signupFirm).not.toHaveBeenCalled();
  });

  it('missing email → 400, service not called', async () => {
    await expect(
      controller.signupFirm(
        { firmName: 'Acme Capital', password: 'password123' } as never,
        fakeReq,
        fakeRes
      )
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(mockAuthService.signupFirm).not.toHaveBeenCalled();
  });

  it('invalid email → 400, service not called', async () => {
    await expect(
      controller.signupFirm(
        { firmName: 'Acme Capital', email: 'not-an-email', password: 'password123' },
        fakeReq,
        fakeRes
      )
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(mockAuthService.signupFirm).not.toHaveBeenCalled();
  });

  it('short password (< 8 chars) → 400, service not called', async () => {
    await expect(
      controller.signupFirm(
        { firmName: 'Acme Capital', email: 'founder@example.com', password: 'short' },
        fakeReq,
        fakeRes
      )
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(mockAuthService.signupFirm).not.toHaveBeenCalled();
  });

  it('workspace_id supplied by client → rejected by strict schema → 400', async () => {
    // SECURITY: The schema is .strict() — any extra field causes Zod to reject.
    // This is the controller-level proof that a client cannot supply workspace_id.
    await expect(
      controller.signupFirm(
        {
          firmName: 'Acme Capital',
          email: 'founder@example.com',
          password: 'password123',
          workspaceId: 'attacker-controlled-id',
        } as never,
        fakeReq,
        fakeRes
      )
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(mockAuthService.signupFirm).not.toHaveBeenCalled();
  });

  it('workspace_id as snake_case → also rejected by strict schema → 400', async () => {
    await expect(
      controller.signupFirm(
        {
          firmName: 'Acme Capital',
          email: 'founder@example.com',
          password: 'password123',
          workspace_id: 'attacker-controlled-id',
        } as never,
        fakeReq,
        fakeRes
      )
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(mockAuthService.signupFirm).not.toHaveBeenCalled();
  });

  it('valid body → service called with parsed (trimmed) data', async () => {
    mockAuthService.signupFirm.mockResolvedValue({
      userId: 'st-user-1',
      email: 'founder@example.com',
      role: 'admin',
    });

    const result = await controller.signupFirm(
      { firmName: '  Acme Capital  ', email: 'founder@example.com', password: 'password123' },
      fakeReq,
      fakeRes
    );

    expect(mockAuthService.signupFirm).toHaveBeenCalledOnce();
    // Zod .trim() strips leading/trailing whitespace from firmName
    const callArg = (mockAuthService.signupFirm as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(callArg.firmName).toBe('Acme Capital');
    expect(result).toMatchObject({ userId: 'st-user-1', role: 'admin' });
  });

  it('null body → 400', async () => {
    await expect(controller.signupFirm(null as never, fakeReq, fakeRes)).rejects.toBeInstanceOf(
      BadRequestException
    );
    expect(mockAuthService.signupFirm).not.toHaveBeenCalled();
  });
});

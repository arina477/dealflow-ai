/**
 * T-2 DI-boot regression — MandateModule value-import guard.
 *
 * WHY THIS TEST EXISTS:
 *   mandate.service.ts injects AuditService and AuthRepository as constructor
 *   parameters. Under TypeScript `emitDecoratorMetadata`, a type-only import
 *   (`import type`) of a constructor-injected class erases the
 *   `design:paramtypes` metadata that NestJS needs to resolve the dependency.
 *   At runtime this produces:
 *     UnknownDependenciesException: MandateService argument Function at index [N]
 *   This crash only manifests when NestJS builds the DI container; unit tests
 *   that construct MandateService directly bypass it entirely.
 *
 * WHAT IT CATCHES:
 *   - `import type` on AuditService, AuthRepository, or MandateRepository
 *     in mandate.service.ts (or mandate.controller.ts for MandateService).
 *   - Any future regression that strips a value import back to type-only.
 *
 * TWO-LAYER APPROACH:
 *   1. Metadata assertion (fast, no network): verifies Reflect.getMetadata
 *      returns real class references (not undefined / Object) so NestJS can
 *      resolve them — fails immediately if `import type` is used.
 *   2. TestingModule compile (DI container): wires the full MandateModule
 *      with external boundaries mocked out. Compiles cleanly if and only if
 *      all DI metadata is present and correct.
 */

import 'reflect-metadata';

// ── Mock SuperTokens (MandateModule → AuthModule → AuthService imports supertokens-node) ──
import { describe, expect, it, vi } from 'vitest';

vi.mock('supertokens-node', () => ({
  default: {
    init: vi.fn(),
    listUsersByAccountInfo: vi.fn(),
    deleteUser: vi.fn(),
    convertToRecipeUserId: vi.fn((id: string) => ({ getAsString: () => id })),
  },
}));

vi.mock('supertokens-node/recipe/emailpassword', () => ({
  default: {
    init: vi.fn(),
    signUp: vi.fn(),
    createResetPasswordToken: vi.fn(),
    resetPasswordUsingToken: vi.fn(),
  },
}));

vi.mock('supertokens-node/recipe/session', () => ({
  default: {
    init: vi.fn(),
    createNewSession: vi.fn(),
    getSession: vi.fn(),
  },
}));

import { Test } from '@nestjs/testing';
import { DB } from '../../db/db.provider';
import { AuditService } from '../audit/audit.service';
import { AuthRepository } from '../auth/auth.repository';
import { MandateController } from './mandate.controller';
import { MandateModule } from './mandate.module';
import { MandateRepository } from './mandate.repository';
import { MandateService } from './mandate.service';

// ── Layer 1: Reflect.getMetadata assertion ────────────────────────────────────
describe('DI metadata — MandateService value-import guard', () => {
  it('MandateService design:paramtypes[0] is MandateRepository (not undefined/Object)', () => {
    const paramTypes: unknown[] | undefined = Reflect.getMetadata(
      'design:paramtypes',
      MandateService
    );
    expect(
      paramTypes,
      'design:paramtypes on MandateService must be defined — check emitDecoratorMetadata is on'
    ).toBeDefined();
    expect(
      paramTypes?.[0],
      'design:paramtypes[0] must be the MandateRepository class, not undefined/Object'
    ).toBe(MandateRepository);
  });

  it('MandateService design:paramtypes[1] is AuditService (not undefined/Object)', () => {
    const paramTypes: unknown[] | undefined = Reflect.getMetadata(
      'design:paramtypes',
      MandateService
    );
    expect(
      paramTypes,
      'design:paramtypes on MandateService must be defined — check emitDecoratorMetadata is on'
    ).toBeDefined();
    expect(
      paramTypes?.[1],
      'design:paramtypes[1] must be the AuditService class, not undefined/Object'
    ).toBe(AuditService);
  });

  it('MandateService design:paramtypes[2] is AuthRepository (not undefined/Object)', () => {
    const paramTypes: unknown[] | undefined = Reflect.getMetadata(
      'design:paramtypes',
      MandateService
    );
    expect(
      paramTypes,
      'design:paramtypes on MandateService must be defined — check emitDecoratorMetadata is on'
    ).toBeDefined();
    expect(
      paramTypes?.[2],
      'design:paramtypes[2] must be the AuthRepository class, not undefined/Object'
    ).toBe(AuthRepository);
  });

  it('MandateController design:paramtypes[0] is MandateService (not undefined/Object)', () => {
    const paramTypes: unknown[] | undefined = Reflect.getMetadata(
      'design:paramtypes',
      MandateController
    );
    expect(paramTypes).toBeDefined();
    expect(
      paramTypes?.[0],
      'design:paramtypes[0] must be the MandateService class, not undefined/Object'
    ).toBe(MandateService);
  });
});

// ── Layer 2: NestJS TestingModule compile ─────────────────────────────────────
describe('NestJS DI container boot — MandateModule compiles', () => {
  it('compiles MandateModule and resolves MandateService + all deps from the container', async () => {
    const fakeDb = {
      select: vi.fn(),
      insert: vi.fn(),
      update: vi.fn(),
      transaction: vi.fn(),
    };

    const moduleRef = await Test.createTestingModule({
      imports: [MandateModule],
    })
      .overrideProvider(DB)
      .useValue(fakeDb)
      .compile();

    // MandateService must resolve — this is the DI-crash provider.
    const mandateService = moduleRef.get(MandateService);
    expect(mandateService).toBeInstanceOf(MandateService);

    const auditService = moduleRef.get(AuditService);
    expect(auditService).toBeInstanceOf(AuditService);

    const authRepository = moduleRef.get(AuthRepository);
    expect(authRepository).toBeInstanceOf(AuthRepository);

    const mandateRepository = moduleRef.get(MandateRepository);
    expect(mandateRepository).toBeInstanceOf(MandateRepository);
  });
});

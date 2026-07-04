/**
 * T-2 DI-boot regression — MatchingModule value-import guard.
 *
 * Mirrors the pattern from buyer-universe.di-boot.spec.ts.
 *
 * WHY THIS TEST EXISTS:
 *   matching.service.ts uses `import type { AuditService }` and
 *   `import type { AuthRepository }` would erase the `design:paramtypes`
 *   metadata NestJS needs to resolve the dependency. This test catches
 *   any regression that strips a value import back to type-only.
 *
 * TWO-LAYER APPROACH:
 *   1. Metadata assertion: verifies Reflect.getMetadata returns real class
 *      references (not undefined / Object).
 *   2. TestingModule compile: wires the full MatchingModule with external
 *      boundaries mocked out; fails with UnknownDependenciesException if any
 *      DI-injected class is type-only imported.
 */

import 'reflect-metadata';

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
import { MatchingModule } from './matching.module';
import { MatchingRepository } from './matching.repository';
import { MatchingService } from './matching.service';

// ── Layer 1: Reflect.getMetadata assertion ────────────────────────────────────

describe('DI metadata — MatchingService value-import guard', () => {
  it('MatchingService design:paramtypes[0] is MatchingRepository (not undefined/Object)', () => {
    const paramTypes: unknown[] | undefined = Reflect.getMetadata(
      'design:paramtypes',
      MatchingService
    );
    expect(
      paramTypes,
      'design:paramtypes on MatchingService must be defined — check emitDecoratorMetadata is on'
    ).toBeDefined();
    expect(
      paramTypes?.[0],
      'design:paramtypes[0] must be the MatchingRepository class, not undefined/Object'
    ).toBe(MatchingRepository);
  });

  it('MatchingService design:paramtypes[1] is AuditService (not undefined/Object)', () => {
    const paramTypes: unknown[] | undefined = Reflect.getMetadata(
      'design:paramtypes',
      MatchingService
    );
    expect(paramTypes).toBeDefined();
    expect(
      paramTypes?.[1],
      'design:paramtypes[1] must be the AuditService class, not undefined/Object'
    ).toBe(AuditService);
  });

  it('MatchingService design:paramtypes[2] is AuthRepository (not undefined/Object)', () => {
    const paramTypes: unknown[] | undefined = Reflect.getMetadata(
      'design:paramtypes',
      MatchingService
    );
    expect(paramTypes).toBeDefined();
    expect(
      paramTypes?.[2],
      'design:paramtypes[2] must be the AuthRepository class, not undefined/Object'
    ).toBe(AuthRepository);
  });
});

// ── Layer 2: NestJS TestingModule compile ─────────────────────────────────────

describe('NestJS DI container boot — MatchingModule compiles', () => {
  it('compiles MatchingModule and resolves MatchingService + all deps', async () => {
    const fakeDb = {
      select: vi.fn(),
      insert: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      transaction: vi.fn(),
    };

    const moduleRef = await Test.createTestingModule({
      imports: [MatchingModule],
    })
      .overrideProvider(DB)
      .useValue(fakeDb)
      .compile();

    const matchingService = moduleRef.get(MatchingService);
    expect(matchingService).toBeInstanceOf(MatchingService);

    const auditService = moduleRef.get(AuditService);
    expect(auditService).toBeInstanceOf(AuditService);

    const authRepository = moduleRef.get(AuthRepository);
    expect(authRepository).toBeInstanceOf(AuthRepository);

    const matchingRepository = moduleRef.get(MatchingRepository);
    expect(matchingRepository).toBeInstanceOf(MatchingRepository);
  });
});

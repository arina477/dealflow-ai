/**
 * T-2 DI-boot regression — BuyerUniverseModule value-import guard.
 *
 * Mirrors the pattern from sourcing.di-boot.spec.ts.
 *
 * WHY THIS TEST EXISTS:
 *   buyer-universe.service.ts uses `import type { AuditService }` and
 *   `import type { AuthRepository }` would erase the `design:paramtypes`
 *   metadata NestJS needs to resolve the dependency. This test catches
 *   any regression that strips a value import back to type-only.
 *
 * TWO-LAYER APPROACH:
 *   1. Metadata assertion: verifies Reflect.getMetadata returns real class
 *      references (not undefined / Object) — fails if `import type` is used.
 *   2. TestingModule compile: wires the full BuyerUniverseModule with external
 *      boundaries mocked out; fails with UnknownDependenciesException if any
 *      DI-injected class is type-only imported.
 */

import 'reflect-metadata';

import { describe, expect, it, vi } from 'vitest';

// Mock SuperTokens (BuyerUniverseModule → AuthModule → AuthService imports supertokens-node)
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
import { BuyerUniverseModule } from './buyer-universe.module';
import { BuyerUniverseRepository } from './buyer-universe.repository';
import { BuyerUniverseService } from './buyer-universe.service';

// ── Layer 1: Reflect.getMetadata assertion ────────────────────────────────────

describe('DI metadata — BuyerUniverseService value-import guard', () => {
  it('BuyerUniverseService design:paramtypes[0] is BuyerUniverseRepository (not undefined/Object)', () => {
    const paramTypes: unknown[] | undefined = Reflect.getMetadata(
      'design:paramtypes',
      BuyerUniverseService
    );
    expect(
      paramTypes,
      'design:paramtypes on BuyerUniverseService must be defined — check emitDecoratorMetadata is on'
    ).toBeDefined();
    expect(
      paramTypes?.[0],
      'design:paramtypes[0] must be the BuyerUniverseRepository class, not undefined/Object'
    ).toBe(BuyerUniverseRepository);
  });

  it('BuyerUniverseService design:paramtypes[1] is AuditService (not undefined/Object)', () => {
    const paramTypes: unknown[] | undefined = Reflect.getMetadata(
      'design:paramtypes',
      BuyerUniverseService
    );
    expect(paramTypes).toBeDefined();
    expect(
      paramTypes?.[1],
      'design:paramtypes[1] must be the AuditService class, not undefined/Object'
    ).toBe(AuditService);
  });

  it('BuyerUniverseService design:paramtypes[2] is AuthRepository (not undefined/Object)', () => {
    const paramTypes: unknown[] | undefined = Reflect.getMetadata(
      'design:paramtypes',
      BuyerUniverseService
    );
    expect(paramTypes).toBeDefined();
    expect(
      paramTypes?.[2],
      'design:paramtypes[2] must be the AuthRepository class, not undefined/Object'
    ).toBe(AuthRepository);
  });
});

// ── Layer 2: NestJS TestingModule compile ─────────────────────────────────────

describe('NestJS DI container boot — BuyerUniverseModule compiles', () => {
  it('compiles BuyerUniverseModule and resolves BuyerUniverseService + all deps', async () => {
    const fakeDb = {
      select: vi.fn(),
      insert: vi.fn(),
      update: vi.fn(),
      transaction: vi.fn(),
    };

    const moduleRef = await Test.createTestingModule({
      imports: [BuyerUniverseModule],
    })
      .overrideProvider(DB)
      .useValue(fakeDb)
      .compile();

    const buyerUniverseService = moduleRef.get(BuyerUniverseService);
    expect(buyerUniverseService).toBeInstanceOf(BuyerUniverseService);

    const auditService = moduleRef.get(AuditService);
    expect(auditService).toBeInstanceOf(AuditService);

    const authRepository = moduleRef.get(AuthRepository);
    expect(authRepository).toBeInstanceOf(AuthRepository);

    const buyerUniverseRepository = moduleRef.get(BuyerUniverseRepository);
    expect(buyerUniverseRepository).toBeInstanceOf(BuyerUniverseRepository);
  });
});

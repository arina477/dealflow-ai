/**
 * T-2 DI-boot regression — NestJS emitDecoratorMetadata / value-import guard.
 *
 * WHY THIS TEST EXISTS:
 *   The original auth.service.ts used `import type { AuthRepository }` and
 *   roles.guard.ts used `import type { Reflector }`. Under TypeScript
 *   `emitDecoratorMetadata`, a type-only import of a constructor-injected class
 *   erases the `design:paramtypes` metadata that NestJS needs to resolve the
 *   dependency. At runtime this produces:
 *     UnknownDependenciesException: AuthService argument Function at index [0]
 *   This crash only manifests when NestJS builds the DI container; the existing
 *   unit tests bypass it by constructing AuthService directly.
 *
 * WHAT IT CATCHES:
 *   - `import type` on any constructor-injected class in the auth module.
 *   - Any future regression that strips the value import back to type-only.
 *
 * TWO-LAYER APPROACH:
 *   1. Metadata assertion (fast, no network): verifies Reflect.getMetadata
 *      returns the actual AuthRepository class (not undefined / Object) so
 *      NestJS can resolve it — fails if `import type` is used.
 *   2. TestingModule compile (DI container): uses @nestjs/testing to wire the
 *      full AuthModule with external boundaries mocked out. Compiles cleanly if
 *      and only if all DI metadata is present.
 *
 * NOTE: the vitest.config.ts must use unplugin-swc with decoratorMetadata:true
 * (added alongside this test) so that design:paramtypes is emitted during test
 * transforms — without it, esbuild strips all decorator metadata and layer 1
 * would silently pass regardless of import type vs value import.
 */

import 'reflect-metadata';

// ── Mock the SuperTokens SDK (supertokens.config init runs in onModuleInit) ──
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

// ── Suppress SuperTokens env validation so the module boots in test ──────────
vi.mock('./supertokens.env', () => ({
  loadSupertokensEnv: () => ({
    connectionUri: 'http://localhost:3567',
    apiKey: 'test-api-key',
    appName: 'test',
    apiDomain: 'http://localhost:4000',
    websiteDomain: 'http://localhost:3000',
  }),
}));

vi.mock('./supertokens.config', () => ({
  initSupertokens: vi.fn(),
}));

import { Test } from '@nestjs/testing';
import { DB } from '../../db/db.provider';
import { AuthModule } from './auth.module';
import { AuthRepository } from './auth.repository';
import { AuthService } from './auth.service';

// ── Layer 1: Reflect.getMetadata assertion ────────────────────────────────────
describe('DI metadata — value-import guard', () => {
  it('AuthService design:paramtypes[0] is the AuthRepository class (not undefined)', () => {
    // If `import type { AuthRepository }` is used instead of a value import,
    // TypeScript emits `Object` (or nothing) into design:paramtypes rather than
    // the real constructor reference. NestJS then cannot resolve the dependency.
    // This assertion fails on the buggy `import type` and passes on the fix.
    const paramTypes: unknown[] | undefined = Reflect.getMetadata('design:paramtypes', AuthService);
    expect(
      paramTypes,
      'design:paramtypes on AuthService must be defined — check emitDecoratorMetadata is on'
    ).toBeDefined();
    expect(
      paramTypes?.[0],
      'design:paramtypes[0] must be the AuthRepository class, not undefined/Object'
    ).toBe(AuthRepository);
  });
});

// ── Layer 2: NestJS TestingModule compile ─────────────────────────────────────
describe('NestJS DI container boot — AuthModule compiles', () => {
  it('compiles AuthModule and resolves AuthService + guards from the container', async () => {
    // Stub the DB provider so the repository can be instantiated without a real
    // Postgres connection. The DB token is a Symbol so we override by token.
    const fakeDb = {
      select: vi.fn(),
      insert: vi.fn(),
      update: vi.fn(),
      transaction: vi.fn(),
    };

    const moduleRef = await Test.createTestingModule({
      imports: [AuthModule],
    })
      .overrideProvider(DB)
      .useValue(fakeDb)
      .compile();

    // If either import type bug is present the compile() call above throws
    // UnknownDependenciesException — the test fails there. These additional
    // assertions confirm the resolved instances are real class instances.
    const authService = moduleRef.get(AuthService);
    expect(authService).toBeInstanceOf(AuthService);

    const authRepository = moduleRef.get(AuthRepository);
    expect(authRepository).toBeInstanceOf(AuthRepository);
  });
});

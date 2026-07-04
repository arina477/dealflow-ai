/**
 * T-2 DI-boot regression — SourcingModule value-import guard.
 *
 * WHY THIS TEST EXISTS:
 *   sourcing.service.ts used `import type { AuditService }`,
 *   `import type { AuthRepository }`, and `import type { IngestionService }` for
 *   its three constructor-injected dependencies. Under TypeScript
 *   `emitDecoratorMetadata`, a type-only import of a constructor-injected class
 *   erases the `design:paramtypes` metadata that NestJS needs to resolve the
 *   dependency. At runtime this produces:
 *     UnknownDependenciesException: SourcingService argument Function at index [N]
 *   This crash only manifests when NestJS builds the DI container; unit tests
 *   that construct SourcingService directly bypass it entirely.
 *
 * WHAT IT CATCHES:
 *   - `import type` on any constructor-injected class in SourcingService.
 *   - Any future regression that strips a value import back to type-only.
 *
 * TWO-LAYER APPROACH:
 *   1. Metadata assertion (fast, no network): verifies Reflect.getMetadata
 *      returns real class references (not undefined / Object / Function) so
 *      NestJS can resolve them — fails if `import type` is used.
 *   2. TestingModule compile (DI container): uses @nestjs/testing to wire the
 *      full SourcingModule with external boundaries mocked out. Compiles cleanly
 *      if and only if all DI metadata is present.
 *
 * FAIL-ON-PRE-FIX:
 *   Revert the three DI-injected imports to `import type` → Layer 1 assertions
 *   fail (paramtypes[N] is Object/Function, not the real class) AND the
 *   compile() call throws UnknownDependenciesException.
 *
 * NOTE: vitest.config.ts uses unplugin-swc with decoratorMetadata:true so that
 * design:paramtypes is emitted during test transforms — without it, esbuild
 * strips all decorator metadata and layer 1 would silently pass regardless of
 * import type vs value import.
 */

import 'reflect-metadata';

// ── Mock SuperTokens (SourcingModule → AuthModule → AuthService imports supertokens-node) ──
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
import { IngestionService } from './ingestion.service';
import { SourcingModule } from './sourcing.module';
import { SourcingRepository } from './sourcing.repository';
import { SourcingService } from './sourcing.service';

// ── Layer 1: Reflect.getMetadata assertion ────────────────────────────────────
describe('DI metadata — SourcingService value-import guard', () => {
  it('SourcingService design:paramtypes[0] is SourcingRepository (not undefined/Object)', () => {
    // SourcingRepository is at constructor index [0].
    // If the import reverts to `import type`, TypeScript emits Object (or nothing)
    // into design:paramtypes — NestJS then cannot resolve the dependency.
    const paramTypes: unknown[] | undefined = Reflect.getMetadata(
      'design:paramtypes',
      SourcingService
    );
    expect(
      paramTypes,
      'design:paramtypes on SourcingService must be defined — check emitDecoratorMetadata is on'
    ).toBeDefined();
    expect(
      paramTypes?.[0],
      'design:paramtypes[0] must be the SourcingRepository class, not undefined/Object'
    ).toBe(SourcingRepository);
  });

  it('SourcingService design:paramtypes[1] is IngestionService (not undefined/Object)', () => {
    // IngestionService is at constructor index [1].
    // The import type → erase bug would make this Object/Function.
    const paramTypes: unknown[] | undefined = Reflect.getMetadata(
      'design:paramtypes',
      SourcingService
    );
    expect(
      paramTypes,
      'design:paramtypes on SourcingService must be defined — check emitDecoratorMetadata is on'
    ).toBeDefined();
    expect(
      paramTypes?.[1],
      'design:paramtypes[1] must be the IngestionService class, not undefined/Object'
    ).toBe(IngestionService);
  });

  it('SourcingService design:paramtypes[2] is AuditService (not undefined/Object)', () => {
    // AuditService is at constructor index [2].
    const paramTypes: unknown[] | undefined = Reflect.getMetadata(
      'design:paramtypes',
      SourcingService
    );
    expect(
      paramTypes,
      'design:paramtypes on SourcingService must be defined — check emitDecoratorMetadata is on'
    ).toBeDefined();
    expect(
      paramTypes?.[2],
      'design:paramtypes[2] must be the AuditService class, not undefined/Object'
    ).toBe(AuditService);
  });

  it('SourcingService design:paramtypes[3] is AuthRepository (not undefined/Object)', () => {
    // AuthRepository is at constructor index [3].
    const paramTypes: unknown[] | undefined = Reflect.getMetadata(
      'design:paramtypes',
      SourcingService
    );
    expect(
      paramTypes,
      'design:paramtypes on SourcingService must be defined — check emitDecoratorMetadata is on'
    ).toBeDefined();
    expect(
      paramTypes?.[3],
      'design:paramtypes[3] must be the AuthRepository class, not undefined/Object'
    ).toBe(AuthRepository);
  });
});

// ── Layer 2: NestJS TestingModule compile ─────────────────────────────────────
describe('NestJS DI container boot — SourcingModule compiles', () => {
  it('compiles SourcingModule and resolves SourcingService + all deps from the container', async () => {
    // Stub the DB provider so all repositories (SourcingRepository, AuditRepository,
    // AuthRepository) and IngestionService can be instantiated without a real Postgres
    // connection. The DB token is a Symbol; we override it by token so every module
    // that imports dbProvider (SourcingModule, AuditModule, AuthModule) all get the
    // fake handle.
    //
    // AuditKeyring fails fast on a missing AUDIT_LOG_HMAC_KEY — but vitest.config.ts
    // injects AUDIT_LOG_HMAC_KEY as a dummy env var so the AuditModule boots cleanly
    // in any test environment.
    const fakeDb = {
      select: vi.fn(),
      insert: vi.fn(),
      update: vi.fn(),
      transaction: vi.fn(),
    };

    // Compile SourcingModule exactly as NestJS does at app bootstrap.
    // If ANY of the three previously-type-only imports is still `import type`,
    // this call throws UnknownDependenciesException — the test fails here.
    const moduleRef = await Test.createTestingModule({
      imports: [SourcingModule],
    })
      .overrideProvider(DB)
      .useValue(fakeDb)
      .compile();

    // SourcingService must resolve — this is the crash-looping provider.
    const sourcingService = moduleRef.get(SourcingService);
    expect(sourcingService).toBeInstanceOf(SourcingService);

    // Each constructor-injected dep must also be resolvable from the module.
    const ingestionService = moduleRef.get(IngestionService);
    expect(ingestionService).toBeInstanceOf(IngestionService);

    const auditService = moduleRef.get(AuditService);
    expect(auditService).toBeInstanceOf(AuditService);

    const authRepository = moduleRef.get(AuthRepository);
    expect(authRepository).toBeInstanceOf(AuthRepository);

    const sourcingRepository = moduleRef.get(SourcingRepository);
    expect(sourcingRepository).toBeInstanceOf(SourcingRepository);
  });
});

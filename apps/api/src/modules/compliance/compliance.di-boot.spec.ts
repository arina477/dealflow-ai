/**
 * T-2 DI-boot regression — ComplianceModule consuming-context guard.
 *
 * WHY THIS TEST EXISTS:
 *   The auth.di-boot.spec tested AuthModule in ISOLATION. It confirmed that
 *   RolesGuard resolves inside AuthModule's own injector, but it did NOT catch
 *   that ComplianceModule's @UseGuards(RolesGuard) creates RolesGuard in
 *   ComplianceModule's injector context — where AuthRepository was NOT available
 *   because AuthModule only exported SessionGuard + RolesGuard, not
 *   AuthRepository.
 *
 *   The resulting crash-loop on boot:
 *     UnknownDependenciesException: Nest can't resolve dependencies of the
 *     RolesGuard (Reflector, ?). AuthRepository at index [1] is not available
 *     in the ComplianceModule context.
 *
 * WHAT IT CATCHES:
 *   - AuthModule removing AuthRepository from its exports[] array.
 *   - Any future guard that constructor-injects a provider not exported by
 *     AuthModule being applied via @UseGuards in a consuming module.
 *
 * FAIL-ON-REVERT:
 *   Remove `AuthRepository` from AuthModule's exports[] → this test throws
 *   `UnknownDependenciesException` at the `compile()` call, failing the suite.
 *   The auth.di-boot.spec DOES NOT catch this because it only compiles
 *   AuthModule in isolation (where AuthRepository is always resolvable as a
 *   provider, whether or not it's exported).
 */

import 'reflect-metadata';

// ── Mock SuperTokens (ComplianceModule → AuthModule → AuthService/Guards import supertokens-node) ──
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
import { AuthRepository } from '../auth/auth.repository';
import { RolesGuard } from '../auth/guards/roles.guard';
import { SessionGuard } from '../auth/guards/session.guard';
import { ComplianceModule } from './compliance.module';
import { ComplianceService } from './compliance.service';

// ── ComplianceModule consuming-context boot test ──────────────────────────────

describe('NestJS DI container boot — ComplianceModule (consuming AuthModule) compiles', () => {
  it('compiles ComplianceModule with AuthModule imported and resolves RolesGuard + AuthRepository in the consuming context', async () => {
    // Stub the DB token so AuthRepository (and anything downstream) can be
    // instantiated without a live Postgres connection. The DB token is a Symbol
    // provided by dbProvider inside AuthModule; we override it by token here so
    // the AuthModule providers (AuthRepository, AuthService, guards) all get the
    // fake handle regardless of which module's injector they're resolved in.
    const fakeDb = {
      select: vi.fn(),
      insert: vi.fn(),
      update: vi.fn(),
      transaction: vi.fn(),
    };

    // THIS is the critical compile: we import ComplianceModule (not AuthModule),
    // exactly as NestJS does at app bootstrap. If AuthRepository is not exported
    // by AuthModule, Nest cannot construct RolesGuard in ComplianceModule's
    // injector and this call throws UnknownDependenciesException.
    const moduleRef = await Test.createTestingModule({
      imports: [ComplianceModule],
    })
      .overrideProvider(DB)
      .useValue(fakeDb)
      .compile();

    // RolesGuard must be resolvable in the ComplianceModule context.
    // This is the exact DI path that crashed in production.
    const rolesGuard = moduleRef.get(RolesGuard);
    expect(rolesGuard).toBeInstanceOf(RolesGuard);

    // AuthRepository is re-exported from AuthModule; consuming modules can
    // resolve it directly (the guard needs it for DB-authoritative role verify).
    const authRepository = moduleRef.get(AuthRepository);
    expect(authRepository).toBeInstanceOf(AuthRepository);

    // SessionGuard is also exported — sanity-check it still resolves.
    const sessionGuard = moduleRef.get(SessionGuard);
    expect(sessionGuard).toBeInstanceOf(SessionGuard);

    // ComplianceService is a direct provider of ComplianceModule.
    const complianceService = moduleRef.get(ComplianceService);
    expect(complianceService).toBeInstanceOf(ComplianceService);
  });
});

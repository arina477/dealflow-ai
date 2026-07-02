/**
 * AuthModule (wave-2) — the first real domain module.
 *
 * Wires the controller, service, repository, DB provider, and both guards.
 * SuperTokens is initialised in onModuleInit (after DI is ready) so the
 * createNewSession role-claim override can resolve roles through the
 * repository. init is idempotent (guarded in supertokens.config).
 *
 * Guard registration note: SessionGuard AND RolesGuard are both provided so
 * they are DI-resolvable, but RolesGuard is applied to NO route this wave
 * (built-but-unapplied primitive — arch delta 3). SessionGuard is applied only
 * to /auth/me + /auth/logout at the controller level (authentication, in-spec).
 */

import { Module, type OnModuleInit } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

import { dbProvider } from '../../db/db.provider';
import { AuthController } from './auth.controller';
import { AuthRepository } from './auth.repository';
import { AuthService } from './auth.service';
import { RolesGuard } from './guards/roles.guard';
import { SessionGuard } from './guards/session.guard';
import { initSupertokens } from './supertokens.config';
import { loadSupertokensEnv } from './supertokens.env';

@Module({
  controllers: [AuthController],
  providers: [dbProvider, AuthRepository, AuthService, SessionGuard, RolesGuard, Reflector],
  exports: [SessionGuard, RolesGuard],
})
export class AuthModule implements OnModuleInit {
  constructor(private readonly repository: AuthRepository) {}

  onModuleInit(): void {
    // Boot-time env load also runs the no-alias assertion (fail-fast). It is
    // additionally asserted in main.ts before app creation; running it here too
    // keeps the module self-contained for isolated (e.g. test-harness) boots.
    const env = loadSupertokensEnv();

    initSupertokens({
      env,
      resolveRole: (supertokensUserId) =>
        this.repository.resolveRoleBySupertokensUserId(supertokensUserId),
    });
  }
}

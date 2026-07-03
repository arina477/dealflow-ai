/**
 * AuthModule (wave-2) — the first real domain module.
 *
 * Wires the controller, service, repository, DB provider, and both guards.
 * SuperTokens is initialised in main.ts bootstrap() BEFORE NestFactory.create()
 * using the module-singleton Drizzle client directly (no DI needed). This
 * ordering is what allows middleware() to be registered via app.use() before
 * app.listen() mounts the Nest router — making /auth/* auto-routes reachable
 * by the SuperTokens SDK ahead of the Nest 404 handler.
 *
 * Guard registration note: SessionGuard AND RolesGuard are both provided and
 * exported. AuthRepository is ALSO exported (wave-3 fix): RolesGuard
 * constructor-injects AuthRepository for the DB-authoritative role re-verify
 * (B-6 CRITICAL-1). Any module that imports AuthModule and uses RolesGuard via
 * @UseGuards must be able to construct RolesGuard in its own DI context —
 * which requires AuthRepository to be available there. Exporting AuthRepository
 * re-uses the single instance provisioned here (no second DB pool).
 */

import { Module } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

import { dbProvider } from '../../db/db.provider';
import { AuthController } from './auth.controller';
import { AuthRepository } from './auth.repository';
import { AuthService } from './auth.service';
import { RolesGuard } from './guards/roles.guard';
import { SessionGuard } from './guards/session.guard';

@Module({
  controllers: [AuthController],
  providers: [dbProvider, AuthRepository, AuthService, SessionGuard, RolesGuard, Reflector],
  exports: [SessionGuard, RolesGuard, AuthRepository],
})
export class AuthModule {}

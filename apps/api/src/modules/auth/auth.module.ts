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
 * Guard registration note: SessionGuard AND RolesGuard are both provided so
 * they are DI-resolvable, but RolesGuard is applied to NO route this wave
 * (built-but-unapplied primitive — arch delta 3). SessionGuard is applied only
 * to /auth/me + /auth/logout at the controller level (authentication, in-spec).
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
  exports: [SessionGuard, RolesGuard],
})
export class AuthModule {}

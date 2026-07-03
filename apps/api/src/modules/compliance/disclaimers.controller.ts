/**
 * DisclaimersController (wave-5, B-2 step 2.13) — CRUD endpoints for
 * disclaimer_templates.
 *
 * All endpoints @UseGuards(SessionGuard, RolesGuard) + @Roles('compliance','admin').
 * PATCH implements "edit = new version" via DisclaimersService.updateDisclaimer
 * (append-style versioning — prior row is deactivated, new row inserted in-tx).
 * Bodies validated inline against shared Zod schemas (400 on ZodError).
 *
 * Actor id translation (wave-5 C-2 fix): session.getUserId() returns the
 * SuperTokens user id, NOT the FK-safe `users.id`. AuthRepository.getUserWithRole()
 * translates to the app users row (id + DB-authoritative role). Fail closed on
 * null (user row missing → 401).
 *
 * FAIL-CLOSED at boot: rolesForRoute assert same as other CRUD controllers.
 */

import type { DisclaimerTemplate, Role } from '@dealflow/shared';
import { disclaimerCreateSchema, disclaimerUpdateSchema, rolesForRoute } from '@dealflow/shared';
import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Req,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import type { SessionContainer } from 'supertokens-node/recipe/session';
import { ZodError } from 'zod';

// biome-ignore lint/style/useImportType: value import required for emitDecoratorMetadata DI resolution
import { AuthRepository } from '../auth/auth.repository';
import { Roles, RolesGuard } from '../auth/guards/roles.guard';
import { SessionGuard } from '../auth/guards/session.guard';
import type { DisclaimerCreateDto, DisclaimerUpdateDto } from './compliance-crud.dto';
// biome-ignore lint/style/useImportType: value import required for emitDecoratorMetadata DI resolution
import { DisclaimersService } from './disclaimers.service';

const DISCLAIMERS_ROLES: Role[] = [...rolesForRoute('/compliance/disclaimers')];

if (DISCLAIMERS_ROLES.length === 0) {
  throw new Error(
    "RBAC config drift: rolesForRoute('/compliance/disclaimers') resolved to [] — " +
      'the route pattern is missing from the shared roleRoutes matrix. Refusing to ' +
      'boot rather than expose /compliance/disclaimers to every authenticated user.'
  );
}

interface RequestWithSession extends Request {
  session?: SessionContainer;
}

@Controller('compliance')
export class DisclaimersController {
  constructor(
    private readonly disclaimersService: DisclaimersService,
    private readonly authRepository: AuthRepository
  ) {}

  /**
   * Translate the SuperTokens session user id to the FK-safe app `users.id`
   * and DB-authoritative role. Fails closed (UnauthorizedException) if the
   * users row is missing — never passes a null/bogus actor to the service.
   */
  private async resolveActor(req: RequestWithSession): Promise<{ userId: string; role: string }> {
    const session = req.session;
    if (!session) throw new UnauthorizedException('Session not found on request');
    const appUser = await this.authRepository.getUserWithRole(session.getUserId());
    if (!appUser) {
      throw new UnauthorizedException('Authenticated user not found in app users table');
    }
    return { userId: appUser.id, role: appUser.roleName };
  }

  @Get('disclaimers')
  @UseGuards(SessionGuard, RolesGuard)
  @Roles(...DISCLAIMERS_ROLES)
  listDisclaimers(): Promise<DisclaimerTemplate[]> {
    return this.disclaimersService.listDisclaimers();
  }

  @Post('disclaimers')
  @HttpCode(HttpStatus.CREATED)
  @UseGuards(SessionGuard, RolesGuard)
  @Roles(...DISCLAIMERS_ROLES)
  async createDisclaimer(
    @Body() body: DisclaimerCreateDto,
    @Req() req: RequestWithSession
  ): Promise<DisclaimerTemplate> {
    let input: ReturnType<typeof disclaimerCreateSchema.parse>;
    try {
      input = disclaimerCreateSchema.parse(body);
    } catch (err) {
      if (err instanceof ZodError) {
        throw new BadRequestException(err.issues);
      }
      throw err;
    }
    const { userId, role } = await this.resolveActor(req);
    return this.disclaimersService.createDisclaimer(input, userId, role);
  }

  @Patch('disclaimers/:id')
  @UseGuards(SessionGuard, RolesGuard)
  @Roles(...DISCLAIMERS_ROLES)
  async updateDisclaimer(
    @Param('id') id: string,
    @Body() body: DisclaimerUpdateDto,
    @Req() req: RequestWithSession
  ): Promise<DisclaimerTemplate> {
    let input: ReturnType<typeof disclaimerUpdateSchema.parse>;
    try {
      input = disclaimerUpdateSchema.parse(body);
    } catch (err) {
      if (err instanceof ZodError) {
        throw new BadRequestException(err.issues);
      }
      throw err;
    }
    const { userId, role } = await this.resolveActor(req);
    return this.disclaimersService.updateDisclaimer(id, input, userId, role);
  }
}

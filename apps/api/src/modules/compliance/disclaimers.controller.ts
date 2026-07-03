/**
 * DisclaimersController (wave-5, B-2 step 2.13) — CRUD endpoints for
 * disclaimer_templates.
 *
 * All endpoints @UseGuards(SessionGuard, RolesGuard) + @Roles('compliance','admin').
 * PATCH implements "edit = new version" via DisclaimersService.updateDisclaimer
 * (append-style versioning — prior row is deactivated, new row inserted in-tx).
 * Bodies validated inline against shared Zod schemas (400 on ZodError).
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
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import type { SessionContainer } from 'supertokens-node/recipe/session';
import { ZodError } from 'zod';

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

function actorFromRequest(req: RequestWithSession): { userId: string; role: string } {
  const session = req.session;
  if (!session) throw new Error('Session not found on request (SessionGuard must run first)');
  const userId = session.getUserId();
  const role = (session.getAccessTokenPayload() as { role?: string }).role ?? 'unknown';
  return { userId, role };
}

@Controller('compliance')
export class DisclaimersController {
  constructor(private readonly disclaimersService: DisclaimersService) {}

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
  createDisclaimer(
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
    const { userId, role } = actorFromRequest(req);
    return this.disclaimersService.createDisclaimer(input, userId, role);
  }

  @Patch('disclaimers/:id')
  @UseGuards(SessionGuard, RolesGuard)
  @Roles(...DISCLAIMERS_ROLES)
  updateDisclaimer(
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
    const { userId, role } = actorFromRequest(req);
    return this.disclaimersService.updateDisclaimer(id, input, userId, role);
  }
}

/**
 * SuppressionController (wave-5, B-2 step 2.12) — CRUD endpoints for
 * suppression_list.
 *
 * All endpoints @UseGuards(SessionGuard, RolesGuard) + @Roles('compliance','admin').
 * POST validates body against suppressionCreateSchema inline (400 on ZodError).
 * DELETE is a hard remove (no updates — entries are added or removed).
 *
 * FAIL-CLOSED at boot: same rolesForRoute assert as RulesController.
 */

import type { Role, SuppressionEntry } from '@dealflow/shared';
import { rolesForRoute, suppressionCreateSchema } from '@dealflow/shared';
import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import type { SessionContainer } from 'supertokens-node/recipe/session';
import { ZodError } from 'zod';

import { Roles, RolesGuard } from '../auth/guards/roles.guard';
import { SessionGuard } from '../auth/guards/session.guard';
import type { SuppressionCreateDto } from './compliance-crud.dto';
// biome-ignore lint/style/useImportType: value import required for emitDecoratorMetadata DI resolution
import { SuppressionService } from './suppression.service';

const SUPPRESSION_ROLES: Role[] = [...rolesForRoute('/compliance/suppression')];

if (SUPPRESSION_ROLES.length === 0) {
  throw new Error(
    "RBAC config drift: rolesForRoute('/compliance/suppression') resolved to [] — " +
      'the route pattern is missing from the shared roleRoutes matrix. Refusing to ' +
      'boot rather than expose /compliance/suppression to every authenticated user.'
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
export class SuppressionController {
  constructor(private readonly suppressionService: SuppressionService) {}

  @Get('suppression')
  @UseGuards(SessionGuard, RolesGuard)
  @Roles(...SUPPRESSION_ROLES)
  listEntries(): Promise<SuppressionEntry[]> {
    return this.suppressionService.listEntries();
  }

  @Post('suppression')
  @HttpCode(HttpStatus.CREATED)
  @UseGuards(SessionGuard, RolesGuard)
  @Roles(...SUPPRESSION_ROLES)
  createEntry(
    @Body() body: SuppressionCreateDto,
    @Req() req: RequestWithSession
  ): Promise<SuppressionEntry> {
    let input: ReturnType<typeof suppressionCreateSchema.parse>;
    try {
      input = suppressionCreateSchema.parse(body);
    } catch (err) {
      if (err instanceof ZodError) {
        throw new BadRequestException(err.issues);
      }
      throw err;
    }
    const { userId, role } = actorFromRequest(req);
    return this.suppressionService.createEntry(input, userId, role);
  }

  @Delete('suppression/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(SessionGuard, RolesGuard)
  @Roles(...SUPPRESSION_ROLES)
  deleteEntry(@Param('id') id: string, @Req() req: RequestWithSession): Promise<void> {
    const { userId, role } = actorFromRequest(req);
    return this.suppressionService.deleteEntry(id, userId, role);
  }
}

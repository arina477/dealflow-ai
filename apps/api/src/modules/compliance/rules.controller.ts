/**
 * RulesController (wave-5, B-2 step 2.11) — CRUD endpoints for compliance_rules.
 *
 * All endpoints:
 *   @UseGuards(SessionGuard, RolesGuard) — 401 anon, 403 wrong role
 *   @Roles('compliance', 'admin')        — sourced from shared roleRoutes matrix
 *
 * Validation: request bodies are parsed against the shared Zod create/update
 * schemas inline (BadRequestException 400 on ZodError). Actor identity is
 * extracted from the server-verified session — never from the client body.
 *
 * Actor id translation (wave-5 C-2 fix): session.getUserId() returns the
 * SuperTokens user id, which is NOT the FK-safe `users.id`. We call
 * AuthRepository.getUserWithRole() to translate to the app users row and also
 * obtain the DB-authoritative role (fixes both the FK violation and the
 * INFO audit-role finding). Fail closed on null (user row missing → 401).
 *
 * FAIL-CLOSED at boot: if rolesForRoute('/compliance/rules') returns [], the
 * module-eval assertion throws so config drift crashes at boot (loud) rather
 * than silently opening the route. The guard also denies empty @Roles() at
 * request time — two independent fail-closed layers (ComplianceController
 * exemplar pattern).
 */

import type { ComplianceRule, Role } from '@dealflow/shared';
import { rolesForRoute, ruleCreateSchema, ruleUpdateSchema } from '@dealflow/shared';
import {
  BadRequestException,
  Body,
  Controller,
  Delete,
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
import type { RuleCreateDto, RuleUpdateDto } from './compliance-crud.dto';
// biome-ignore lint/style/useImportType: value import required for emitDecoratorMetadata DI resolution
import { RulesService } from './rules.service';

const RULES_ROLES: Role[] = [...rolesForRoute('/compliance/rules')];

if (RULES_ROLES.length === 0) {
  throw new Error(
    "RBAC config drift: rolesForRoute('/compliance/rules') resolved to [] — " +
      'the route pattern is missing from the shared roleRoutes matrix. Refusing to ' +
      'boot rather than expose /compliance/rules to every authenticated user.'
  );
}

interface RequestWithSession extends Request {
  session?: SessionContainer;
}

@Controller('compliance')
export class RulesController {
  constructor(
    private readonly rulesService: RulesService,
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

  @Get('rules')
  @UseGuards(SessionGuard, RolesGuard)
  @Roles(...RULES_ROLES)
  listRules(): Promise<ComplianceRule[]> {
    return this.rulesService.listRules();
  }

  @Post('rules')
  @HttpCode(HttpStatus.CREATED)
  @UseGuards(SessionGuard, RolesGuard)
  @Roles(...RULES_ROLES)
  async createRule(
    @Body() body: RuleCreateDto,
    @Req() req: RequestWithSession
  ): Promise<ComplianceRule> {
    let input: ReturnType<typeof ruleCreateSchema.parse>;
    try {
      input = ruleCreateSchema.parse(body);
    } catch (err) {
      if (err instanceof ZodError) {
        throw new BadRequestException(err.issues);
      }
      throw err;
    }
    const { userId, role } = await this.resolveActor(req);
    return this.rulesService.createRule(input, userId, role);
  }

  @Patch('rules/:id')
  @UseGuards(SessionGuard, RolesGuard)
  @Roles(...RULES_ROLES)
  async updateRule(
    @Param('id') id: string,
    @Body() body: RuleUpdateDto,
    @Req() req: RequestWithSession
  ): Promise<ComplianceRule> {
    let input: ReturnType<typeof ruleUpdateSchema.parse>;
    try {
      input = ruleUpdateSchema.parse(body);
    } catch (err) {
      if (err instanceof ZodError) {
        throw new BadRequestException(err.issues);
      }
      throw err;
    }
    const { userId, role } = await this.resolveActor(req);
    return this.rulesService.updateRule(id, input, userId, role);
  }

  @Delete('rules/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(SessionGuard, RolesGuard)
  @Roles(...RULES_ROLES)
  async deleteRule(@Param('id') id: string, @Req() req: RequestWithSession): Promise<void> {
    const { userId, role } = await this.resolveActor(req);
    return this.rulesService.deleteRule(id, userId, role);
  }
}

/**
 * DataSourceAdminController (wave-15, task 41c017f7) — admin integrations.
 *
 * Routes:
 *   GET   /admin/integrations          — list connections (NO credential in response)
 *   POST  /admin/integrations          — create connection + encrypted credential
 *   PATCH /admin/integrations/:id      — update connection + re-encrypt credential
 *   PATCH /admin/integrations/:id/toggle — enable/disable (NO live connection-test)
 *
 * RBAC: admin-only.
 * Auth: SessionGuard + RolesGuard.
 *
 * Route ordering: POST /admin/integrations BEFORE PATCH /admin/integrations/:id
 * to avoid `:id` matching 'integrations'. NestJS route resolution in @Controller
 * + method-level decorators resolves POST /admin/integrations correctly because
 * there is no `:id` on the POST path. The ordering comment is for clarity.
 *
 * SECURITY: the credential field in the request body is a plaintext ephemeral
 * input that is encrypted by DataSourceAdminService before any DB write. The
 * controller MUST NOT log `body` or include it in error messages when a credential
 * is present. The service handles credential REDACTION in error paths.
 */

import type {
  DataSourceConnectionAdminListResponse,
  DataSourceConnectionAdminRecord,
  Role,
} from '@dealflow/shared';
import {
  dataSourceConnectionToggleSchema,
  dataSourceConnectionUpsertSchema,
  rolesForRoute,
} from '@dealflow/shared';
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
// biome-ignore lint/style/useImportType: value import required for emitDecoratorMetadata DI resolution
import { DataSourceAdminService } from './data-source-admin.service';

const ADMIN_INTEGRATIONS_ROLES: Role[] = [...rolesForRoute('/admin/integrations')];

if (ADMIN_INTEGRATIONS_ROLES.length === 0) {
  throw new Error(
    "RBAC config drift: rolesForRoute('/admin/integrations') resolved to [] — " +
      'route missing from shared roleRoutes. Refusing to boot.'
  );
}

interface RequestWithSession extends Request {
  session?: SessionContainer;
}

@Controller('admin')
export class DataSourceAdminController {
  constructor(
    private readonly dataSourceAdminService: DataSourceAdminService,
    private readonly authRepository: AuthRepository
  ) {}

  private async resolveActor(req: RequestWithSession): Promise<{ userId: string; role: string }> {
    const session = req.session;
    if (!session) throw new UnauthorizedException('Session not found on request');
    const appUser = await this.authRepository.getUserWithRole(session.getUserId());
    if (!appUser)
      throw new UnauthorizedException('Authenticated user not found in app users table');
    return { userId: appUser.id, role: appUser.roleName };
  }

  @Get('integrations')
  @UseGuards(SessionGuard, RolesGuard)
  @Roles(...ADMIN_INTEGRATIONS_ROLES)
  async listConnections(): Promise<DataSourceConnectionAdminListResponse> {
    const connections = await this.dataSourceAdminService.listConnections();
    return { connections };
  }

  @Post('integrations')
  @HttpCode(HttpStatus.CREATED)
  @UseGuards(SessionGuard, RolesGuard)
  @Roles(...ADMIN_INTEGRATIONS_ROLES)
  async createConnection(
    @Body() body: unknown,
    @Req() req: RequestWithSession
  ): Promise<DataSourceConnectionAdminRecord> {
    let input: ReturnType<typeof dataSourceConnectionUpsertSchema.parse>;
    try {
      input = dataSourceConnectionUpsertSchema.parse(body);
    } catch (err) {
      if (err instanceof ZodError) {
        // SECURITY: Zod error may echo the input — scrub the credential.
        // The issues array from ZodError does not include full input values for
        // standard schema validations, but we sanitize explicitly for defence-in-depth.
        throw new BadRequestException('Invalid input for data source connection');
      }
      throw err;
    }
    const { userId, role } = await this.resolveActor(req);
    return this.dataSourceAdminService.createConnection(input, userId, role);
  }

  @Patch('integrations/:id')
  @UseGuards(SessionGuard, RolesGuard)
  @Roles(...ADMIN_INTEGRATIONS_ROLES)
  async updateConnection(
    @Param('id') id: string,
    @Body() body: unknown,
    @Req() req: RequestWithSession
  ): Promise<DataSourceConnectionAdminRecord> {
    let input: ReturnType<typeof dataSourceConnectionUpsertSchema.parse>;
    try {
      input = dataSourceConnectionUpsertSchema.parse(body);
    } catch (err) {
      if (err instanceof ZodError) {
        throw new BadRequestException('Invalid input for data source connection');
      }
      throw err;
    }
    const { userId, role } = await this.resolveActor(req);
    return this.dataSourceAdminService.updateConnection(id, input, userId, role);
  }

  @Patch('integrations/:id/toggle')
  @UseGuards(SessionGuard, RolesGuard)
  @Roles(...ADMIN_INTEGRATIONS_ROLES)
  async toggleConnection(
    @Param('id') id: string,
    @Body() body: unknown,
    @Req() req: RequestWithSession
  ): Promise<DataSourceConnectionAdminRecord> {
    let input: ReturnType<typeof dataSourceConnectionToggleSchema.parse>;
    try {
      input = dataSourceConnectionToggleSchema.parse(body);
    } catch (err) {
      if (err instanceof ZodError) throw new BadRequestException(err.issues);
      throw err;
    }
    const { userId, role } = await this.resolveActor(req);
    return this.dataSourceAdminService.toggleConnection(id, input, userId, role);
  }
}

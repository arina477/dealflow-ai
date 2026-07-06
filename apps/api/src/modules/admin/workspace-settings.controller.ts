/**
 * WorkspaceSettingsController (wave-15, task 648a86a6) — admin workspace settings.
 *
 * Routes:
 *   GET /admin/workspace-settings   — return current firm + compliance profile defaults
 *   PUT /admin/workspace-settings   — upsert settings (creates if absent)
 *
 * RBAC: admin-only.
 * Auth: SessionGuard + RolesGuard.
 */

import type { Role, WorkspaceSettings } from '@dealflow/shared';
import { rolesForRoute, workspaceSettingsUpdateSchema } from '@dealflow/shared';
import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Put,
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
import { WorkspaceSettingsService } from './workspace-settings.service';

const ADMIN_SETTINGS_ROLES: Role[] = [...rolesForRoute('/admin/workspace-settings')];

if (ADMIN_SETTINGS_ROLES.length === 0) {
  throw new Error(
    "RBAC config drift: rolesForRoute('/admin/workspace-settings') resolved to [] — " +
      'route missing from shared roleRoutes. Refusing to boot.'
  );
}

interface RequestWithSession extends Request {
  session?: SessionContainer;
}

@Controller('admin')
export class WorkspaceSettingsController {
  constructor(
    private readonly workspaceSettingsService: WorkspaceSettingsService,
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

  @Get('workspace-settings')
  @UseGuards(SessionGuard, RolesGuard)
  @Roles(...ADMIN_SETTINGS_ROLES)
  async getSettings(): Promise<WorkspaceSettings | null> {
    return this.workspaceSettingsService.getSettings();
  }

  @Put('workspace-settings')
  @UseGuards(SessionGuard, RolesGuard)
  @Roles(...ADMIN_SETTINGS_ROLES)
  async updateSettings(
    @Body() body: unknown,
    @Req() req: RequestWithSession
  ): Promise<WorkspaceSettings> {
    let input: ReturnType<typeof workspaceSettingsUpdateSchema.parse>;
    try {
      input = workspaceSettingsUpdateSchema.parse(body);
    } catch (err) {
      if (err instanceof ZodError) throw new BadRequestException(err.issues);
      throw err;
    }
    const { userId, role } = await this.resolveActor(req);
    return this.workspaceSettingsService.updateSettings(input, userId, role);
  }
}

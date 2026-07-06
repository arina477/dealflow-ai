/**
 * AdminUsersController (wave-15 task 82ec8724; wave-16 task 042cf4e6)
 * — admin user management.
 *
 * Routes:
 *   GET  /admin/users                   — list users (name/email/role/active)
 *   POST /admin/users/invite            — create invite record (no email send)
 *   PATCH /admin/users/:id/role         — change user role
 *   POST /admin/users/:id/deactivate    — soft-deactivate a user
 *   POST /admin/users/:id/reactivate    — reverse deactivation (wave-16 042cf4e6)
 *
 * RBAC: admin-only (sourced from shared roleRoutes matrix).
 * Auth: SessionGuard + RolesGuard.
 * Actor: getUserWithRole(session.getUserId()) → FK-safe app users.id.
 *
 * FAIL-CLOSED at boot: if rolesForRoute('/admin/users') returns [], module
 * init throws (config drift → loud boot failure, not silent open).
 */

import type { Role } from '@dealflow/shared';
import {
  adminAssignRoleInputSchema,
  type adminDeactivateResponseSchema,
  adminInviteInputSchema,
  adminReactivateParamsSchema,
  type adminReactivateResponseSchema,
  rolesForRoute,
  type userAdminListResponseSchema,
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
import { UserManagementService } from './user-management.service';

const ADMIN_USERS_ROLES: Role[] = [...rolesForRoute('/admin/users')];

if (ADMIN_USERS_ROLES.length === 0) {
  throw new Error(
    "RBAC config drift: rolesForRoute('/admin/users') resolved to [] — " +
      'route missing from shared roleRoutes. Refusing to boot rather than expose /admin/users.'
  );
}

interface RequestWithSession extends Request {
  session?: SessionContainer;
}

@Controller('admin')
export class AdminUsersController {
  constructor(
    private readonly userManagementService: UserManagementService,
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

  @Get('users')
  @UseGuards(SessionGuard, RolesGuard)
  @Roles(...ADMIN_USERS_ROLES)
  async listUsers(
    @Req() _req: RequestWithSession
  ): Promise<ReturnType<typeof userAdminListResponseSchema.parse>> {
    const userList = await this.userManagementService.listUsers();
    return {
      users: userList.map((u) => ({
        id: u.id,
        email: u.email,
        role: u.role as Role,
        deactivatedAt: u.deactivatedAt,
        createdAt: u.createdAt,
        invitedBy: u.invitedBy,
      })),
    };
  }

  @Post('users/invite')
  @HttpCode(HttpStatus.CREATED)
  @UseGuards(SessionGuard, RolesGuard)
  @Roles(...ADMIN_USERS_ROLES)
  async inviteUser(
    @Body() body: unknown,
    @Req() req: RequestWithSession
  ): Promise<{ inviteId: string; email: string; role: Role; expiry: string }> {
    let input: ReturnType<typeof adminInviteInputSchema.parse>;
    try {
      input = adminInviteInputSchema.parse(body);
    } catch (err) {
      if (err instanceof ZodError) throw new BadRequestException('Invalid request body');
      throw err;
    }
    const { userId, role } = await this.resolveActor(req);
    return this.userManagementService.inviteAsActor(input, userId, role);
  }

  @Patch('users/:id/role')
  @UseGuards(SessionGuard, RolesGuard)
  @Roles(...ADMIN_USERS_ROLES)
  async assignRole(
    @Param('id') id: string,
    @Body() body: unknown,
    @Req() req: RequestWithSession
  ): Promise<void> {
    let input: ReturnType<typeof adminAssignRoleInputSchema.parse>;
    try {
      input = adminAssignRoleInputSchema.parse(body);
    } catch (err) {
      if (err instanceof ZodError) throw new BadRequestException('Invalid request body');
      throw err;
    }
    const { userId, role } = await this.resolveActor(req);
    return this.userManagementService.assignRoleAsActor(id, input.role, userId, role);
  }

  @Post('users/:id/deactivate')
  @UseGuards(SessionGuard, RolesGuard)
  @Roles(...ADMIN_USERS_ROLES)
  async deactivateUser(
    @Param('id') id: string,
    @Req() req: RequestWithSession
  ): Promise<ReturnType<typeof adminDeactivateResponseSchema.parse>> {
    const { userId, role } = await this.resolveActor(req);
    return this.userManagementService.deactivateAsActor(id, userId, role);
  }

  /**
   * POST /admin/users/:id/reactivate — reverse a soft-deactivation.
   *
   * Responses:
   *   200  — user is now active (deactivated_at = null)
   *   400  — user is already active (deactivated_at was already null)
   *   401  — anonymous caller
   *   403  — advisor (admin-only guard)
   *   404  — unknown user id
   */
  @Post('users/:id/reactivate')
  @HttpCode(HttpStatus.OK)
  @UseGuards(SessionGuard, RolesGuard)
  @Roles(...ADMIN_USERS_ROLES)
  async reactivateUser(
    @Param('id') id: string,
    @Req() req: RequestWithSession
  ): Promise<ReturnType<typeof adminReactivateResponseSchema.parse>> {
    try {
      adminReactivateParamsSchema.parse({ id });
    } catch {
      throw new BadRequestException('id must be a valid UUID');
    }
    const { userId, role } = await this.resolveActor(req);
    return this.userManagementService.reactivateAsActor(id, userId, role);
  }
}

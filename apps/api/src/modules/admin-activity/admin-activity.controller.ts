/**
 * AdminActivityController (wave-16, task 8bb0a22f — P-4 Finding 3)
 *
 * Exposes GET /admin/activity-data — the admin-only, read-only view of the
 * immutable audit log filtered to the 7 admin-activity actions.
 *
 * ── RBAC ────────────────────────────────────────────────────────────────────
 * Admin-only: SessionGuard + RolesGuard with ADMIN_ACTIVITY_ROLES (admin only).
 * Advisor receives 403 (ForbiddenException from RolesGuard).
 * Unauthenticated caller receives 401 (UnauthorizedException from SessionGuard).
 *
 * FAIL-CLOSED at boot: if rolesForRoute('/admin/activity-data') resolves to [],
 * the module throws on load — config drift surfaces as a loud boot failure
 * rather than silently opening the route (mirrors AdminUsersController pattern).
 *
 * ── Security invariants ─────────────────────────────────────────────────────
 * 1. GET only — no mutating method on this controller.
 * 2. The service layer provides the row projection. The controller does NOT
 *    inspect or pass through raw audit fields.
 * 3. Query params are validated against adminActivityQuerySchema (Zod);
 *    invalid params → 400 BadRequestException (no input echo in the error).
 */

import type { Role } from '@dealflow/shared';
import {
  type AdminActivityResponse,
  adminActivityQuerySchema,
  rolesForRoute,
} from '@dealflow/shared';
import { BadRequestException, Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ZodError } from 'zod';

// biome-ignore lint/style/useImportType: value import required for emitDecoratorMetadata DI resolution
import { Roles, RolesGuard } from '../auth/guards/roles.guard';
// biome-ignore lint/style/useImportType: value import required for emitDecoratorMetadata DI resolution
import { SessionGuard } from '../auth/guards/session.guard';
// biome-ignore lint/style/useImportType: value import required for emitDecoratorMetadata DI resolution
import { AdminActivityService } from './admin-activity.service';

const ADMIN_ACTIVITY_ROLES: Role[] = [...rolesForRoute('/admin/activity-data')];

if (ADMIN_ACTIVITY_ROLES.length === 0) {
  throw new Error(
    "RBAC config drift: rolesForRoute('/admin/activity-data') resolved to [] — " +
      'route missing from shared roleRoutes. Refusing to boot rather than expose /admin/activity-data.'
  );
}

@Controller('admin')
export class AdminActivityController {
  constructor(private readonly adminActivityService: AdminActivityService) {}

  /**
   * GET /admin/activity-data
   *
   * Returns a paginated list of admin-activity entries from the immutable audit
   * log. Filtered to the 7 admin actions, newest-first, cursor-paginated.
   *
   * Query params (all optional):
   *   action  — one of the 7 admin-activity action values
   *   since   — ISO datetime lower bound (inclusive)
   *   until   — ISO datetime upper bound (inclusive)
   *   cursor  — sequence_number of the last item on the prior page
   *   limit   — page size (1–200, default 50)
   *
   * Response: { rows: AdminActivityRow[], nextCursor: number|null, total: number }
   * Row shape: { sequenceNumber, actor{displayName,email}, target{displayName,email}|null,
   *              action, timestamp }
   * NEVER includes hash fields, credentials, or raw payload.
   *
   * Auth: SessionGuard (401 if no session) + RolesGuard (403 if not admin).
   */
  @Get('activity-data')
  @UseGuards(SessionGuard, RolesGuard)
  @Roles(...ADMIN_ACTIVITY_ROLES)
  async getActivityData(@Query() rawQuery: unknown): Promise<AdminActivityResponse> {
    let query: ReturnType<typeof adminActivityQuerySchema.parse>;
    try {
      query = adminActivityQuerySchema.parse(rawQuery);
    } catch (err) {
      if (err instanceof ZodError) throw new BadRequestException('Invalid query parameters');
      throw err;
    }

    return this.adminActivityService.getActivity(query);
  }
}

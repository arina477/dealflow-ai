/**
 * OutreachActivityController — wave-20 M9 outreach-activity HTTP surface (task b2acf4ce).
 *
 * Endpoints:
 *   GET  /outreach-activity           advisor, admin (list own-workspace activities)
 *   POST /outreach-activity           advisor, admin (create activity)
 *   PATCH /outreach-activity/:id      advisor, admin (update / status-transition / cancel)
 *
 * ── RBAC pattern (wave-5/8/11/12 exemplar) ───────────────────────────────────
 * Role constants sourced from shared roleRoutes via rolesForRoute(). Fail-closed
 * boot assertions: if route pattern drifts from RBAC map, boot fails loudly.
 *
 * ── ROUTE-ORDERING (wave-9 lesson) ──────────────────────────────────────────
 * Static routes declared before :id routes. No overlap here (3 endpoints).
 *
 * ── HARD BOUNDARY ────────────────────────────────────────────────────────────
 * ZERO email send, ZERO Anthropic/LLM import, ZERO new external SDK.
 */

import type {
  CreateOutreachActivityInput,
  Role,
  UpdateOutreachActivityInput,
} from '@dealflow/shared';
import {
  createOutreachActivitySchema,
  rolesForRoute,
  updateOutreachActivitySchema,
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
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { ZodError } from 'zod';
import { Roles, RolesGuard } from '../auth/guards/roles.guard';
import type { RequestWithSession } from '../auth/guards/session.guard';
import { SessionGuard } from '../auth/guards/session.guard';
// biome-ignore lint/style/useImportType: NestJS DI needs the runtime value (emitDecoratorMetadata)
import { OutreachActivityService } from './outreach-activity.service';

// ---------------------------------------------------------------------------
// Fail-closed boot assertions — guard against RBAC config drift
// ---------------------------------------------------------------------------

/**
 * OUTREACH_ACTIVITY_ROLES — advisor, admin.
 * Both create and list are open to advisor + admin.
 */
const OUTREACH_ACTIVITY_ROLES: Role[] = [...rolesForRoute('/outreach-activity')];
if (OUTREACH_ACTIVITY_ROLES.length === 0) {
  throw new Error(
    "RBAC config drift: rolesForRoute('/outreach-activity') resolved to [] — " +
      'route pattern missing from shared roleRoutes matrix. Refusing to boot.'
  );
}

/**
 * OUTREACH_ACTIVITY_DETAIL_ROLES — advisor, admin.
 * Update / status-transition / cancel require same roles.
 */
const OUTREACH_ACTIVITY_DETAIL_ROLES: Role[] = [...rolesForRoute('/outreach-activity/:id')];
if (OUTREACH_ACTIVITY_DETAIL_ROLES.length === 0) {
  throw new Error(
    "RBAC config drift: rolesForRoute('/outreach-activity/:id') resolved to [] — " +
      'route pattern missing from shared roleRoutes matrix. Refusing to boot.'
  );
}

// ---------------------------------------------------------------------------
// Controller
// ---------------------------------------------------------------------------

@Controller('outreach-activity')
export class OutreachActivityController {
  constructor(private readonly outreachActivityService: OutreachActivityService) {}

  // ---------------------------------------------------------------------------
  // GET /outreach-activity (list)
  // ---------------------------------------------------------------------------

  /**
   * list — return outreach_activity rows for the current workspace.
   * Optional query param: ?status=planned|completed|cancelled
   * Auth: advisor, admin.
   */
  @Get()
  @UseGuards(SessionGuard, RolesGuard)
  @Roles(...OUTREACH_ACTIVITY_ROLES)
  async list(@Query() query: Record<string, string>) {
    const validStatuses = ['planned', 'completed', 'cancelled'] as const;
    const statusParam = query.status;
    const filter: { status?: 'planned' | 'completed' | 'cancelled' } = {};
    if (
      statusParam &&
      validStatuses.includes(statusParam as 'planned' | 'completed' | 'cancelled')
    ) {
      filter.status = statusParam as 'planned' | 'completed' | 'cancelled';
    }
    const activities = await this.outreachActivityService.list(filter);
    return { activities };
  }

  // ---------------------------------------------------------------------------
  // POST /outreach-activity (create)
  // ---------------------------------------------------------------------------

  /**
   * create — create a new outreach_activity row.
   * Body: CreateOutreachActivityInput (Zod validated, strict — no workspaceId/createdBy).
   * Returns 201 with the created row.
   * Auth: advisor, admin.
   */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  @UseGuards(SessionGuard, RolesGuard)
  @Roles(...OUTREACH_ACTIVITY_ROLES)
  async create(@Body() body: unknown, @Req() req: RequestWithSession) {
    const result = createOutreachActivitySchema.safeParse(body);
    if (!result.success) {
      throw new BadRequestException(
        (result.error as ZodError).issues.map((i) => i.message).join('; ')
      );
    }
    const input: CreateOutreachActivityInput = result.data;

    const session = req.session;
    if (!session) {
      throw new Error('OutreachActivityController: session not present after SessionGuard');
    }

    return this.outreachActivityService.create(input, session.getUserId());
  }

  // ---------------------------------------------------------------------------
  // PATCH /outreach-activity/:id (update / status-transition / cancel)
  // ---------------------------------------------------------------------------

  /**
   * update — update an outreach_activity row's fields or status.
   * Body: UpdateOutreachActivityInput (Zod validated, strict).
   * Special: if status='cancelled', delegates to service.cancel (separate audit verb).
   * Returns 200 with the updated row.
   * Auth: advisor, admin.
   */
  @Patch(':id')
  @UseGuards(SessionGuard, RolesGuard)
  @Roles(...OUTREACH_ACTIVITY_DETAIL_ROLES)
  async update(@Param('id') id: string, @Body() body: unknown, @Req() req: RequestWithSession) {
    const result = updateOutreachActivitySchema.safeParse(body);
    if (!result.success) {
      throw new BadRequestException(
        (result.error as ZodError).issues.map((i) => i.message).join('; ')
      );
    }
    const input: UpdateOutreachActivityInput = result.data;

    const session = req.session;
    if (!session) {
      throw new Error('OutreachActivityController: session not present after SessionGuard');
    }

    const stUserId = session.getUserId();

    // Route to dedicated cancel/updateStatus/update verb for per-verb audit coverage (R4/SF5).
    if (input.status === 'cancelled') {
      return this.outreachActivityService.cancel(id, stUserId);
    }
    if (input.status === 'completed' || input.status === 'planned') {
      // Pure status transition — use updateStatus for distinct audit action.
      const hasOtherFields = Object.keys(input).some((k) => k !== 'status');
      if (!hasOtherFields) {
        return this.outreachActivityService.updateStatus(id, input.status, stUserId);
      }
    }

    // General field update (may include a non-cancel/non-transition status change).
    return this.outreachActivityService.update(id, input, stUserId);
  }
}

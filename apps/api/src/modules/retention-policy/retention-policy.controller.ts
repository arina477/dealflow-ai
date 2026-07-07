/**
 * RetentionPolicyController (wave-28, task d3cc1337) — HTTP surface for the
 * M10 retention policy configuration.
 *
 * Endpoints:
 *   GET /compliance/retention  — return current policy + cutoff date.
 *   PUT /compliance/retention  — upsert the policy (audit-logged on change).
 *
 * ── RBAC (fail-closed boot assertions) ───────────────────────────────────────
 * RETENTION_ROLES derived from '/compliance/retention' in the shared roleRoutes.
 * If the pattern is absent from the matrix the boot assertion throws and the
 * service refuses to start — fail-closed (mirrors recordkeeping.controller.ts).
 * Allowed: compliance + admin. advisor/analyst → 403. anon → 401.
 *
 * ── SEC-2 enforcement ────────────────────────────────────────────────────────
 * The PUT body is parsed through setRetentionPolicySchema.strict() — any request
 * carrying workspace_id / firmId / tenant → 400 (unknown key rejected by .strict()).
 * workspace_id is ALWAYS resolved server-side from the ALS GUC.
 *
 * ── SEC-A (server-resolved workspace) ────────────────────────────────────────
 * The service reads workspace_id from getWorkspaceId() (ALS/GUC). The controller
 * does NOT pass any workspace identifier from the request to the service.
 *
 * ── NO deletion endpoint ─────────────────────────────────────────────────────
 * There is no DELETE handler. The retention policy is permanent once created.
 */

import type { RetentionPolicy, Role } from '@dealflow/shared';
import { rolesForRoute, setRetentionPolicySchema } from '@dealflow/shared';
import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Put,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { ZodError } from 'zod';
// biome-ignore lint/style/useImportType: NestJS DI needs the runtime value
import { AuthRepository } from '../auth/auth.repository';
import { Roles, RolesGuard } from '../auth/guards/roles.guard';
import type { RequestWithSession } from '../auth/guards/session.guard';
import { SessionGuard } from '../auth/guards/session.guard';
// biome-ignore lint/style/useImportType: NestJS DI needs the runtime value
import { RetentionPolicyService } from './retention-policy.service';

// ---------------------------------------------------------------------------
// Fail-closed boot assertions — guard against RBAC config drift
// ---------------------------------------------------------------------------

/**
 * RETENTION_ROLES — compliance + admin.
 * Sourced from '/compliance/retention' in the shared roleRoutes.
 * If the pattern is absent the service refuses to boot.
 */
const RETENTION_ROLES: Role[] = [...rolesForRoute('/compliance/retention')];
if (RETENTION_ROLES.length === 0) {
  throw new Error(
    "RBAC config drift: rolesForRoute('/compliance/retention') resolved to [] — " +
      'route pattern missing from shared roleRoutes matrix. Refusing to boot.'
  );
}

// ---------------------------------------------------------------------------
// Controller
// ---------------------------------------------------------------------------

@Controller('compliance')
export class RetentionPolicyController {
  constructor(
    private readonly retentionPolicyService: RetentionPolicyService,
    private readonly authRepository: AuthRepository
  ) {}

  /**
   * GET /compliance/retention
   * Returns the current retention policy (or the default if not yet configured).
   * Reads are not audited.
   */
  @Get('retention')
  @UseGuards(SessionGuard, RolesGuard)
  @Roles(...RETENTION_ROLES)
  async getPolicy(): Promise<RetentionPolicy> {
    return this.retentionPolicyService.getPolicy();
  }

  /**
   * PUT /compliance/retention
   * Upserts the retention policy for the current workspace.
   * Audit-logs the change when the value changes (SEC-C).
   * workspace_id is resolved server-side from the ALS GUC (SEC-A).
   */
  @Put('retention')
  @HttpCode(HttpStatus.OK)
  @UseGuards(SessionGuard, RolesGuard)
  @Roles(...RETENTION_ROLES)
  async setPolicy(@Body() body: unknown, @Req() req: RequestWithSession): Promise<RetentionPolicy> {
    // SEC-2: .strict() rejects workspace_id, firmId, tenant, or any unknown key → 400.
    const parsed = setRetentionPolicySchema.safeParse(body);
    if (!parsed.success) {
      const err = parsed.error as ZodError;
      throw new BadRequestException(err.issues.map((i) => i.message).join('; '));
    }

    const session = req.session;
    if (!session) {
      throw new Error('RetentionPolicyController: session not present after SessionGuard');
    }

    // Resolve actor from session (server-side; never from client body).
    const actor = await this.authRepository.getUserWithRole(session.getUserId());
    if (!actor) {
      throw new Error('RetentionPolicyController: actor not found for session user');
    }

    return this.retentionPolicyService.setPolicy(parsed.data, actor.id, actor.roleName);
  }
}

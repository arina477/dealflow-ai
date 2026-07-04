/**
 * OutreachController — HTTP surface for outreach composition.
 *
 * Endpoints:
 *   POST  /outreach        advisor  (compose — triggers non-bypassable gate)
 *   GET   /outreach        advisor, compliance  (list)
 *   GET   /outreach/:id    advisor, compliance  (detail)
 *
 * ── GATE INVARIANT ──────────────────────────────────────────────────────────
 * The POST /outreach endpoint ALWAYS results in OutreachService.composeAsActor
 * being called, which ALWAYS calls ComplianceGateService.evaluate(ctx, tx).
 * There is NO code path in the controller that bypasses the service or sets
 * status='send_eligible' directly. The controller is a thin HTTP adapter.
 *
 * ── RBAC pattern (wave-5/8 exemplar) ─────────────────────────────────────
 * Role constants derived from shared roleRoutes. Fail-closed boot assertions.
 *
 * ── ROUTE-ORDERING (wave-9 lesson) ──────────────────────────────────────────
 * GET /outreach declared before GET /outreach/:id to prevent 'list' from being
 * swallowed as :id. (NestJS processes in declaration order.)
 *
 * ── HARD BOUNDARY ────────────────────────────────────────────────────────────
 * NO actual email send. NO Anthropic/LLM import. The compose endpoint produces
 * the send-eligible outreach RECORD only — no send is triggered.
 */

import type { OutreachComposeInput, Role } from '@dealflow/shared';
import { outreachComposeInputSchema, rolesForRoute } from '@dealflow/shared';
import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
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
import { OutreachService } from './outreach.service';

// ---------------------------------------------------------------------------
// Fail-closed boot assertions
// ---------------------------------------------------------------------------

/**
 * OUTREACH_READ_ROLES — advisor, compliance.
 * Sourced from '/outreach' in roleRoutes.
 */
const OUTREACH_READ_ROLES: Role[] = [...rolesForRoute('/outreach')];
if (OUTREACH_READ_ROLES.length === 0) {
  throw new Error(
    "RBAC config drift: rolesForRoute('/outreach') resolved to [] — " +
      'route pattern missing from shared roleRoutes matrix. Refusing to boot.'
  );
}

/**
 * OUTREACH_WRITE_ROLES — advisor ONLY.
 * Sourced from '/outreach/new' in roleRoutes.
 * Compliance may read but NOT compose outreach.
 */
const OUTREACH_WRITE_ROLES: Role[] = [...rolesForRoute('/outreach/new')];
if (OUTREACH_WRITE_ROLES.length === 0) {
  throw new Error(
    "RBAC config drift: rolesForRoute('/outreach/new') resolved to [] — " +
      'route pattern missing from shared roleRoutes matrix. Refusing to boot.'
  );
}

@Controller('outreach')
export class OutreachController {
  constructor(private readonly outreachService: OutreachService) {}

  // ---------------------------------------------------------------------------
  // POST /outreach  (compose — non-bypassable gate)
  // ---------------------------------------------------------------------------

  /**
   * compose — compose an outreach record.
   * ALWAYS calls ComplianceGateService.evaluate (non-bypassable).
   * Returns the outreach record with gate_verdict + status (send_eligible | blocked).
   * NO email send occurs — this produces the send-eligible record only.
   *
   * Body: OutreachComposeInput — mandateId, matchCandidateId, templateVersionId,
   *   recipients, jurisdiction.
   * Returns 201 with the outreach record.
   * Auth: advisor ONLY.
   */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  @UseGuards(SessionGuard, RolesGuard)
  @Roles(...OUTREACH_WRITE_ROLES)
  async compose(@Body() body: unknown, @Req() req: RequestWithSession) {
    const result = outreachComposeInputSchema.safeParse(body);
    if (!result.success) {
      throw new BadRequestException(
        (result.error as ZodError).issues.map((i) => i.message).join('; ')
      );
    }
    const input: OutreachComposeInput = result.data;

    const session = req.session;
    if (!session) {
      throw new Error('OutreachController: session not present after SessionGuard');
    }

    return this.outreachService.composeAsActor(input, session.getUserId());
  }

  // ---------------------------------------------------------------------------
  // GET /outreach  (list)
  //
  // ROUTE-ORDERING: declared before @Get(':id') — NestJS matches in declaration order.
  // ---------------------------------------------------------------------------

  /**
   * listOutreach — returns outreach records, optionally filtered by mandateId.
   *
   * Query params (optional):
   *   mandateId — filter by mandate UUID
   *
   * Auth: advisor, compliance.
   */
  @Get()
  @UseGuards(SessionGuard, RolesGuard)
  @Roles(...OUTREACH_READ_ROLES)
  async listOutreach(@Query() query: Record<string, string>) {
    const filter: { mandateId?: string } = {};
    if (query.mandateId) {
      filter.mandateId = query.mandateId;
    }
    return this.outreachService.list(filter);
  }

  // ---------------------------------------------------------------------------
  // GET /outreach/:id  (detail)
  // ---------------------------------------------------------------------------

  /**
   * getOutreachDetail — returns an outreach record by UUID.
   * Throws 404 if not found.
   * Auth: advisor, compliance.
   */
  @Get(':id')
  @UseGuards(SessionGuard, RolesGuard)
  @Roles(...OUTREACH_READ_ROLES)
  async getOutreachDetail(@Param('id') id: string) {
    return this.outreachService.getById(id);
  }
}

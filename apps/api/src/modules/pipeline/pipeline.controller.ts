/**
 * PipelineController — HTTP surface for M6 pipeline / deal-stage tracking.
 *
 * Endpoints:
 *   GET  /pipeline              advisor, compliance  (board — grouped by stage)
 *   POST /pipeline              advisor              (enroll deal from eligible source)
 *   PATCH /pipeline/:id/stage   advisor              (transition deal to new stage)
 *   POST  /pipeline/:id/notes   advisor, compliance  (append note)
 *   GET   /pipeline/:id/events  advisor, compliance  (ordered event timeline)
 *
 * ── RBAC pattern (wave-5/8/11 exemplar) ──────────────────────────────────────
 * Role constants derived from shared roleRoutes. Fail-closed boot assertions.
 * @Roles() derived from rolesForRoute — if route drifts, boot assertion fails.
 *
 * ── ROUTE-ORDERING (wave-9 lesson) ───────────────────────────────────────────
 * Static sub-routes declared BEFORE :id routes (e.g., if we add /pipeline/new
 * as a static route in the future). Within :id, sub-routes (:id/stage,
 * :id/notes, :id/events) are declared after bare :id handlers.
 * NestJS processes route handlers in declaration order within a controller.
 *
 * ── HARD BOUNDARY ────────────────────────────────────────────────────────────
 * NO email send, NO Anthropic/LLM import, NO new external SDK.
 * Pipeline tracking only — additive over shipped surfaces.
 */

import type { AddNoteInput, EnrollInput, Role, TransitionInput } from '@dealflow/shared';
import {
  addNoteInputSchema,
  enrollInputSchema,
  rolesForRoute,
  transitionInputSchema,
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
import { PipelineService } from './pipeline.service';

// ---------------------------------------------------------------------------
// Fail-closed boot assertions — guard against RBAC config drift
// ---------------------------------------------------------------------------

/**
 * PIPELINE_READ_ROLES — advisor, compliance.
 * Board read + events read + add note are open to both roles.
 * Sourced from '/pipeline' in roleRoutes.
 */
const PIPELINE_READ_ROLES: Role[] = [...rolesForRoute('/pipeline')];
if (PIPELINE_READ_ROLES.length === 0) {
  throw new Error(
    "RBAC config drift: rolesForRoute('/pipeline') resolved to [] — " +
      'route pattern missing from shared roleRoutes matrix. Refusing to boot.'
  );
}

/**
 * PIPELINE_WRITE_ROLES — advisor ONLY.
 * Enroll + transition mutations are advisor-only.
 * Sourced from '/pipeline/new' in roleRoutes.
 */
const PIPELINE_WRITE_ROLES: Role[] = [...rolesForRoute('/pipeline/new')];
if (PIPELINE_WRITE_ROLES.length === 0) {
  throw new Error(
    "RBAC config drift: rolesForRoute('/pipeline/new') resolved to [] — " +
      'route pattern missing from shared roleRoutes matrix. Refusing to boot.'
  );
}

/**
 * PIPELINE_TRANSITION_ROLES — advisor ONLY.
 * Stage transitions are advisor-only (not compliance read).
 * Sourced from '/pipeline/:id/stage' in roleRoutes.
 */
const PIPELINE_TRANSITION_ROLES: Role[] = [...rolesForRoute('/pipeline/:id/stage')];
if (PIPELINE_TRANSITION_ROLES.length === 0) {
  throw new Error(
    "RBAC config drift: rolesForRoute('/pipeline/:id/stage') resolved to [] — " +
      'route pattern missing from shared roleRoutes matrix. Refusing to boot.'
  );
}

/**
 * PIPELINE_NOTES_ROLES — advisor + compliance.
 * Notes are writable by both advisor and compliance.
 * Sourced from '/pipeline/:id/notes' in roleRoutes.
 */
const PIPELINE_NOTES_ROLES: Role[] = [...rolesForRoute('/pipeline/:id/notes')];
if (PIPELINE_NOTES_ROLES.length === 0) {
  throw new Error(
    "RBAC config drift: rolesForRoute('/pipeline/:id/notes') resolved to [] — " +
      'route pattern missing from shared roleRoutes matrix. Refusing to boot.'
  );
}

@Controller('pipeline')
export class PipelineController {
  constructor(private readonly pipelineService: PipelineService) {}

  // ---------------------------------------------------------------------------
  // GET /pipeline  (board — deals grouped by stage)
  //
  // ROUTE-ORDERING: declared before all :id routes (wave-9 lesson — static before :id).
  // ---------------------------------------------------------------------------

  /**
   * getBoard — return all pipeline rows grouped by stage.
   * Optional query param: ?mandateId for mandate-scoped board.
   * Auth: advisor, compliance.
   */
  @Get()
  @UseGuards(SessionGuard, RolesGuard)
  @Roles(...PIPELINE_READ_ROLES)
  async getBoard(@Query() query: Record<string, string>) {
    const filter: { mandateId?: string } = {};
    if (query.mandateId) {
      filter.mandateId = query.mandateId;
    }
    return this.pipelineService.getBoard(filter);
  }

  // ---------------------------------------------------------------------------
  // POST /pipeline  (enroll)
  // ---------------------------------------------------------------------------

  /**
   * enroll — enroll a deal target from an eligible source into the pipeline.
   * Eligible sources: outreach (status='send_eligible') or match_candidate
   * (disposition='accepted' AND match_run.ready_for_outreach=true).
   * Returns 201 with the created pipeline row.
   * Auth: advisor ONLY.
   */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  @UseGuards(SessionGuard, RolesGuard)
  @Roles(...PIPELINE_WRITE_ROLES)
  async enroll(@Body() body: unknown, @Req() req: RequestWithSession) {
    const result = enrollInputSchema.safeParse(body);
    if (!result.success) {
      throw new BadRequestException(
        (result.error as ZodError).issues.map((i) => i.message).join('; ')
      );
    }
    const input: EnrollInput = result.data;

    const session = req.session;
    if (!session) {
      throw new Error('PipelineController: session not present after SessionGuard');
    }

    return this.pipelineService.enrollAsActor(input, session.getUserId());
  }

  // ---------------------------------------------------------------------------
  // PATCH /pipeline/:id/stage  (stage transition)
  //
  // ROUTE-ORDERING: sub-routes (:id/stage, :id/notes, :id/events) declared
  // before bare :id to avoid NestJS shadowing (wave-9 static-before-:id lesson).
  // ---------------------------------------------------------------------------

  /**
   * transitionStage — move a deal to a new fixed stage.
   * Body: { toStage } — must be one of the 7 fixed pipeline stages.
   * Returns 200 with the updated pipeline row.
   * Auth: advisor ONLY.
   */
  @Patch(':id/stage')
  @UseGuards(SessionGuard, RolesGuard)
  @Roles(...PIPELINE_TRANSITION_ROLES)
  async transitionStage(
    @Param('id') id: string,
    @Body() body: unknown,
    @Req() req: RequestWithSession
  ) {
    const result = transitionInputSchema.safeParse(body);
    if (!result.success) {
      throw new BadRequestException(
        (result.error as ZodError).issues.map((i) => i.message).join('; ')
      );
    }
    const input: TransitionInput = result.data;

    const session = req.session;
    if (!session) {
      throw new Error('PipelineController: session not present after SessionGuard');
    }

    return this.pipelineService.transitionStageAsActor(id, input.toStage, session.getUserId());
  }

  // ---------------------------------------------------------------------------
  // POST /pipeline/:id/notes  (add note)
  // ---------------------------------------------------------------------------

  /**
   * addNote — append a free-text note to a pipeline deal's event timeline.
   * Body: { text } — non-empty (min 1 char).
   * Returns 201 with the created pipeline_events row.
   * Auth: advisor, compliance.
   */
  @Post(':id/notes')
  @HttpCode(HttpStatus.CREATED)
  @UseGuards(SessionGuard, RolesGuard)
  @Roles(...PIPELINE_NOTES_ROLES)
  async addNote(@Param('id') id: string, @Body() body: unknown, @Req() req: RequestWithSession) {
    const result = addNoteInputSchema.safeParse(body);
    if (!result.success) {
      throw new BadRequestException(
        (result.error as ZodError).issues.map((i) => i.message).join('; ')
      );
    }
    const input: AddNoteInput = result.data;

    const session = req.session;
    if (!session) {
      throw new Error('PipelineController: session not present after SessionGuard');
    }

    return this.pipelineService.addNoteAsActor(id, input.text, session.getUserId());
  }

  // ---------------------------------------------------------------------------
  // GET /pipeline/:id/events  (event timeline)
  // ---------------------------------------------------------------------------

  /**
   * getEvents — return the ordered event timeline for a pipeline deal.
   * Returns enrolled + stage_changed + note events in created_at ASC order.
   * Throws 404 if the pipeline row does not exist.
   * Auth: advisor, compliance.
   */
  @Get(':id/events')
  @UseGuards(SessionGuard, RolesGuard)
  @Roles(...PIPELINE_READ_ROLES)
  async getEvents(@Param('id') id: string) {
    return this.pipelineService.getEvents(id);
  }
}

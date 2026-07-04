/**
 * MatchingController — HTTP surface for the match spine.
 *
 * Endpoints:
 *   POST   /matches                           advisor, admin         (create run)
 *   GET    /matches/:id/shortlist             advisor, admin, analyst (shortlist — before /:id)
 *   GET    /matches/:id/candidates/:cid       advisor, admin         (candidate detail — before /:id)
 *   GET    /matches/:id                       advisor, admin, analyst (detail)
 *   GET    /matches                           advisor, admin, analyst (list by mandate)
 *   PATCH  /matches/:id/candidates/:cid       advisor, admin         (disposition)
 *   POST   /matches/:id/handoff               advisor, admin         (handoff)
 *
 * ── RBAC pattern (wave-5/7/8/9/10 exemplar) ─────────────────────────────────
 * Each endpoint:
 *   @UseGuards(SessionGuard, RolesGuard) — authentication + DB-authoritative role
 *   @Roles(...ROLES) — fail-closed on config drift
 *
 * advisor/admin: create + mutate (create run, disposition, handoff).
 * analyst: read-only (GET /matches, /matches/:id, /matches/:id/shortlist).
 *
 * Fail-closed boot assertion: MATCHES_READ_ROLES and MATCHES_WRITE_ROLES are
 * resolved from the shared roleRoutes matrix and asserted non-empty at boot.
 *
 * ── Route ordering ──────────────────────────────────────────────────────────
 * Static sub-paths (/shortlist) and /candidates/:cid are declared BEFORE
 * the generic @Get(':id') to prevent NestJS from capturing them as `:id`.
 *
 * ── Actor identity ───────────────────────────────────────────────────────────
 * For mutating endpoints, the SuperTokens user id is extracted from the verified
 * session and passed to MatchingService, which translates it to app users.id
 * via AuthRepository.getUserWithRole (wave-5 lesson).
 *
 * ── Request validation ───────────────────────────────────────────────────────
 * Body and query params are validated against the shared Zod schemas.
 * ZodError → 400 BadRequestException with issue messages joined by '; '.
 *
 * HARD BOUNDARY: NO Anthropic/Claude/LLM import. This is a pure HTTP adapter.
 */

import type {
  DispositionInput,
  MatchListFilter,
  MatchRunCreateInput,
  Role,
} from '@dealflow/shared';
import {
  dispositionInputSchema,
  matchListFilterSchema,
  matchRunCreateInputSchema,
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
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { ZodError } from 'zod';
import { Roles, RolesGuard } from '../auth/guards/roles.guard';
import type { RequestWithSession } from '../auth/guards/session.guard';
import { SessionGuard } from '../auth/guards/session.guard';
// biome-ignore lint/style/useImportType: DI-injected, needs runtime metadata (emitDecoratorMetadata)
import { MatchingService } from './matching.service';

// ---------------------------------------------------------------------------
// Fail-closed boot assertions — resolved from the single source of truth.
// If the /matches pattern is renamed/removed in rbac.ts, the app crashes at boot.
// ---------------------------------------------------------------------------

/**
 * MATCHES_READ_ROLES — roles permitted to read match runs (advisor, admin, analyst).
 * Sourced from '/matches' in the shared roleRoutes matrix.
 */
const MATCHES_READ_ROLES: Role[] = [...rolesForRoute('/matches')];
if (MATCHES_READ_ROLES.length === 0) {
  throw new Error(
    "RBAC config drift: rolesForRoute('/matches') resolved to [] — " +
      'the route pattern is missing from the shared roleRoutes matrix. Refusing to boot.'
  );
}

/**
 * MATCHES_WRITE_ROLES — roles permitted to create/mutate match runs (advisor, admin).
 * Sourced from '/matches/new' in the shared roleRoutes matrix.
 */
const MATCHES_WRITE_ROLES: Role[] = [...rolesForRoute('/matches/new')];
if (MATCHES_WRITE_ROLES.length === 0) {
  throw new Error(
    "RBAC config drift: rolesForRoute('/matches/new') resolved to [] — " +
      'the route pattern is missing from the shared roleRoutes matrix. Refusing to boot.'
  );
}

@Controller('matches')
export class MatchingController {
  constructor(private readonly matchingService: MatchingService) {}

  // ---------------------------------------------------------------------------
  // POST /matches  (create match run)
  // ---------------------------------------------------------------------------

  /**
   * createMatchRun — creates (or idempotently re-scores) a match run for a mandate.
   *
   * Body: { mandateId: string }
   * Returns 201 Created with MatchRankedList (run + candidates ordered fit_score DESC).
   * Auth: advisor, admin.
   */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  @UseGuards(SessionGuard, RolesGuard)
  @Roles(...MATCHES_WRITE_ROLES)
  async createMatchRun(@Body() body: unknown, @Req() req: RequestWithSession) {
    const result = matchRunCreateInputSchema.safeParse(body);
    if (!result.success) {
      throw new BadRequestException(
        (result.error as ZodError).issues.map((i) => i.message).join('; ')
      );
    }
    const input: MatchRunCreateInput = result.data;

    const session = req.session;
    if (!session) {
      throw new Error('MatchingController: session not present after SessionGuard');
    }
    const supertokensUserId = session.getUserId();

    return this.matchingService.createRunAsActor(input.mandateId, supertokensUserId);
  }

  // ---------------------------------------------------------------------------
  // GET /matches/:id/shortlist  (shortlist — BEFORE /:id to avoid capture)
  // ---------------------------------------------------------------------------

  /**
   * getShortlist — returns the shortlist (accepted candidates, fit_score DESC).
   *
   * Returns 200 with Shortlist { run, accepted }.
   * Auth: advisor, admin, analyst.
   */
  @Get(':id/shortlist')
  @UseGuards(SessionGuard, RolesGuard)
  @Roles(...MATCHES_READ_ROLES)
  async getShortlist(@Param('id') id: string) {
    return this.matchingService.getShortlist(id);
  }

  // ---------------------------------------------------------------------------
  // GET /matches  (list by mandate)
  // ROUTE ORDER: before @Get(':id') so the list handler fires first on bare /matches
  // ---------------------------------------------------------------------------

  /**
   * listMatchRuns — returns all match runs, optionally filtered by mandateId.
   *
   * Query params: mandateId (optional UUID)
   * Returns 200 with { runs: MatchRun[] }.
   * Auth: advisor, admin, analyst.
   */
  @Get()
  @UseGuards(SessionGuard, RolesGuard)
  @Roles(...MATCHES_READ_ROLES)
  async listMatchRuns(@Query() query: Record<string, string>) {
    const result = matchListFilterSchema.safeParse(query);
    if (!result.success) {
      throw new BadRequestException(
        (result.error as ZodError).issues.map((i) => i.message).join('; ')
      );
    }
    const filter: MatchListFilter = result.data;

    if (filter.mandateId) {
      return this.matchingService.listByMandate(filter.mandateId);
    }
    // Without mandateId, return empty (no global list endpoint by design for this wave).
    return { runs: [] };
  }

  // ---------------------------------------------------------------------------
  // GET /matches/:id  (detail)
  // ---------------------------------------------------------------------------

  /**
   * getMatchRun — returns MatchRankedList (run + candidates ordered fit_score DESC).
   *
   * Throws 404 if the run is not found.
   * Auth: advisor, admin, analyst.
   */
  @Get(':id')
  @UseGuards(SessionGuard, RolesGuard)
  @Roles(...MATCHES_READ_ROLES)
  async getMatchRun(@Param('id') id: string) {
    return this.matchingService.getRun(id);
  }

  // ---------------------------------------------------------------------------
  // PATCH /matches/:id/candidates/:cid  (disposition)
  // ---------------------------------------------------------------------------

  /**
   * patchDisposition — accept/reject/flag a match candidate.
   *
   * Body: { disposition: 'accepted' | 'rejected' | 'flagged' | 'pending' }
   * Returns 200 with the updated match_candidates row.
   * Cross-run scoped: 404 if the candidate does not belong to the given run.
   * Auth: advisor, admin.
   */
  @Patch(':id/candidates/:cid')
  @UseGuards(SessionGuard, RolesGuard)
  @Roles(...MATCHES_WRITE_ROLES)
  async patchDisposition(
    @Param('id') runId: string,
    @Param('cid') candidateId: string,
    @Body() body: unknown,
    @Req() req: RequestWithSession
  ) {
    const result = dispositionInputSchema.safeParse(body);
    if (!result.success) {
      throw new BadRequestException(
        (result.error as ZodError).issues.map((i) => i.message).join('; ')
      );
    }
    const input: DispositionInput = result.data;

    const session = req.session;
    if (!session) {
      throw new Error('MatchingController: session not present after SessionGuard');
    }
    const supertokensUserId = session.getUserId();

    return this.matchingService.patchDispositionAsActor(
      runId,
      candidateId,
      input.disposition,
      supertokensUserId
    );
  }

  // ---------------------------------------------------------------------------
  // POST /matches/:id/handoff  (handoff)
  // ---------------------------------------------------------------------------

  /**
   * handoffMatchRun — mark the run ready_for_outreach=true.
   *
   * Guard: ≥1 ACCEPTED candidate (returns 400 if none accepted).
   * NO outreach executed — this is the M6 handoff sentinel only.
   * Returns 200 with updated MatchRankedList.
   * Auth: advisor, admin.
   */
  @Post(':id/handoff')
  @UseGuards(SessionGuard, RolesGuard)
  @Roles(...MATCHES_WRITE_ROLES)
  async handoffMatchRun(@Param('id') runId: string, @Req() req: RequestWithSession) {
    const session = req.session;
    if (!session) {
      throw new Error('MatchingController: session not present after SessionGuard');
    }
    const supertokensUserId = session.getUserId();

    return this.matchingService.handoffAsActor(runId, supertokensUserId);
  }
}

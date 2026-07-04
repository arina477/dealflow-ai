/**
 * BuyerUniverseController — HTTP surface for the buyer-universe spine.
 *
 * Endpoints:
 *   POST   /buyer-universe                              analyst, advisor, admin  (assemble)
 *   POST   /buyer-universe/:id/filter                   analyst, advisor, admin  (filter)
 *   POST   /buyer-universe/:id/enrich                   analyst, advisor, admin  (enrich)
 *   GET    /buyer-universe/:id/gaps                     analyst, advisor, admin  (gaps)
 *   POST   /buyer-universe/:id/submit                   analyst, advisor, admin  (submit)
 *   GET    /buyer-universe/:id                          analyst, advisor, admin  (detail)
 *   GET    /buyer-universe                              analyst, advisor, admin  (list by mandate)
 *   PATCH  /buyer-universe/:id/candidates/:candidateId  analyst, advisor, admin  (patch candidate)
 *
 * ── RBAC pattern (wave-5/7/8 exemplar) ─────────────────────────────────────
 * Each endpoint:
 *   @UseGuards(SessionGuard, RolesGuard) — authentication + DB-authoritative role
 *   @Roles(...BUYER_UNIVERSE_ROLES) — fail-closed on config drift
 *
 * All buyer-universe operations share the same role set: analyst, advisor, admin.
 * analyst is the primary persona; advisor and admin have full access too.
 *
 * Fail-closed boot assertion: BUYER_UNIVERSE_ROLES is resolved from the shared
 * roleRoutes matrix and asserted non-empty at module-eval time. An empty set
 * (caused by route rename/removal in rbac.ts) throws at boot.
 *
 * ── Route ordering ──────────────────────────────────────────────────────────
 * Sub-resource routes (/gaps, /filter, /enrich, /submit, /candidates/:id) are
 * declared BEFORE the generic @Get(':id') and @Patch(':id') to prevent NestJS
 * from capturing literal sub-path segments as the `:id` param.
 *
 * ── Actor identity ───────────────────────────────────────────────────────────
 * For mutating endpoints, the SuperTokens user id is extracted from the verified
 * session and passed to BuyerUniverseService, which translates it to app users.id
 * via AuthRepository.getUserWithRole (wave-5 lesson).
 *
 * ── Request validation ───────────────────────────────────────────────────────
 * Body and query params are validated against the shared Zod schemas.
 * ZodError → 400 BadRequestException with issue messages joined by '; '.
 */

import type {
  BuyerUniverseAssembleInput,
  BuyerUniverseCandidatePatchInput,
  BuyerUniverseListFilter,
  Role,
} from '@dealflow/shared';
import {
  buyerUniverseAssembleInputSchema,
  buyerUniverseCandidatePatchInputSchema,
  buyerUniverseListFilterSchema,
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
import { BuyerUniverseService } from './buyer-universe.service';

// ---------------------------------------------------------------------------
// Fail-closed boot assertion — resolved from the single source of truth.
// If the /buyer-universe pattern is renamed/removed in rbac.ts, the app crashes at boot.
// ---------------------------------------------------------------------------

/**
 * BUYER_UNIVERSE_ROLES — roles permitted for all buyer-universe operations.
 * Sourced from '/buyer-universe' in the shared roleRoutes matrix: analyst, advisor, admin.
 */
const BUYER_UNIVERSE_ROLES: Role[] = [...rolesForRoute('/buyer-universe')];
if (BUYER_UNIVERSE_ROLES.length === 0) {
  throw new Error(
    "RBAC config drift: rolesForRoute('/buyer-universe') resolved to [] — " +
      'the route pattern is missing from the shared roleRoutes matrix. Refusing to boot.'
  );
}

@Controller('buyer-universe')
export class BuyerUniverseController {
  constructor(private readonly buyerUniverseService: BuyerUniverseService) {}

  // ---------------------------------------------------------------------------
  // POST /buyer-universe  (assemble)
  // ---------------------------------------------------------------------------

  /**
   * assembleUniverse — assembles a buyer universe from M3 companies for a mandate.
   *
   * Body: { mandateId: string }
   * Returns 201 Created with the buyer_universe row.
   * Auth: analyst, advisor, admin.
   */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  @UseGuards(SessionGuard, RolesGuard)
  @Roles(...BUYER_UNIVERSE_ROLES)
  async assembleUniverse(@Body() body: unknown, @Req() req: RequestWithSession) {
    const result = buyerUniverseAssembleInputSchema.safeParse(body);
    if (!result.success) {
      throw new BadRequestException(
        (result.error as ZodError).issues.map((i) => i.message).join('; ')
      );
    }
    const input: BuyerUniverseAssembleInput = result.data;

    const session = req.session;
    if (!session) {
      throw new Error('BuyerUniverseController: session not present after SessionGuard');
    }
    const supertokensUserId = session.getUserId();

    return this.buyerUniverseService.assembleAsActor(input, supertokensUserId);
  }

  // ---------------------------------------------------------------------------
  // POST /buyer-universe/:id/filter  (filter)
  // ROUTE ORDER: declared before @Get(':id') to prevent `:id` from swallowing sub-paths
  // ---------------------------------------------------------------------------

  /**
   * filterUniverse — apply the mandate's buyer criteria to include/exclude candidates.
   *
   * Returns 200 with the updated buyer_universe row (status=filtered).
   * Auth: analyst, advisor, admin.
   */
  @Post(':id/filter')
  @UseGuards(SessionGuard, RolesGuard)
  @Roles(...BUYER_UNIVERSE_ROLES)
  async filterUniverse(@Param('id') id: string, @Req() req: RequestWithSession) {
    const session = req.session;
    if (!session) {
      throw new Error('BuyerUniverseController: session not present after SessionGuard');
    }
    const supertokensUserId = session.getUserId();

    return this.buyerUniverseService.filterAsActor(id, supertokensUserId);
  }

  // ---------------------------------------------------------------------------
  // POST /buyer-universe/:id/enrich  (enrich)
  // ---------------------------------------------------------------------------

  /**
   * enrichUniverse — attach M3 contacts to included candidates.
   *
   * Returns 200 with { universeId, enrichedCandidates }.
   * Auth: analyst, advisor, admin.
   */
  @Post(':id/enrich')
  @UseGuards(SessionGuard, RolesGuard)
  @Roles(...BUYER_UNIVERSE_ROLES)
  async enrichUniverse(@Param('id') id: string, @Req() req: RequestWithSession) {
    const session = req.session;
    if (!session) {
      throw new Error('BuyerUniverseController: session not present after SessionGuard');
    }
    const supertokensUserId = session.getUserId();

    return this.buyerUniverseService.enrichAsActor(id, supertokensUserId);
  }

  // ---------------------------------------------------------------------------
  // GET /buyer-universe/:id/gaps  (gaps)
  // ROUTE ORDER: before @Get(':id') to prevent gaps from being captured as id
  // ---------------------------------------------------------------------------

  /**
   * getUniverseGaps — returns included candidates with no M3 contacts / missing data.
   *
   * Returns 200 with { universeId, gaps: BuyerUniverseGap[] }.
   * Auth: analyst, advisor, admin.
   */
  @Get(':id/gaps')
  @UseGuards(SessionGuard, RolesGuard)
  @Roles(...BUYER_UNIVERSE_ROLES)
  async getUniverseGaps(@Param('id') id: string) {
    return this.buyerUniverseService.getGaps(id);
  }

  // ---------------------------------------------------------------------------
  // POST /buyer-universe/:id/submit  (submit)
  // ---------------------------------------------------------------------------

  /**
   * submitUniverse — mark the universe as submitted (ready-to-rank for M5).
   *
   * Returns 200 with the updated buyer_universe row (status=submitted).
   * Throws 400 if universe is empty or in draft status.
   * Auth: analyst, advisor, admin.
   */
  @Post(':id/submit')
  @UseGuards(SessionGuard, RolesGuard)
  @Roles(...BUYER_UNIVERSE_ROLES)
  async submitUniverse(@Param('id') id: string, @Req() req: RequestWithSession) {
    const session = req.session;
    if (!session) {
      throw new Error('BuyerUniverseController: session not present after SessionGuard');
    }
    const supertokensUserId = session.getUserId();

    return this.buyerUniverseService.submitAsActor(id, supertokensUserId);
  }

  // ---------------------------------------------------------------------------
  // GET /buyer-universe  (list by mandate)
  // ROUTE ORDER: before @Get(':id') so the list handler fires first on bare /buyer-universe
  // ---------------------------------------------------------------------------

  /**
   * listUniverses — returns all buyer universes, optionally filtered by mandateId.
   *
   * Query params (all optional):
   *   mandateId — filter by mandate UUID
   *
   * Returns 200 with { universes: BuyerUniverse[] }.
   * Auth: analyst, advisor, admin.
   */
  @Get()
  @UseGuards(SessionGuard, RolesGuard)
  @Roles(...BUYER_UNIVERSE_ROLES)
  async listUniverses(@Query() query: Record<string, string>) {
    const result = buyerUniverseListFilterSchema.safeParse(query);
    if (!result.success) {
      throw new BadRequestException(
        (result.error as ZodError).issues.map((i) => i.message).join('; ')
      );
    }
    const filter: BuyerUniverseListFilter = result.data;

    if (filter.mandateId) {
      return this.buyerUniverseService.listByMandate(filter.mandateId);
    }
    // Without mandateId, return empty (no global list endpoint by design for this wave).
    return { universes: [] };
  }

  // ---------------------------------------------------------------------------
  // GET /buyer-universe/:id  (detail)
  // ---------------------------------------------------------------------------

  /**
   * getUniverseDetail — returns a BuyerUniverseDetail (universe + enriched candidates).
   *
   * Throws 404 if the universe is not found.
   * Auth: analyst, advisor, admin.
   */
  @Get(':id')
  @UseGuards(SessionGuard, RolesGuard)
  @Roles(...BUYER_UNIVERSE_ROLES)
  async getUniverseDetail(@Param('id') id: string) {
    return this.buyerUniverseService.getById(id);
  }

  // ---------------------------------------------------------------------------
  // PATCH /buyer-universe/:id/candidates/:candidateId
  // ---------------------------------------------------------------------------

  /**
   * patchCandidate — update a single candidate's membership_status and/or provenance.
   *
   * Body: { membershipStatus?: string, provenance?: string }
   * Returns 200 with the updated buyer_universe_candidates row.
   * Auth: analyst, advisor, admin.
   */
  @Patch(':id/candidates/:candidateId')
  @UseGuards(SessionGuard, RolesGuard)
  @Roles(...BUYER_UNIVERSE_ROLES)
  async patchCandidate(
    @Param('id') id: string,
    @Param('candidateId') candidateId: string,
    @Body() body: unknown,
    @Req() req: RequestWithSession
  ) {
    const result = buyerUniverseCandidatePatchInputSchema.safeParse(body);
    if (!result.success) {
      throw new BadRequestException(
        (result.error as ZodError).issues.map((i) => i.message).join('; ')
      );
    }
    const input: BuyerUniverseCandidatePatchInput = result.data;

    const session = req.session;
    if (!session) {
      throw new Error('BuyerUniverseController: session not present after SessionGuard');
    }
    const supertokensUserId = session.getUserId();

    return this.buyerUniverseService.patchCandidateAsActor(
      id,
      candidateId,
      input,
      supertokensUserId
    );
  }
}

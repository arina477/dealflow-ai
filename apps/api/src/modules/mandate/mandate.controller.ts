/**
 * MandateController — HTTP surface for the mandate spine.
 *
 * Endpoints:
 *   POST   /mandates        advisor, admin  (create)
 *   PATCH  /mandates/:id    advisor, admin  (configure)
 *   GET    /mandates        advisor, admin, analyst  (list)
 *   GET    /mandates/:id    advisor, admin, analyst  (detail)
 *
 * ── RBAC pattern (wave-5/7 exemplar) ───────────────────────────────────────
 * Each endpoint:
 *   @UseGuards(SessionGuard, RolesGuard) — authentication + DB-authoritative role
 *   @Roles(...ROLE_CONSTANT) — fail-closed on config drift
 *
 * Two role constants derived from the shared roleRoutes matrix:
 *   MANDATES_READ_ROLES  = rolesForRoute('/mandates')     → advisor, admin, analyst
 *   MANDATES_WRITE_ROLES = rolesForRoute('/mandates/new') → advisor, admin
 *
 * Fail-closed boot assertions: each role set is resolved and asserted non-empty
 * at module-eval time. An empty set (caused by route rename/removal in rbac.ts)
 * throws at boot — loud, unmissable, before any request is served.
 * The RolesGuard also denies a present-but-empty @Roles() at request time.
 *
 * ── Actor identity ──────────────────────────────────────────────────────────
 * For write endpoints (create, configure), the SuperTokens user id is extracted
 * from the verified session and passed to MandateService, which translates it
 * to app users.id via AuthRepository.getUserWithRole (wave-5 lesson).
 * The raw SuperTokens id NEVER touches a users.id FK column.
 *
 * ── Request validation ──────────────────────────────────────────────────────
 * Body and query params are validated against the shared Zod schemas.
 * ZodError → 400 BadRequestException with issue messages joined by '; '.
 */

import type {
  MandateConfigureInput,
  MandateCreateInput,
  MandateListFilter,
  Role,
} from '@dealflow/shared';
import {
  mandateConfigureSchema,
  mandateCreateSchema,
  mandateListFilterSchema,
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
import { MandateService } from './mandate.service';

// ---------------------------------------------------------------------------
// Fail-closed boot assertions — resolved from the single source of truth.
// If any pattern is renamed/removed in rbac.ts, the app crashes at boot.
// ---------------------------------------------------------------------------

/**
 * MANDATES_READ_ROLES — roles permitted to list/detail mandates (GET).
 * Sourced from '/mandates' in the shared roleRoutes matrix: advisor, admin, analyst.
 */
const MANDATES_READ_ROLES: Role[] = [...rolesForRoute('/mandates')];
if (MANDATES_READ_ROLES.length === 0) {
  throw new Error(
    "RBAC config drift: rolesForRoute('/mandates') resolved to [] — " +
      'the route pattern is missing from the shared roleRoutes matrix. Refusing to boot.'
  );
}

/**
 * MANDATES_WRITE_ROLES — roles permitted to create/configure mandates (POST, PATCH).
 * Sourced from '/mandates/new' in the shared roleRoutes matrix: advisor, admin.
 * Analyst is read-only for mandates; write access requires advisor or admin.
 */
const MANDATES_WRITE_ROLES: Role[] = [...rolesForRoute('/mandates/new')];
if (MANDATES_WRITE_ROLES.length === 0) {
  throw new Error(
    "RBAC config drift: rolesForRoute('/mandates/new') resolved to [] — " +
      'the route pattern is missing from the shared roleRoutes matrix. Refusing to boot.'
  );
}

@Controller('mandates')
export class MandateController {
  constructor(private readonly mandateService: MandateService) {}

  // ---------------------------------------------------------------------------
  // POST /mandates  (create)
  // ---------------------------------------------------------------------------

  /**
   * createMandate — creates a new mandate (3-table atomic insert + audit).
   *
   * Body: MandateCreateInput — seller fields + buyer criteria + compliance.
   *   compliance.jurisdiction is used to DERIVE the disclaimer template (D2).
   *   All 3 acknowledgments must be true (D5).
   *   NO disclaimerTemplateId in the body — derived server-side.
   *
   * Returns 201 Created with the created Mandate row.
   * Auth: advisor, admin.
   */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  @UseGuards(SessionGuard, RolesGuard)
  @Roles(...MANDATES_WRITE_ROLES)
  async createMandate(@Body() body: unknown, @Req() req: RequestWithSession) {
    const result = mandateCreateSchema.safeParse(body);
    if (!result.success) {
      throw new BadRequestException(
        (result.error as ZodError).issues.map((i) => i.message).join('; ')
      );
    }
    const input: MandateCreateInput = result.data;

    const session = req.session;
    if (!session) {
      throw new Error('MandateController: session not present after SessionGuard');
    }
    const supertokensUserId = session.getUserId();

    return this.mandateService.createAsActor(input, supertokensUserId);
  }

  // ---------------------------------------------------------------------------
  // PATCH /mandates/:id  (configure)
  // ---------------------------------------------------------------------------

  /**
   * configureMandate — partially updates a mandate (draft reconfiguration or
   * draft → active transition).
   *
   * Body: MandateConfigureInput — partial mandate fields + optional buyer criteria.
   * Returns 200 with the updated Mandate row.
   * Auth: advisor, admin.
   */
  @Patch(':id')
  @UseGuards(SessionGuard, RolesGuard)
  @Roles(...MANDATES_WRITE_ROLES)
  async configureMandate(
    @Param('id') id: string,
    @Body() body: unknown,
    @Req() req: RequestWithSession
  ) {
    const result = mandateConfigureSchema.safeParse(body);
    if (!result.success) {
      throw new BadRequestException(
        (result.error as ZodError).issues.map((i) => i.message).join('; ')
      );
    }
    const input: MandateConfigureInput = result.data;

    const session = req.session;
    if (!session) {
      throw new Error('MandateController: session not present after SessionGuard');
    }
    const supertokensUserId = session.getUserId();

    return this.mandateService.configureAsActor(id, input, supertokensUserId);
  }

  // ---------------------------------------------------------------------------
  // GET /mandates  (list)
  // ---------------------------------------------------------------------------

  /**
   * listMandates — returns mandates filtered by status.
   *
   * Query params (all optional):
   *   status — 'draft' | 'active' | 'all' (default: 'all')
   *
   * Auth: advisor, admin, analyst.
   */
  @Get()
  @UseGuards(SessionGuard, RolesGuard)
  @Roles(...MANDATES_READ_ROLES)
  async listMandates(@Query() query: Record<string, string>) {
    const result = mandateListFilterSchema.safeParse(query);
    if (!result.success) {
      throw new BadRequestException(
        (result.error as ZodError).issues.map((i) => i.message).join('; ')
      );
    }
    const filter: MandateListFilter = result.data;
    return this.mandateService.list(filter);
  }

  // ---------------------------------------------------------------------------
  // GET /mandates/:id  (detail)
  // ---------------------------------------------------------------------------

  /**
   * getMandateDetail — returns a MandateDetail (mandate + buyer criteria + compliance profile).
   *
   * Throws 404 if the mandate is not found.
   * Auth: advisor, admin, analyst.
   */
  @Get(':id')
  @UseGuards(SessionGuard, RolesGuard)
  @Roles(...MANDATES_READ_ROLES)
  async getMandateDetail(@Param('id') id: string) {
    return this.mandateService.getById(id);
  }
}

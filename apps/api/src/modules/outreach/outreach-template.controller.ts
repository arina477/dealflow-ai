/**
 * OutreachTemplateController — HTTP surface for outreach template management.
 *
 * Endpoints:
 *   POST   /outreach-templates             advisor, analyst  (create template + v1)
 *   GET    /outreach-templates             advisor, analyst, compliance  (list)
 *   GET    /outreach-templates/pending     compliance  (pending approval queue)
 *   GET    /outreach-templates/:id         advisor, analyst, compliance  (detail + versions)
 *   POST   /outreach-templates/:id/versions
 *                                          advisor, analyst  (draft new version)
 *   POST   /outreach-templates/:id/versions/:vid/request-approval
 *                                          advisor, analyst  (request approval)
 *   POST   /outreach-templates/:id/versions/:vid/approve
 *                                          compliance ONLY  (grant approval — SoD)
 *   POST   /outreach-templates/:id/versions/:vid/reject
 *                                          compliance ONLY  (reject — SoD)
 *
 * ── RBAC pattern (wave-5/8 exemplar) ────────────────────────────────────────
 * Role constants derived from the shared roleRoutes matrix. Fail-closed boot
 * assertions: an empty set throws at boot (not at request time).
 * nav⊆RBAC invariant holds for all routes.
 *
 * ── ROUTE-ORDERING (wave-9 lesson) ──────────────────────────────────────────
 * Static sub-paths (GET /outreach-templates/pending) MUST be declared BEFORE
 * parameterized /:id handlers to prevent NestJS from matching 'pending' as :id.
 * Similarly, /:id/versions/:vid/approve MUST be before /:id handlers.
 *
 * ── Actor identity ───────────────────────────────────────────────────────────
 * Write endpoints extract the SuperTokens user id from the verified session and
 * pass it to the service layer for resolution to app users.id.
 */

import type { Role, TemplateCreateInput, VersionDraftInput } from '@dealflow/shared';
import {
  approvalRejectInputSchema,
  rolesForRoute,
  templateCreateInputSchema,
  versionDraftInputSchema,
} from '@dealflow/shared';
import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { ZodError } from 'zod';
import { Roles, RolesGuard } from '../auth/guards/roles.guard';
import type { RequestWithSession } from '../auth/guards/session.guard';
import { SessionGuard } from '../auth/guards/session.guard';
// biome-ignore lint/style/useImportType: NestJS DI needs the runtime value (emitDecoratorMetadata)
import { ApprovalService } from './approval.service';
// biome-ignore lint/style/useImportType: NestJS DI needs the runtime value (emitDecoratorMetadata)
import { TemplateService } from './template.service';

// ---------------------------------------------------------------------------
// Fail-closed boot assertions — resolved from the single source of truth.
// ---------------------------------------------------------------------------

/**
 * OUTREACH_TEMPLATES_READ_ROLES — advisor, analyst, compliance.
 * Sourced from '/outreach-templates' in roleRoutes.
 */
const OUTREACH_TEMPLATES_READ_ROLES: Role[] = [...rolesForRoute('/outreach-templates')];
if (OUTREACH_TEMPLATES_READ_ROLES.length === 0) {
  throw new Error(
    "RBAC config drift: rolesForRoute('/outreach-templates') resolved to [] — " +
      'route pattern missing from shared roleRoutes matrix. Refusing to boot.'
  );
}

/**
 * OUTREACH_TEMPLATES_WRITE_ROLES — advisor, analyst.
 * Sourced from '/outreach-templates/new' in roleRoutes.
 */
const OUTREACH_TEMPLATES_WRITE_ROLES: Role[] = [...rolesForRoute('/outreach-templates/new')];
if (OUTREACH_TEMPLATES_WRITE_ROLES.length === 0) {
  throw new Error(
    "RBAC config drift: rolesForRoute('/outreach-templates/new') resolved to [] — " +
      'route pattern missing from shared roleRoutes matrix. Refusing to boot.'
  );
}

/**
 * OUTREACH_TEMPLATES_APPROVE_ROLES — compliance ONLY.
 * Sourced from '/outreach-templates/:id/versions/:vid/approve' in roleRoutes.
 * SoD: advisor is explicitly excluded from this set.
 */
const OUTREACH_TEMPLATES_APPROVE_ROLES: Role[] = [
  ...rolesForRoute('/outreach-templates/:id/versions/:vid/approve'),
];
if (OUTREACH_TEMPLATES_APPROVE_ROLES.length === 0) {
  throw new Error(
    "RBAC config drift: rolesForRoute('/outreach-templates/:id/versions/:vid/approve') resolved to [] — " +
      'route pattern missing from shared roleRoutes matrix. Refusing to boot.'
  );
}

@Controller('outreach-templates')
export class OutreachTemplateController {
  constructor(
    private readonly templateService: TemplateService,
    private readonly approvalService: ApprovalService
  ) {}

  // ---------------------------------------------------------------------------
  // POST /outreach-templates  (create template + v1)
  // ---------------------------------------------------------------------------

  /**
   * createTemplate — creates an outreach template + version 1 (atomic).
   *
   * Body: TemplateCreateInput — name, mandateScope?, subject, body, disclaimerTemplateId.
   * Returns 201 with the created template + version 1.
   * Auth: advisor, analyst.
   */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  @UseGuards(SessionGuard, RolesGuard)
  @Roles(...OUTREACH_TEMPLATES_WRITE_ROLES)
  async createTemplate(@Body() body: unknown, @Req() req: RequestWithSession) {
    const result = templateCreateInputSchema.safeParse(body);
    if (!result.success) {
      throw new BadRequestException(
        (result.error as ZodError).issues.map((i) => i.message).join('; ')
      );
    }
    const input: TemplateCreateInput = result.data;

    const session = req.session;
    if (!session) {
      throw new Error('OutreachTemplateController: session not present after SessionGuard');
    }

    return this.templateService.create(input, session.getUserId());
  }

  // ---------------------------------------------------------------------------
  // GET /outreach-templates  (list)
  //
  // ROUTE-ORDERING: must be declared BEFORE @Get(':id') and @Get('pending').
  // ---------------------------------------------------------------------------

  /**
   * listTemplates — returns all outreach templates.
   * Auth: advisor, analyst, compliance.
   */
  @Get()
  @UseGuards(SessionGuard, RolesGuard)
  @Roles(...OUTREACH_TEMPLATES_READ_ROLES)
  async listTemplates() {
    return this.templateService.listTemplates();
  }

  // ---------------------------------------------------------------------------
  // GET /outreach-templates/pending  (compliance queue)
  //
  // ROUTE-ORDERING CRITICAL: declared BEFORE @Get(':id') so NestJS matches
  // the literal 'pending' here and does NOT capture it as :id.
  // ---------------------------------------------------------------------------

  /**
   * listPendingVersions — returns all versions with approvalStatus='pending'.
   * Used by the compliance queue view.
   * Auth: compliance (OUTREACH_TEMPLATES_APPROVE_ROLES).
   */
  @Get('pending')
  @UseGuards(SessionGuard, RolesGuard)
  @Roles(...OUTREACH_TEMPLATES_APPROVE_ROLES)
  async listPendingVersions() {
    return this.templateService.getPendingVersions();
  }

  // ---------------------------------------------------------------------------
  // GET /outreach-templates/:id  (detail + versions)
  // ---------------------------------------------------------------------------

  /**
   * getTemplateDetail — returns template + all versions.
   * Throws 404 if not found.
   * Auth: advisor, analyst, compliance.
   */
  @Get(':id')
  @UseGuards(SessionGuard, RolesGuard)
  @Roles(...OUTREACH_TEMPLATES_READ_ROLES)
  async getTemplateDetail(@Param('id') id: string) {
    return this.templateService.getTemplateById(id);
  }

  // ---------------------------------------------------------------------------
  // POST /outreach-templates/:id/versions  (draft new version)
  // ---------------------------------------------------------------------------

  /**
   * draftNewVersion — creates a new version row for a template.
   * ALWAYS creates a new row — never mutates an approved version.
   * The new version starts with approvalStatus='pending', isUsableForSend=false.
   *
   * Body: VersionDraftInput — subject, body, disclaimerTemplateId.
   * Returns 201 with the new version row.
   * Auth: advisor, analyst.
   */
  @Post(':id/versions')
  @HttpCode(HttpStatus.CREATED)
  @UseGuards(SessionGuard, RolesGuard)
  @Roles(...OUTREACH_TEMPLATES_WRITE_ROLES)
  async draftNewVersion(
    @Param('id') id: string,
    @Body() body: unknown,
    @Req() req: RequestWithSession
  ) {
    const result = versionDraftInputSchema.safeParse(body);
    if (!result.success) {
      throw new BadRequestException(
        (result.error as ZodError).issues.map((i) => i.message).join('; ')
      );
    }
    const input: VersionDraftInput = result.data;

    const session = req.session;
    if (!session) {
      throw new Error('OutreachTemplateController: session not present after SessionGuard');
    }

    return this.templateService.draftNewVersion(id, input, session.getUserId());
  }

  // ---------------------------------------------------------------------------
  // POST /outreach-templates/:id/versions/:vid/request-approval
  //
  // ROUTE-ORDERING: declared before @Get(':id') — the static sub-path
  // 'versions' prevents confusion with the :id param handler.
  // ---------------------------------------------------------------------------

  /**
   * requestApproval — validates the required disclaimer block + audits the request.
   * Returns 400 if the version's disclaimerTemplateId is invalid.
   *
   * Auth: advisor, analyst.
   */
  @Post(':id/versions/:vid/request-approval')
  @UseGuards(SessionGuard, RolesGuard)
  @Roles(...OUTREACH_TEMPLATES_WRITE_ROLES)
  async requestApproval(@Param('vid') vid: string, @Req() req: RequestWithSession) {
    const session = req.session;
    if (!session) {
      throw new Error('OutreachTemplateController: session not present after SessionGuard');
    }

    return this.templateService.requestApproval(vid, session.getUserId());
  }

  // ---------------------------------------------------------------------------
  // POST /outreach-templates/:id/versions/:vid/approve  (compliance only — SoD)
  //
  // ROUTE-ORDERING: declared before @Get(':id') to ensure the static segment
  // 'versions/:vid/approve' is matched over the :id wildcard.
  // ---------------------------------------------------------------------------

  /**
   * approveVersion — compliance grants approval to a template version.
   * Sets approvedContentHash = contentHash + approvedBy = actor.id.
   * After approval, isUsableForSend returns true for this version.
   *
   * Auth: compliance ONLY (SoD — advisor 403).
   */
  @Post(':id/versions/:vid/approve')
  @UseGuards(SessionGuard, RolesGuard)
  @Roles(...OUTREACH_TEMPLATES_APPROVE_ROLES)
  async approveVersion(@Param('vid') vid: string, @Req() req: RequestWithSession) {
    const session = req.session;
    if (!session) {
      throw new Error('OutreachTemplateController: session not present after SessionGuard');
    }

    return this.approvalService.grantApproval(vid, session.getUserId());
  }

  // ---------------------------------------------------------------------------
  // POST /outreach-templates/:id/versions/:vid/reject  (compliance only — SoD)
  // ---------------------------------------------------------------------------

  /**
   * rejectVersion — compliance rejects a template version.
   * Sets approvalStatus = 'rejected'. Requires a reason in the body.
   *
   * Auth: compliance ONLY (SoD).
   */
  @Post(':id/versions/:vid/reject')
  @UseGuards(SessionGuard, RolesGuard)
  @Roles(...OUTREACH_TEMPLATES_APPROVE_ROLES)
  async rejectVersion(
    @Param('vid') vid: string,
    @Body() body: unknown,
    @Req() req: RequestWithSession
  ) {
    const result = approvalRejectInputSchema.safeParse(body);
    if (!result.success) {
      throw new BadRequestException(
        (result.error as ZodError).issues.map((i) => i.message).join('; ')
      );
    }

    const session = req.session;
    if (!session) {
      throw new Error('OutreachTemplateController: session not present after SessionGuard');
    }

    return this.approvalService.reject(vid, result.data.reason, session.getUserId());
  }
}

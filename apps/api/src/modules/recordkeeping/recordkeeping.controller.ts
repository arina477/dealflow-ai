/**
 * RecordkeepingController — HTTP surface for the M6 audit-log
 * read + verify + export (FINRA/SOX recordkeeping).
 *
 * Endpoints:
 *   GET  /compliance/audit-log            compliance, admin, advisor (own-outreach)
 *   GET  /compliance/audit-log/verify     compliance, admin
 *   POST /compliance/audit-log/export     compliance, admin ONLY (advisor 403)
 *
 * ── RBAC pattern (wave-5/8/11/12 exemplar) ───────────────────────────────────
 * Role constants derived from the shared roleRoutes single source of truth.
 * Fail-closed boot assertions — if a route pattern drifts from rbac.ts, boot
 * crashes loudly rather than silently opening the endpoint.
 *
 * ── ROUTE-ORDERING (wave-9 lesson) ───────────────────────────────────────────
 * Static sub-routes (audit-log/verify, audit-log/export) declared BEFORE the
 * bare audit-log route to avoid NestJS shadowing :param routes. All routes are
 * under @Controller('compliance') so /compliance prefix is set once.
 *
 * ── VERIFY ROUTE NOTE ────────────────────────────────────────────────────────
 * GET /compliance/audit-log/verify is also handled by the existing
 * AuditLogController in ComplianceModule (wave-4). Since ComplianceModule is
 * registered before RecordkeepingModule in AppModule, the AuditLogController
 * handler takes priority in production. This handler is here for test coverage
 * and future migration; the behavior is identical (both delegate to
 * AuditVerifier.verifyChain()). Tests exercise this handler directly via the
 * class prototype — not through the NestJS HTTP layer.
 *
 * ── READ-PASSTHROUGH ─────────────────────────────────────────────────────────
 * The read endpoint passes the filter query params directly to the service
 * without re-validating field semantics in the controller. Invalid filter values
 * (bad UUID, bad date) are handled by the service/repository (400 from Zod parse
 * or query error).
 *
 * ── HARD BOUNDARY ────────────────────────────────────────────────────────────
 * NO email send, NO Anthropic/LLM import, NO new external SDK.
 */

import type { AuditVerifyResponse, ExportScope, Role } from '@dealflow/shared';
import { exportScopeSchema, rolesForRoute } from '@dealflow/shared';
import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Header,
  HttpCode,
  HttpStatus,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { ZodError } from 'zod';
import { Roles, RolesGuard } from '../auth/guards/roles.guard';
import type { RequestWithSession } from '../auth/guards/session.guard';
import { SessionGuard } from '../auth/guards/session.guard';
import type { ExportPackage } from './recordkeeping.service';
// biome-ignore lint/style/useImportType: NestJS DI needs the runtime value
import { RecordkeepingService } from './recordkeeping.service';

// ---------------------------------------------------------------------------
// Fail-closed boot assertions — guard against RBAC config drift
// ---------------------------------------------------------------------------

/**
 * READ_ROLES — compliance + admin + advisor.
 * Sourced from '/compliance/audit-log' in the shared roleRoutes.
 * Advisor gets org-scoped access to the route; the service applies own-outreach
 * role-scoping server-side.
 */
const READ_ROLES: Role[] = [...rolesForRoute('/compliance/audit-log')];
if (READ_ROLES.length === 0) {
  throw new Error(
    "RBAC config drift: rolesForRoute('/compliance/audit-log') resolved to [] — " +
      'route pattern missing from shared roleRoutes matrix. Refusing to boot.'
  );
}

/**
 * VERIFY_ROLES — compliance + admin.
 * Sourced from '/compliance/audit-log/verify' in the shared roleRoutes.
 */
const VERIFY_ROLES: Role[] = [...rolesForRoute('/compliance/audit-log/verify')];
if (VERIFY_ROLES.length === 0) {
  throw new Error(
    "RBAC config drift: rolesForRoute('/compliance/audit-log/verify') resolved to [] — " +
      'route pattern missing from shared roleRoutes matrix. Refusing to boot.'
  );
}

/**
 * EXPORT_ROLES — compliance + admin ONLY (advisor excluded = 403).
 * Sourced from '/compliance/audit-log/export' in the shared roleRoutes.
 */
const EXPORT_ROLES: Role[] = [...rolesForRoute('/compliance/audit-log/export')];
if (EXPORT_ROLES.length === 0) {
  throw new Error(
    "RBAC config drift: rolesForRoute('/compliance/audit-log/export') resolved to [] — " +
      'route pattern missing from shared roleRoutes matrix. Refusing to boot.'
  );
}

// ---------------------------------------------------------------------------
// Controller
// ---------------------------------------------------------------------------

@Controller('compliance')
export class RecordkeepingController {
  constructor(private readonly recordkeepingService: RecordkeepingService) {}

  // ---------------------------------------------------------------------------
  // GET /compliance/audit-log/verify  (static sub-route — BEFORE bare audit-log)
  //
  // ROUTE-ORDERING: declared FIRST (static-before-dynamic wave-9 lesson).
  // ---------------------------------------------------------------------------

  /**
   * verify — run the full-chain integrity check.
   *
   * Delegates to the EXISTING AuditVerifier.verifyChain() via
   * RecordkeepingService.verifyChainAsActor. Returns the real shape:
   *   {ok: true,  entriesChecked: N}                      — chain intact
   *   {ok: false, entriesChecked: N, firstBreakAt, reason} — break detected
   *   {ok: true,  entriesChecked: 0}                      — empty log (vacuously intact)
   *
   * Auth: compliance, admin.
   * READ-ONLY: NO audit row emitted.
   */
  @Get('audit-log/verify')
  @UseGuards(SessionGuard, RolesGuard)
  @Roles(...VERIFY_ROLES)
  async verify(@Req() req: RequestWithSession): Promise<AuditVerifyResponse> {
    const session = req.session;
    if (!session) {
      throw new Error('RecordkeepingController: session not present after SessionGuard');
    }
    return this.recordkeepingService.verifyChainAsActor(session.getUserId());
  }

  // ---------------------------------------------------------------------------
  // POST /compliance/audit-log/export  (static sub-route — BEFORE bare audit-log)
  // ---------------------------------------------------------------------------

  /**
   * export — assemble and download a deterministic recordkeeping export package.
   *
   * Body: ExportScope { mandateId?, from?, to? } (.strict — unknown keys → 400).
   * Returns 200 with JSON attachment containing:
   *   { manifest, verifyResult, entries } (deterministic for same scope).
   *
   * Appends EXACTLY ONE 'export_generated' audit row LAST-IN-TXN.
   * Rollback-on-audit-fail: no package without its audit row.
   *
   * Auth: compliance, admin ONLY (advisor → 403 from RolesGuard).
   */
  @Post('audit-log/export')
  @HttpCode(HttpStatus.OK)
  @UseGuards(SessionGuard, RolesGuard)
  @Roles(...EXPORT_ROLES)
  @Header('Content-Disposition', 'attachment; filename="audit-log-export.json"')
  async export(@Body() body: unknown, @Req() req: RequestWithSession): Promise<ExportPackage> {
    const result = exportScopeSchema.safeParse(body);
    if (!result.success) {
      throw new BadRequestException(
        (result.error as ZodError).issues.map((i) => i.message).join('; ')
      );
    }
    const scope: ExportScope = result.data;

    const session = req.session;
    if (!session) {
      throw new Error('RecordkeepingController: session not present after SessionGuard');
    }

    return this.recordkeepingService.exportAsActor(scope, session.getUserId());
  }

  // ---------------------------------------------------------------------------
  // GET /compliance/audit-log  (bare read — AFTER static sub-routes)
  //
  // ROUTE-ORDERING: declared LAST (after static sub-routes — wave-9 lesson).
  // ---------------------------------------------------------------------------

  /**
   * list — filtered, paginated read over the audit log.
   *
   * Query params (all optional):
   *   mandateId — scope to a specific mandate (triggers per-resource_type derivation)
   *   type      — filter by action string
   *   actor     — filter by actorUserId (UUID)
   *   from      — ISO datetime lower bound
   *   to        — ISO datetime upper bound
   *   limit     — page size (max 200, default 50)
   *   offset    — page offset (default 0)
   *
   * Role-scoped:
   *   compliance/admin → org-wide.
   *   advisor          → own-outreach entries only (service-enforced).
   *
   * Auth: compliance, admin, advisor.
   * READ-ONLY: NO audit row emitted on this path.
   */
  @Get('audit-log')
  @UseGuards(SessionGuard, RolesGuard)
  @Roles(...READ_ROLES)
  async list(@Query() query: Record<string, string>, @Req() req: RequestWithSession) {
    const session = req.session;
    if (!session) {
      throw new Error('RecordkeepingController: session not present after SessionGuard');
    }

    // exactOptionalPropertyTypes: true — conditionally include fields to avoid
    // assigning `undefined` to optional properties (which is disallowed).
    const filter: import('./recordkeeping.repository').RecordkeepingFilter = {
      ...(query.mandateId !== undefined && { mandateId: query.mandateId }),
      ...(query.type !== undefined && { type: query.type }),
      ...(query.actor !== undefined && { actor: query.actor }),
      ...(query.from !== undefined && { from: query.from }),
      ...(query.to !== undefined && { to: query.to }),
      ...(query.limit !== undefined && { limit: Number(query.limit) }),
      ...(query.offset !== undefined && { offset: Number(query.offset) }),
    };

    return this.recordkeepingService.listAsActor(filter, session.getUserId());
  }
}

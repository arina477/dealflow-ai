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
 * ── READ VALIDATION ──────────────────────────────────────────────────────────
 * The list endpoint parses the filter query params through listFilterSchema
 * (imported from @dealflow/shared) before forwarding to the service. Invalid
 * values (non-UUID mandateId/actor, non-numeric limit, limit > 200) produce a
 * 400 BadRequestException before reaching the repository — mirroring the export
 * path's exportScopeSchema.safeParse pattern.
 *
 * ── SEC-2 ENFORCEMENT ────────────────────────────────────────────────────────
 * The export body is parsed through exportScopeSchema.strict() — any request
 * carrying workspace_id / firmId / tenant → 400 (unknown key rejected by .strict()).
 * Workspace is server-resolved from the session GUC (ALS) — never a client param.
 *
 * ── SEC-5 CSV RESPONSE ───────────────────────────────────────────────────────
 * When format='csv' the response Content-Type is text/csv and the pre-serialized
 * csvContent string is returned directly. When format='json' the original JSON
 * ExportPackage shape is returned.
 *
 * ── HARD BOUNDARY ────────────────────────────────────────────────────────────
 * NO email send, NO Anthropic/LLM import, NO new external SDK.
 */

import type {
  AuditVerifyResponse,
  DealActivityBrowseFilter,
  DealActivityBrowseResponse,
  ExportScope,
  Role,
} from '@dealflow/shared';
import {
  dealActivityBrowseFilterSchema,
  exportScopeSchema,
  listFilterSchema,
  rolesForRoute,
} from '@dealflow/shared';
import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Query,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';
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

/**
 * DEAL_ACTIVITY_ROLES — compliance + admin ONLY (wave-29 deal-activity browse).
 * Sourced from '/compliance/records/deal-activity' in the shared roleRoutes.
 * Mirrors EXPORT_ALLOWED_ROLES: advisor/analyst → 403 (enforced in service + guard).
 */
const DEAL_ACTIVITY_ROLES: Role[] = [...rolesForRoute('/compliance/records/deal-activity')];
if (DEAL_ACTIVITY_ROLES.length === 0) {
  throw new Error(
    "RBAC config drift: rolesForRoute('/compliance/records/deal-activity') resolved to [] — " +
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
   * export — assemble and download a deterministic, SEC-compliant recordkeeping
   * export package (wave-27 M10 extension).
   *
   * Body: ExportScope { mandateId?, from?, to?, format?, scope? }
   *   .strict() — unknown keys (workspace_id, firmId, tenant, etc.) → 400 (SEC-2).
   *
   * format='csv' (default): returns text/csv attachment (injection-safe, SEC-5).
   * format='json': returns JSON attachment { manifest, verifyResult, entries, dealEntries }.
   *
   * scope='audit': audit log entries only.
   * scope='deal': deal/pipeline activity only.
   * scope='both' (default): audit + deal.
   *
   * Bounded: default 12-month from-date if omitted; max EXPORT_ROW_CAP rows (SEC-4).
   * On cap-hit: manifest.truncated=true + rowsReturned + rowsAvailable (SEC-4).
   *
   * Appends EXACTLY ONE 'export_generated' audit row LAST-IN-TXN (SEC-9).
   * Rollback-on-audit-fail: no package without its audit row.
   *
   * Auth: compliance, admin ONLY (advisor → 403 from RolesGuard) (SEC-7).
   */
  @Post('audit-log/export')
  @HttpCode(HttpStatus.OK)
  @UseGuards(SessionGuard, RolesGuard)
  @Roles(...EXPORT_ROLES)
  async export(
    @Body() body: unknown,
    @Req() req: RequestWithSession,
    @Res() res: Response
  ): Promise<void> {
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

    const pkg: ExportPackage = await this.recordkeepingService.exportAsActor(
      scope,
      session.getUserId()
    );

    // SEC-4: Set the manifest on the HTTP response so the browser (via the
    // Next.js same-origin proxy) can read truncation metadata without parsing
    // the response body. Both CSV and JSON branches MUST set this header —
    // omitting it causes the frontend fallback to synthesise manifest.truncated=false,
    // silently presenting a capped export as complete (the exact compliance-
    // integrity failure SEC-4 exists to prevent).
    //
    // Access-Control-Expose-Headers is set so direct cross-origin API consumers
    // (e2e Supertest, external integrations) can also read the header. The
    // Next.js same-origin proxy does not require CORS, but exposing the header
    // here is a no-cost correctness invariant that keeps the HTTP contract clean.
    const manifestJson = JSON.stringify(pkg.manifest);
    res.setHeader('X-Export-Manifest', manifestJson);
    res.setHeader('Access-Control-Expose-Headers', 'X-Export-Manifest');

    if (pkg.format === 'csv') {
      // SEC-5: CSV response — injection-safe, RFC-4180 serialized.
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', 'attachment; filename="audit-log-export.csv"');
      res.status(HttpStatus.OK).send(pkg.csvContent ?? '');
    } else {
      // JSON response: return manifest + verifyResult + entries + dealEntries.
      // csvContent is not included in the JSON response (internal artifact).
      const { csvContent: _csv, format: _fmt, ...jsonPkg } = pkg;
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', 'attachment; filename="audit-log-export.json"');
      res.status(HttpStatus.OK).json(jsonPkg);
    }
  }

  // ---------------------------------------------------------------------------
  // GET /compliance/records/deal-activity  (wave-29 deal-activity browse)
  //
  // ROUTE-ORDERING: declared before the bare audit-log route (static-before-dynamic).
  // ---------------------------------------------------------------------------

  /**
   * dealActivityList — filtered, paginated READ-ONLY browse over deal/pipeline activity.
   *
   * Query params (all optional):
   *   mandateId  — scope to a specific mandate
   *   type       — filter by deal_source_type (e.g. 'match_candidate', 'outreach')
   *   from       — ISO datetime lower bound on pipeline.created_at
   *   to         — ISO datetime upper bound on pipeline.created_at
   *   limit      — page size (default 25, max 50; > 50 → 400)
   *   offset     — page offset (default 0)
   *
   * RBAC: compliance + admin ONLY (advisor/analyst → 403).
   *   Service enforces RBAC; guard fails-closed via DEAL_ACTIVITY_ROLES.
   *
   * READ-ONLY: NO audit row emitted on this path.
   *
   * Workspace-RLS-scoped: the repository uses getDb (FORCE RLS on pipeline +
   *   mandates) — workspace is server-resolved, never a client param.
   *
   * SEC-2: .strict() on dealActivityBrowseFilterSchema rejects unknown keys
   *   (workspace_id, firmId, tenant, etc.) → 400.
   */
  @Get('records/deal-activity')
  @UseGuards(SessionGuard, RolesGuard)
  @Roles(...DEAL_ACTIVITY_ROLES)
  async dealActivityList(
    @Query() query: Record<string, string>,
    @Req() req: RequestWithSession
  ): Promise<DealActivityBrowseResponse> {
    const session = req.session;
    if (!session) {
      throw new Error('RecordkeepingController: session not present after SessionGuard');
    }

    const parsed = dealActivityBrowseFilterSchema.safeParse(query);
    if (!parsed.success) {
      throw new BadRequestException(
        (parsed.error as ZodError).issues.map((i) => i.message).join('; ')
      );
    }

    const filter: DealActivityBrowseFilter = {
      ...(parsed.data.mandateId !== undefined && { mandateId: parsed.data.mandateId }),
      ...(parsed.data.type !== undefined && { type: parsed.data.type }),
      ...(parsed.data.from !== undefined && { from: parsed.data.from }),
      ...(parsed.data.to !== undefined && { to: parsed.data.to }),
      ...(parsed.data.limit !== undefined && { limit: parsed.data.limit }),
      ...(parsed.data.offset !== undefined && { offset: parsed.data.offset }),
    };

    return this.recordkeepingService.listDealActivityAsActor(filter, session.getUserId());
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

    // Parse and validate query params through listFilterSchema.
    // Rejects: non-UUID mandateId/actor → 400; limit > 200 → 400;
    // non-numeric limit → 400. Mirrors the export path's safeParse pattern.
    const parsed = listFilterSchema.safeParse(query);
    if (!parsed.success) {
      throw new BadRequestException(
        (parsed.error as ZodError).issues.map((i) => i.message).join('; ')
      );
    }

    // exactOptionalPropertyTypes: true — conditionally include fields to avoid
    // assigning `undefined` to optional properties (which is disallowed).
    const filter: import('./recordkeeping.repository').RecordkeepingFilter = {
      ...(parsed.data.mandateId !== undefined && { mandateId: parsed.data.mandateId }),
      ...(parsed.data.type !== undefined && { type: parsed.data.type }),
      ...(parsed.data.actor !== undefined && { actor: parsed.data.actor }),
      ...(parsed.data.from !== undefined && { from: parsed.data.from }),
      ...(parsed.data.to !== undefined && { to: parsed.data.to }),
      ...(parsed.data.limit !== undefined && { limit: parsed.data.limit }),
      ...(parsed.data.offset !== undefined && { offset: parsed.data.offset }),
    };

    return this.recordkeepingService.listAsActor(filter, session.getUserId());
  }
}

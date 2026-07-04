/**
 * SourcingController — HTTP surface for the deal-sourcing data spine.
 *
 * Endpoints:
 *   POST /sourcing/connections/:id/sync           analyst, admin
 *   GET  /sourcing/companies                      analyst
 *   GET  /sourcing/companies/:id                  analyst
 *   POST /sourcing/dedupe-candidates/:id/resolve  analyst, admin
 *
 * ── RBAC pattern (wave-5 exemplar) ──────────────────────────────────────────
 * Each endpoint:
 *   @UseGuards(SessionGuard, RolesGuard) — authentication + DB-authoritative role
 *   @Roles(...rolesForRoute('<pattern>')) — fail-closed on config drift
 *
 * Fail-closed boot assertion: each role set is resolved from the shared
 * roleRoutes matrix at module-eval time and asserted non-empty. An empty set
 * (caused by route rename/removal in rbac.ts) throws at boot — loud + unmissable.
 * The RolesGuard ALSO denies a present-but-empty @Roles() at request time
 * (two independent fail-closed layers; the wave-5 compliance.controller exemplar).
 *
 * ── Actor identity ──────────────────────────────────────────────────────────
 * For the resolve endpoint, the actor's SuperTokens user id is extracted from
 * the server-verified session and passed to SourcingService, which translates
 * it to app users.id via AuthRepository.getUserWithRole (wave-5 actor-id-FK lesson).
 * The raw SuperTokens id NEVER touches a users.id FK column.
 *
 * ── Request validation ──────────────────────────────────────────────────────
 * Query params and body are validated against the shared Zod schemas.
 * ZodError → 400 BadRequestException.
 */

import type { CompaniesListFilter, DedupeResolveInput, Role } from '@dealflow/shared';
import {
  companiesListFilterSchema,
  dedupeResolveInputSchema,
  rolesForRoute,
} from '@dealflow/shared';
import {
  BadRequestException,
  Body,
  Controller,
  Get,
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
// biome-ignore lint/style/useImportType: DI-injected, needs runtime metadata (emitDecoratorMetadata)
import { SourcingService } from './sourcing.service';

// ---------------------------------------------------------------------------
// Fail-closed boot assertions — resolved from the single source of truth.
// If any pattern is renamed/removed in rbac.ts, the app crashes at boot.
// ---------------------------------------------------------------------------

const SYNC_ROLES: Role[] = [...rolesForRoute('/sourcing/connections/:id/sync')];
if (SYNC_ROLES.length === 0) {
  throw new Error(
    "RBAC config drift: rolesForRoute('/sourcing/connections/:id/sync') resolved to [] — " +
      'the route pattern is missing from the shared roleRoutes matrix. Refusing to boot.'
  );
}

const COMPANIES_ROLES: Role[] = [...rolesForRoute('/sourcing/companies')];
if (COMPANIES_ROLES.length === 0) {
  throw new Error(
    "RBAC config drift: rolesForRoute('/sourcing/companies') resolved to [] — " +
      'the route pattern is missing from the shared roleRoutes matrix. Refusing to boot.'
  );
}

const COMPANIES_DETAIL_ROLES: Role[] = [...rolesForRoute('/sourcing/companies/:id')];
if (COMPANIES_DETAIL_ROLES.length === 0) {
  throw new Error(
    "RBAC config drift: rolesForRoute('/sourcing/companies/:id') resolved to [] — " +
      'the route pattern is missing from the shared roleRoutes matrix. Refusing to boot.'
  );
}

const RESOLVE_ROLES: Role[] = [...rolesForRoute('/sourcing/dedupe-candidates/:id/resolve')];
if (RESOLVE_ROLES.length === 0) {
  throw new Error(
    "RBAC config drift: rolesForRoute('/sourcing/dedupe-candidates/:id/resolve') resolved to [] — " +
      'the route pattern is missing from the shared roleRoutes matrix. Refusing to boot.'
  );
}

@Controller('sourcing')
export class SourcingController {
  constructor(private readonly sourcingService: SourcingService) {}

  // ---------------------------------------------------------------------------
  // POST /sourcing/connections/:id/sync
  // ---------------------------------------------------------------------------

  /**
   * syncConnection — on-demand ETL trigger for a single data_source_connection.
   *
   * Resolves the adapter, fetches + normalizes companies, upserts staging
   * (idempotent), then runs the dedupe promotion pass. Returns SyncSummary.
   *
   * Idempotent: re-triggering the sync for the same connection is safe.
   * Auth: analyst, admin.
   */
  @Post('connections/:id/sync')
  @UseGuards(SessionGuard, RolesGuard)
  @Roles(...SYNC_ROLES)
  async syncConnection(@Param('id') id: string) {
    return this.sourcingService.syncConnection(id);
  }

  // ---------------------------------------------------------------------------
  // GET /sourcing/companies
  // ---------------------------------------------------------------------------

  /**
   * listCompanies — paginated canonical companies list with filters.
   *
   * Query params (all optional):
   *   q      — free-text filter on name/domain
   *   source — filter to companies from a specific connection_id
   *   status — 'active' | 'archived' (default: 'active')
   *
   * Auth: analyst.
   */
  @Get('companies')
  @UseGuards(SessionGuard, RolesGuard)
  @Roles(...COMPANIES_ROLES)
  async listCompanies(@Query() query: Record<string, string>) {
    const filterResult = companiesListFilterSchema.safeParse(query);
    if (!filterResult.success) {
      throw new BadRequestException(
        (filterResult.error as ZodError).issues.map((i) => i.message).join('; ')
      );
    }
    const filter: CompaniesListFilter = filterResult.data;
    return this.sourcingService.listCompanies(filter);
  }

  // ---------------------------------------------------------------------------
  // GET /sourcing/companies/:id
  // ---------------------------------------------------------------------------

  /**
   * getCompanyDetail — canonical company detail with contacts, provenance,
   * and any pending dedupe candidates targeting it.
   *
   * Auth: analyst.
   */
  @Get('companies/:id')
  @UseGuards(SessionGuard, RolesGuard)
  @Roles(...COMPANIES_DETAIL_ROLES)
  async getCompanyDetail(@Param('id') id: string) {
    return this.sourcingService.getCompanyDetail(id);
  }

  // ---------------------------------------------------------------------------
  // POST /sourcing/dedupe-candidates/:id/resolve
  // ---------------------------------------------------------------------------

  /**
   * resolveDedupeCandidate — human resolution of a pending dedupe candidate.
   *
   * Body: { action: 'merge' | 'reject' }
   *   merge  → promote raw into matched_company_id + write provenance +
   *             mark candidate merged — all in one transaction with audit entry.
   *   reject → mark candidate rejected (keep-separate; no canonical write).
   *
   * AUDITED via AuditService.append(action='sourcing-dedupe-resolve', tx) in the
   * same transaction as the status update + optional merge write.
   *
   * Actor: SuperTokens session userId → app users.id via getUserWithRole.
   * NEVER passes raw SuperTokens id to a users.id FK (wave-5 actor-id-FK lesson).
   *
   * Auth: analyst, admin.
   */
  @Post('dedupe-candidates/:id/resolve')
  @UseGuards(SessionGuard, RolesGuard)
  @Roles(...RESOLVE_ROLES)
  async resolveDedupeCandidate(
    @Param('id') id: string,
    @Body() body: unknown,
    @Req() req: RequestWithSession
  ) {
    const bodyResult = dedupeResolveInputSchema.safeParse(body);
    if (!bodyResult.success) {
      throw new BadRequestException(
        (bodyResult.error as ZodError).issues.map((i) => i.message).join('; ')
      );
    }
    const input: DedupeResolveInput = bodyResult.data;

    // Extract the SuperTokens user id from the server-verified session.
    // The service translates this to app users.id via getUserWithRole.
    const session = req.session;
    if (!session) {
      // SessionGuard should have caught this; defensive check.
      throw new Error('SourcingController: session not present after SessionGuard');
    }
    const supertokensUserId = session.getUserId();

    return this.sourcingService.resolveDedupeCandidateAsActor(id, input, supertokensUserId);
  }
}

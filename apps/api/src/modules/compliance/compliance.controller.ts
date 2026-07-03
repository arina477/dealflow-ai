/**
 * ComplianceController (wave-3, task 2ecc4a7b) — the ENFORCED-RBAC exemplar.
 *
 * GET /compliance/summary is the first route this product applies per-route
 * RBAC to. It exists to make the wave-2 RolesGuard PRIMITIVE (previously
 * applied to zero routes) a LIVE, tested enforcement surface — the M6
 * separation-of-duties wedge hard-depends on enforced RBAC.
 *
 * ── Allowlist safety (load-bearing) ────────────────────────────────────────
 * Enforcement is OPT-IN by decoration. RolesGuard no-ops on any route without
 * @Roles() metadata (`if (!required || required.length === 0) return true;`).
 * There is NO global RBAC guard: /auth/*, /health, and every other undecorated
 * route stay ungated — the live wave-2 login is NOT gated by this change.
 * Only THIS handler carries @Roles(), so only THIS route changes behaviour.
 *
 * ── Single source of truth ─────────────────────────────────────────────────
 * The required-role set is NOT hardcoded: it is read from the shared
 * `roleRoutes` matrix via `rolesForRoute('/compliance/summary')`. Nav
 * visibility (B-3) derives from the SAME map, so nav and enforcement cannot
 * drift (spec block-3 invariant). Per the pinned P-4 matrix this resolves to
 * ['compliance', 'admin'].
 *
 * ── Role source ────────────────────────────────────────────────────────────
 * RolesGuard reads the role from the SERVER-VERIFIED session claim
 * (getAccessTokenPayload().role via SuperTokens getSession) — never a client
 * header/body. Guard order is SessionGuard (401 anon) THEN RolesGuard (403 on
 * role deny) so a valid-session-wrong-role gets 403, an anon request 401.
 *
 * ── Deny envelope ──────────────────────────────────────────────────────────
 * Deny → NestJS ForbiddenException default body
 * ({statusCode:403, message:'Forbidden', error:'Forbidden'}) — carries NO
 * requested-resource data and NO role information.
 */

import type { ComplianceSummaryResponse, Role } from '@dealflow/shared';
import { rolesForRoute } from '@dealflow/shared';
import { Controller, Get, UseGuards } from '@nestjs/common';

import { Roles, RolesGuard } from '../auth/guards/roles.guard';
import { SessionGuard } from '../auth/guards/session.guard';
// biome-ignore lint/style/useImportType: value import required for emitDecoratorMetadata DI resolution
import { ComplianceService } from './compliance.service';

/**
 * Required roles for /compliance/summary, resolved from the SINGLE source of
 * truth (shared roleRoutes) at module-eval time — not duplicated/hardcoded.
 *
 * FAIL-CLOSED at boot (B-6 CRITICAL-2 defence in depth): if the route pattern
 * is ever renamed/removed in rbac.ts, rolesForRoute returns [] and the spread
 * would yield an EMPTY @Roles() — which, absent this guard, could no-op the
 * RolesGuard and open the route to every authenticated user. We assert the
 * resolved set is non-empty at module load so config drift crashes the app at
 * boot (loud, unmissable) rather than silently fail-opening at request time.
 * The RolesGuard ALSO denies a present-but-empty @Roles() at request time —
 * two independent fail-closed layers.
 */
const COMPLIANCE_SUMMARY_ROLES: Role[] = [...rolesForRoute('/compliance/summary')];

if (COMPLIANCE_SUMMARY_ROLES.length === 0) {
  throw new Error(
    "RBAC config drift: rolesForRoute('/compliance/summary') resolved to [] — " +
      'the route pattern is missing from the shared roleRoutes matrix. Refusing to ' +
      'boot rather than expose GET /compliance/summary to every authenticated user.'
  );
}

@Controller('compliance')
export class ComplianceController {
  constructor(private readonly complianceService: ComplianceService) {}

  @Get('summary')
  @UseGuards(SessionGuard, RolesGuard)
  @Roles(...COMPLIANCE_SUMMARY_ROLES)
  getSummary(): ComplianceSummaryResponse {
    return this.complianceService.getSummary();
  }
}

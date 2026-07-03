/**
 * AuditLogController (wave-4, task e6a4cbfe) — the RBAC-guarded chain-verify
 * endpoint. Mirrors the ComplianceController enforced-RBAC exemplar exactly.
 *
 * GET /compliance/audit-log/verify
 *   @UseGuards(SessionGuard, RolesGuard)   — SessionGuard 401 anon → RolesGuard 403 wrong role
 *   @Roles(...rolesForRoute('/compliance/audit-log/verify'))  → ['compliance','admin']
 *
 * ── Single source of truth ─────────────────────────────────────────────────
 * The required-role set is NOT hardcoded: it is read from the shared roleRoutes
 * matrix via rolesForRoute('/compliance/audit-log/verify'). Same pattern as the
 * /compliance/summary exemplar; nav visibility (B-3) derives from the SAME map.
 *
 * ── FAIL-CLOSED at boot ────────────────────────────────────────────────────
 * If the route pattern is ever renamed/removed in rbac.ts, rolesForRoute returns
 * [] and the spread would yield an EMPTY @Roles() — which could no-op the guard
 * and open the route. We assert non-empty at module load so drift crashes the
 * app at boot (loud), and the RolesGuard ALSO denies a present-but-empty @Roles()
 * at request time — two independent fail-closed layers (mirrors ComplianceController).
 *
 * ── Deny envelope ──────────────────────────────────────────────────────────
 * Deny → NestJS ForbiddenException default body (no requested-resource data, no
 * role info). Read-only endpoint; no write path.
 */

import type { AuditVerifyResponse, Role } from '@dealflow/shared';
import { rolesForRoute } from '@dealflow/shared';
import { Controller, Get, UseGuards } from '@nestjs/common';
// biome-ignore lint/style/useImportType: value import required for emitDecoratorMetadata DI resolution
import { AuditVerifier } from '../audit/audit.verifier';
import { Roles, RolesGuard } from '../auth/guards/roles.guard';
import { SessionGuard } from '../auth/guards/session.guard';

/**
 * Required roles for /compliance/audit-log/verify, resolved from the single
 * source of truth (shared roleRoutes) at module-eval time. Per the pinned matrix
 * this resolves to ['compliance', 'admin'] (an admin may run an integrity check).
 * See ComplianceController for the full rationale of the boot-time non-empty
 * assertion (fail-closed on RBAC config drift).
 */
const AUDIT_LOG_VERIFY_ROLES: Role[] = [...rolesForRoute('/compliance/audit-log/verify')];

if (AUDIT_LOG_VERIFY_ROLES.length === 0) {
  throw new Error(
    "RBAC config drift: rolesForRoute('/compliance/audit-log/verify') resolved to [] — " +
      'the route pattern is missing from the shared roleRoutes matrix. Refusing to ' +
      'boot rather than expose GET /compliance/audit-log/verify to every authenticated user.'
  );
}

@Controller('compliance')
export class AuditLogController {
  constructor(private readonly auditVerifier: AuditVerifier) {}

  @Get('audit-log/verify')
  @UseGuards(SessionGuard, RolesGuard)
  @Roles(...AUDIT_LOG_VERIFY_ROLES)
  verify(): Promise<AuditVerifyResponse> {
    return this.auditVerifier.verifyChain();
  }
}

/**
 * ComplianceModule (wave-3) — wires the enforced-RBAC exemplar route.
 *
 * Imports AuthModule so the DI-resolvable SessionGuard + RolesGuard (and the
 * Reflector they depend on) — which AuthModule provides AND exports — are
 * available to ComplianceController without re-providing them (single guard
 * instance graph, no duplicate providers).
 */

import { Module } from '@nestjs/common';

import { AuditModule } from '../audit/audit.module';
import { AuthModule } from '../auth/auth.module';
import { AuditLogController } from './audit-log.controller';
import { ComplianceController } from './compliance.controller';
import { ComplianceService } from './compliance.service';

/**
 * Wave-4: registers AuditLogController (GET /compliance/audit-log/verify) and
 * imports AuditModule so its exported AuditVerifier resolves in this module's
 * DI context. AuthModule (unchanged) provides the SessionGuard/RolesGuard/
 * AuthRepository the controller's @UseGuards depends on.
 */
@Module({
  imports: [AuthModule, AuditModule],
  controllers: [ComplianceController, AuditLogController],
  providers: [ComplianceService],
})
export class ComplianceModule {}

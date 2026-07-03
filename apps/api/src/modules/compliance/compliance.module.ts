/**
 * ComplianceModule (wave-3) — wires the enforced-RBAC exemplar route.
 *
 * Imports AuthModule so the DI-resolvable SessionGuard + RolesGuard (and the
 * Reflector they depend on) — which AuthModule provides AND exports — are
 * available to ComplianceController without re-providing them (single guard
 * instance graph, no duplicate providers).
 */

import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module';
import { ComplianceController } from './compliance.controller';
import { ComplianceService } from './compliance.service';

@Module({
  imports: [AuthModule],
  controllers: [ComplianceController],
  providers: [ComplianceService],
})
export class ComplianceModule {}

/**
 * ComplianceModule (wave-3, extended wave-5) — wires the enforced-RBAC exemplar
 * route and the B-2 compliance config CRUD surface.
 *
 * Wave-5 additions:
 *   - RulesController + RulesService        (GET/POST/PATCH/DELETE /compliance/rules)
 *   - SuppressionController + SuppressionService (GET/POST/DELETE /compliance/suppression)
 *   - DisclaimersController + DisclaimersService (GET/POST/PATCH /compliance/disclaimers)
 *
 * AuditModule is imported (and was already present from wave-4) so that
 * AuditService is resolvable in this module's DI context. Every mutation in the
 * CRUD services writes an audit entry via AuditService.append(_, tx) in the same
 * transaction as the DB write — audit-fail rolls back the mutation.
 *
 * AuthModule provides and exports SessionGuard, RolesGuard, and AuthRepository
 * (DB-authoritative role re-verify for the guards applied to all new routes).
 */

import { Module } from '@nestjs/common';

import { dbProvider } from '../../db/db.provider';
import { AuditModule } from '../audit/audit.module';
import { AuthModule } from '../auth/auth.module';
import { AuditLogController } from './audit-log.controller';
import { ComplianceController } from './compliance.controller';
import { ComplianceService } from './compliance.service';
import { DisclaimersController } from './disclaimers.controller';
import { DisclaimersService } from './disclaimers.service';
import { RulesController } from './rules.controller';
import { RulesService } from './rules.service';
import { SuppressionController } from './suppression.controller';
import { SuppressionService } from './suppression.service';

@Module({
  imports: [AuthModule, AuditModule],
  controllers: [
    ComplianceController,
    AuditLogController,
    RulesController,
    SuppressionController,
    DisclaimersController,
  ],
  providers: [dbProvider, ComplianceService, RulesService, SuppressionService, DisclaimersService],
})
export class ComplianceModule {}

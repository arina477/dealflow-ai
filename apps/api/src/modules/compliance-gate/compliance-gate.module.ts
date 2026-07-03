/**
 * ComplianceGateModule (wave-5, task 0595a835) — packages the SOLE
 * send-eligibility authority (ComplianceGateService) + its read-only repository.
 *
 * Imports AuditModule so the exported AuditService resolves in this module's DI
 * context — the gate writes every verdict via AuditService.append IN the caller's
 * tx (reused wave-4 append authority; not re-implemented here). Provides the DB
 * handle for the gate repository's config-table reads.
 *
 * Exports ComplianceGateService so the M6 outreach send path (later) can inject
 * it and call evaluate() before any send. There is intentionally NO controller /
 * HTTP surface this wave — the gate is a service-to-service authority, not an
 * endpoint (an HTTP /evaluate route would be a callable surface with no send
 * behind it and an RBAC ambiguity). Exercised standalone via unit tests.
 */

import { Module } from '@nestjs/common';

import { dbProvider } from '../../db/db.provider';
import { AuditModule } from '../audit/audit.module';
import { ComplianceGateRepository } from './compliance-gate.repository';
import { ComplianceGateService } from './compliance-gate.service';

@Module({
  imports: [AuditModule],
  providers: [dbProvider, ComplianceGateRepository, ComplianceGateService],
  exports: [ComplianceGateService],
})
export class ComplianceGateModule {}

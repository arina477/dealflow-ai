/**
 * RetentionPolicyModule (wave-28, task d3cc1337) — M10 retention window config.
 *
 * Provides:
 *   - RetentionPolicyRepository (RLS-scoped reads + SEC-A upsert)
 *   - RetentionPolicyService    (getPolicy, setPolicy with SEC-C audit)
 *   - RetentionPolicyController (GET + PUT /compliance/retention, RBAC fail-closed)
 *
 * Imports:
 *   - AuditModule  → exports AuditService (retention.policy.updated append LAST-standalone)
 *   - AuthModule   → exports AuthRepository (getUserWithRole), RolesGuard, SessionGuard
 *
 * HARD BOUNDARY:
 *   NO purge/delete path. NO deletion of audit_log_entries. NO LLM/AI import.
 *   WORM-preserving: setPolicy appends to the audit chain; never deletes.
 */

import { Module } from '@nestjs/common';
import { dbProvider } from '../../db/db.provider';
import { AuditModule } from '../audit/audit.module';
import { AuthModule } from '../auth/auth.module';
import { RetentionPolicyController } from './retention-policy.controller';
import { RetentionPolicyRepository } from './retention-policy.repository';
import { RetentionPolicyService } from './retention-policy.service';

@Module({
  imports: [AuditModule, AuthModule],
  controllers: [RetentionPolicyController],
  providers: [dbProvider, RetentionPolicyRepository, RetentionPolicyService],
})
export class RetentionPolicyModule {}

/**
 * RecordkeepingModule (wave-13) — the M6 audit-log read + verify + export module.
 *
 * Provides:
 *   - RecordkeepingRepository (read-only queries over audit_log_entries + joins)
 *   - RecordkeepingService    (listAsActor, verifyChainAsActor, exportAsActor)
 *   - RecordkeepingController (GET/GET/POST /compliance/audit-log*)
 *
 * Imports:
 *   - AuditModule  → exports AuditService (export_generated append LAST-IN-TXN)
 *                    and AuditVerifier (verifyChain reuse — single tamper-evidence
 *                    authority; NOT forked in this module)
 *   - AuthModule   → exports AuthRepository (getUserWithRole: ST → app users.id),
 *                    RolesGuard, and SessionGuard (RBAC + session guards)
 *
 * DB provider: RecordkeepingRepository needs the Drizzle database handle for
 *   its filtered/paginated reads and runInTransaction.
 *
 * HARD BOUNDARY:
 *   NO Anthropic/Claude/LLM import anywhere in this module.
 *   NO transactional-email SDK (nodemailer/sendgrid/postmark/resend/ses).
 *   NO new external SDK. Read-only over the immutable audit chain.
 *   ONLY the export path writes ONE audit row (via M2 AuditService).
 *
 * This module does NOT export anything — self-contained feature module.
 */

import { Module } from '@nestjs/common';

import { dbProvider } from '../../db/db.provider';
import { AuditModule } from '../audit/audit.module';
import { AuthModule } from '../auth/auth.module';
import { RecordkeepingController } from './recordkeeping.controller';
import { RecordkeepingRepository } from './recordkeeping.repository';
import { RecordkeepingService } from './recordkeeping.service';

@Module({
  imports: [AuditModule, AuthModule],
  controllers: [RecordkeepingController],
  providers: [dbProvider, RecordkeepingRepository, RecordkeepingService],
})
export class RecordkeepingModule {}

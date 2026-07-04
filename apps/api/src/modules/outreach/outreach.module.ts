/**
 * OutreachModule — NestJS module for the wave-11 outreach spine.
 *
 * Wires:
 *   - OutreachRepository (Drizzle read/write queries for 3 outreach tables)
 *   - TemplateService    (create / draftNewVersion / requestApproval / isUsableForSend)
 *   - ApprovalService    (grantApproval / reject — compliance role SoD)
 *   - OutreachService    (composeAsActor — non-bypassable pre-send gate)
 *   - OutreachTemplateController (POST/GET /outreach-templates + versions + approve/reject)
 *   - OutreachController         (POST/GET /outreach)
 *
 * Imports:
 *   - ComplianceGateModule → exports ComplianceGateService (the SOLE send-eligibility
 *     authority — OutreachService.composeAsActor ALWAYS calls evaluate(ctx, tx))
 *   - AuditModule          → exports AuditService (in-tx audit for all mutations)
 *   - AuthModule           → exports AuthRepository (getUserWithRole: ST → app users.id)
 *                            and RolesGuard + SessionGuard (RBAC primitives)
 *
 * HARD BOUNDARY:
 *   NO Anthropic/Claude/LLM import anywhere in this module.
 *   NO transactional-email SDK (nodemailer/sendgrid/postmark/resend/ses).
 *   NO send call. This module produces send-eligible records only.
 *
 * The module does NOT export anything — it is a self-contained feature module.
 */

import { Module } from '@nestjs/common';

import { dbProvider } from '../../db/db.provider';
import { AuditModule } from '../audit/audit.module';
import { AuthModule } from '../auth/auth.module';
import { ComplianceGateModule } from '../compliance-gate/compliance-gate.module';
import { ApprovalService } from './approval.service';
import { OutreachController } from './outreach.controller';
import { OutreachRepository } from './outreach.repository';
import { OutreachService } from './outreach.service';
import { OutreachTemplateController } from './outreach-template.controller';
import { TemplateService } from './template.service';

@Module({
  imports: [ComplianceGateModule, AuditModule, AuthModule],
  controllers: [OutreachTemplateController, OutreachController],
  providers: [dbProvider, OutreachRepository, TemplateService, ApprovalService, OutreachService],
})
export class OutreachModule {}

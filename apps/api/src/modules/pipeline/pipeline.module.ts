/**
 * PipelineModule — NestJS module for the wave-12 pipeline spine.
 *
 * Wires:
 *   - PipelineRepository (Drizzle read/write queries for 2 pipeline tables)
 *   - PipelineService    (enroll + transition + addNote + board + events)
 *   - PipelineController (GET/POST /pipeline + PATCH/POST/GET /pipeline/:id/*)
 *
 * Imports:
 *   - AuditModule  → exports AuditService (in-tx audit for all mutations — LAST-IN-TXN)
 *   - AuthModule   → exports AuthRepository (getUserWithRole: ST → app users.id)
 *                    and RolesGuard + SessionGuard (RBAC primitives)
 *
 * HARD BOUNDARY:
 *   NO Anthropic/Claude/LLM import anywhere in this module.
 *   NO transactional-email SDK (nodemailer/sendgrid/postmark/resend/ses).
 *   NO send call. This module produces pipeline tracking records only.
 *
 * The module does NOT export anything — it is a self-contained feature module.
 */

import { Module } from '@nestjs/common';

import { dbProvider } from '../../db/db.provider';
import { AuditModule } from '../audit/audit.module';
import { AuthModule } from '../auth/auth.module';
import { PipelineController } from './pipeline.controller';
import { PipelineRepository } from './pipeline.repository';
import { PipelineService } from './pipeline.service';

@Module({
  imports: [AuditModule, AuthModule],
  controllers: [PipelineController],
  providers: [dbProvider, PipelineRepository, PipelineService],
})
export class PipelineModule {}

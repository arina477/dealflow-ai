/**
 * OutreachActivityModule — NestJS module for wave-20 M9 outreach-activity tracker.
 *
 * Wires:
 *   - OutreachActivityRepository  (Drizzle read/write queries for outreach_activity)
 *   - OutreachActivityService     (create / list / update / updateStatus / cancel)
 *   - OutreachActivityController  (GET / POST / PATCH /outreach-activity)
 *
 * Imports:
 *   - AuditModule  → exports AuditService (in-tx audit for all mutations — LAST-IN-TXN)
 *   - AuthModule   → exports AuthRepository (getUserWithRole: ST → app users.id)
 *                    and RolesGuard + SessionGuard (RBAC primitives)
 *
 * HARD BOUNDARY:
 *   NO Anthropic/Claude/LLM import anywhere in this module.
 *   NO transactional-email SDK.
 *   NO external send. This module produces internal records only.
 *   ZERO new external SDK — channel labels are pure record strings.
 *
 * The module does NOT export anything — self-contained feature module.
 */

import { Module } from '@nestjs/common';

import { dbProvider } from '../../db/db.provider';
import { AuditModule } from '../audit/audit.module';
import { AuthModule } from '../auth/auth.module';
import { OutreachActivityController } from './outreach-activity.controller';
import { OutreachActivityRepository } from './outreach-activity.repository';
import { OutreachActivityService } from './outreach-activity.service';

@Module({
  imports: [AuditModule, AuthModule],
  controllers: [OutreachActivityController],
  providers: [dbProvider, OutreachActivityRepository, OutreachActivityService],
})
export class OutreachActivityModule {}

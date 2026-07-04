/**
 * MandateModule — NestJS module for the wave-8 mandate spine.
 *
 * Wires:
 *   - MandateRepository (Drizzle read/write queries for 3 mandate tables)
 *   - MandateService (orchestration: create/configure/list/detail + audit)
 *   - MandateController (HTTP surface: POST/PATCH/GET /mandates)
 *
 * Imports:
 *   - AuditModule → exports AuditService (used in-tx for mandate-create/configure audit)
 *   - AuthModule  → exports AuthRepository (getUserWithRole: ST id → app users.id)
 *                   and RolesGuard + SessionGuard (RBAC primitives)
 *
 * The module does NOT export anything — it is a self-contained feature module.
 */

import { Module } from '@nestjs/common';

import { dbProvider } from '../../db/db.provider';
import { AuditModule } from '../audit/audit.module';
import { AuthModule } from '../auth/auth.module';
import { MandateController } from './mandate.controller';
import { MandateRepository } from './mandate.repository';
import { MandateService } from './mandate.service';

@Module({
  imports: [AuditModule, AuthModule],
  controllers: [MandateController],
  providers: [dbProvider, MandateRepository, MandateService],
})
export class MandateModule {}

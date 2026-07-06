/**
 * AnalyticsModule — workspace-scoped analytics surface.
 *
 * Wave-18 (tasks a5ba8068 / 9e05828b).
 *
 * Exposes GET /analytics → AnalyticsController → AnalyticsService →
 * AnalyticsRepository (4 workspace-scoped aggregation queries via getDb()).
 *
 * Imports:
 *   - AuthModule → SessionGuard, RolesGuard, AuthRepository (BUILD rule 2:
 *                  RolesGuard constructor-injects AuthRepository; AuthModule
 *                  exports both so they resolve in this module's DI context).
 *
 * No exports: self-contained feature module (read-only surface, no downstream
 * consumers need a service or repository from here).
 *
 * Security note: this module NEVER writes to any table. The service layer
 * enforces the no-write invariant (AnalyticsRepository has no INSERT/UPDATE/DELETE
 * methods). No AuditService.append call is ever made in this path.
 */

import { Module } from '@nestjs/common';

import { dbProvider } from '../../db/db.provider';
import { AuthModule } from '../auth/auth.module';
import { AnalyticsController } from './analytics.controller';
import { AnalyticsRepository } from './analytics.repository';
import { AnalyticsService } from './analytics.service';

@Module({
  imports: [AuthModule],
  controllers: [AnalyticsController],
  providers: [dbProvider, AnalyticsRepository, AnalyticsService],
})
export class AnalyticsModule {}

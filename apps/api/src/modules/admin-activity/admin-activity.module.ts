/**
 * AdminActivityModule (wave-16, task 8bb0a22f — P-4 Finding 3)
 *
 * Read-only admin-activity surface: GET /admin/activity-data.
 *
 * Wires:
 *   - AdminActivityController (GET /admin/activity-data, admin-only)
 *   - AdminActivityService (fetches + maps audit entries; NEVER writes)
 *
 * Imports:
 *   - AuthModule  → SessionGuard, RolesGuard, AuthRepository (BUILD rule 2:
 *                   RolesGuard constructor-injects AuthRepository; AuthModule
 *                   exports both so they resolve in this module's DI context)
 *   - AuditModule → AuditRepository (exported from AuditModule to expose the
 *                   findAdminActivity / countAdminActivity read-only methods;
 *                   AuditService/AuditVerifier also exported but not used here)
 *
 * No exports: self-contained feature module (read-only surface, no downstream
 * consumers need a service or repository from here).
 *
 * Security note: this module NEVER writes to audit_log_entries. The service
 * layer enforces the no-write invariant (AuditRepository.findAdminActivity is
 * a SELECT-only method; no AuditService.append call is ever made in this path).
 */

import { Module } from '@nestjs/common';

import { dbProvider } from '../../db/db.provider';
import { AuditModule } from '../audit/audit.module';
import { AuthModule } from '../auth/auth.module';
import { AdminActivityController } from './admin-activity.controller';
import { AdminActivityService } from './admin-activity.service';

@Module({
  imports: [AuthModule, AuditModule],
  controllers: [AdminActivityController],
  providers: [dbProvider, AdminActivityService],
})
export class AdminActivityModule {}

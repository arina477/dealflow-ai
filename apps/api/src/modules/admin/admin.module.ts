/**
 * AdminModule (wave-15, tasks 82ec8724 + 648a86a6 + 41c017f7) — M7 admin vertical.
 *
 * Wires three services + three controllers:
 *   - UserManagementService   + AdminUsersController   (user-mgmt: invite/role/deactivate)
 *   - WorkspaceSettingsService + WorkspaceSettingsController (firm profile + compliance defaults)
 *   - DataSourceAdminService  + DataSourceAdminController  (connection CRUD + encrypted cred)
 *
 * Imports:
 *   - AuthModule  → SessionGuard, RolesGuard, AuthRepository (DB-auth RBAC + actor id)
 *   - AuditModule → AuditService (WORM audit last-in-txn on every mutation)
 *
 * All three services reuse M1 auth/RBAC/invites, M2 AuditService via imports.
 * The DataSourceAdminService uses the M3 data_source_connections table directly
 * (no SourcingModule import needed — just the DB provider + schema reference).
 *
 * Security notes:
 *   - CREDENTIALS_ENC_KEY must be set in env (boot fails if missing — credential-crypto.ts).
 *   - No module exports (self-contained feature module).
 */

import { Module } from '@nestjs/common';

import { dbProvider } from '../../db/db.provider';
import { AuditModule } from '../audit/audit.module';
import { AuthModule } from '../auth/auth.module';
import { AdminUsersController } from './admin-users.controller';
import { DataSourceAdminController } from './data-source-admin.controller';
import { DataSourceAdminService } from './data-source-admin.service';
import { UserManagementService } from './user-management.service';
import { WorkspaceSettingsController } from './workspace-settings.controller';
import { WorkspaceSettingsService } from './workspace-settings.service';

@Module({
  imports: [AuthModule, AuditModule],
  controllers: [AdminUsersController, WorkspaceSettingsController, DataSourceAdminController],
  providers: [dbProvider, UserManagementService, WorkspaceSettingsService, DataSourceAdminService],
})
export class AdminModule {}

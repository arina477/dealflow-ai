/**
 * DI-boot spec for AdminModule (wave-15).
 *
 * Proves that AdminModule wires correctly and all three controllers/services
 * can be resolved in the NestJS DI container without a live DB or SuperTokens.
 *
 * Pattern: mirrors the audit.di-boot.spec.ts / compliance.di-boot.spec.ts exemplar.
 * The DB handle is provided as a value mock (no real pool opened).
 */

import { Test } from '@nestjs/testing';
import { describe, expect, it } from 'vitest';

// ── DB mock (no real pool) ───────────────────────────────────────────────────
import { DB } from '../../db/db.provider';
import { AuditService } from '../audit/audit.service';
import { AuthRepository } from '../auth/auth.repository';
import { RolesGuard } from '../auth/guards/roles.guard';
import { SessionGuard } from '../auth/guards/session.guard';
import { AdminModule } from './admin.module';
import { AdminUsersController } from './admin-users.controller';
import { DataSourceAdminController } from './data-source-admin.controller';
import { DataSourceAdminService } from './data-source-admin.service';
import { UserManagementService } from './user-management.service';
import { WorkspaceSettingsController } from './workspace-settings.controller';
import { WorkspaceSettingsService } from './workspace-settings.service';

// biome-ignore lint/suspicious/noExplicitAny: mock DB handle
const mockDb: any = {
  select: () => ({ from: () => ({ where: () => ({ limit: () => Promise.resolve([]) }) }) }),
  insert: () => ({ values: () => ({ returning: () => Promise.resolve([]) }) }),
  update: () => ({ set: () => ({ where: () => ({ returning: () => Promise.resolve([]) }) }) }),
  transaction: () => Promise.resolve(),
  execute: () => Promise.resolve({ rows: [] }),
};

describe('AdminModule DI boot', () => {
  it('resolves all controllers and services without a live DB', async () => {
    const module = await Test.createTestingModule({
      imports: [AdminModule],
    })
      .overrideProvider(DB)
      .useValue(mockDb)
      .compile();

    // All three controllers must resolve.
    expect(module.get(AdminUsersController)).toBeDefined();
    expect(module.get(WorkspaceSettingsController)).toBeDefined();
    expect(module.get(DataSourceAdminController)).toBeDefined();

    // All three services must resolve.
    expect(module.get(UserManagementService)).toBeDefined();
    expect(module.get(WorkspaceSettingsService)).toBeDefined();
    expect(module.get(DataSourceAdminService)).toBeDefined();

    // Shared infrastructure from imports must resolve.
    expect(module.get(AuditService)).toBeDefined();
    expect(module.get(AuthRepository)).toBeDefined();
    expect(module.get(RolesGuard)).toBeDefined();
    expect(module.get(SessionGuard)).toBeDefined();
  });
});

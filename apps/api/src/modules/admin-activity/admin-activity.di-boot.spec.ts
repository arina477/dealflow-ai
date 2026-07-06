/**
 * DI-boot spec for AdminActivityModule (wave-16, task 8bb0a22f).
 *
 * Proves that AdminActivityModule wires correctly and all providers can be
 * resolved in the NestJS DI container without a live DB or SuperTokens.
 *
 * Specifically validates BUILD rules 2 and 3:
 *   - RolesGuard constructor-injects AuthRepository; AuthModule exports it.
 *   - AuditRepository is exported from AuditModule; AdminActivityModule imports it.
 *   - No `import type` for any DI-injected class (would erase the DI token).
 *
 * Also validates the RBAC fail-closed boot guard in the controller:
 *   rolesForRoute('/admin/activity-data') must return ['admin'] (not []).
 */

import { Test } from '@nestjs/testing';
import { describe, expect, it } from 'vitest';

import { DB } from '../../db/db.provider';
import { AuditRepository } from '../audit/audit.repository';
import { AuthRepository } from '../auth/auth.repository';
import { RolesGuard } from '../auth/guards/roles.guard';
import { SessionGuard } from '../auth/guards/session.guard';
import { AdminActivityController } from './admin-activity.controller';
import { AdminActivityModule } from './admin-activity.module';
import { AdminActivityService } from './admin-activity.service';

// biome-ignore lint/suspicious/noExplicitAny: mock DB handle
const mockDb: any = {
  select: () => ({
    from: () => ({
      where: () => ({
        limit: () => Promise.resolve([]),
        orderBy: () => ({ limit: () => Promise.resolve([]) }),
      }),
      orderBy: () => ({ limit: () => Promise.resolve([]) }),
    }),
  }),
  insert: () => ({ values: () => ({ returning: () => Promise.resolve([]) }) }),
  update: () => ({
    set: () => ({ where: () => ({ returning: () => Promise.resolve([]) }) }),
  }),
  transaction: () => Promise.resolve(),
  execute: () => Promise.resolve({ rows: [] }),
};

describe('AdminActivityModule DI boot', () => {
  it('resolves all providers without a live DB or SuperTokens', async () => {
    const module = await Test.createTestingModule({
      imports: [AdminActivityModule],
    })
      .overrideProvider(DB)
      .useValue(mockDb)
      .compile();

    // Controller and service must resolve.
    expect(module.get(AdminActivityController)).toBeDefined();
    expect(module.get(AdminActivityService)).toBeDefined();

    // Shared infrastructure from imports must resolve:
    // AuditRepository (exported by AuditModule per wave-16 export addition).
    // BUILD rule 2: guard-injected repos exported by consuming module.
    expect(module.get(AuditRepository)).toBeDefined();
    // AuthRepository (exported by AuthModule; RolesGuard constructor-injects it).
    expect(module.get(AuthRepository)).toBeDefined();
    // RolesGuard + SessionGuard (exported by AuthModule).
    expect(module.get(RolesGuard)).toBeDefined();
    expect(module.get(SessionGuard)).toBeDefined();
  });

  it('RBAC fail-closed: rolesForRoute resolves to non-empty set for /admin/activity-data', async () => {
    // This assertion is the dual of the controller's boot-fail guard.
    // If the route were removed from rbac.ts, the controller would throw on load.
    // Here we verify the contract holds from the shared package side.
    const { rolesForRoute } = await import('@dealflow/shared');
    const roles = rolesForRoute('/admin/activity-data');
    expect(roles.length).toBeGreaterThan(0);
    expect(roles).toContain('admin');
    // Advisor and anon are excluded (P-4 Finding 3).
    expect(roles).not.toContain('advisor');
    expect(roles).not.toContain('compliance');
    expect(roles).not.toContain('analyst');
  });
});

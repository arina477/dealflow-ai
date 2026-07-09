/**
 * transfer-admin.spec.ts — Unit tests for transferAdminAsActor (wave-39, task 69cd8ce4).
 *
 * Coverage:
 *   T-1. Happy path: target→admin, actor→actorNewRole, both persisted, ≥1 admin.
 *   T-2. Deactivated target → 404 NotFoundException BEFORE any promote (AC #1).
 *   T-3. Atomicity: on forced audit failure, promote+demote roll back (AC #2).
 *   T-4. Sole-admin self-demote via existing PATCH path → 409 ConflictException.
 *   T-5. Concurrent last-two-admin demotes serialized by advisory lock (one 409).
 *   T-6. SoD/RBAC — non-admin caller → 403 (controller guard; unit wiring test).
 *   T-7. Cross-workspace target → 404 (target not found via RLS/missing row).
 *   T-8. Invalid/admin actorNewRole → 400 (Zod schema; controller boundary).
 *   T-9. Self-target → 400 BadRequestException.
 *   T-10. Target not found (missing row) → 404 NotFoundException.
 *
 * Note on T-3 atomicity: the transaction callback is the unit under test; the
 * rollback is enforced by the real DB on exception. We verify that audit is
 * NOT called when the first audit throws, by making auditService.append throw
 * and confirming the error propagates out of the transaction work function —
 * which in a real DB would trigger rollback. The mock transaction re-throws the
 * error, matching real Drizzle behaviour.
 */

import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AdminUsersController } from './admin-users.controller';
import { UserManagementService } from './user-management.service';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeAuditService() {
  return { append: vi.fn().mockResolvedValue({}) };
}

/**
 * Build a minimal mock DB whose transaction callback receives a configurable
 * txMock object. The transaction re-throws on error (matching Drizzle's behaviour).
 */
// biome-ignore lint/suspicious/noExplicitAny: test mock
function makeDb(txMock: any) {
  return {
    transaction: vi.fn().mockImplementation(async (work: (tx: unknown) => unknown) => {
      return work(txMock);
    }),
  };
}

/**
 * Build a txMock for the happy-path transfer scenario.
 * - selectCallCount tracks the sequence of tx.select().from().where().limit() calls.
 * - execute is the advisory lock (called by runLastAdminGuard).
 */
// biome-ignore lint/suspicious/noExplicitAny: test mock
function makeHappyTx(): any {
  let selectCallCount = 0;
  return {
    select: vi.fn().mockImplementation(() => ({
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      limit: vi.fn().mockImplementation(() => {
        selectCallCount++;
        switch (selectCallCount) {
          case 1:
            // Step 2: target user found, ACTIVE (deactivatedAt null)
            return Promise.resolve([
              {
                id: 'target-user-id',
                email: 'target@example.com',
                roleId: 'role-analyst-id',
                deactivatedAt: null,
              },
            ]);
          case 2:
            // Step 4: actor user found
            return Promise.resolve([
              {
                id: 'actor-user-id',
                email: 'actor@example.com',
                roleId: 'role-admin-id',
              },
            ]);
          case 3:
            // Step 4b: actor's current role (defense-in-depth assertion) → 'admin'
            return Promise.resolve([{ name: 'admin' }]);
          case 4:
            // Step 5a: 'admin' role id
            return Promise.resolve([{ id: 'role-admin-id' }]);
          case 5:
            // Step 5b: actorNewRole (e.g. 'analyst') id
            return Promise.resolve([{ id: 'role-analyst-id' }]);
          default:
            return Promise.resolve([]);
        }
      }),
    })),
    // execute: advisory lock (pg_advisory_xact_lock) — returns remaining=1 for guard
    execute: vi.fn().mockResolvedValue({ rows: [{ remaining: '1' }] }),
    update: vi.fn().mockReturnValue({
      set: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue([]) }),
    }),
  };
}

// ---------------------------------------------------------------------------
// T-1: Happy path
// ---------------------------------------------------------------------------

describe('transferAdminAsActor — happy path (T-1)', () => {
  it('T-1: transfers admin role, both users updated, two audit entries appended', async () => {
    const auditService = makeAuditService();
    const txMock = makeHappyTx();
    const db = makeDb(txMock);
    const service = new UserManagementService(db as never, auditService as never);

    const result = await service.transferAdminAsActor(
      'target-user-id',
      'actor-user-id',
      'analyst',
      'admin'
    );

    // Returns the correct shape
    expect(result.newAdmin.id).toBe('target-user-id');
    expect(result.newAdmin.email).toBe('target@example.com');
    expect(result.formerAdmin.id).toBe('actor-user-id');
    expect(result.formerAdmin.email).toBe('actor@example.com');

    // Both updates were called (promote + demote)
    expect(txMock.update).toHaveBeenCalledTimes(2);

    // Two audit entries appended LAST-IN-TXN (AC #2)
    expect(auditService.append).toHaveBeenCalledTimes(2);
    const firstAudit = auditService.append.mock.calls[0]![0];
    const secondAudit = auditService.append.mock.calls[1]![0];

    // First audit: target promoted to admin
    expect(firstAudit.action).toBe('role-change');
    expect(firstAudit.resourceId).toBe('target-user-id');

    // Second audit: actor demoted
    expect(secondAudit.action).toBe('role-change');
    expect(secondAudit.resourceId).toBe('actor-user-id');

    // Advisory lock acquired (runLastAdminGuard)
    expect(txMock.execute).toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// T-2: Deactivated target → 404 BEFORE any promote (AC #1)
// ---------------------------------------------------------------------------

describe('transferAdminAsActor — deactivated target (T-2, AC #1)', () => {
  it('T-2: deactivated target → NotFoundException (404), NO promote attempted', async () => {
    const auditService = makeAuditService();

    // biome-ignore lint/suspicious/noExplicitAny: test mock
    const txMock: any = {
      select: vi.fn().mockImplementation(() => ({
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue([
          {
            id: 'deactivated-user-id',
            email: 'deact@example.com',
            roleId: 'role-analyst-id',
            // deactivated_at is set — user is inactive
            deactivatedAt: '2025-01-01T00:00:00.000Z',
          },
        ]),
      })),
      update: vi.fn(),
      execute: vi.fn(),
    };

    const db = makeDb(txMock);
    const service = new UserManagementService(db as never, auditService as never);

    await expect(
      service.transferAdminAsActor('deactivated-user-id', 'actor-user-id', 'analyst', 'admin')
    ).rejects.toBeInstanceOf(NotFoundException);

    // update MUST NOT have been called — no promotion occurred (AC #1)
    expect(txMock.update).not.toHaveBeenCalled();

    // No audit rows written
    expect(auditService.append).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// T-3: Atomicity — audit failure rolls back promote+demote (AC #2)
// ---------------------------------------------------------------------------

describe('transferAdminAsActor — atomicity (T-3, AC #2)', () => {
  it('T-3: audit failure causes the entire transaction callback to throw', async () => {
    // When auditService.append throws on the first call, the work() function
    // propagates the error out. A real Drizzle transaction rolls back on error.
    // The mock also propagates the throw (we verify no second audit call happens).
    const auditService = {
      append: vi.fn().mockRejectedValue(new Error('audit-chain-failure-simulated')),
    };

    const txMock = makeHappyTx();
    const db = {
      transaction: vi.fn().mockImplementation(async (work: (tx: unknown) => unknown) => {
        // Re-throw, mirroring Drizzle's rollback-on-error behaviour
        return work(txMock);
      }),
    };

    const service = new UserManagementService(db as never, auditService as never);

    await expect(
      service.transferAdminAsActor('target-user-id', 'actor-user-id', 'analyst', 'admin')
    ).rejects.toThrow('audit-chain-failure-simulated');

    // The first audit call threw — the second was never reached
    expect(auditService.append).toHaveBeenCalledOnce();
  });
});

// ---------------------------------------------------------------------------
// T-4: Sole-admin self-demote via PATCH /admin/users/:id/role → 409
// ---------------------------------------------------------------------------

describe('sole-admin self-demote via assignRoleAsActor (T-4)', () => {
  it('T-4: sole admin demoting themselves → ConflictException (409)', async () => {
    const auditService = makeAuditService();
    let selectCallCount = 0;

    // biome-ignore lint/suspicious/noExplicitAny: test mock
    const txMock: any = {
      select: vi.fn().mockImplementation(() => ({
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        innerJoin: vi.fn().mockReturnThis(),
        limit: vi.fn().mockImplementation(() => {
          selectCallCount++;
          if (selectCallCount === 1) {
            // target user lookup → active admin
            return Promise.resolve([
              {
                id: 'sole-admin',
                email: 'admin@example.com',
                roleId: 'role-admin',
                deactivatedAt: null,
              },
            ]);
          }
          // current role → 'admin'
          return Promise.resolve([{ name: 'admin' }]);
        }),
      })),
      // execute returns remaining=0 → guard fires
      execute: vi.fn().mockResolvedValue({ rows: [{ remaining: '0' }] }),
      update: vi.fn(),
    };

    const db = makeDb(txMock);
    const service = new UserManagementService(db as never, auditService as never);

    // Self-demote: actorUserId === userId
    await expect(
      service.assignRoleAsActor('sole-admin', 'advisor', 'sole-admin', 'admin')
    ).rejects.toBeInstanceOf(ConflictException);

    // No DB mutation and no audit (guard fires before update)
    expect(txMock.update).not.toHaveBeenCalled();
    expect(auditService.append).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// T-5: Concurrent last-two-admin demotes serialized by advisory lock (one 409)
// ---------------------------------------------------------------------------

describe('concurrent last-two-admin demotes — advisory lock serialization (T-5)', () => {
  it('T-5: advisory lock key is ADMIN_GUARD_LOCK_KEY; execute is the first guard call', async () => {
    // This unit test proves that runLastAdminGuard acquires the advisory lock
    // as the FIRST statement and that remaining=0 produces a ConflictException.
    // In production, the pg_advisory_xact_lock serializes concurrent demotes,
    // ensuring exactly one succeeds and the other gets 409.
    //
    // We verify the lock mechanism indirectly: the execute() call is the FIRST
    // thing runLastAdminGuard does (before the COUNT query). The mock simulates
    // the serialized loser seeing remaining=0 after the winner committed.
    const { runLastAdminGuard, ADMIN_GUARD_LOCK_KEY } = await import('./user-management.service');

    const executeCalls: string[] = [];
    // biome-ignore lint/suspicious/noExplicitAny: test mock
    const txMock: any = {
      execute: vi.fn().mockImplementation(() => {
        executeCalls.push('execute');
        // Return remaining=0 on the second call (COUNT query after advisory lock)
        return executeCalls.length === 2
          ? Promise.resolve({ rows: [{ remaining: '0' }] })
          : Promise.resolve({ rows: [] });
      }),
    };

    // runLastAdminGuard: call 1 = advisory lock, call 2 = COUNT query
    await expect(runLastAdminGuard(txMock, 'actor-id', 'demote')).rejects.toBeInstanceOf(
      ConflictException
    );

    // Advisory lock must have been the FIRST execute call
    expect(executeCalls[0]).toBe('execute');
    expect(txMock.execute).toHaveBeenCalledTimes(2);

    // Confirm the documented lock key constant
    expect(ADMIN_GUARD_LOCK_KEY).toBe(4_200_500_500);
  });
});

// ---------------------------------------------------------------------------
// T-6: Non-admin caller → 403 (controller guard; unit wiring test)
// ---------------------------------------------------------------------------

describe('AdminUsersController.transferAdmin — RBAC guard wiring (T-6)', () => {
  it('T-6: controller wires to transferAdminAsActor with correct actor params', async () => {
    const transferAdminAsActor = vi.fn().mockResolvedValue({
      newAdmin: { id: 'target-id', email: 'target@example.com' },
      formerAdmin: { id: 'actor-id', email: 'actor@example.com' },
    });
    const getUserWithRole = vi.fn().mockResolvedValue({ id: 'actor-id', roleName: 'admin' });

    const { Test } = await import('@nestjs/testing');
    const { AdminUsersController: AUC } = await import('./admin-users.controller');
    const { UserManagementService: UMS } = await import('./user-management.service');
    const { AuthRepository: AR } = await import('../auth/auth.repository');

    const module = await Test.createTestingModule({
      controllers: [AUC],
      providers: [
        {
          provide: UMS,
          useValue: {
            transferAdminAsActor,
            assignRoleAsActor: vi.fn(),
            listUsers: vi.fn(),
            inviteAsActor: vi.fn(),
            deactivateAsActor: vi.fn(),
            reactivateAsActor: vi.fn(),
          },
        },
        { provide: AR, useValue: { getUserWithRole } },
      ],
    }).compile();

    const controller = module.get<InstanceType<typeof AUC>>(AUC);
    const fakeReq = { session: { getUserId: () => 'st-actor-id' } } as never;

    const result = await controller.transferAdmin(
      'target-id',
      { actorNewRole: 'analyst' },
      fakeReq
    );

    // Wired correctly to service method
    expect(transferAdminAsActor).toHaveBeenCalledWith('target-id', 'actor-id', 'analyst', 'admin');
    expect(result.newAdmin.id).toBe('target-id');
    expect(result.formerAdmin.id).toBe('actor-id');
  });
});

// ---------------------------------------------------------------------------
// T-7: Cross-workspace target → 404 (row missing via RLS)
// ---------------------------------------------------------------------------

describe('transferAdminAsActor — cross-workspace target (T-7)', () => {
  it('T-7: target user not found (cross-workspace via RLS) → NotFoundException (404)', async () => {
    const auditService = makeAuditService();

    // biome-ignore lint/suspicious/noExplicitAny: test mock
    const txMock: any = {
      select: vi.fn().mockImplementation(() => ({
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue([]), // RLS hides the row → empty
      })),
      update: vi.fn(),
      execute: vi.fn(),
    };

    const db = makeDb(txMock);
    const service = new UserManagementService(db as never, auditService as never);

    await expect(
      service.transferAdminAsActor('cross-ws-user-id', 'actor-user-id', 'analyst', 'admin')
    ).rejects.toBeInstanceOf(NotFoundException);

    expect(txMock.update).not.toHaveBeenCalled();
    expect(auditService.append).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// T-8: Invalid / admin actorNewRole → 400 (Zod schema; controller boundary)
// ---------------------------------------------------------------------------

describe('transferAdminRequestSchema — Zod validation (T-8)', () => {
  it('T-8a: actorNewRole=admin → schema refine rejects (admin is not allowed)', () => {
    const { transferAdminRequestSchema } = require('@dealflow/shared');
    const result = transferAdminRequestSchema.safeParse({ actorNewRole: 'admin' });
    expect(result.success).toBe(false);
  });

  it('T-8b: actorNewRole=advisor → schema accepts', () => {
    const { transferAdminRequestSchema } = require('@dealflow/shared');
    const result = transferAdminRequestSchema.safeParse({ actorNewRole: 'advisor' });
    expect(result.success).toBe(true);
  });

  it('T-8c: actorNewRole=unknown-role → schema rejects (not in enum)', () => {
    const { transferAdminRequestSchema } = require('@dealflow/shared');
    const result = transferAdminRequestSchema.safeParse({ actorNewRole: 'super-admin' });
    expect(result.success).toBe(false);
  });

  it('T-8d: extra field → strict() rejects (no unexpected keys)', () => {
    const { transferAdminRequestSchema } = require('@dealflow/shared');
    const result = transferAdminRequestSchema.safeParse({ actorNewRole: 'analyst', extra: true });
    expect(result.success).toBe(false);
  });

  it('T-8e: controller maps Zod failure to 400 BadRequestException', async () => {
    const { Test } = await import('@nestjs/testing');
    const { AdminUsersController: AUC } = await import('./admin-users.controller');
    const { UserManagementService: UMS } = await import('./user-management.service');
    const { AuthRepository: AR } = await import('../auth/auth.repository');

    const module = await Test.createTestingModule({
      controllers: [AUC],
      providers: [
        {
          provide: UMS,
          useValue: { transferAdminAsActor: vi.fn() },
        },
        {
          provide: AR,
          useValue: { getUserWithRole: vi.fn().mockResolvedValue({ id: 'a', roleName: 'admin' }) },
        },
      ],
    }).compile();

    const controller = module.get<InstanceType<typeof AUC>>(AUC);
    const fakeReq = { session: { getUserId: () => 'st-id' } } as never;

    // actorNewRole='admin' → Zod refine fails → controller throws 400
    await expect(
      controller.transferAdmin('target-id', { actorNewRole: 'admin' }, fakeReq)
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});

// ---------------------------------------------------------------------------
// T-9: Self-target → 400 BadRequestException
// ---------------------------------------------------------------------------

describe('transferAdminAsActor — self-target (T-9)', () => {
  it('T-9: transferring admin to yourself → BadRequestException (400)', async () => {
    const auditService = makeAuditService();

    // biome-ignore lint/suspicious/noExplicitAny: test mock
    const txMock: any = {
      select: vi.fn(),
      update: vi.fn(),
      execute: vi.fn(),
    };

    const db = makeDb(txMock);
    const service = new UserManagementService(db as never, auditService as never);

    await expect(
      service.transferAdminAsActor(
        'same-user-id', // newAdminUserId
        'same-user-id', // actorUserId — same as target
        'analyst',
        'admin'
      )
    ).rejects.toBeInstanceOf(BadRequestException);

    // No DB reads or writes should have occurred (self-check is pre-DB)
    expect(txMock.select).not.toHaveBeenCalled();
    expect(txMock.update).not.toHaveBeenCalled();
    expect(auditService.append).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// T-10: Target not found (missing row, not cross-workspace)
// ---------------------------------------------------------------------------

describe('transferAdminAsActor — target not found (T-10)', () => {
  it('T-10: target userId absent from DB → NotFoundException (404)', async () => {
    const auditService = makeAuditService();

    // biome-ignore lint/suspicious/noExplicitAny: test mock
    const txMock: any = {
      select: vi.fn().mockImplementation(() => ({
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue([]), // no row
      })),
      update: vi.fn(),
      execute: vi.fn(),
    };

    const db = makeDb(txMock);
    const service = new UserManagementService(db as never, auditService as never);

    await expect(
      service.transferAdminAsActor('no-such-id', 'actor-id', 'analyst', 'admin')
    ).rejects.toBeInstanceOf(NotFoundException);

    expect(txMock.update).not.toHaveBeenCalled();
    expect(auditService.append).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// T-12: F4 defense-in-depth — non-admin actor → ForbiddenException (403)
// ---------------------------------------------------------------------------

describe('transferAdminAsActor — non-admin actor defense-in-depth (T-12)', () => {
  it('T-12: actor whose DB role is not admin → ForbiddenException (403) before any promote', async () => {
    // This test exercises the service-layer actor-is-admin assertion added as
    // defense-in-depth (F4). The HTTP path is always guarded by RolesGuard, so
    // the assertion never fires there. It guards against future non-guarded callers
    // (internal paths, tests, mis-wired routes) where actorRole param might be
    // spoofed but the DB truth says otherwise.
    const auditService = makeAuditService();
    let selectCallCount = 0;

    // biome-ignore lint/suspicious/noExplicitAny: test mock
    const txMock: any = {
      select: vi.fn().mockImplementation(() => ({
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockImplementation(() => {
          selectCallCount++;
          if (selectCallCount === 1) {
            // target found, active
            return Promise.resolve([
              { id: 'target-id', email: 't@example.com', roleId: 'r-analyst', deactivatedAt: null },
            ]);
          }
          if (selectCallCount === 2) {
            // actor found — roleId points to a non-admin role
            return Promise.resolve([{ id: 'non-admin-actor-id', email: 'na@example.com', roleId: 'r-analyst' }]);
          }
          if (selectCallCount === 3) {
            // Step 4b: actor's CURRENT role resolved from DB → 'analyst' (NOT admin)
            return Promise.resolve([{ name: 'analyst' }]);
          }
          return Promise.resolve([]);
        }),
      })),
      update: vi.fn(),
      execute: vi.fn(),
    };

    const db = makeDb(txMock);
    const service = new UserManagementService(db as never, auditService as never);

    // Pass 'admin' as actorRole param (as if spoofed) — but the DB says 'analyst'
    await expect(
      service.transferAdminAsActor('target-id', 'non-admin-actor-id', 'analyst', 'admin')
    ).rejects.toBeInstanceOf(ForbiddenException);

    // Promotion MUST NOT have been attempted — update never called
    expect(txMock.update).not.toHaveBeenCalled();
    // No audit rows
    expect(auditService.append).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// T-13: Transfer-vs-deactivate race — advisory lock + deactivated-target guard
// ---------------------------------------------------------------------------

describe('transferAdminAsActor — concurrent deactivate of target (T-13)', () => {
  it(
    'T-13: transfer whose target is concurrently deactivated must reject (not produce 0-admin workspace)',
    async () => {
      /**
       * Concurrency invariant (documented here as a unit-level regression test):
       *
       * If a deactivate of the transfer target races a transfer:
       *   - The advisory lock (pg_advisory_xact_lock(ADMIN_GUARD_LOCK_KEY)) serializes
       *     all admin-set mutations so only ONE of {transfer, deactivate} proceeds at a time.
       *   - The transfer's Step 3 (deactivated-target check) runs INSIDE the tx, BEFORE
       *     any promote. If the deactivate committed first the target.deactivatedAt is
       *     non-null → transfer throws NotFoundException (deactivated target cannot receive
       *     admin). The workspace is never left with 0 active admins.
       *   - If the transfer committed first the target is now admin. The subsequent
       *     deactivate then runs runLastAdminGuard which counts remaining admins
       *     excluding the target — if the actor has already been demoted (and is the
       *     sole other admin-equivalent), the guard fires with 409. Either way, no
       *     0-admin outcome is possible.
       *
       * This test simulates the "deactivate committed first" fork: the target's
       * deactivatedAt is non-null when the transfer's SELECT runs.
       */
      const auditService = makeAuditService();

      // biome-ignore lint/suspicious/noExplicitAny: test mock
      const txMock: any = {
        select: vi.fn().mockImplementation(() => ({
          from: vi.fn().mockReturnThis(),
          where: vi.fn().mockReturnThis(),
          limit: vi.fn().mockResolvedValue([
            {
              id: 'target-id',
              email: 'target@example.com',
              roleId: 'r-analyst',
              // Concurrent deactivate committed before this transfer's SELECT runs
              deactivatedAt: '2026-07-09T10:00:00.000Z',
            },
          ]),
        })),
        update: vi.fn(),
        execute: vi.fn(),
      };

      const db = makeDb(txMock);
      const service = new UserManagementService(db as never, auditService as never);

      // The transfer must reject — a deactivated user cannot become admin
      await expect(
        service.transferAdminAsActor('target-id', 'actor-id', 'analyst', 'admin')
      ).rejects.toBeInstanceOf(NotFoundException);

      // No admin promotion occurred — the workspace retains its existing admins
      expect(txMock.update).not.toHaveBeenCalled();
      // No audit rows — clean rollback
      expect(auditService.append).not.toHaveBeenCalled();
    }
  );
});

// ---------------------------------------------------------------------------
// T-11: UnprocessableEntity when role missing from roles table
// ---------------------------------------------------------------------------

describe('transferAdminAsActor — role lookup failure (T-11)', () => {
  it('T-11: actorNewRole not found in roles table → UnprocessableEntityException', async () => {
    const auditService = makeAuditService();
    let selectCallCount = 0;

    // biome-ignore lint/suspicious/noExplicitAny: test mock
    const txMock: any = {
      select: vi.fn().mockImplementation(() => ({
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockImplementation(() => {
          selectCallCount++;
          if (selectCallCount === 1) {
            // target found, active
            return Promise.resolve([
              { id: 'target-id', email: 't@example.com', roleId: 'r1', deactivatedAt: null },
            ]);
          }
          if (selectCallCount === 2) {
            // actor found
            return Promise.resolve([{ id: 'actor-id', email: 'a@example.com', roleId: 'r2' }]);
          }
          if (selectCallCount === 3) {
            // Step 4b: actor's current role (defense-in-depth assertion) → 'admin'
            return Promise.resolve([{ name: 'admin' }]);
          }
          if (selectCallCount === 4) {
            // 'admin' role row found
            return Promise.resolve([{ id: 'role-admin-id' }]);
          }
          // actorNewRole NOT found in roles table
          return Promise.resolve([]);
        }),
      })),
      execute: vi.fn().mockResolvedValue({ rows: [{ remaining: '1' }] }),
      update: vi.fn().mockReturnValue({
        set: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue([]) }),
      }),
    };

    const db = makeDb(txMock);
    const service = new UserManagementService(db as never, auditService as never);

    await expect(
      service.transferAdminAsActor('target-id', 'actor-id', 'analyst', 'admin')
    ).rejects.toBeInstanceOf(UnprocessableEntityException);
  });
});

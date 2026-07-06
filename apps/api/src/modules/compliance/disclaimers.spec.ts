/**
 * T-2/T-4 — DisclaimersController + DisclaimersService (wave-5, B-2 step 2.13).
 *
 * Tests:
 *   - CRUD happy path: create/update writes audit entry in-tx
 *   - GET does NOT call AuditService.append
 *   - Disclaimer edit = new version row + prior deactivated
 *   - Audit-append failure rolls back mutation
 *   - RBAC: compliance→201/200, admin→201/200, advisor/analyst→403, anon→401
 *   - Validation: invalid body → ZodError (400 in controller)
 */

import type { Role } from '@dealflow/shared';
import { rolesForRoute } from '@dealflow/shared';
import type { ExecutionContext } from '@nestjs/common';
import { ForbiddenException, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('supertokens-node/recipe/session', () => ({
  default: {
    getSession: vi.fn().mockRejectedValue(new Error('no session')),
  },
}));

import type { AuthRepository } from '../auth/auth.repository';
import { ROLES_KEY, RolesGuard } from '../auth/guards/roles.guard';
import { DisclaimersController } from './disclaimers.controller';
import { DisclaimersService } from './disclaimers.service';

const LIST_HANDLER = DisclaimersController.prototype.listDisclaimers;

const TEST_USER_ID = 'st-user-disclaimers-123';

function contextFor(handler: unknown, claimRole: Role | undefined): ExecutionContext {
  const req =
    claimRole === undefined
      ? {}
      : {
          session: {
            getUserId: () => TEST_USER_ID,
            getAccessTokenPayload: () => ({ role: claimRole }),
          },
        };
  return {
    getHandler: () => handler,
    getClass: () => DisclaimersController,
    switchToHttp: () => ({ getRequest: () => req, getResponse: () => ({}) }),
  } as unknown as ExecutionContext;
}

function guardWithDbRole(dbRole: Role | null): RolesGuard {
  const repo = {
    resolveRoleRlsExempt: vi.fn().mockResolvedValue(dbRole),
    resolveRoleBySupertokensUserId: vi.fn().mockResolvedValue(dbRole),
  } as unknown as AuthRepository;
  return new RolesGuard(new Reflector(), repo);
}

// ── RBAC matrix ───────────────────────────────────────────────────────────────

describe('GET /compliance/disclaimers — RBAC', () => {
  afterEach(() => vi.clearAllMocks());

  it('resolves @Roles from shared roleRoutes (single source of truth)', () => {
    const fromMap = [...rolesForRoute('/compliance/disclaimers')].sort();
    const fromMeta = [...new Reflector().get<Role[]>(ROLES_KEY, LIST_HANDLER)].sort();
    expect(fromMeta).toEqual(fromMap);
    expect(fromMeta).toEqual(['admin', 'compliance']);
  });

  it.each(['compliance', 'admin'] as Role[])('%s → ALLOW', async (role) => {
    const guard = guardWithDbRole(role);
    await expect(guard.canActivate(contextFor(LIST_HANDLER, role))).resolves.toBe(true);
  });

  it.each(['advisor', 'analyst'] as Role[])('%s → DENY (403)', async (role) => {
    const guard = guardWithDbRole(role);
    await expect(guard.canActivate(contextFor(LIST_HANDLER, role))).rejects.toBeInstanceOf(
      ForbiddenException
    );
  });

  it('anon → 401', async () => {
    const guard = guardWithDbRole('admin');
    await expect(guard.canActivate(contextFor(LIST_HANDLER, undefined))).rejects.toBeInstanceOf(
      UnauthorizedException
    );
  });
});

// ── Service unit tests ─────────────────────────────────────────────────────────

describe('DisclaimersService — CRUD + versioning + audit-in-tx', () => {
  const ACTOR_USER_ID = '00000000-0000-0000-0000-000000000003';
  const ACTOR_ROLE = 'compliance';

  const EXISTING_ROW = {
    id: '33333333-3333-3333-3333-333333333333',
    jurisdiction: 'US',
    body: 'Original disclaimer text',
    version: 1,
    active: true,
    createdBy: ACTOR_USER_ID,
    createdAt: '2026-07-03T12:00:00.000Z',
  };

  const NEW_VERSION_ROW = {
    id: '44444444-4444-4444-4444-444444444444',
    jurisdiction: 'US',
    body: 'Updated disclaimer text',
    version: 2,
    active: true,
    createdBy: ACTOR_USER_ID,
    createdAt: '2026-07-03T13:00:00.000Z',
  };

  let mockAuditService: { append: ReturnType<typeof vi.fn> };
  let mockTx: Record<string, ReturnType<typeof vi.fn>>;
  let service: DisclaimersService;

  beforeEach(() => {
    mockAuditService = { append: vi.fn().mockResolvedValue({}) };

    const chain: Record<string, ReturnType<typeof vi.fn>> = {} as Record<
      string,
      ReturnType<typeof vi.fn>
    >;
    chain.select = vi.fn().mockReturnValue(chain);
    chain.from = vi.fn().mockReturnValue(chain);
    // Default: return existing row; callers override per-test as needed
    chain.where = vi.fn().mockResolvedValue([EXISTING_ROW]);
    chain.insert = vi.fn().mockReturnValue(chain);
    chain.values = vi.fn().mockReturnValue(chain);
    chain.returning = vi.fn().mockResolvedValue([NEW_VERSION_ROW]);
    chain.update = vi.fn().mockReturnValue(chain);
    chain.set = vi.fn().mockReturnValue(chain);
    chain.delete = vi.fn().mockReturnValue(chain);
    // Advisory lock: tx.execute() is called for pg_advisory_xact_lock(hashtext(jurisdiction)).
    chain.execute = vi.fn().mockResolvedValue(undefined);

    mockTx = chain;

    const mockDb = {
      select: vi.fn().mockReturnValue({
        from: vi.fn().mockResolvedValue([EXISTING_ROW]),
      }),
      transaction: vi.fn().mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => {
        return fn(mockTx);
      }),
    };

    service = new DisclaimersService(
      mockDb as unknown as ConstructorParameters<typeof DisclaimersService>[0],
      mockAuditService as unknown as ConstructorParameters<typeof DisclaimersService>[1]
    );
  });

  afterEach(() => vi.clearAllMocks());

  it('listDisclaimers — returns mapped rows, does NOT call AuditService.append', async () => {
    const result = await service.listDisclaimers();
    expect(result).toHaveLength(1);
    expect(result[0]?.id).toBe(EXISTING_ROW.id);
    expect(mockAuditService.append).not.toHaveBeenCalled();
  });

  it('createDisclaimer (first version) — acquires advisory lock, inserts row, calls AuditService.append in-tx', async () => {
    // No prior rows: max(version) = null → nextVersion = 1
    mockTx.where.mockResolvedValueOnce([{ maxVersion: null }]);
    mockTx.returning.mockResolvedValueOnce([EXISTING_ROW]);

    const result = await service.createDisclaimer(
      { jurisdiction: 'US', body: 'Original disclaimer text' },
      ACTOR_USER_ID,
      ACTOR_ROLE
    );

    expect(result.id).toBe(EXISTING_ROW.id);
    expect(result.version).toBe(1);

    // Advisory lock must be the first tx call — serializes per-jurisdiction edits.
    expect(mockTx.execute).toHaveBeenCalledOnce();

    expect(mockAuditService.append).toHaveBeenCalledOnce();
    const firstCall = mockAuditService.append.mock.calls[0] ?? [];
    const auditInput = firstCall[0] as { action: string; actorUserId: string };
    const tx = firstCall[1];
    expect(auditInput.action).toBe('disclaimer-change');
    expect(auditInput.actorUserId).toBe(ACTOR_USER_ID);
    expect(tx).toBeDefined();
  });

  it('createDisclaimer — unique-violation on active-disclaimer index (23505) propagates cleanly (DB backstop)', async () => {
    // Simulate what happens when the advisory lock is bypassed or two processes
    // race and the DB partial-unique index rejects the second INSERT:
    //   disclaimer_templates_jurisdiction_active_unique (jurisdiction) WHERE active
    // The service does NOT swallow 23505 — it lets the tx roll back, surfacing
    // a clean DB error to the caller (no silent duplicate active rows).
    const uniqueViolation = Object.assign(
      new Error('duplicate key value violates unique constraint'),
      {
        code: '23505',
        constraint: 'disclaimer_templates_jurisdiction_active_unique',
      }
    );
    mockTx.where.mockResolvedValueOnce([{ maxVersion: 1 }]); // max(version) read
    mockTx.returning.mockRejectedValueOnce(uniqueViolation); // INSERT fails

    await expect(
      service.createDisclaimer(
        { jurisdiction: 'US', body: 'Conflicting text' },
        ACTOR_USER_ID,
        ACTOR_ROLE
      )
    ).rejects.toMatchObject({ code: '23505' });

    // Audit must NOT have been written — the tx rolled back.
    expect(mockAuditService.append).not.toHaveBeenCalled();
  });

  describe('updateDisclaimer — edit = new version + deactivate prior', () => {
    it('acquires advisory lock, inserts new version row (version+1) AND deactivates prior', async () => {
      // updateDisclaimer flow: select existing → advisory lock → max(version) → update(set active=false) → insert
      mockTx.where
        .mockResolvedValueOnce([EXISTING_ROW]) // fetch existing by id
        .mockResolvedValueOnce([{ maxVersion: 1 }]) // max(version) for jurisdiction
        .mockResolvedValue(undefined); // deactivate update

      mockTx.returning.mockResolvedValue([NEW_VERSION_ROW]);

      const result = await service.updateDisclaimer(
        EXISTING_ROW.id,
        { body: 'Updated disclaimer text' },
        ACTOR_USER_ID,
        ACTOR_ROLE
      );

      expect(result.id).toBe(NEW_VERSION_ROW.id);
      expect(result.version).toBe(NEW_VERSION_ROW.version);
      expect(result.active).toBe(true);

      // Advisory lock must be acquired for the target jurisdiction.
      expect(mockTx.execute).toHaveBeenCalledOnce();

      // Prior row deactivation: set({ active: false }) must be called
      expect(mockTx.update).toHaveBeenCalled();
      expect(mockTx.set).toHaveBeenCalledWith({ active: false });
    });

    it('calls AuditService.append in-tx with action=disclaimer-change for the new version', async () => {
      mockTx.where
        .mockResolvedValueOnce([EXISTING_ROW])
        .mockResolvedValueOnce([{ maxVersion: 1 }])
        .mockResolvedValue(undefined);
      mockTx.returning.mockResolvedValue([NEW_VERSION_ROW]);

      await service.updateDisclaimer(
        EXISTING_ROW.id,
        { body: 'Updated disclaimer text' },
        ACTOR_USER_ID,
        ACTOR_ROLE
      );

      expect(mockAuditService.append).toHaveBeenCalledOnce();
      const auditInput = (mockAuditService.append.mock.calls[0] ?? [])[0] as {
        action: string;
        resourceId: string;
      };
      expect(auditInput.action).toBe('disclaimer-change');
      expect(auditInput.resourceId).toBe(NEW_VERSION_ROW.id);
    });

    it('throws NotFoundException when referenced id does not exist', async () => {
      mockTx.where.mockResolvedValueOnce([]);
      await expect(
        service.updateDisclaimer('nonexistent-id', { body: 'new body' }, ACTOR_USER_ID, ACTOR_ROLE)
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(mockAuditService.append).not.toHaveBeenCalled();
    });

    it('concurrent update — unique-violation on active-disclaimer index (23505) propagates cleanly (DB backstop)', async () => {
      // Simulates the race where two concurrent updateDisclaimer calls for the
      // same jurisdiction both pass the advisory lock (e.g. different app instances
      // not sharing the same PG connection pool lock key) and the second INSERT
      // active=true hits the partial unique index:
      //   disclaimer_templates_jurisdiction_active_unique (jurisdiction) WHERE active
      // The service must NOT swallow the error — it propagates so the caller
      // receives a clean 409/500 and audit is NOT written.
      const uniqueViolation = Object.assign(
        new Error('duplicate key value violates unique constraint'),
        {
          code: '23505',
          constraint: 'disclaimer_templates_jurisdiction_active_unique',
        }
      );
      mockTx.where
        .mockResolvedValueOnce([EXISTING_ROW]) // fetch existing
        .mockResolvedValueOnce([{ maxVersion: 1 }]); // max(version)
      mockTx.returning.mockRejectedValueOnce(uniqueViolation); // INSERT fails

      await expect(
        service.updateDisclaimer(
          EXISTING_ROW.id,
          { body: 'Conflicting update' },
          ACTOR_USER_ID,
          ACTOR_ROLE
        )
      ).rejects.toMatchObject({ code: '23505' });

      // Audit was NOT written — tx rolled back before audit.append could be called.
      expect(mockAuditService.append).not.toHaveBeenCalled();
    });
  });

  it('audit-append failure → mutation rolls back', async () => {
    mockAuditService.append.mockRejectedValueOnce(new Error('audit chain locked'));
    mockTx.where.mockResolvedValueOnce([{ maxVersion: null }]);
    mockTx.returning.mockResolvedValueOnce([EXISTING_ROW]);

    await expect(
      service.createDisclaimer({ jurisdiction: 'US', body: 'text' }, ACTOR_USER_ID, ACTOR_ROLE)
    ).rejects.toThrow('audit chain locked');
  });
});

// ── Validation ─────────────────────────────────────────────────────────────────

describe('disclaimerCreateSchema + disclaimerUpdateSchema — validation', () => {
  it('create: throws ZodError when jurisdiction is missing', async () => {
    const { ZodError } = await import('zod');
    const { disclaimerCreateSchema } = await import('@dealflow/shared');
    expect(() => disclaimerCreateSchema.parse({ body: 'text' })).toThrow(ZodError);
  });

  it('create: throws ZodError when body is missing', async () => {
    const { ZodError } = await import('zod');
    const { disclaimerCreateSchema } = await import('@dealflow/shared');
    expect(() => disclaimerCreateSchema.parse({ jurisdiction: 'US' })).toThrow(ZodError);
  });

  it('update: throws ZodError on empty object (at-least-one-field refine)', async () => {
    const { ZodError } = await import('zod');
    const { disclaimerUpdateSchema } = await import('@dealflow/shared');
    expect(() => disclaimerUpdateSchema.parse({})).toThrow(ZodError);
  });
});

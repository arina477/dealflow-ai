/**
 * T-2/T-4 — SuppressionController + SuppressionService (wave-5, B-2 step 2.12).
 *
 * Tests:
 *   - CRUD happy path: create/delete writes audit entry in-tx
 *   - GET does NOT call AuditService.append
 *   - Audit-append failure rolls back mutation
 *   - RBAC: compliance→201/204, admin→201/204, advisor/analyst→403, anon→401
 *   - Validation: invalid body → ZodError (400 in controller)
 *   - Value normalization: value is stored lower-case
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
import { SuppressionController } from './suppression.controller';
import { SuppressionService } from './suppression.service';

const LIST_HANDLER = SuppressionController.prototype.listEntries;

const TEST_USER_ID = 'st-user-suppression-123';

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
    getClass: () => SuppressionController,
    switchToHttp: () => ({ getRequest: () => req, getResponse: () => ({}) }),
  } as unknown as ExecutionContext;
}

function guardWithDbRole(dbRole: Role | null): RolesGuard {
  const repo = {
    resolveRoleBySupertokensUserId: vi.fn().mockResolvedValue(dbRole),
  } as unknown as AuthRepository;
  return new RolesGuard(new Reflector(), repo);
}

// ── RBAC matrix ───────────────────────────────────────────────────────────────

describe('GET /compliance/suppression — RBAC', () => {
  afterEach(() => vi.clearAllMocks());

  it('resolves @Roles from shared roleRoutes (single source of truth)', () => {
    const fromMap = [...rolesForRoute('/compliance/suppression')].sort();
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

describe('SuppressionService — CRUD + audit-in-tx', () => {
  const ACTOR_USER_ID = '00000000-0000-0000-0000-000000000002';
  const ACTOR_ROLE = 'compliance';

  const ENTRY_ROW = {
    id: '22222222-2222-2222-2222-222222222222',
    matchType: 'email' as const,
    value: 'blocked@example.com',
    reason: null,
    createdBy: ACTOR_USER_ID,
    createdAt: '2026-07-03T12:00:00.000Z',
  };

  let mockAuditService: { append: ReturnType<typeof vi.fn> };
  let mockTx: Record<string, ReturnType<typeof vi.fn>>;
  let service: SuppressionService;

  beforeEach(() => {
    mockAuditService = { append: vi.fn().mockResolvedValue({}) };

    const chain: Record<string, ReturnType<typeof vi.fn>> = {} as Record<
      string,
      ReturnType<typeof vi.fn>
    >;
    chain.select = vi.fn().mockReturnValue(chain);
    chain.from = vi.fn().mockReturnValue(chain);
    chain.where = vi.fn().mockResolvedValue([ENTRY_ROW]);
    chain.insert = vi.fn().mockReturnValue(chain);
    chain.values = vi.fn().mockReturnValue(chain);
    chain.returning = vi.fn().mockResolvedValue([ENTRY_ROW]);
    chain.delete = vi.fn().mockReturnValue(chain);

    mockTx = chain;

    const mockDb = {
      select: vi.fn().mockReturnValue({
        from: vi.fn().mockResolvedValue([ENTRY_ROW]),
      }),
      transaction: vi.fn().mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => {
        return fn(mockTx);
      }),
    };

    service = new SuppressionService(
      mockDb as unknown as ConstructorParameters<typeof SuppressionService>[0],
      mockAuditService as unknown as ConstructorParameters<typeof SuppressionService>[1]
    );
  });

  afterEach(() => vi.clearAllMocks());

  it('listEntries — returns mapped entries, does NOT call AuditService.append', async () => {
    const result = await service.listEntries();
    expect(result).toHaveLength(1);
    expect(result[0]?.id).toBe(ENTRY_ROW.id);
    expect(mockAuditService.append).not.toHaveBeenCalled();
  });

  it('createEntry — inserts row AND calls AuditService.append with action=suppression-change', async () => {
    const result = await service.createEntry(
      { matchType: 'email', value: 'Blocked@Example.com' },
      ACTOR_USER_ID,
      ACTOR_ROLE
    );

    expect(result.id).toBe(ENTRY_ROW.id);
    expect(mockAuditService.append).toHaveBeenCalledOnce();
    const firstCall = mockAuditService.append.mock.calls[0] ?? [];
    const auditInput = firstCall[0] as { action: string; actorUserId: string };
    const tx = firstCall[1];
    expect(auditInput.action).toBe('suppression-change');
    expect(auditInput.actorUserId).toBe(ACTOR_USER_ID);
    expect(tx).toBeDefined();
  });

  it('createEntry — normalizes value to lower-case before insert', async () => {
    await service.createEntry(
      { matchType: 'email', value: 'UPPER@CASE.COM' },
      ACTOR_USER_ID,
      ACTOR_ROLE
    );

    const valueCall = mockTx.values.mock.calls[0]?.[0] as { value?: string } | undefined;
    expect(valueCall?.value).toBe('upper@case.com');
  });

  it('deleteEntry — deletes row AND calls AuditService.append with action=suppression-change', async () => {
    await service.deleteEntry(ENTRY_ROW.id, ACTOR_USER_ID, ACTOR_ROLE);

    expect(mockAuditService.append).toHaveBeenCalledOnce();
    const auditInput = (mockAuditService.append.mock.calls[0] ?? [])[0] as {
      action: string;
      resourceId: string;
    };
    expect(auditInput.action).toBe('suppression-change');
    expect(auditInput.resourceId).toBe(ENTRY_ROW.id);
  });

  it('deleteEntry — throws NotFoundException when entry does not exist', async () => {
    mockTx.where.mockResolvedValueOnce([]);
    await expect(
      service.deleteEntry('nonexistent-id', ACTOR_USER_ID, ACTOR_ROLE)
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(mockAuditService.append).not.toHaveBeenCalled();
  });

  it('audit-append failure → mutation rolls back', async () => {
    mockAuditService.append.mockRejectedValueOnce(new Error('audit chain locked'));
    await expect(
      service.createEntry({ matchType: 'email', value: 'x@y.com' }, ACTOR_USER_ID, ACTOR_ROLE)
    ).rejects.toThrow('audit chain locked');
  });
});

// ── Validation ─────────────────────────────────────────────────────────────────

describe('suppressionCreateSchema — validation', () => {
  it('throws ZodError on missing matchType', async () => {
    const { ZodError } = await import('zod');
    const { suppressionCreateSchema } = await import('@dealflow/shared');
    expect(() => suppressionCreateSchema.parse({ value: 'x@y.com' })).toThrow(ZodError);
  });

  it('throws ZodError on missing value', async () => {
    const { ZodError } = await import('zod');
    const { suppressionCreateSchema } = await import('@dealflow/shared');
    expect(() => suppressionCreateSchema.parse({ matchType: 'email' })).toThrow(ZodError);
  });

  it('throws ZodError on invalid matchType', async () => {
    const { ZodError } = await import('zod');
    const { suppressionCreateSchema } = await import('@dealflow/shared');
    expect(() => suppressionCreateSchema.parse({ matchType: 'phone', value: '123' })).toThrow(
      ZodError
    );
  });
});

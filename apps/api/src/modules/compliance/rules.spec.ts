/**
 * T-2/T-4 — RulesController + RulesService (wave-5, B-2 step 2.11).
 *
 * Tests:
 *   - CRUD happy path: create/update/delete writes the audit entry in-tx
 *   - GET does NOT call AuditService.append
 *   - Audit-append failure rolls back the mutation
 *   - RBAC: compliance→201/200/204, admin→201/200/204, advisor/analyst→403, anon→401
 *   - Validation: invalid body → ZodError (400 in controller)
 *   - Id-translation: controller calls getUserWithRole and passes the returned
 *     app users.id (NOT the raw SuperTokens id) to the service (wave-5 C-2 fix)
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
import { RulesController } from './rules.controller';
import { RulesService } from './rules.service';

// ── Helpers ────────────────────────────────────────────────────────────────────

const RULES_HANDLER_LIST = RulesController.prototype.listRules;

/** SuperTokens id — what session.getUserId() returns (NOT FK-safe). */
const ST_USER_ID = 'st-user-rules-123';
/** App users.id — what getUserWithRole returns; FK-safe for compliance_rules. */
const APP_USER_ID = 'aaaaaaaa-0000-0000-0000-000000000001';
const APP_USER_ROLE = 'compliance' as Role;

function contextFor(handler: unknown, claimRole: Role | undefined): ExecutionContext {
  const req =
    claimRole === undefined
      ? {}
      : {
          session: {
            getUserId: () => ST_USER_ID,
            getAccessTokenPayload: () => ({ role: claimRole }),
          },
        };
  return {
    getHandler: () => handler,
    getClass: () => RulesController,
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

describe('GET /compliance/rules — RBAC', () => {
  afterEach(() => vi.clearAllMocks());

  it('resolves @Roles from shared roleRoutes (single source of truth)', () => {
    const fromMap = [...rolesForRoute('/compliance/rules')].sort();
    const fromMeta = [...new Reflector().get<Role[]>(ROLES_KEY, RULES_HANDLER_LIST)].sort();
    expect(fromMeta).toEqual(fromMap);
    expect(fromMeta).toEqual(['admin', 'compliance']);
  });

  it.each([
    ['compliance', true],
    ['admin', true],
  ] as [Role, boolean][])('%s → ALLOW', async (role, expected) => {
    const guard = guardWithDbRole(role);
    await expect(guard.canActivate(contextFor(RULES_HANDLER_LIST, role))).resolves.toBe(expected);
  });

  it.each(['advisor', 'analyst'] as Role[])('%s → DENY (403)', async (role) => {
    const guard = guardWithDbRole(role);
    await expect(guard.canActivate(contextFor(RULES_HANDLER_LIST, role))).rejects.toBeInstanceOf(
      ForbiddenException
    );
  });

  it('anon → 401', async () => {
    const guard = guardWithDbRole('admin');
    await expect(
      guard.canActivate(contextFor(RULES_HANDLER_LIST, undefined))
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });
});

// ── Id-translation assertion (wave-5 C-2 fix) ────────────────────────────────
//
// This test catches the id-space mismatch at the unit level even without a
// live DB: it asserts that the controller calls AuthRepository.getUserWithRole
// with the SuperTokens id AND passes the RETURNED app users.id (not the raw
// SuperTokens id) to the service. Without this test, mocked services never see
// an FK violation — the defect is invisible until hitting a real DB.
//
// FAIL-ON-PRE-FIX: before the C-2 fix, the controller called session.getUserId()
// directly and passed the SuperTokens id to the service. That id is not in
// users(id), so every write FK-violates → transaction rollback → HTTP 500.
// This test would FAIL in that state because:
//   - getUserWithRole would never be called, and
//   - rulesService.createRule would be called with ST_USER_ID, not APP_USER_ID.

describe('RulesController — id-translation (SuperTokens id → app users.id)', () => {
  afterEach(() => vi.clearAllMocks());

  it('createRule: calls getUserWithRole with the ST id and passes app users.id to RulesService', async () => {
    const getUserWithRole = vi.fn().mockResolvedValue({ id: APP_USER_ID, roleName: APP_USER_ROLE });
    const mockAuthRepo = { getUserWithRole } as unknown as AuthRepository;

    const mockService: Partial<RulesService> = {
      createRule: vi.fn().mockResolvedValue({
        id: 'rule-id',
        ruleType: 'blocklist_check',
        jurisdiction: null,
        config: {},
        enabled: true,
        createdBy: APP_USER_ID,
        createdAt: new Date().toISOString(),
        updatedAt: null,
      }),
    };

    const controller = new RulesController(mockService as RulesService, mockAuthRepo);

    const req = {
      session: {
        getUserId: () => ST_USER_ID,
        getAccessTokenPayload: () => ({ role: APP_USER_ROLE }),
      },
    };

    await controller.createRule({ ruleType: 'blocklist_check', config: {} }, req as never);

    // 1. The lookup MUST have been called with the SuperTokens id.
    expect(getUserWithRole).toHaveBeenCalledOnce();
    expect(getUserWithRole).toHaveBeenCalledWith(ST_USER_ID);

    // 2. The service MUST receive the app users.id, NOT the raw ST id.
    expect(mockService.createRule).toHaveBeenCalledWith(
      expect.anything(),
      APP_USER_ID, // ← app users.id (FK-safe)
      APP_USER_ROLE // ← DB-authoritative role
    );

    // Defensive: the raw SuperTokens id must NOT have leaked to the service.
    const [, passedUserId] =
      (mockService.createRule as ReturnType<typeof vi.fn>).mock.calls[0] ?? [];
    expect(passedUserId).not.toBe(ST_USER_ID);
  });

  it('createRule: throws UnauthorizedException when getUserWithRole returns null (user row missing — fail closed)', async () => {
    const mockAuthRepo = {
      getUserWithRole: vi.fn().mockResolvedValue(null),
    } as unknown as AuthRepository;

    const mockService: Partial<RulesService> = {
      createRule: vi.fn(),
    };

    const controller = new RulesController(mockService as RulesService, mockAuthRepo);

    const req = {
      session: {
        getUserId: () => ST_USER_ID,
        getAccessTokenPayload: () => ({ role: 'compliance' }),
      },
    };

    await expect(
      controller.createRule({ ruleType: 'blocklist_check', config: {} }, req as never)
    ).rejects.toBeInstanceOf(UnauthorizedException);

    // Service must NOT be called — fail closed.
    expect(mockService.createRule).not.toHaveBeenCalled();
  });
});

// ── Service unit tests ─────────────────────────────────────────────────────────

describe('RulesService — CRUD + audit-in-tx', () => {
  const ACTOR_USER_ID = '00000000-0000-0000-0000-000000000001';
  const ACTOR_ROLE = 'compliance';

  const RULE_ROW = {
    id: '11111111-1111-1111-1111-111111111111',
    ruleType: 'blocklist_check' as const,
    jurisdiction: null,
    config: {},
    enabled: true,
    createdBy: ACTOR_USER_ID,
    createdAt: '2026-07-03T12:00:00.000Z',
    updatedAt: null,
  };

  let mockAuditService: { append: ReturnType<typeof vi.fn> };
  let mockTx: Record<string, ReturnType<typeof vi.fn>>;
  let service: RulesService;

  beforeEach(() => {
    mockAuditService = { append: vi.fn().mockResolvedValue({}) };

    /**
     * The tx chains diverge after entry point:
     *   select  → from → where  (promise — terminates chain for SELECT)
     *   insert  → values → returning (promise)
     *   update  → set → where → returning (promise — must NOT terminate where)
     *   delete  → where (promise)
     * We create separate chains for each entry so where() can terminate selects
     * while also returning the chain-continuation for update.
     */
    const selectChain: Record<string, ReturnType<typeof vi.fn>> = {} as Record<
      string,
      ReturnType<typeof vi.fn>
    >;
    selectChain.from = vi.fn().mockReturnValue(selectChain);
    selectChain.where = vi.fn().mockResolvedValue([RULE_ROW]);

    const insertChain: Record<string, ReturnType<typeof vi.fn>> = {} as Record<
      string,
      ReturnType<typeof vi.fn>
    >;
    insertChain.values = vi.fn().mockReturnValue(insertChain);
    insertChain.returning = vi.fn().mockResolvedValue([RULE_ROW]);

    const updateChain: Record<string, ReturnType<typeof vi.fn>> = {} as Record<
      string,
      ReturnType<typeof vi.fn>
    >;
    updateChain.set = vi.fn().mockReturnValue(updateChain);
    updateChain.where = vi.fn().mockReturnValue(updateChain);
    updateChain.returning = vi.fn().mockResolvedValue([RULE_ROW]);

    const deleteChain: Record<string, ReturnType<typeof vi.fn>> = {} as Record<
      string,
      ReturnType<typeof vi.fn>
    >;
    deleteChain.where = vi.fn().mockResolvedValue(undefined);

    const tx: Record<string, ReturnType<typeof vi.fn>> = {} as Record<
      string,
      ReturnType<typeof vi.fn>
    >;
    tx.select = vi.fn().mockReturnValue(selectChain);
    tx.insert = vi.fn().mockReturnValue(insertChain);
    tx.update = vi.fn().mockReturnValue(updateChain);
    tx.delete = vi.fn().mockReturnValue(deleteChain);
    // Expose sub-chains via the top-level mock for assertion access
    tx.where = selectChain.where;
    tx.returning = insertChain.returning;
    tx.values = insertChain.values;
    tx.set = updateChain.set;

    mockTx = tx;

    const mockDb = {
      select: vi.fn().mockReturnValue({
        from: vi.fn().mockResolvedValue([RULE_ROW]),
      }),
      transaction: vi.fn().mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => {
        return fn(mockTx);
      }),
    };

    service = new RulesService(
      mockDb as unknown as ConstructorParameters<typeof RulesService>[0],
      mockAuditService as unknown as ConstructorParameters<typeof RulesService>[1]
    );
  });

  afterEach(() => vi.clearAllMocks());

  it('listRules — returns mapped rules, does NOT call AuditService.append', async () => {
    const result = await service.listRules();
    expect(result).toHaveLength(1);
    expect(result[0]?.id).toBe(RULE_ROW.id);
    expect(mockAuditService.append).not.toHaveBeenCalled();
  });

  it('createRule — inserts row AND calls AuditService.append in-tx with action=rule-change', async () => {
    const result = await service.createRule(
      { ruleType: 'blocklist_check', config: {} },
      ACTOR_USER_ID,
      ACTOR_ROLE
    );

    expect(result.id).toBe(RULE_ROW.id);
    expect(mockAuditService.append).toHaveBeenCalledOnce();
    const calls = mockAuditService.append.mock.calls;
    const firstCall = calls[0] ?? [];
    const auditInput = firstCall[0] as {
      action: string;
      actorUserId: string;
      actorRole: string;
      resourceId: string;
    };
    const tx = firstCall[1];
    expect(auditInput.action).toBe('rule-change');
    expect(auditInput.actorUserId).toBe(ACTOR_USER_ID);
    expect(auditInput.actorRole).toBe(ACTOR_ROLE);
    expect(auditInput.resourceId).toBe(RULE_ROW.id);
    expect(tx).toBeDefined();
  });

  it('updateRule — updates row AND calls AuditService.append in-tx with action=rule-change', async () => {
    const result = await service.updateRule(
      RULE_ROW.id,
      { enabled: false },
      ACTOR_USER_ID,
      ACTOR_ROLE
    );

    expect(result.id).toBe(RULE_ROW.id);
    expect(mockAuditService.append).toHaveBeenCalledOnce();
    const auditInput = (mockAuditService.append.mock.calls[0] ?? [])[0] as { action: string };
    expect(auditInput.action).toBe('rule-change');
  });

  it('deleteRule — deletes row AND calls AuditService.append in-tx with action=rule-change', async () => {
    await service.deleteRule(RULE_ROW.id, ACTOR_USER_ID, ACTOR_ROLE);

    expect(mockAuditService.append).toHaveBeenCalledOnce();
    const auditInput = (mockAuditService.append.mock.calls[0] ?? [])[0] as {
      action: string;
      resourceId: string;
    };
    expect(auditInput.action).toBe('rule-change');
    expect(auditInput.resourceId).toBe(RULE_ROW.id);
  });

  it('updateRule — throws NotFoundException when rule does not exist', async () => {
    mockTx.where.mockResolvedValueOnce([]);
    await expect(
      service.updateRule('nonexistent-id', { enabled: false }, ACTOR_USER_ID, ACTOR_ROLE)
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(mockAuditService.append).not.toHaveBeenCalled();
  });

  it('deleteRule — throws NotFoundException when rule does not exist', async () => {
    mockTx.where.mockResolvedValueOnce([]);
    await expect(
      service.deleteRule('nonexistent-id', ACTOR_USER_ID, ACTOR_ROLE)
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(mockAuditService.append).not.toHaveBeenCalled();
  });

  it('audit-append failure → mutation rolls back (transaction rejects)', async () => {
    mockAuditService.append.mockRejectedValueOnce(new Error('audit chain locked'));

    await expect(
      service.createRule({ ruleType: 'blocklist_check', config: {} }, ACTOR_USER_ID, ACTOR_ROLE)
    ).rejects.toThrow('audit chain locked');
  });
});

// ── Validation (Zod schema parsing) ─────────────────────────────────────────────

describe('ruleCreateSchema + ruleUpdateSchema — validation', () => {
  it('create: throws ZodError when body is empty (no ruleType)', async () => {
    const { ZodError } = await import('zod');
    const { ruleCreateSchema } = await import('@dealflow/shared');
    expect(() => ruleCreateSchema.parse({})).toThrow(ZodError);
  });

  it('create: throws ZodError for invalid ruleType value', async () => {
    const { ZodError } = await import('zod');
    const { ruleCreateSchema } = await import('@dealflow/shared');
    expect(() => ruleCreateSchema.parse({ ruleType: 'invalid_type', config: {} })).toThrow(
      ZodError
    );
  });

  it('update: throws ZodError on empty object (at-least-one-field refine)', async () => {
    const { ZodError } = await import('zod');
    const { ruleUpdateSchema } = await import('@dealflow/shared');
    expect(() => ruleUpdateSchema.parse({})).toThrow(ZodError);
  });
});

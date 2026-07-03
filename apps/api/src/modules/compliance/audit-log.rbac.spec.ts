/**
 * T-8 — Per-route RBAC matrix for GET /compliance/audit-log/verify (task e6a4cbfe).
 *
 * Mirrors compliance.rbac.spec.ts against the AuditLogController.verify handler.
 * Exercises the REAL RolesGuard against the REAL @Roles() metadata resolved from
 * the controller, sourced from the shared roleRoutes map.
 *
 * Matrix (DB role drives the decision — the guard re-verifies against the app-DB
 * users row, not the session claim):
 *   compliance      → ALLOW (200)
 *   admin           → ALLOW (200)   [an admin may run an integrity check]
 *   advisor         → DENY  (403)
 *   analyst         → DENY  (403)
 *   unauthenticated → 401
 */

import type { Role } from '@dealflow/shared';
import { rolesForRoute } from '@dealflow/shared';
import type { ExecutionContext } from '@nestjs/common';
import { ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('supertokens-node/recipe/session', () => ({
  default: {
    getSession: vi.fn().mockRejectedValue(new Error('no session')),
  },
}));

import type { AuthRepository } from '../auth/auth.repository';
import { ROLES_KEY, RolesGuard } from '../auth/guards/roles.guard';
import { AuditLogController } from './audit-log.controller';

const verifyHandler = AuditLogController.prototype.verify;
const TEST_USER_ID = 'st-user-verify-123';

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
    getClass: () => AuditLogController,
    switchToHttp: () => ({ getRequest: () => req, getResponse: () => ({}) }),
  } as unknown as ExecutionContext;
}

function mockRepo(dbRole: Role | null): AuthRepository {
  return {
    resolveRoleBySupertokensUserId: vi.fn().mockResolvedValue(dbRole),
  } as unknown as AuthRepository;
}

function guardWithDbRole(dbRole: Role | null): RolesGuard {
  return new RolesGuard(new Reflector(), mockRepo(dbRole));
}

describe('GET /compliance/audit-log/verify — per-route RBAC matrix', () => {
  afterEach(() => vi.clearAllMocks());

  it('sources @Roles() from the shared roleRoutes map (compliance + admin)', () => {
    const fromSharedMap = [...rolesForRoute('/compliance/audit-log/verify')].sort();
    const fromMetadata = [...new Reflector().get<Role[]>(ROLES_KEY, verifyHandler)].sort();
    expect(fromMetadata).toEqual(fromSharedMap);
    expect(fromMetadata).toEqual(['admin', 'compliance']);
  });

  it('compliance → ALLOW (200)', async () => {
    const guard = guardWithDbRole('compliance');
    await expect(guard.canActivate(contextFor(verifyHandler, 'compliance'))).resolves.toBe(true);
  });

  it('admin → ALLOW (200)', async () => {
    const guard = guardWithDbRole('admin');
    await expect(guard.canActivate(contextFor(verifyHandler, 'admin'))).resolves.toBe(true);
  });

  it('advisor → DENY (403 ForbiddenException)', async () => {
    const guard = guardWithDbRole('advisor');
    await expect(guard.canActivate(contextFor(verifyHandler, 'advisor'))).rejects.toBeInstanceOf(
      ForbiddenException
    );
  });

  it('analyst → DENY (403)', async () => {
    const guard = guardWithDbRole('analyst');
    await expect(guard.canActivate(contextFor(verifyHandler, 'analyst'))).rejects.toBeInstanceOf(
      ForbiddenException
    );
  });

  it('unauthenticated (no session) → 401 UnauthorizedException', async () => {
    const guard = guardWithDbRole('admin');
    await expect(guard.canActivate(contextFor(verifyHandler, undefined))).rejects.toBeInstanceOf(
      UnauthorizedException
    );
  });

  it('stale claim=admin but DB role advisor → DENY (DB-authoritative)', async () => {
    const guard = guardWithDbRole('advisor');
    await expect(guard.canActivate(contextFor(verifyHandler, 'admin'))).rejects.toBeInstanceOf(
      ForbiddenException
    );
  });
});

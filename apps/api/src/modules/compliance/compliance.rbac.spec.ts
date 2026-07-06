/**
 * T-2/T-4 — Per-route RBAC enforcement matrix for GET /compliance/summary.
 *
 * This is the ENFORCED-RBAC proof (spec block-2, task 2ecc4a7b). It exercises
 * the REAL RolesGuard against the REAL @Roles() metadata resolved from the
 * ComplianceController handler.
 *
 * ── B-6 hardening under test ────────────────────────────────────────────────
 *   CRITICAL-1 (DB-authoritative role): the guard authorizes off the app-DB
 *   users row via the RLS-EXEMPT path (AuthRepository.resolveRoleRlsExempt →
 *   resolve_user_workspace SECURITY DEFINER fn), NOT the session claim and NOT
 *   the RLS-gated resolveRoleBySupertokensUserId. Tests inject a mock repo and
 *   assert the DB value decides — including the case where the DB role DIFFERS
 *   from the stale claim (DB wins).
 *
 *   CRITICAL-1b (B-6 rework3, P0): the guard MUST call resolveRoleRlsExempt,
 *   NOT resolveRoleBySupertokensUserId. The guard runs PRE-INTERCEPTOR (NestJS
 *   guard-before-interceptor ordering) → ALS empty → no GUC set → under
 *   dealflow_app (NOSUPERUSER FORCE RLS) the direct Drizzle users SELECT
 *   returns 0 rows → null → 403-EVERYTHING. The fault-killing test below
 *   proves the guard calls the RLS-exempt path and FAILS if it regresses to
 *   the RLS-gated resolveRoleBySupertokensUserId.
 *
 *   CRITICAL-2 (fail-closed empty-@Roles): a route with @Roles() PRESENT but
 *   EMPTY denies (403); a route with NO @Roles() decorator at all passes
 *   through (allowlist safety — /auth/*, /health, /auth/me stay ungated).
 *
 * Matrix asserted (DB role drives the decision):
 *   compliance      → allow (guard returns true → handler runs → 200)
 *   admin           → allow (200)
 *   advisor         → deny  (ForbiddenException → 403, no data leak)
 *   analyst         → deny  (403)
 *   unauthenticated → 401   (UnauthorizedException — no session)
 */

import type { Role } from '@dealflow/shared';
import { rolesForRoute } from '@dealflow/shared';
import type { ExecutionContext } from '@nestjs/common';
import { ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { afterEach, describe, expect, it, vi } from 'vitest';

// Mock the SuperTokens session recipe BEFORE importing the guard. The guard
// only calls Session.getSession as a FALLBACK when req.session is absent; our
// tests populate req.session directly, so getSession must never be reached for
// the authenticated cases. We stub it to reject (i.e. "no session") so the
// unauthenticated case (no req.session) maps to 401.
vi.mock('supertokens-node/recipe/session', () => ({
  default: {
    getSession: vi.fn().mockRejectedValue(new Error('no session')),
  },
}));

import type { AuthRepository } from '../auth/auth.repository';
import { ROLES_KEY, RolesGuard } from '../auth/guards/roles.guard';
import { ComplianceController } from './compliance.controller';

// ── Fake ExecutionContext helpers ──────────────────────────────────────────

/** The real handler whose @Roles() metadata the guard reads via Reflector. */
const complianceSummaryHandler = ComplianceController.prototype.getSummary;

const TEST_USER_ID = 'st-user-123';

/**
 * Build an ExecutionContext.
 * @param handler        the route handler (its @Roles() metadata is read)
 * @param claimRole      role present in the session CLAIM (undefined = anon).
 *                       The guard MUST NOT authorize off this — it re-verifies
 *                       against the DB. We still set it so the "DB wins over
 *                       stale claim" test can prove the claim is ignored.
 */
function contextFor(handler: unknown, claimRole: Role | undefined): ExecutionContext {
  // claimRole === undefined models an UNAUTHENTICATED request (no req.session).
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
    getClass: () => ComplianceController,
    switchToHttp: () => ({
      getRequest: () => req,
      getResponse: () => ({}),
    }),
  } as unknown as ExecutionContext;
}

/**
 * Mock AuthRepository for guard tests (B-6 rework3).
 *
 * resolveRoleRlsExempt is the method the guard MUST call (RLS-exempt path,
 * pre-interceptor safe). resolveRoleBySupertokensUserId is the RLS-gated path
 * that must NOT be called by the guard — its spy is used in the fault-killing
 * test to assert it is never reached.
 */
function mockRepo(dbRole: Role | null): AuthRepository {
  return {
    resolveRoleRlsExempt: vi.fn().mockResolvedValue(dbRole),
    resolveRoleBySupertokensUserId: vi.fn().mockResolvedValue(dbRole),
  } as unknown as AuthRepository;
}

/** Guard whose DB re-verify returns `dbRole` for the session user. */
function guardWithDbRole(dbRole: Role | null): RolesGuard {
  return new RolesGuard(new Reflector(), mockRepo(dbRole));
}

describe('GET /compliance/summary — per-route RBAC matrix (DB-authoritative)', () => {
  afterEach(() => vi.clearAllMocks());

  it('sources @Roles() from the shared roleRoutes map (single source of truth)', () => {
    // The controller decorates with rolesForRoute('/compliance/summary'); the
    // metadata the guard reads must equal that shared-map result exactly.
    const fromSharedMap = [...rolesForRoute('/compliance/summary')].sort();
    const fromMetadata = [
      ...new Reflector().get<Role[]>(ROLES_KEY, complianceSummaryHandler),
    ].sort();

    expect(fromMetadata).toEqual(fromSharedMap);
    expect(fromMetadata).toEqual(['admin', 'compliance']);
  });

  it('compliance → ALLOW (200) — DB role compliance', async () => {
    const guard = guardWithDbRole('compliance');
    await expect(
      guard.canActivate(contextFor(complianceSummaryHandler, 'compliance'))
    ).resolves.toBe(true);
  });

  it('admin → ALLOW (200) — DB role admin', async () => {
    const guard = guardWithDbRole('admin');
    await expect(guard.canActivate(contextFor(complianceSummaryHandler, 'admin'))).resolves.toBe(
      true
    );
  });

  it('advisor → DENY (403 ForbiddenException, no data leak) — DB role advisor', async () => {
    const guard = guardWithDbRole('advisor');
    await expect(
      guard.canActivate(contextFor(complianceSummaryHandler, 'advisor'))
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('analyst → DENY (403, not 401; valid session, wrong DB role)', async () => {
    const guard = guardWithDbRole('analyst');
    await expect(
      guard.canActivate(contextFor(complianceSummaryHandler, 'analyst'))
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('no app-DB user row (DB role null) → DENY (403)', async () => {
    const guard = guardWithDbRole(null);
    await expect(
      guard.canActivate(contextFor(complianceSummaryHandler, 'admin'))
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('unauthenticated (no session) → 401 UnauthorizedException', async () => {
    const guard = guardWithDbRole('admin');
    await expect(
      guard.canActivate(contextFor(complianceSummaryHandler, undefined))
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('403 deny body carries NO requested-resource data or role info', () => {
    const body = new ForbiddenException().getResponse() as Record<string, unknown>;
    expect(body.statusCode).toBe(403);
    expect(body.message).toBe('Forbidden');
    for (const key of Object.keys(body)) {
      expect(['statusCode', 'message', 'error']).toContain(key);
    }
    expect(body).not.toHaveProperty('role');
    expect(body).not.toHaveProperty('items');
    expect(body).not.toHaveProperty('pendingCount');
  });
});

// ── CRITICAL-1: DB role is authoritative, NOT the (possibly stale) claim ─────

describe('CRITICAL-1 — guard uses DB role, not the stale session claim', () => {
  afterEach(() => vi.clearAllMocks());

  it('stale claim=admin but DB role downgraded to advisor → DENY (DB wins)', async () => {
    // The claim still says admin (minted at login, never re-verified). The DB
    // was downgraded to advisor. The guard MUST deny — authorizing off the DB.
    const guard = guardWithDbRole('advisor');
    await expect(
      guard.canActivate(contextFor(complianceSummaryHandler, 'admin'))
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('stale claim=advisor but DB role upgraded to compliance → ALLOW (DB wins)', async () => {
    // Inverse: claim is a stale advisor, DB is now compliance → allow off DB.
    const guard = guardWithDbRole('compliance');
    await expect(guard.canActivate(contextFor(complianceSummaryHandler, 'advisor'))).resolves.toBe(
      true
    );
  });

  it('re-verifies against the DB by the SuperTokens user id (same source as /auth/me)', async () => {
    const repo = mockRepo('compliance');
    const guard = new RolesGuard(new Reflector(), repo);
    await guard.canActivate(contextFor(complianceSummaryHandler, 'admin'));
    // B-6 rework3: must call the RLS-EXEMPT path (resolveRoleRlsExempt), not the
    // RLS-gated resolveRoleBySupertokensUserId. Fails if guard regresses.
    expect(repo.resolveRoleRlsExempt).toHaveBeenCalledWith(TEST_USER_ID);
    expect(repo.resolveRoleBySupertokensUserId).not.toHaveBeenCalled();
  });
});

// ── CRITICAL-1b (B-6 rework3, P0): guard calls RLS-EXEMPT path, not RLS-gated ─
//
// FAULT-KILLING: this test fails if the guard regresses to calling
// resolveRoleBySupertokensUserId (the RLS-gated Drizzle path). Under
// dealflow_app (NOSUPERUSER FORCE RLS, pre-interceptor / ALS empty / no GUC),
// the RLS-gated path returns 0 rows → null role → 403-everything.
// The fix routes through resolveRoleRlsExempt → SECURITY DEFINER
// resolve_user_workspace → bypasses FORCE RLS.

describe('CRITICAL-1b (B-6 rework3) — guard calls RLS-exempt path pre-interceptor', () => {
  afterEach(() => vi.clearAllMocks());

  it('calls resolveRoleRlsExempt (not resolveRoleBySupertokensUserId) for the role lookup', async () => {
    // FAULT-KILLING: fails if the guard regresses to the RLS-gated path.
    const repo = mockRepo('compliance');
    const guard = new RolesGuard(new Reflector(), repo);
    await guard.canActivate(contextFor(complianceSummaryHandler, 'compliance'));

    expect(repo.resolveRoleRlsExempt).toHaveBeenCalledOnce();
    expect(repo.resolveRoleRlsExempt).toHaveBeenCalledWith(TEST_USER_ID);
    // The RLS-gated path must NOT be called (would 403-everything under dealflow_app).
    expect(repo.resolveRoleBySupertokensUserId).not.toHaveBeenCalled();
  });

  it('resolveRoleRlsExempt result drives allow/deny (not the session claim or getDb path)', async () => {
    // Verify the resolved value from resolveRoleRlsExempt is what the guard
    // actually authorizes off — not a stale claim or a secondary lookup.
    const repoCompliance = mockRepo('compliance');
    await expect(
      new RolesGuard(new Reflector(), repoCompliance).canActivate(
        contextFor(complianceSummaryHandler, 'advisor') // stale claim = advisor
      )
    ).resolves.toBe(true); // RLS-exempt resolver returned 'compliance' → allow

    const repoAdvisor = mockRepo('advisor');
    await expect(
      new RolesGuard(new Reflector(), repoAdvisor).canActivate(
        contextFor(complianceSummaryHandler, 'compliance') // stale claim = compliance
      )
    ).rejects.toBeInstanceOf(ForbiddenException); // RLS-exempt resolver returned 'advisor' → deny
  });

  it('@Roles()-guarded route allows correct role and denies wrong role under the RLS-exempt path', async () => {
    // Simulate what happens under dealflow_app after the fix:
    // correct role → 200; wrong role → 403 (NOT 403-for-all).
    const allowed: Role[] = ['admin', 'compliance'];
    const denied: Role[] = ['advisor', 'analyst'];

    for (const role of allowed) {
      const repo = mockRepo(role);
      await expect(
        new RolesGuard(new Reflector(), repo).canActivate(
          contextFor(complianceSummaryHandler, role)
        )
      ).resolves.toBe(true);
      // Must use RLS-exempt path.
      expect(repo.resolveRoleRlsExempt).toHaveBeenCalledWith(TEST_USER_ID);
      expect(repo.resolveRoleBySupertokensUserId).not.toHaveBeenCalled();
    }

    for (const role of denied) {
      const repo = mockRepo(role);
      await expect(
        new RolesGuard(new Reflector(), repo).canActivate(
          contextFor(complianceSummaryHandler, role)
        )
      ).rejects.toBeInstanceOf(ForbiddenException);
    }
  });
});

// ── CRITICAL-2: fail-closed on present-but-empty @Roles(); pass-through only
//    when there is NO @Roles() decorator at all (allowlist safety). ───────────

describe('CRITICAL-2 — @Roles() metadata cases', () => {
  afterEach(() => vi.clearAllMocks());

  // A metadata-carrying context whose @Roles() resolves to an EMPTY array,
  // modelling `@Roles(...rolesForRoute('/renamed'))` after config drift.
  function emptyRolesContext(claimRole: Role | undefined): ExecutionContext {
    const ctx = contextFor(() => undefined, claimRole);
    // Overlay the Reflector lookup to return [] (present-but-empty).
    return ctx;
  }

  function guardWithEmptyMetadata(dbRole: Role | null): RolesGuard {
    const reflector = {
      getAllAndOverride: vi.fn().mockReturnValue([]),
    } as unknown as Reflector;
    return new RolesGuard(reflector, mockRepo(dbRole));
  }

  function guardWithNoDecorator(dbRole: Role | null): RolesGuard {
    const reflector = {
      getAllAndOverride: vi.fn().mockReturnValue(undefined),
    } as unknown as Reflector;
    return new RolesGuard(reflector, mockRepo(dbRole));
  }

  it('@Roles() PRESENT but EMPTY → DENY (403, fail-closed on config drift)', async () => {
    const guard = guardWithEmptyMetadata('admin');
    await expect(guard.canActivate(emptyRolesContext('admin'))).rejects.toBeInstanceOf(
      ForbiddenException
    );
  });

  it('empty @Roles() denies EVEN a valid admin (no fail-open to any user)', async () => {
    for (const role of ['advisor', 'analyst', 'compliance', 'admin'] as Role[]) {
      const guard = guardWithEmptyMetadata(role);
      await expect(guard.canActivate(emptyRolesContext(role))).rejects.toBeInstanceOf(
        ForbiddenException
      );
    }
  });

  it('empty @Roles() denies WITHOUT hitting the DB (deny is decided from metadata)', async () => {
    const repo = mockRepo('admin');
    const reflector = {
      getAllAndOverride: vi.fn().mockReturnValue([]),
    } as unknown as Reflector;
    const guard = new RolesGuard(reflector, repo);
    await expect(guard.canActivate(emptyRolesContext('admin'))).rejects.toBeInstanceOf(
      ForbiddenException
    );
    // Fail-closed short-circuits before the DB re-verify.
    expect(repo.resolveRoleBySupertokensUserId).not.toHaveBeenCalled();
  });

  it('NO @Roles() decorator (undefined) → PASS-THROUGH even with no session (login not gated)', async () => {
    const guard = guardWithNoDecorator(null);
    // No session at all — mirrors an anon request to an ungated route.
    await expect(guard.canActivate(emptyRolesContext(undefined))).resolves.toBe(true);
  });

  it('NO @Roles() decorator → PASS-THROUGH for any authenticated role', async () => {
    for (const role of ['advisor', 'analyst', 'compliance', 'admin'] as Role[]) {
      const guard = guardWithNoDecorator(role);
      await expect(guard.canActivate(emptyRolesContext(role))).resolves.toBe(true);
    }
  });

  it('NO @Roles() decorator → PASS-THROUGH without hitting the DB (pure allowlist)', async () => {
    const repo = mockRepo('admin');
    const reflector = {
      getAllAndOverride: vi.fn().mockReturnValue(undefined),
    } as unknown as Reflector;
    const guard = new RolesGuard(reflector, repo);
    await expect(guard.canActivate(emptyRolesContext('admin'))).resolves.toBe(true);
    expect(repo.resolveRoleBySupertokensUserId).not.toHaveBeenCalled();
  });
});

/**
 * T-2/T-4 — Per-route RBAC enforcement matrix for GET /compliance/summary.
 *
 * This is the ENFORCED-RBAC proof (spec block-2, task 2ecc4a7b). It exercises
 * the REAL RolesGuard against the REAL @Roles() metadata resolved from the
 * ComplianceController handler, with the session role mocked (SuperTokens Core
 * is a C-2 runtime dependency — the guard/role LOGIC is what we assert here).
 *
 * Matrix asserted:
 *   compliance      → allow (guard returns true → handler runs → 200)
 *   admin           → allow (200)
 *   advisor         → deny  (ForbiddenException → 403, no data leak)
 *   analyst         → deny  (403)
 *   unauthenticated → 401   (UnauthorizedException — no session)
 *
 * Allowlist safety is asserted separately: the guard is a PASS-THROUGH on a
 * route with NO @Roles() metadata (opt-in enforcement — /auth/*, /health,
 * GET /auth/me stay ungated; the live wave-2 login is not gated).
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

import { RolesGuard } from '../auth/guards/roles.guard';
import { ComplianceController } from './compliance.controller';

// ── Fake ExecutionContext helpers ──────────────────────────────────────────

/** The real handler whose @Roles() metadata the guard reads via Reflector. */
const complianceSummaryHandler = ComplianceController.prototype.getSummary;

function contextFor(handler: unknown, role: Role | undefined): ExecutionContext {
  // role === undefined models an UNAUTHENTICATED request (no req.session).
  const req =
    role === undefined
      ? {}
      : {
          session: {
            getAccessTokenPayload: () => ({ role }),
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

function newGuard(): RolesGuard {
  return new RolesGuard(new Reflector());
}

describe('GET /compliance/summary — per-route RBAC matrix', () => {
  afterEach(() => vi.clearAllMocks());

  it('sources @Roles() from the shared roleRoutes map (single source of truth)', () => {
    // The controller decorates with rolesForRoute('/compliance/summary'); the
    // metadata the guard reads must equal that shared-map result exactly.
    const fromSharedMap = [...rolesForRoute('/compliance/summary')].sort();
    const fromMetadata = [
      ...new Reflector().get<Role[]>('dealflow:required-roles', complianceSummaryHandler),
    ].sort();

    expect(fromMetadata).toEqual(fromSharedMap);
    expect(fromMetadata).toEqual(['admin', 'compliance']);
  });

  it('compliance → ALLOW (200)', async () => {
    const guard = newGuard();
    await expect(
      guard.canActivate(contextFor(complianceSummaryHandler, 'compliance'))
    ).resolves.toBe(true);
  });

  it('admin → ALLOW (200)', async () => {
    const guard = newGuard();
    await expect(guard.canActivate(contextFor(complianceSummaryHandler, 'admin'))).resolves.toBe(
      true
    );
  });

  it('advisor → DENY (403 ForbiddenException, no data leak)', async () => {
    const guard = newGuard();
    await expect(
      guard.canActivate(contextFor(complianceSummaryHandler, 'advisor'))
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('analyst → DENY (403 ForbiddenException, not 401; valid session, wrong role)', async () => {
    const guard = newGuard();
    await expect(
      guard.canActivate(contextFor(complianceSummaryHandler, 'analyst'))
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('unauthenticated (no session) → 401 UnauthorizedException', async () => {
    const guard = newGuard();
    await expect(
      guard.canActivate(contextFor(complianceSummaryHandler, undefined))
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('403 deny body carries NO requested-resource data or role info', () => {
    // NestJS ForbiddenException default response — status + generic message
    // only; no resource payload and no role echoed back. Assert the shape is
    // exactly the safe fields (no leak), regardless of extra generic keys.
    const body = new ForbiddenException().getResponse() as Record<string, unknown>;
    expect(body.statusCode).toBe(403);
    expect(body.message).toBe('Forbidden');
    // No leak: only generic error-envelope keys, never a role/resource field.
    for (const key of Object.keys(body)) {
      expect(['statusCode', 'message', 'error']).toContain(key);
    }
    expect(body).not.toHaveProperty('role');
    expect(body).not.toHaveProperty('items');
    expect(body).not.toHaveProperty('pendingCount');
  });
});

describe('Allowlist safety — RolesGuard is opt-in (no @Roles() → pass-through)', () => {
  afterEach(() => vi.clearAllMocks());

  // A handler with NO @Roles() metadata (models /auth/*, /health, /auth/me).
  function undecoratedHandler(): void {}

  it('undecorated route → guard PASSES THROUGH even with no session (login not gated)', async () => {
    const guard = newGuard();
    // No session at all — mirrors an anon request to an ungated route.
    await expect(guard.canActivate(contextFor(undecoratedHandler, undefined))).resolves.toBe(true);
  });

  it('undecorated route → guard PASSES THROUGH for any authenticated role', async () => {
    const guard = newGuard();
    for (const role of ['advisor', 'analyst', 'compliance', 'admin'] as Role[]) {
      await expect(guard.canActivate(contextFor(undecoratedHandler, role))).resolves.toBe(true);
    }
  });
});

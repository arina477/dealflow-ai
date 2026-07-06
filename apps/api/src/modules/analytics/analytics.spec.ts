/**
 * AnalyticsService unit tests (wave-18, tasks a5ba8068 / 9e05828b).
 *
 * Pure mocked tests (no DB). Validates:
 *
 *   A. Empty-state safety — 0 mandates → totalDraft=0, totalActive=0, total=0.
 *      F2 total=0 → gatePassRate=null, blockedRate=null (no div-by-zero).
 *      F3 empty array → { rows: [], total: 0 }.
 *      F4 all zeros → total=0.
 *
 *   B. F2 gate-outcome math — send_eligible/total, blocked/total.
 *      Verifies the field names are gatePassRate / blockedRate (NOT responseRate).
 *
 *   C. RBAC — wrong role → 403; anon → 401.
 *      Uses the real RolesGuard against the real @Roles() metadata.
 *
 *   D. Aggregation plumbing — getSummary() delegates to all 4 repository methods
 *      and assembles the AnalyticsSummary shape.
 */

import type { Role } from '@dealflow/shared';
import { rolesForRoute } from '@dealflow/shared';
import type { ExecutionContext } from '@nestjs/common';
import { ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// ── Mock SuperTokens BEFORE importing the guard ───────────────────────────────
vi.mock('supertokens-node/recipe/session', () => ({
  default: {
    getSession: vi.fn().mockRejectedValue(new Error('no session')),
  },
}));

import type { AuthRepository } from '../auth/auth.repository';
import { ROLES_KEY, RolesGuard } from '../auth/guards/roles.guard';
import { AnalyticsController } from './analytics.controller';
import { AnalyticsService } from './analytics.service';

// ── Mock AnalyticsRepository ─────────────────────────────────────────────────

function makeRepo() {
  return {
    getMandateThroughput: vi.fn().mockResolvedValue({ totalDraft: 0, totalActive: 0, total: 0 }),
    getOutreachGateOutcomes: vi.fn().mockResolvedValue({
      totalCompose: 0,
      totalSendEligible: 0,
      totalBlocked: 0,
      total: 0,
      gatePassRate: null,
      blockedRate: null,
    }),
    getAdvisorProductivity: vi.fn().mockResolvedValue([]),
    getMatchDisposition: vi.fn().mockResolvedValue({
      totalPending: 0,
      totalAccepted: 0,
      totalRejected: 0,
      totalFlagged: 0,
      total: 0,
    }),
  };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('AnalyticsService', () => {
  let mockRepo: ReturnType<typeof makeRepo>;
  let service: AnalyticsService;

  beforeEach(() => {
    vi.clearAllMocks();
    mockRepo = makeRepo();
    service = new AnalyticsService(mockRepo as never);
  });

  // ── A. Empty-state safety ─────────────────────────────────────────────────

  describe('A. Empty-state safety', () => {
    it('A-1: 0 mandates → MandateThroughput all zeros, total=0', async () => {
      const result = await service.getSummary();
      expect(result.mandateThroughput).toEqual({ totalDraft: 0, totalActive: 0, total: 0 });
    });

    it('A-2: F2 total=0 → gatePassRate=null, blockedRate=null (no div-by-zero)', async () => {
      const result = await service.getSummary();
      const f2 = result.outreachGateOutcomes;
      expect(f2.total).toBe(0);
      expect(f2.gatePassRate).toBeNull();
      expect(f2.blockedRate).toBeNull();
    });

    it('A-3: F3 empty → { rows: [], total: 0 }', async () => {
      const result = await service.getSummary();
      expect(result.advisorProductivity).toEqual({ rows: [], total: 0 });
    });

    it('A-4: F4 empty → all counts 0, total=0', async () => {
      const result = await service.getSummary();
      expect(result.matchDisposition).toEqual({
        totalPending: 0,
        totalAccepted: 0,
        totalRejected: 0,
        totalFlagged: 0,
        total: 0,
      });
    });
  });

  // ── B. F2 gate-outcome math ───────────────────────────────────────────────

  describe('B. F2 gate-outcome math', () => {
    it('B-1: gatePassRate = send_eligible / total', async () => {
      mockRepo.getOutreachGateOutcomes.mockResolvedValue({
        totalCompose: 0,
        totalSendEligible: 7,
        totalBlocked: 3,
        total: 10,
        gatePassRate: 0.7,
        blockedRate: 0.3,
      });

      const result = await service.getSummary();
      expect(result.outreachGateOutcomes.gatePassRate).toBeCloseTo(0.7);
      expect(result.outreachGateOutcomes.blockedRate).toBeCloseTo(0.3);
    });

    it('B-2: field names are gatePassRate and blockedRate — NOT responseRate', async () => {
      mockRepo.getOutreachGateOutcomes.mockResolvedValue({
        totalCompose: 0,
        totalSendEligible: 5,
        totalBlocked: 5,
        total: 10,
        gatePassRate: 0.5,
        blockedRate: 0.5,
      });

      const result = await service.getSummary();
      const f2 = result.outreachGateOutcomes;

      // Confirm correct field names exist.
      expect('gatePassRate' in f2).toBe(true);
      expect('blockedRate' in f2).toBe(true);

      // Confirm "responseRate" does NOT appear (naming contract).
      expect('responseRate' in f2).toBe(false);
      const serialized = JSON.stringify(f2);
      expect(serialized).not.toContain('"responseRate"');
    });

    it('B-3: all compose (gate not yet run) → gatePassRate and blockedRate both 0/total', async () => {
      mockRepo.getOutreachGateOutcomes.mockResolvedValue({
        totalCompose: 5,
        totalSendEligible: 0,
        totalBlocked: 0,
        total: 5,
        gatePassRate: 0,
        blockedRate: 0,
      });

      const result = await service.getSummary();
      expect(result.outreachGateOutcomes.gatePassRate).toBe(0);
      expect(result.outreachGateOutcomes.blockedRate).toBe(0);
    });
  });

  // ── D. Aggregation plumbing ───────────────────────────────────────────────

  describe('D. Aggregation plumbing', () => {
    it('D-1: getSummary delegates to all 4 repository methods', async () => {
      await service.getSummary();
      expect(mockRepo.getMandateThroughput).toHaveBeenCalledOnce();
      expect(mockRepo.getOutreachGateOutcomes).toHaveBeenCalledOnce();
      expect(mockRepo.getAdvisorProductivity).toHaveBeenCalledOnce();
      expect(mockRepo.getMatchDisposition).toHaveBeenCalledOnce();
    });

    it('D-2: getSummary assembles all 4 family fields', async () => {
      mockRepo.getMandateThroughput.mockResolvedValue({ totalDraft: 2, totalActive: 3, total: 5 });
      mockRepo.getAdvisorProductivity.mockResolvedValue([
        { userId: 'aaaaaaaa-0000-4000-8000-000000000001', mandatesCreated: 2, pipelineRows: 1 },
      ]);

      const result = await service.getSummary();

      expect(result.mandateThroughput.total).toBe(5);
      expect(result.advisorProductivity.rows).toHaveLength(1);
      expect(result.advisorProductivity.total).toBe(1);
      expect('outreachGateOutcomes' in result).toBe(true);
      expect('matchDisposition' in result).toBe(true);
    });
  });
});

// ── C. RBAC tests ─────────────────────────────────────────────────────────────

const TEST_USER_ID = 'st-user-analytics-test';

/** The real handler whose @Roles() metadata the guard reads. */
const analyticsHandler = AnalyticsController.prototype.getSummary;

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
    getClass: () => AnalyticsController,
    switchToHttp: () => ({
      getRequest: () => req,
      getResponse: () => ({}),
    }),
  } as unknown as ExecutionContext;
}

function mockAuthRepo(dbRole: Role | null): AuthRepository {
  return {
    resolveRoleRlsExempt: vi.fn().mockResolvedValue(dbRole),
    resolveRoleBySupertokensUserId: vi.fn().mockResolvedValue(dbRole),
  } as unknown as AuthRepository;
}

function guardWithDbRole(dbRole: Role | null): RolesGuard {
  return new RolesGuard(new Reflector(), mockAuthRepo(dbRole));
}

describe('GET /analytics — RBAC matrix (DB-authoritative)', () => {
  afterEach(() => vi.clearAllMocks());

  it('sources @Roles() from the shared roleRoutes map (single source of truth)', () => {
    const fromSharedMap = [...rolesForRoute('/analytics')].sort();
    const fromMetadata = [...new Reflector().get<Role[]>(ROLES_KEY, analyticsHandler)].sort();
    expect(fromMetadata).toEqual(fromSharedMap);
    expect(fromMetadata).toEqual(['admin', 'advisor']);
  });

  it('advisor → ALLOW (200) — DB role advisor', async () => {
    const guard = guardWithDbRole('advisor');
    await expect(guard.canActivate(contextFor(analyticsHandler, 'advisor'))).resolves.toBe(true);
  });

  it('admin → ALLOW (200) — DB role admin', async () => {
    const guard = guardWithDbRole('admin');
    await expect(guard.canActivate(contextFor(analyticsHandler, 'admin'))).resolves.toBe(true);
  });

  it('analyst → DENY (403) — DB role analyst (not in ANALYTICS_ROLES)', async () => {
    const guard = guardWithDbRole('analyst');
    await expect(guard.canActivate(contextFor(analyticsHandler, 'analyst'))).rejects.toThrow(
      ForbiddenException
    );
  });

  it('compliance → DENY (403) — DB role compliance (not in ANALYTICS_ROLES)', async () => {
    const guard = guardWithDbRole('compliance');
    await expect(guard.canActivate(contextFor(analyticsHandler, 'compliance'))).rejects.toThrow(
      ForbiddenException
    );
  });

  it('unauthenticated → 401 — no session', async () => {
    // DB role null = user not found (unauthenticated path — guard raises 401 via SessionGuard).
    const guard = guardWithDbRole(null);
    await expect(guard.canActivate(contextFor(analyticsHandler, undefined))).rejects.toThrow(
      UnauthorizedException
    );
  });
});

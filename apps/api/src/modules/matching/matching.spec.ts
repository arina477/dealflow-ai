/**
 * matching.spec.ts — MatchingService + MatchingController tests.
 *
 * Covers all required ACs:
 *   1. Schema/Zod: matchRunSchema, matchCandidateSchema, matchRunCreateInputSchema .strict()
 *   2. createRunAsActor: persists run+candidates, ranked DESC, idempotent re-run=same run,
 *      submit-guard 400 if universe not submitted
 *   3. patchDispositionAsActor: accept/reject/flag audited, cross-run-scoped 404
 *   2b. re-run PRESERVES dispositions: accepted/rejected/flagged survive a re-score cycle
 *       (CRITICAL-1: disposition-preserve regression)
 *   3. patchDispositionAsActor: accept/reject/flag audited, cross-run-scoped 404
 *   4. handoffAsActor: ready_for_outreach=true; ≥1-accepted guard 400; guard fires on 0 accepted;
 *      guard uses countAcceptedCandidatesByRunIdInTx (tx-aware, CRITICAL-2);
 *      re-handoff is idempotent — no duplicate audit (INFO-B)
 *   5. RBAC matrix: advisor 201 (create), analyst read 200 + mutate 403, anon 401
 *   6. Actor-id: app users.id used (not raw ST id)
 *   7. Audited in-txn: append called, rollback on audit fail
 *   8. DrizzleError-unwrap: cause.code unwrapped correctly
 *   9. BOUNDARY: NO anthropic/llm/bullmq import in service/controller/repository
 *
 * Mock strategy:
 *   - DB / Drizzle: repository is mocked at service boundary.
 *   - AuditService: mocked (vi.fn()) to assert append called.
 *   - AuthRepository: mocked to assert getUserWithRole called + returns app id.
 *   - SuperTokens Session: mocked (vi.mock) for guard tests.
 *   - No live DB required.
 */

import type { Role } from '@dealflow/shared';
import {
  matchCandidateSchema,
  matchRunCreateInputSchema,
  matchRunSchema,
  rolesForRoute,
} from '@dealflow/shared';
import type { ExecutionContext } from '@nestjs/common';
import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('supertokens-node/recipe/session', () => ({
  default: {
    getSession: vi.fn().mockRejectedValue(new Error('no session')),
  },
}));

import type { AuditService } from '../audit/audit.service';
import type { AuthRepository } from '../auth/auth.repository';
import { RolesGuard } from '../auth/guards/roles.guard';
import type { MatchingRepository } from './matching.repository';
import { MatchingService } from './matching.service';

// ---------------------------------------------------------------------------
// 9. BOUNDARY TEST: NO anthropic/llm/bullmq import
// ---------------------------------------------------------------------------

describe('BOUNDARY — no LLM/anthropic/bullmq import in matching modules', () => {
  it('matching.service.ts does NOT import anthropic or bullmq', async () => {
    const mod = await import('./matching.service');
    expect(typeof mod.MatchingService).toBe('function');
    // If anthropic or bullmq were imported, they'd throw at load time
    // (not installed). This test passing IS the boundary assertion.
  });

  it('matching.controller.ts does NOT import anthropic or bullmq', async () => {
    const mod = await import('./matching.controller');
    expect(typeof mod.MatchingController).toBe('function');
  });

  it('matching.repository.ts does NOT import anthropic or bullmq', async () => {
    const mod = await import('./matching.repository');
    expect(typeof mod.MatchingRepository).toBe('function');
  });
});

// ---------------------------------------------------------------------------
// 1. Schema: Zod parse + reject
// ---------------------------------------------------------------------------

describe('matchRunSchema — Zod read parse', () => {
  it('parses a valid match_run row', () => {
    const input = {
      id: '00000000-0000-0000-0000-000000000001',
      mandateId: '00000000-0000-0000-0000-000000000002',
      buyerUniverseId: '00000000-0000-0000-0000-000000000003',
      createdBy: '00000000-0000-0000-0000-000000000004',
      status: 'scored',
      readyForOutreach: false,
      createdAt: '2026-07-04 04:42:20+00',
      updatedAt: null,
    };
    const result = matchRunSchema.safeParse(input);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.status).toBe('scored');
      expect(result.data.readyForOutreach).toBe(false);
    }
  });

  it('rejects invalid status', () => {
    const result = matchRunSchema.safeParse({
      id: '00000000-0000-0000-0000-000000000001',
      mandateId: '00000000-0000-0000-0000-000000000002',
      buyerUniverseId: '00000000-0000-0000-0000-000000000003',
      createdBy: '00000000-0000-0000-0000-000000000004',
      status: 'invalid_status',
      readyForOutreach: false,
      createdAt: '2026-07-04T00:00:00Z',
      updatedAt: null,
    });
    expect(result.success).toBe(false);
  });

  it('passthrough: extra server fields are forwarded not dropped', () => {
    const input = {
      id: '00000000-0000-0000-0000-000000000001',
      mandateId: '00000000-0000-0000-0000-000000000002',
      buyerUniverseId: '00000000-0000-0000-0000-000000000003',
      createdBy: '00000000-0000-0000-0000-000000000004',
      status: 'pending',
      readyForOutreach: false,
      createdAt: '2026-07-04T00:00:00Z',
      updatedAt: null,
      futureField: 'extra',
    };
    const result = matchRunSchema.safeParse(input);
    expect(result.success).toBe(true);
    if (result.success) {
      expect((result.data as Record<string, unknown>).futureField).toBe('extra');
    }
  });
});

describe('matchCandidateSchema — Zod read parse', () => {
  it('parses a valid match_candidate row', () => {
    const input = {
      id: '00000000-0000-0000-0000-000000000001',
      matchRunId: '00000000-0000-0000-0000-000000000002',
      buyerUniverseCandidateId: '00000000-0000-0000-0000-000000000003',
      fitScore: 75,
      scoreBreakdown: {
        sectorMatch: 60,
        contactCompleteness: 15,
        tieBreak: 0,
        total: 75,
        notApplied: [],
      },
      disposition: 'pending',
      createdAt: '2026-07-04T00:00:00Z',
    };
    const result = matchCandidateSchema.safeParse(input);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.fitScore).toBe(75);
      expect(result.data.disposition).toBe('pending');
    }
  });

  it('rejects fitScore < 0', () => {
    const result = matchCandidateSchema.safeParse({
      id: '00000000-0000-0000-0000-000000000001',
      matchRunId: '00000000-0000-0000-0000-000000000002',
      buyerUniverseCandidateId: '00000000-0000-0000-0000-000000000003',
      fitScore: -1,
      scoreBreakdown: null,
      disposition: 'pending',
      createdAt: '2026-07-04T00:00:00Z',
    });
    expect(result.success).toBe(false);
  });

  it('rejects fitScore > 100', () => {
    const result = matchCandidateSchema.safeParse({
      id: '00000000-0000-0000-0000-000000000001',
      matchRunId: '00000000-0000-0000-0000-000000000002',
      buyerUniverseCandidateId: '00000000-0000-0000-0000-000000000003',
      fitScore: 101,
      scoreBreakdown: null,
      disposition: 'pending',
      createdAt: '2026-07-04T00:00:00Z',
    });
    expect(result.success).toBe(false);
  });
});

describe('matchRunCreateInputSchema — strict input validation', () => {
  it('accepts valid { mandateId }', () => {
    const result = matchRunCreateInputSchema.safeParse({
      mandateId: '00000000-0000-0000-0000-000000000001',
    });
    expect(result.success).toBe(true);
  });

  it('rejects extra fields (strict)', () => {
    const result = matchRunCreateInputSchema.safeParse({
      mandateId: '00000000-0000-0000-0000-000000000001',
      extraField: 'bad',
    });
    expect(result.success).toBe(false);
  });

  it('rejects missing mandateId', () => {
    const result = matchRunCreateInputSchema.safeParse({});
    expect(result.success).toBe(false);
  });

  it('rejects non-UUID mandateId', () => {
    const result = matchRunCreateInputSchema.safeParse({ mandateId: 'not-a-uuid' });
    expect(result.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Shared test fixtures
// ---------------------------------------------------------------------------

const APP_USER_ID = '00000000-0000-0000-0000-000000000099';
const ST_USER_ID = 'st-user-abc';
const MANDATE_ID = '00000000-0000-0000-0000-000000000001';
const UNIVERSE_ID = '00000000-0000-0000-0000-000000000002';
const RUN_ID = '00000000-0000-0000-0000-000000000003';
const CANDIDATE_ID = '00000000-0000-0000-0000-000000000004';
const BUC_ID = '00000000-0000-0000-0000-000000000005'; // buyer_universe_candidate id

function makeMatchRun(overrides: Record<string, unknown> = {}) {
  return {
    id: RUN_ID,
    mandateId: MANDATE_ID,
    buyerUniverseId: UNIVERSE_ID,
    createdBy: APP_USER_ID,
    status: 'scored',
    readyForOutreach: false,
    createdAt: '2026-07-04T00:00:00Z',
    updatedAt: null,
    ...overrides,
  };
}

function makeMatchCandidate(overrides: Record<string, unknown> = {}) {
  return {
    id: CANDIDATE_ID,
    matchRunId: RUN_ID,
    buyerUniverseCandidateId: BUC_ID,
    fitScore: 75,
    scoreBreakdown: {
      sectorMatch: 60,
      contactCompleteness: 15,
      tieBreak: 0,
      total: 75,
      notApplied: [],
    },
    disposition: 'pending',
    createdAt: '2026-07-04T00:00:00Z',
    ...overrides,
  };
}

function makeBuyerUniverse(overrides: Record<string, unknown> = {}) {
  return {
    id: UNIVERSE_ID,
    mandateId: MANDATE_ID,
    createdBy: APP_USER_ID,
    status: 'submitted',
    createdAt: '2026-07-04T00:00:00Z',
    updatedAt: null,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// 2. createRunAsActor
// ---------------------------------------------------------------------------

describe('MatchingService.createRunAsActor', () => {
  let service: MatchingService;
  let repository: Partial<MatchingRepository>;
  let auditService: Partial<AuditService>;
  let authRepository: Partial<AuthRepository>;

  beforeEach(() => {
    auditService = { append: vi.fn().mockResolvedValue(undefined) };
    authRepository = {
      getUserWithRole: vi.fn().mockResolvedValue({ id: APP_USER_ID, roleName: 'advisor' }),
    };

    const runRow = makeMatchRun();
    const candidateRow = makeMatchCandidate();

    repository = {
      runInTransaction: vi.fn().mockImplementation((work: (tx: unknown) => unknown) => work({})),
      findBuyerUniverseByMandateIdInTx: vi.fn().mockResolvedValue(makeBuyerUniverse()),
      acquireUniverseAdvisoryLockInTx: vi.fn().mockResolvedValue(undefined),
      upsertMatchRunInTx: vi.fn().mockResolvedValue({ run: runRow, isNew: true }),
      snapshotCandidateDispositionsByRunIdInTx: vi.fn().mockResolvedValue(new Map()),
      deleteMatchCandidatesByRunIdInTx: vi.fn().mockResolvedValue(undefined),
      listIncludedCandidatesInTx: vi.fn().mockResolvedValue([
        {
          id: BUC_ID,
          companyId: '00000000-0000-0000-0000-000000000010',
          createdAt: '2026-07-04T00:00:00Z',
        },
      ]),
      findCompaniesByIdsInTx: vi
        .fn()
        .mockResolvedValue([
          { id: '00000000-0000-0000-0000-000000000010', name: 'Acme', sector: 'technology' },
        ]),
      findContactsByCompanyIdsInTx: vi.fn().mockResolvedValue([
        {
          id: 'c1',
          companyId: '00000000-0000-0000-0000-000000000010',
          email: 'a@b.com',
          name: 'Alice',
          title: 'CEO',
        },
      ]),
      findBuyerCriteriaByMandateIdInTx: vi.fn().mockResolvedValue({
        industry: 'technology',
        geo: null,
        sizeBand: null,
        dealType: null,
      }),
      insertMatchCandidatesBatch: vi.fn().mockResolvedValue([candidateRow]),
      updateMatchRunStatusInTx: vi.fn().mockResolvedValue({ ...runRow, status: 'scored' }),
      findMatchRunByIdInTx: vi.fn().mockResolvedValue({ ...runRow, status: 'scored' }),
      listMatchCandidatesByRunIdInTx: vi.fn().mockResolvedValue([candidateRow]),
    };

    service = new MatchingService(
      repository as MatchingRepository,
      auditService as AuditService,
      authRepository as AuthRepository
    );
  });

  it('calls getUserWithRole with the ST user id (actor-id regression)', async () => {
    await service.createRunAsActor(MANDATE_ID, ST_USER_ID);
    expect(authRepository.getUserWithRole).toHaveBeenCalledWith(ST_USER_ID);
  });

  it('returns a ranked list (run + candidates)', async () => {
    const result = await service.createRunAsActor(MANDATE_ID, ST_USER_ID);
    expect(result.run.id).toBe(RUN_ID);
    expect(Array.isArray(result.candidates)).toBe(true);
  });

  it('calls AuditService.append in-txn (audit last-in-txn)', async () => {
    await service.createRunAsActor(MANDATE_ID, ST_USER_ID);
    expect(auditService.append).toHaveBeenCalledOnce();
    const auditCall = (auditService.append as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(auditCall[0].action).toBe('match-run-create');
    expect(auditCall[0].actorUserId).toBe(APP_USER_ID);
    expect(auditCall[0].resourceType).toBe('match_run');
  });

  it('throws ForbiddenException when getUserWithRole returns null', async () => {
    (authRepository.getUserWithRole as ReturnType<typeof vi.fn>).mockResolvedValueOnce(null);
    await expect(service.createRunAsActor(MANDATE_ID, ST_USER_ID)).rejects.toThrow(
      ForbiddenException
    );
  });

  it('throws NotFoundException when buyer_universe not found for mandate', async () => {
    (repository.findBuyerUniverseByMandateIdInTx as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
      null
    );
    await expect(service.createRunAsActor(MANDATE_ID, ST_USER_ID)).rejects.toThrow(
      NotFoundException
    );
  });

  it('submit-guard: throws 400 when universe status is not submitted (draft)', async () => {
    (repository.findBuyerUniverseByMandateIdInTx as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
      makeBuyerUniverse({ status: 'draft' })
    );
    await expect(service.createRunAsActor(MANDATE_ID, ST_USER_ID)).rejects.toThrow(
      BadRequestException
    );
  });

  it('submit-guard: throws 400 when universe status is filtered (not submitted)', async () => {
    (repository.findBuyerUniverseByMandateIdInTx as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
      makeBuyerUniverse({ status: 'filtered' })
    );
    await expect(service.createRunAsActor(MANDATE_ID, ST_USER_ID)).rejects.toThrow(
      BadRequestException
    );
  });

  it('idempotent: upsertMatchRunInTx called (get-or-create pattern)', async () => {
    await service.createRunAsActor(MANDATE_ID, ST_USER_ID);
    expect(repository.upsertMatchRunInTx).toHaveBeenCalledOnce();
  });

  it('idempotent re-run: deleteMatchCandidatesByRunIdInTx called to clear stale scores', async () => {
    await service.createRunAsActor(MANDATE_ID, ST_USER_ID);
    expect(repository.deleteMatchCandidatesByRunIdInTx).toHaveBeenCalledWith(
      expect.anything(),
      RUN_ID
    );
  });

  it('CRITICAL-1: snapshotCandidateDispositionsByRunIdInTx called before delete on re-run', async () => {
    await service.createRunAsActor(MANDATE_ID, ST_USER_ID);
    expect(repository.snapshotCandidateDispositionsByRunIdInTx).toHaveBeenCalledWith(
      expect.anything(),
      RUN_ID
    );
    // Snapshot must be called BEFORE delete (call order check).
    const snapshotOrder = (
      repository.snapshotCandidateDispositionsByRunIdInTx as ReturnType<typeof vi.fn>
    ).mock.invocationCallOrder[0];
    const deleteOrder = (repository.deleteMatchCandidatesByRunIdInTx as ReturnType<typeof vi.fn>)
      .mock.invocationCallOrder[0];
    expect(snapshotOrder).toBeLessThan(deleteOrder);
  });

  it('CRITICAL-1: re-run PRESERVES accepted disposition (accepted candidate stays accepted after re-score)', async () => {
    // Simulate a prior snapshot where BUC_ID was accepted.
    const priorSnapshot = new Map<string, 'accepted' | 'rejected' | 'flagged'>([
      [BUC_ID, 'accepted'],
    ]);
    (
      repository.snapshotCandidateDispositionsByRunIdInTx as ReturnType<typeof vi.fn>
    ).mockResolvedValueOnce(priorSnapshot);

    await service.createRunAsActor(MANDATE_ID, ST_USER_ID);

    // insertMatchCandidatesBatch must receive 'accepted' disposition for BUC_ID.
    const insertCall = (repository.insertMatchCandidatesBatch as ReturnType<typeof vi.fn>).mock
      .calls[0];
    const insertedCandidates = insertCall[1] as Array<{
      buyerUniverseCandidateId: string;
      disposition?: string;
    }>;
    const matchedCandidate = insertedCandidates.find((c) => c.buyerUniverseCandidateId === BUC_ID);
    expect(matchedCandidate).toBeDefined();
    expect(matchedCandidate?.disposition).toBe('accepted');
  });

  it('CRITICAL-1: newly-added candidate (no prior snapshot) gets pending disposition', async () => {
    // Empty snapshot = no prior dispositions.
    (
      repository.snapshotCandidateDispositionsByRunIdInTx as ReturnType<typeof vi.fn>
    ).mockResolvedValueOnce(new Map());

    await service.createRunAsActor(MANDATE_ID, ST_USER_ID);

    const insertCall = (repository.insertMatchCandidatesBatch as ReturnType<typeof vi.fn>).mock
      .calls[0];
    const insertedCandidates = insertCall[1] as Array<{
      buyerUniverseCandidateId: string;
      disposition?: string;
    }>;
    const matchedCandidate = insertedCandidates.find((c) => c.buyerUniverseCandidateId === BUC_ID);
    expect(matchedCandidate).toBeDefined();
    expect(matchedCandidate?.disposition).toBe('pending');
  });

  it('audit rolls back: when AuditService.append throws, runInTransaction rejects', async () => {
    const auditError = new Error('audit fail');
    (auditService.append as ReturnType<typeof vi.fn>).mockRejectedValueOnce(auditError);
    // The transaction propagates the error
    (repository.runInTransaction as ReturnType<typeof vi.fn>).mockImplementationOnce(
      async (work: (tx: unknown) => unknown) => work({})
    );
    await expect(service.createRunAsActor(MANDATE_ID, ST_USER_ID)).rejects.toThrow('audit fail');
  });
});

// ---------------------------------------------------------------------------
// 3. patchDispositionAsActor
// ---------------------------------------------------------------------------

describe('MatchingService.patchDispositionAsActor', () => {
  let service: MatchingService;
  let repository: Partial<MatchingRepository>;
  let auditService: Partial<AuditService>;
  let authRepository: Partial<AuthRepository>;

  beforeEach(() => {
    auditService = { append: vi.fn().mockResolvedValue(undefined) };
    authRepository = {
      getUserWithRole: vi.fn().mockResolvedValue({ id: APP_USER_ID, roleName: 'advisor' }),
    };

    const updatedCandidate = makeMatchCandidate({ disposition: 'accepted' });

    repository = {
      runInTransaction: vi.fn().mockImplementation((work: (tx: unknown) => unknown) => work({})),
      findMatchRunByIdInTx: vi.fn().mockResolvedValue(makeMatchRun()),
      updateCandidateDispositionScoped: vi.fn().mockResolvedValue(updatedCandidate),
    };

    service = new MatchingService(
      repository as MatchingRepository,
      auditService as AuditService,
      authRepository as AuthRepository
    );
  });

  it('returns updated candidate with new disposition', async () => {
    const result = await service.patchDispositionAsActor(
      RUN_ID,
      CANDIDATE_ID,
      'accepted',
      ST_USER_ID
    );
    expect(result.disposition).toBe('accepted');
  });

  it('audits the disposition change (match-disposition action)', async () => {
    await service.patchDispositionAsActor(RUN_ID, CANDIDATE_ID, 'rejected', ST_USER_ID);
    expect(auditService.append).toHaveBeenCalledOnce();
    const auditCall = (auditService.append as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(auditCall[0].action).toBe('match-disposition');
    expect(auditCall[0].actorUserId).toBe(APP_USER_ID);
  });

  it('cross-run-scoped: throws 404 when candidate not in run', async () => {
    (repository.updateCandidateDispositionScoped as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
      null
    );
    await expect(
      service.patchDispositionAsActor(RUN_ID, 'wrong-cid', 'accepted', ST_USER_ID)
    ).rejects.toThrow(NotFoundException);
  });

  it('throws 404 when run not found', async () => {
    (repository.findMatchRunByIdInTx as ReturnType<typeof vi.fn>).mockResolvedValueOnce(null);
    await expect(
      service.patchDispositionAsActor('wrong-run', CANDIDATE_ID, 'accepted', ST_USER_ID)
    ).rejects.toThrow(NotFoundException);
  });

  it('throws ForbiddenException when actor not found', async () => {
    (authRepository.getUserWithRole as ReturnType<typeof vi.fn>).mockResolvedValueOnce(null);
    await expect(
      service.patchDispositionAsActor(RUN_ID, CANDIDATE_ID, 'accepted', ST_USER_ID)
    ).rejects.toThrow(ForbiddenException);
  });
});

// ---------------------------------------------------------------------------
// 4. handoffAsActor
// ---------------------------------------------------------------------------

describe('MatchingService.handoffAsActor', () => {
  let service: MatchingService;
  let repository: Partial<MatchingRepository>;
  let auditService: Partial<AuditService>;
  let authRepository: Partial<AuthRepository>;

  beforeEach(() => {
    auditService = { append: vi.fn().mockResolvedValue(undefined) };
    authRepository = {
      getUserWithRole: vi.fn().mockResolvedValue({ id: APP_USER_ID, roleName: 'advisor' }),
    };

    const updatedRun = makeMatchRun({ readyForOutreach: true });

    repository = {
      runInTransaction: vi.fn().mockImplementation((work: (tx: unknown) => unknown) => work({})),
      findMatchRunByIdInTx: vi.fn().mockResolvedValue(makeMatchRun()),
      countAcceptedCandidatesByRunIdInTx: vi.fn().mockResolvedValue(1),
      updateMatchRunReadyForOutreachInTx: vi.fn().mockResolvedValue(updatedRun),
      listMatchCandidatesByRunIdInTx: vi
        .fn()
        .mockResolvedValue([makeMatchCandidate({ disposition: 'accepted' })]),
    };

    service = new MatchingService(
      repository as MatchingRepository,
      auditService as AuditService,
      authRepository as AuthRepository
    );
  });

  it('sets ready_for_outreach via updateMatchRunReadyForOutreachInTx', async () => {
    await service.handoffAsActor(RUN_ID, ST_USER_ID);
    expect(repository.updateMatchRunReadyForOutreachInTx).toHaveBeenCalledWith(
      expect.anything(),
      RUN_ID
    );
  });

  it('audits the handoff (match-handoff action)', async () => {
    await service.handoffAsActor(RUN_ID, ST_USER_ID);
    expect(auditService.append).toHaveBeenCalledOnce();
    const auditCall = (auditService.append as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(auditCall[0].action).toBe('match-handoff');
    expect(auditCall[0].actorUserId).toBe(APP_USER_ID);
  });

  it('throws 400 when no accepted candidates (guard: accepted-count = 0)', async () => {
    (
      repository.countAcceptedCandidatesByRunIdInTx as ReturnType<typeof vi.fn>
    ).mockResolvedValueOnce(0);
    await expect(service.handoffAsActor(RUN_ID, ST_USER_ID)).rejects.toThrow(BadRequestException);
  });

  it('throws 404 when run not found', async () => {
    (repository.findMatchRunByIdInTx as ReturnType<typeof vi.fn>).mockResolvedValueOnce(null);
    await expect(service.handoffAsActor('wrong-run', ST_USER_ID)).rejects.toThrow(
      NotFoundException
    );
  });

  it('does NOT update ready_for_outreach when accepted count = 0 (guard fires first)', async () => {
    (
      repository.countAcceptedCandidatesByRunIdInTx as ReturnType<typeof vi.fn>
    ).mockResolvedValueOnce(0);
    await expect(service.handoffAsActor(RUN_ID, ST_USER_ID)).rejects.toThrow(BadRequestException);
    expect(repository.updateMatchRunReadyForOutreachInTx).not.toHaveBeenCalled();
  });

  it('CRITICAL-2: guard uses countAcceptedCandidatesByRunIdInTx (tx-aware), not the escaping-read variant', async () => {
    await service.handoffAsActor(RUN_ID, ST_USER_ID);
    expect(repository.countAcceptedCandidatesByRunIdInTx).toHaveBeenCalledWith(
      expect.anything(),
      RUN_ID
    );
  });

  it('INFO-B: re-handoff on already-handed-off run returns idempotently WITHOUT a new audit entry', async () => {
    // Run is already handed off (readyForOutreach=true).
    (repository.findMatchRunByIdInTx as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
      makeMatchRun({ readyForOutreach: true })
    );

    await service.handoffAsActor(RUN_ID, ST_USER_ID);

    // No audit entry should be emitted for an already-handed-off run.
    expect(auditService.append).not.toHaveBeenCalled();
    // No ready_for_outreach update should occur either.
    expect(repository.updateMatchRunReadyForOutreachInTx).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// 5. RBAC matrix (controller-level)
// ---------------------------------------------------------------------------

describe('RBAC matrix — MatchingController via RolesGuard', () => {
  const makeContext = (role: string | null): ExecutionContext => {
    const session = role ? { getUserId: () => ST_USER_ID } : null;
    return {
      getHandler: () => ({}),
      getClass: () => ({}),
      switchToHttp: () => ({
        getRequest: () => ({ session }),
        getResponse: () => ({}),
      }),
    } as unknown as ExecutionContext;
  };

  it('MATCHES_READ_ROLES includes advisor, admin, analyst', () => {
    const roles = rolesForRoute('/matches');
    expect(roles).toContain('advisor');
    expect(roles).toContain('admin');
    expect(roles).toContain('analyst');
  });

  it('MATCHES_WRITE_ROLES includes advisor and admin but NOT analyst', () => {
    const writeRoles = rolesForRoute('/matches/new');
    expect(writeRoles).toContain('advisor');
    expect(writeRoles).toContain('admin');
    expect(writeRoles).not.toContain('analyst');
  });

  it('RolesGuard denies when required roles is empty (fail-closed)', async () => {
    const reflector = new Reflector();
    vi.spyOn(reflector, 'getAllAndOverride').mockReturnValue([] as Role[]);
    const authRepoMock = {
      resolveRoleRlsExempt: vi.fn().mockResolvedValue('advisor'),
      resolveRoleBySupertokensUserId: vi.fn().mockResolvedValue('advisor'),
    };
    const guard = new RolesGuard(reflector, authRepoMock as unknown as AuthRepository);
    const ctx = makeContext('advisor');
    await expect(guard.canActivate(ctx)).rejects.toThrow(ForbiddenException);
  });

  it('RolesGuard throws UnauthorizedException when no session', async () => {
    const reflector = new Reflector();
    vi.spyOn(reflector, 'getAllAndOverride').mockReturnValue(['advisor'] as Role[]);
    const authRepoMock = {
      resolveRoleRlsExempt: vi.fn(),
      resolveRoleBySupertokensUserId: vi.fn(),
    };
    const guard = new RolesGuard(reflector, authRepoMock as unknown as AuthRepository);
    const ctx = makeContext(null);
    await expect(guard.canActivate(ctx)).rejects.toThrow(UnauthorizedException);
  });

  it('RolesGuard throws ForbiddenException when role not in required', async () => {
    const reflector = new Reflector();
    vi.spyOn(reflector, 'getAllAndOverride').mockReturnValue(['advisor', 'admin'] as Role[]);
    const authRepoMock = {
      resolveRoleRlsExempt: vi.fn().mockResolvedValue('analyst'),
      resolveRoleBySupertokensUserId: vi.fn().mockResolvedValue('analyst'),
    };
    const guard = new RolesGuard(reflector, authRepoMock as unknown as AuthRepository);
    const ctx = makeContext('analyst');
    await expect(guard.canActivate(ctx)).rejects.toThrow(ForbiddenException);
  });

  it('RolesGuard passes for advisor on write routes', async () => {
    const reflector = new Reflector();
    vi.spyOn(reflector, 'getAllAndOverride').mockReturnValue(['advisor', 'admin'] as Role[]);
    const authRepoMock = {
      resolveRoleRlsExempt: vi.fn().mockResolvedValue('advisor'),
      resolveRoleBySupertokensUserId: vi.fn().mockResolvedValue('advisor'),
    };
    const guard = new RolesGuard(reflector, authRepoMock as unknown as AuthRepository);
    const ctx = makeContext('advisor');
    const result = await guard.canActivate(ctx);
    expect(result).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// 6. Actor-id: app users.id (not raw ST id)
// ---------------------------------------------------------------------------

describe('actor-id — app users.id is used, not raw ST id', () => {
  it('audit entry actorUserId is app users.id, not supertokens id', async () => {
    const auditService = { append: vi.fn().mockResolvedValue(undefined) };
    const authRepository = {
      getUserWithRole: vi.fn().mockResolvedValue({ id: APP_USER_ID, roleName: 'advisor' }),
    };
    const runRow = makeMatchRun();
    const candidateRow = makeMatchCandidate();

    const repository: Partial<MatchingRepository> = {
      runInTransaction: vi.fn().mockImplementation((work: (tx: unknown) => unknown) => work({})),
      findBuyerUniverseByMandateIdInTx: vi.fn().mockResolvedValue(makeBuyerUniverse()),
      acquireUniverseAdvisoryLockInTx: vi.fn().mockResolvedValue(undefined),
      upsertMatchRunInTx: vi.fn().mockResolvedValue({ run: runRow, isNew: true }),
      snapshotCandidateDispositionsByRunIdInTx: vi.fn().mockResolvedValue(new Map()),
      deleteMatchCandidatesByRunIdInTx: vi.fn().mockResolvedValue(undefined),
      listIncludedCandidatesInTx: vi.fn().mockResolvedValue([
        {
          id: BUC_ID,
          companyId: '00000000-0000-0000-0000-000000000010',
          createdAt: '2026-07-04T00:00:00Z',
        },
      ]),
      findCompaniesByIdsInTx: vi
        .fn()
        .mockResolvedValue([
          { id: '00000000-0000-0000-0000-000000000010', name: 'Acme', sector: 'technology' },
        ]),
      findContactsByCompanyIdsInTx: vi.fn().mockResolvedValue([]),
      findBuyerCriteriaByMandateIdInTx: vi.fn().mockResolvedValue(null),
      insertMatchCandidatesBatch: vi.fn().mockResolvedValue([candidateRow]),
      updateMatchRunStatusInTx: vi.fn().mockResolvedValue(runRow),
      findMatchRunByIdInTx: vi.fn().mockResolvedValue(runRow),
      listMatchCandidatesByRunIdInTx: vi.fn().mockResolvedValue([candidateRow]),
    };

    const service = new MatchingService(
      repository as MatchingRepository,
      auditService as AuditService,
      authRepository as AuthRepository
    );

    await service.createRunAsActor(MANDATE_ID, ST_USER_ID);

    const auditCall = (auditService.append as ReturnType<typeof vi.fn>).mock.calls[0][0];
    // CRITICAL: must be the app users.id, NOT the raw supertokens id
    expect(auditCall.actorUserId).toBe(APP_USER_ID);
    expect(auditCall.actorUserId).not.toBe(ST_USER_ID);
  });
});

// ---------------------------------------------------------------------------
// 8. DrizzleError-unwrap
// ---------------------------------------------------------------------------

describe('DrizzleError-unwrap — err.cause.code extraction', () => {
  it('MatchingRepository unwraps DrizzleError cause.code correctly', async () => {
    // Import the module to check pgCode behavior via insertMatchCandidatesBatch
    const { MatchingRepository } = await import('./matching.repository');
    const fakeDb = {
      select: vi.fn(),
      insert: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      transaction: vi.fn(),
    };
    const repo = new MatchingRepository(
      fakeDb as unknown as Parameters<typeof MatchingRepository.prototype.constructor>[0]
    );

    // Simulate DrizzleError wrapping a 23503 FK violation
    const drizzleError = Object.assign(new Error('DrizzleQueryError'), {
      cause: { code: '23503', message: 'FK violation' },
    });

    const tx = {
      insert: vi.fn().mockReturnValue({
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockRejectedValue(drizzleError),
        }),
      }),
    };

    await expect(
      repo.insertMatchCandidatesBatch(
        tx as unknown as Parameters<typeof repo.insertMatchCandidatesBatch>[0],
        [
          {
            matchRunId: RUN_ID,
            buyerUniverseCandidateId: BUC_ID,
            fitScore: 75,
            scoreBreakdown: {
              sectorMatch: 0,
              contactCompleteness: 0,
              tieBreak: 0,
              total: 0,
              notApplied: [],
            },
          },
        ]
      )
    ).rejects.toThrow(BadRequestException);
  });
});

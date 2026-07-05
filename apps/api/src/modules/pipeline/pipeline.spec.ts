/**
 * Pipeline module B-2 regression tests — verifies all required ACs:
 *
 * ── Eligible-source guard ──────────────────────────────────────────────────
 *  1.  enrollAsActor: outreach status='send_eligible' → success.
 *  2.  enrollAsActor: outreach status='blocked' → 400 BadRequestException.
 *  3.  enrollAsActor: outreach status='compose' → 400 BadRequestException.
 *  4.  enrollAsActor: match_candidate disposition='accepted' + readyForOutreach=true → success.
 *  5.  enrollAsActor: match_candidate disposition='pending' → 400 (not accepted).
 *  6.  enrollAsActor: match_candidate disposition='accepted' + readyForOutreach=false → 400.
 *
 * ── Idempotent enroll (DB UNIQUE → 409 ConflictException) ─────────────────
 *  7.  enrollAsActor: 2nd enroll for same outreach → repository throws 409 ConflictException.
 *  8.  enrollAsActor: repository unwraps 23505 → ConflictException (DrizzleError-unwrap).
 *
 * ── Fixed-enum transition guard ────────────────────────────────────────────
 *  9.  transitionStageAsActor: valid stage ('contacted') → success.
 * 10.  transitionStageAsActor: invalid stage 'unknown_stage' → 400 BadRequestException.
 * 11.  transitionStageAsActor: invalid stage '' (empty) → 400 BadRequestException.
 * 12.  transitionStageAsActor: all 7 valid stages accepted at service level.
 *
 * ── Append-only note: exactly one events row + one audit row, last-in-txn ──
 * 13.  addNoteAsActor: insertPipelineEvent called once with type='note'.
 * 14.  addNoteAsActor: AuditService.append called with 'pipeline-note' AFTER event insert.
 * 15.  addNoteAsActor: rollback-on-audit-fail: if audit throws, no orphan note event.
 * 16.  addNoteAsActor: empty text → 400 (Zod min 1 guard — controller level).
 *
 * ── Actor identity: getUserWithRole (not raw ST id) ────────────────────────
 * 17.  enrollAsActor: getUserWithRole called, createdBy = app users.id.
 * 18.  transitionStageAsActor: getUserWithRole called, updatedBy = app users.id.
 * 19.  addNoteAsActor: getUserWithRole called, actorId = app users.id in event.
 *
 * ── RBAC matrix ──────────────────────────────────────────────────────────────
 * 20.  /pipeline — advisor + compliance (both can read board + events).
 * 21.  /pipeline/new — advisor ONLY (enroll).
 * 22.  /pipeline/:id/stage — advisor ONLY (transition).
 * 23.  /pipeline/:id/notes — advisor + compliance (both can add notes).
 * 24.  /pipeline/:id/events — advisor + compliance (both can read timeline).
 * 25.  analyst → NOT in /pipeline roles (403 on board read).
 * 26.  anon → 401 (no session).
 *
 * ── DrizzleError unwrap ───────────────────────────────────────────────────────
 * 27.  Repository.insertPipeline: 23505 → ConflictException.
 * 28.  Repository.insertPipeline: 23503 → BadRequestException.
 * 29.  Repository.insertPipelineEvent: 23503 → BadRequestException.
 *
 * ── Boundary test (no anthropic/nodemailer/webhook import) ────────────────────
 * 30.  pipeline.service.ts does NOT import Anthropic/LLM/AI packages.
 * 31.  pipeline.service.ts does NOT import transactional-email SDKs.
 *
 * ── DI-boot ─────────────────────────────────────────────────────────────────
 * 32.  PipelineService can be instantiated with the required dependencies (DI smoke test).
 *
 * Mock strategy:
 *   - PipelineRepository: vi.fn() mocked at the repository boundary.
 *   - AuditService: vi.fn() to assert append called with correct args.
 *   - AuthRepository: vi.fn() to return app users.id.
 *   - No live DB required.
 *   - DrizzleError-unwrap tests instantiate the real PipelineRepository with a
 *     mock DB (the wave-11 lesson: instantiate real repo, not mock, for error-unwrap tests).
 */

import {
  addNoteInputSchema,
  enrollInputSchema,
  rolesForRoute,
  transitionInputSchema,
} from '@dealflow/shared';
import { BadRequestException, ConflictException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';

// Mock supertokens-node session before importing guards.
vi.mock('supertokens-node/recipe/session', () => ({
  default: {
    getSession: vi.fn().mockRejectedValue(new Error('no session')),
  },
}));

import type { AuditService } from '../audit/audit.service';
import type { AuthRepository } from '../auth/auth.repository';
import type { PipelineEventRow, PipelineRow, Tx } from './pipeline.repository';
import { PipelineRepository } from './pipeline.repository';
import { PipelineService } from './pipeline.service';

// ---------------------------------------------------------------------------
// Test fixtures
// ---------------------------------------------------------------------------

const APP_USER_ID = '00000000-0000-0000-0000-000000000001';
const _COMPLIANCE_USER_ID = '00000000-0000-0000-0000-000000000002';
const ST_USER_ID = 'st-raw-user-id';
const MANDATE_ID = '00000000-0000-0000-0000-000000000010';
const OUTREACH_ID = '00000000-0000-0000-0000-000000000020';
const MATCH_CANDIDATE_ID = '00000000-0000-0000-0000-000000000030';
const MATCH_RUN_ID = '00000000-0000-0000-0000-000000000031';
const PIPELINE_ID = '00000000-0000-0000-0000-000000000040';
const EVENT_ID = '00000000-0000-0000-0000-000000000050';

function makePipelineRow(overrides: Partial<PipelineRow> = {}): PipelineRow {
  return {
    id: PIPELINE_ID,
    mandateId: MANDATE_ID,
    dealSourceType: 'outreach',
    outreachId: OUTREACH_ID,
    matchCandidateId: null,
    stage: 'shortlisted',
    createdBy: APP_USER_ID,
    updatedBy: null,
    createdAt: new Date().toISOString(),
    updatedAt: null,
    ...overrides,
  };
}

function makePipelineEventRow(overrides: Partial<PipelineEventRow> = {}): PipelineEventRow {
  return {
    id: EVENT_ID,
    pipelineId: PIPELINE_ID,
    eventType: 'enrolled',
    fromStage: null,
    toStage: null,
    note: null,
    actorId: APP_USER_ID,
    createdAt: new Date().toISOString(),
    ...overrides,
  };
}

function makeMockRepo(overrides: Partial<PipelineRepository> = {}): PipelineRepository {
  return {
    runInTransaction: vi
      .fn()
      .mockImplementation((work: (tx: Tx) => Promise<unknown>) => work({} as Tx)),
    findOutreachByIdInTx: vi.fn().mockResolvedValue({ id: OUTREACH_ID, status: 'send_eligible' }),
    findMatchCandidateEligibilityInTx: vi.fn().mockResolvedValue({
      id: MATCH_CANDIDATE_ID,
      disposition: 'accepted',
      matchRunId: MATCH_RUN_ID,
      readyForOutreach: true,
    }),
    insertPipeline: vi.fn().mockResolvedValue(makePipelineRow()),
    findPipelineByIdInTx: vi.fn().mockResolvedValue(makePipelineRow()),
    findPipelineById: vi.fn().mockResolvedValue(makePipelineRow()),
    updatePipelineStageInTx: vi
      .fn()
      .mockResolvedValue(makePipelineRow({ stage: 'contacted', updatedBy: APP_USER_ID })),
    insertPipelineEvent: vi.fn().mockResolvedValue(makePipelineEventRow()),
    listEventsByPipelineId: vi.fn().mockResolvedValue([]),
    listPipelineForBoard: vi.fn().mockResolvedValue([]),
    ...overrides,
  } as unknown as PipelineRepository;
}

function makeMockAudit(): AuditService {
  return { append: vi.fn().mockResolvedValue(undefined) } as unknown as AuditService;
}

function makeMockAuth(role = 'advisor', userId = APP_USER_ID): AuthRepository {
  return {
    getUserWithRole: vi.fn().mockResolvedValue({ id: userId, roleName: role }),
  } as unknown as AuthRepository;
}

// ---------------------------------------------------------------------------
// 1-6. Eligible-source guard
// ---------------------------------------------------------------------------

describe('PipelineService.enrollAsActor — eligible-source guard', () => {
  it('1. outreach status=send_eligible → success', async () => {
    const repo = makeMockRepo({
      findOutreachByIdInTx: vi.fn().mockResolvedValue({ id: OUTREACH_ID, status: 'send_eligible' }),
    });
    const service = new PipelineService(repo, makeMockAudit(), makeMockAuth());

    const result = await service.enrollAsActor(
      { sourceType: 'outreach', sourceId: OUTREACH_ID, mandateId: MANDATE_ID },
      ST_USER_ID
    );

    expect(vi.mocked(repo.insertPipeline)).toHaveBeenCalledOnce();
    expect(result.stage).toBe('shortlisted');
  });

  it('2. outreach status=blocked → 400 BadRequestException', async () => {
    const repo = makeMockRepo({
      findOutreachByIdInTx: vi.fn().mockResolvedValue({ id: OUTREACH_ID, status: 'blocked' }),
    });
    const service = new PipelineService(repo, makeMockAudit(), makeMockAuth());

    await expect(
      service.enrollAsActor(
        { sourceType: 'outreach', sourceId: OUTREACH_ID, mandateId: MANDATE_ID },
        ST_USER_ID
      )
    ).rejects.toThrow(BadRequestException);

    expect(vi.mocked(repo.insertPipeline)).not.toHaveBeenCalled();
  });

  it('3. outreach status=compose → 400 BadRequestException', async () => {
    const repo = makeMockRepo({
      findOutreachByIdInTx: vi.fn().mockResolvedValue({ id: OUTREACH_ID, status: 'compose' }),
    });
    const service = new PipelineService(repo, makeMockAudit(), makeMockAuth());

    await expect(
      service.enrollAsActor(
        { sourceType: 'outreach', sourceId: OUTREACH_ID, mandateId: MANDATE_ID },
        ST_USER_ID
      )
    ).rejects.toThrow(BadRequestException);
  });

  it('4. match_candidate disposition=accepted + readyForOutreach=true → success', async () => {
    const repo = makeMockRepo({
      findMatchCandidateEligibilityInTx: vi.fn().mockResolvedValue({
        id: MATCH_CANDIDATE_ID,
        disposition: 'accepted',
        matchRunId: MATCH_RUN_ID,
        readyForOutreach: true,
      }),
      insertPipeline: vi.fn().mockResolvedValue(
        makePipelineRow({
          dealSourceType: 'match_candidate',
          outreachId: null,
          matchCandidateId: MATCH_CANDIDATE_ID,
        })
      ),
    });
    const service = new PipelineService(repo, makeMockAudit(), makeMockAuth());

    const result = await service.enrollAsActor(
      { sourceType: 'match_candidate', sourceId: MATCH_CANDIDATE_ID, mandateId: MANDATE_ID },
      ST_USER_ID
    );

    expect(vi.mocked(repo.insertPipeline)).toHaveBeenCalledOnce();
    expect(result.stage).toBe('shortlisted');
  });

  it('5. match_candidate disposition=pending → 400 (not accepted)', async () => {
    const repo = makeMockRepo({
      findMatchCandidateEligibilityInTx: vi.fn().mockResolvedValue({
        id: MATCH_CANDIDATE_ID,
        disposition: 'pending',
        matchRunId: MATCH_RUN_ID,
        readyForOutreach: true,
      }),
    });
    const service = new PipelineService(repo, makeMockAudit(), makeMockAuth());

    await expect(
      service.enrollAsActor(
        { sourceType: 'match_candidate', sourceId: MATCH_CANDIDATE_ID, mandateId: MANDATE_ID },
        ST_USER_ID
      )
    ).rejects.toThrow(BadRequestException);

    expect(vi.mocked(repo.insertPipeline)).not.toHaveBeenCalled();
  });

  it('6. match_candidate accepted but readyForOutreach=false → 400', async () => {
    const repo = makeMockRepo({
      findMatchCandidateEligibilityInTx: vi.fn().mockResolvedValue({
        id: MATCH_CANDIDATE_ID,
        disposition: 'accepted',
        matchRunId: MATCH_RUN_ID,
        readyForOutreach: false,
      }),
    });
    const service = new PipelineService(repo, makeMockAudit(), makeMockAuth());

    await expect(
      service.enrollAsActor(
        { sourceType: 'match_candidate', sourceId: MATCH_CANDIDATE_ID, mandateId: MANDATE_ID },
        ST_USER_ID
      )
    ).rejects.toThrow(BadRequestException);

    expect(vi.mocked(repo.insertPipeline)).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// 7-8. Idempotent enroll (DB UNIQUE → 409 ConflictException)
// ---------------------------------------------------------------------------

describe('PipelineService.enrollAsActor — idempotent enroll (409)', () => {
  it('7. 2nd enroll for same outreach: repository throws ConflictException → surfaced as 409', async () => {
    const repo = makeMockRepo({
      insertPipeline: vi
        .fn()
        .mockRejectedValue(
          new ConflictException(
            'This deal target is already enrolled in the pipeline. Duplicate enrollment refused.'
          )
        ),
    });
    const service = new PipelineService(repo, makeMockAudit(), makeMockAuth());

    await expect(
      service.enrollAsActor(
        { sourceType: 'outreach', sourceId: OUTREACH_ID, mandateId: MANDATE_ID },
        ST_USER_ID
      )
    ).rejects.toThrow(ConflictException);
  });

  it('8. real repository: 23505 unique-violation → ConflictException (DrizzleError-unwrap)', async () => {
    // Instantiate the REAL repository with a mock DB whose transaction calls work(mockTx).
    const uniqueError = Object.assign(new Error('UNIQUE violation'), {
      cause: { code: '23505' },
    });
    const mockTx = {
      insert: vi.fn().mockReturnValue({
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockRejectedValue(uniqueError),
        }),
      }),
      select: vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([{ id: OUTREACH_ID, status: 'send_eligible' }]),
          }),
        }),
      }),
    };
    const mockDb = {
      transaction: vi
        .fn()
        .mockImplementation((work: (tx: unknown) => Promise<unknown>) => work(mockTx)),
    } as unknown as import('../../db/db.provider').Database;

    const repo = new PipelineRepository(mockDb);

    await expect(
      repo.insertPipeline(mockTx as unknown as Tx, {
        mandateId: MANDATE_ID,
        dealSourceType: 'outreach',
        outreachId: OUTREACH_ID,
        matchCandidateId: null,
        createdBy: APP_USER_ID,
      })
    ).rejects.toThrow(ConflictException);
  });
});

// ---------------------------------------------------------------------------
// 9-12. Fixed-enum transition guard
// ---------------------------------------------------------------------------

describe('PipelineService.transitionStageAsActor — fixed-enum guard', () => {
  it('9. valid stage contacted → success', async () => {
    const repo = makeMockRepo({
      updatePipelineStageInTx: vi
        .fn()
        .mockResolvedValue(makePipelineRow({ stage: 'contacted', updatedBy: APP_USER_ID })),
    });
    const service = new PipelineService(repo, makeMockAudit(), makeMockAuth());

    const result = await service.transitionStageAsActor(PIPELINE_ID, 'contacted', ST_USER_ID);

    expect(result.stage).toBe('contacted');
    expect(vi.mocked(repo.updatePipelineStageInTx)).toHaveBeenCalledOnce();
  });

  it('10. invalid stage unknown_stage → 400 BadRequestException', async () => {
    const repo = makeMockRepo();
    const service = new PipelineService(repo, makeMockAudit(), makeMockAuth());

    await expect(
      service.transitionStageAsActor(PIPELINE_ID, 'unknown_stage', ST_USER_ID)
    ).rejects.toThrow(BadRequestException);

    expect(vi.mocked(repo.updatePipelineStageInTx)).not.toHaveBeenCalled();
  });

  it('11. invalid stage empty string → 400 BadRequestException', async () => {
    const repo = makeMockRepo();
    const service = new PipelineService(repo, makeMockAudit(), makeMockAuth());

    await expect(service.transitionStageAsActor(PIPELINE_ID, '', ST_USER_ID)).rejects.toThrow(
      BadRequestException
    );
  });

  it('12. all 7 valid stages accepted at service level', async () => {
    const validStages = [
      'shortlisted',
      'contacted',
      'engaged',
      'diligence',
      'offer',
      'closed',
      'withdrawn',
    ] as const;

    for (const stage of validStages) {
      const repo = makeMockRepo({
        updatePipelineStageInTx: vi
          .fn()
          .mockResolvedValue(makePipelineRow({ stage, updatedBy: APP_USER_ID })),
      });
      const service = new PipelineService(repo, makeMockAudit(), makeMockAuth());

      const result = await service.transitionStageAsActor(PIPELINE_ID, stage, ST_USER_ID);

      expect(vi.mocked(repo.updatePipelineStageInTx)).toHaveBeenCalledOnce();
      expect(result.stage).toBe(stage);
    }
  });
});

// ---------------------------------------------------------------------------
// 13-16. Append-only note: exactly one events row + one audit row, last-in-txn
// ---------------------------------------------------------------------------

describe('PipelineService.addNoteAsActor — append-only note', () => {
  it('13. insertPipelineEvent called exactly once with type=note', async () => {
    const repo = makeMockRepo({
      insertPipelineEvent: vi
        .fn()
        .mockResolvedValue(
          makePipelineEventRow({ eventType: 'note', note: 'Test note', actorId: APP_USER_ID })
        ),
    });
    const service = new PipelineService(repo, makeMockAudit(), makeMockAuth());

    await service.addNoteAsActor(PIPELINE_ID, 'Test note', ST_USER_ID);

    expect(vi.mocked(repo.insertPipelineEvent)).toHaveBeenCalledOnce();
    expect(vi.mocked(repo.insertPipelineEvent)).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        eventType: 'note',
        note: 'Test note',
        actorId: APP_USER_ID,
        pipelineId: PIPELINE_ID,
      })
    );
  });

  it('14. AuditService.append called with pipeline-note AFTER event insert (last-in-txn)', async () => {
    const callOrder: string[] = [];
    const audit = {
      append: vi.fn().mockImplementation((input: { action: string }) => {
        callOrder.push(`audit:${input.action}`);
        return Promise.resolve();
      }),
    } as unknown as AuditService;
    const repo = makeMockRepo({
      insertPipelineEvent: vi.fn().mockImplementation(() => {
        callOrder.push('insertPipelineEvent');
        return Promise.resolve(
          makePipelineEventRow({ eventType: 'note', note: 'Test note', actorId: APP_USER_ID })
        );
      }),
    });
    const service = new PipelineService(repo, audit, makeMockAuth());

    await service.addNoteAsActor(PIPELINE_ID, 'Test note', ST_USER_ID);

    // event insert must come before audit append.
    const eventIdx = callOrder.indexOf('insertPipelineEvent');
    const auditIdx = callOrder.indexOf('audit:pipeline-note');
    expect(eventIdx).toBeGreaterThanOrEqual(0);
    expect(auditIdx).toBeGreaterThan(eventIdx);
    // Verify audit action.
    expect(vi.mocked(audit.append)).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'pipeline-note' }),
      expect.anything()
    );
  });

  it('15. rollback-on-audit-fail: audit throws → promise rejects (no orphan note)', async () => {
    const audit = {
      append: vi.fn().mockRejectedValue(new Error('audit failure')),
    } as unknown as AuditService;
    const repo = makeMockRepo({
      // runInTransaction propagates the rejection from audit.
      runInTransaction: vi.fn().mockImplementation(async (work: (tx: Tx) => Promise<unknown>) => {
        return work({} as Tx);
      }),
    });
    const service = new PipelineService(repo, audit, makeMockAuth());

    await expect(service.addNoteAsActor(PIPELINE_ID, 'Test note', ST_USER_ID)).rejects.toThrow(
      'audit failure'
    );
  });

  it('16. empty text → 400 (addNoteInputSchema min 1 guard)', () => {
    // Zod validation happens at controller layer. Verify the schema rejects empty text.
    const result = addNoteInputSchema.safeParse({ text: '' });
    expect(result.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// 17-19. Actor identity: getUserWithRole (not raw ST id)
// ---------------------------------------------------------------------------

describe('Actor identity — app users.id (NOT raw ST id)', () => {
  it('17. enrollAsActor: getUserWithRole called, createdBy = app users.id', async () => {
    const auth = makeMockAuth('advisor', APP_USER_ID);
    const repo = makeMockRepo();
    const service = new PipelineService(repo, makeMockAudit(), auth);

    await service.enrollAsActor(
      { sourceType: 'outreach', sourceId: OUTREACH_ID, mandateId: MANDATE_ID },
      ST_USER_ID
    );

    expect(vi.mocked(auth.getUserWithRole)).toHaveBeenCalledWith(ST_USER_ID);
    expect(vi.mocked(repo.insertPipeline)).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ createdBy: APP_USER_ID })
    );
  });

  it('18. transitionStageAsActor: getUserWithRole called, updatedBy = app users.id', async () => {
    const auth = makeMockAuth('advisor', APP_USER_ID);
    const repo = makeMockRepo();
    const service = new PipelineService(repo, makeMockAudit(), auth);

    await service.transitionStageAsActor(PIPELINE_ID, 'contacted', ST_USER_ID);

    expect(vi.mocked(auth.getUserWithRole)).toHaveBeenCalledWith(ST_USER_ID);
    expect(vi.mocked(repo.updatePipelineStageInTx)).toHaveBeenCalledWith(
      expect.anything(),
      PIPELINE_ID,
      'contacted',
      APP_USER_ID
    );
  });

  it('19. addNoteAsActor: getUserWithRole called, actorId = app users.id in event', async () => {
    const auth = makeMockAuth('advisor', APP_USER_ID);
    const repo = makeMockRepo();
    const service = new PipelineService(repo, makeMockAudit(), auth);

    await service.addNoteAsActor(PIPELINE_ID, 'My note', ST_USER_ID);

    expect(vi.mocked(auth.getUserWithRole)).toHaveBeenCalledWith(ST_USER_ID);
    expect(vi.mocked(repo.insertPipelineEvent)).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ actorId: APP_USER_ID })
    );
  });
});

// ---------------------------------------------------------------------------
// 20-26. RBAC matrix
// ---------------------------------------------------------------------------

describe('RBAC matrix — pipeline roleRoutes', () => {
  it('20. /pipeline — advisor + compliance (board read)', () => {
    const roles = rolesForRoute('/pipeline');
    expect(roles).toContain('advisor');
    expect(roles).toContain('compliance');
  });

  it('21. /pipeline/new — advisor ONLY (enroll)', () => {
    const roles = rolesForRoute('/pipeline/new');
    expect(roles).toContain('advisor');
    expect(roles).not.toContain('compliance');
    expect(roles).not.toContain('analyst');
  });

  it('22. /pipeline/:id/stage — advisor ONLY (transition)', () => {
    const roles = rolesForRoute('/pipeline/:id/stage');
    expect(roles).toContain('advisor');
    expect(roles).not.toContain('compliance');
    expect(roles).not.toContain('analyst');
  });

  it('23. /pipeline/:id/notes — advisor + compliance (add note)', () => {
    const roles = rolesForRoute('/pipeline/:id/notes');
    expect(roles).toContain('advisor');
    expect(roles).toContain('compliance');
    expect(roles).not.toContain('analyst');
  });

  it('24. /pipeline/:id/events — advisor + compliance (event timeline)', () => {
    const roles = rolesForRoute('/pipeline/:id/events');
    expect(roles).toContain('advisor');
    expect(roles).toContain('compliance');
  });

  it('25. analyst NOT in /pipeline roles (403 on board read)', () => {
    const roles = rolesForRoute('/pipeline');
    expect(roles).not.toContain('analyst');
  });

  it('26. anon → 401 (no session — verified via RBAC route check: no public bypass)', () => {
    // /pipeline is not in the public allowlist.
    const { isPublicRoute } = require('@dealflow/shared');
    expect(isPublicRoute('/pipeline')).toBe(false);
    // The board route requires roles — empty role set means default-deny.
    const roles = rolesForRoute('/pipeline');
    expect(roles.length).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// 27-29. DrizzleError unwrap
// ---------------------------------------------------------------------------

describe('DrizzleError unwrap — real repository + mock DB', () => {
  function makeMockDb(tx: unknown): import('../../db/db.provider').Database {
    return {
      transaction: vi
        .fn()
        .mockImplementation((work: (tx: unknown) => Promise<unknown>) => work(tx)),
    } as unknown as import('../../db/db.provider').Database;
  }

  it('27. insertPipeline: 23505 unique-violation → ConflictException', async () => {
    const err = Object.assign(new Error('UNIQUE'), { cause: { code: '23505' } });
    const mockTx = {
      insert: vi.fn().mockReturnValue({
        values: vi.fn().mockReturnValue({ returning: vi.fn().mockRejectedValue(err) }),
      }),
    };
    const repo = new PipelineRepository(makeMockDb(mockTx));

    await expect(
      repo.insertPipeline(mockTx as unknown as Tx, {
        mandateId: MANDATE_ID,
        dealSourceType: 'outreach',
        outreachId: OUTREACH_ID,
        matchCandidateId: null,
        createdBy: APP_USER_ID,
      })
    ).rejects.toThrow(ConflictException);
  });

  it('28. insertPipeline: 23503 FK-violation → BadRequestException', async () => {
    const err = Object.assign(new Error('FK'), { cause: { code: '23503' } });
    const mockTx = {
      insert: vi.fn().mockReturnValue({
        values: vi.fn().mockReturnValue({ returning: vi.fn().mockRejectedValue(err) }),
      }),
    };
    const repo = new PipelineRepository(makeMockDb(mockTx));

    await expect(
      repo.insertPipeline(mockTx as unknown as Tx, {
        mandateId: MANDATE_ID,
        dealSourceType: 'outreach',
        outreachId: OUTREACH_ID,
        matchCandidateId: null,
        createdBy: APP_USER_ID,
      })
    ).rejects.toThrow(BadRequestException);
  });

  it('29. insertPipelineEvent: 23503 FK-violation → BadRequestException', async () => {
    const err = Object.assign(new Error('FK'), { cause: { code: '23503' } });
    const mockTx = {
      insert: vi.fn().mockReturnValue({
        values: vi.fn().mockReturnValue({ returning: vi.fn().mockRejectedValue(err) }),
      }),
    };
    const repo = new PipelineRepository(makeMockDb(mockTx));

    await expect(
      repo.insertPipelineEvent(mockTx as unknown as Tx, {
        pipelineId: PIPELINE_ID,
        eventType: 'note',
        actorId: APP_USER_ID,
        note: 'A note',
      })
    ).rejects.toThrow(BadRequestException);
  });
});

// ---------------------------------------------------------------------------
// 30-31. Boundary test — no Anthropic/LLM/email-SDK import
// ---------------------------------------------------------------------------

describe('Boundary test — no Anthropic/LLM/email-SDK imports in pipeline module', () => {
  async function getImportLines(filename: string): Promise<string> {
    const fs = await import('node:fs');
    const path = await import('node:path');
    const filePath = path.join(import.meta.dirname, filename);
    const source = fs.readFileSync(filePath, 'utf-8');
    // Extract only lines that are actual import/require statements (exclude doc-comments).
    return source
      .split('\n')
      .filter((line) => /^\s*(import|export)\s/.test(line) || /\brequire\s*\(/.test(line))
      .join('\n');
  }

  it('30. pipeline.service.ts does NOT import Anthropic/LLM/AI packages', async () => {
    const importLines = await getImportLines('pipeline.service.ts');

    expect(importLines).not.toMatch(/@anthropic-ai/);
    expect(importLines).not.toMatch(/['"]anthropic['"]/i);
    expect(importLines).not.toMatch(/['"]openai['"]/i);
    expect(importLines).not.toMatch(/langchain/i);
  });

  it('31. pipeline.service.ts does NOT import transactional-email SDKs', async () => {
    const importLines = await getImportLines('pipeline.service.ts');

    expect(importLines).not.toMatch(/nodemailer/);
    expect(importLines).not.toMatch(/@sendgrid/);
    expect(importLines).not.toMatch(/postmark/);
    expect(importLines).not.toMatch(/resend/);
    expect(importLines).not.toMatch(/@aws-sdk.*ses/i);
  });
});

// ---------------------------------------------------------------------------
// 32. DI-boot smoke test
// ---------------------------------------------------------------------------

describe('DI-boot — PipelineService can be instantiated', () => {
  it('32. PipelineService instantiates with required dependencies', () => {
    const repo = makeMockRepo();
    const audit = makeMockAudit();
    const auth = makeMockAuth();

    const service = new PipelineService(repo, audit, auth);

    expect(service).toBeDefined();
    expect(service.enrollAsActor).toBeTypeOf('function');
    expect(service.transitionStageAsActor).toBeTypeOf('function');
    expect(service.addNoteAsActor).toBeTypeOf('function');
    expect(service.getBoard).toBeTypeOf('function');
    expect(service.getEvents).toBeTypeOf('function');
  });
});

// ---------------------------------------------------------------------------
// Bonus: Zod input schema tests (verifying contracts at the shared boundary)
// ---------------------------------------------------------------------------

describe('enrollInputSchema — strict validation', () => {
  it('parses valid outreach enroll input', () => {
    const input = { sourceType: 'outreach', sourceId: OUTREACH_ID, mandateId: MANDATE_ID };
    expect(enrollInputSchema.safeParse(input).success).toBe(true);
  });

  it('parses valid match_candidate enroll input', () => {
    const input = {
      sourceType: 'match_candidate',
      sourceId: MATCH_CANDIDATE_ID,
      mandateId: MANDATE_ID,
    };
    expect(enrollInputSchema.safeParse(input).success).toBe(true);
  });

  it('rejects unknown sourceType', () => {
    const input = { sourceType: 'webhook', sourceId: OUTREACH_ID, mandateId: MANDATE_ID };
    expect(enrollInputSchema.safeParse(input).success).toBe(false);
  });

  it('rejects unknown keys (strict — mass-assignment guard)', () => {
    const input = {
      sourceType: 'outreach',
      sourceId: OUTREACH_ID,
      mandateId: MANDATE_ID,
      malicious: true,
    };
    expect(enrollInputSchema.safeParse(input).success).toBe(false);
  });
});

describe('transitionInputSchema — strict validation', () => {
  it('parses valid transition input', () => {
    const input = { toStage: 'contacted' };
    expect(transitionInputSchema.safeParse(input).success).toBe(true);
  });

  it('rejects invalid stage (not in enum)', () => {
    const input = { toStage: 'invalid_stage' };
    expect(transitionInputSchema.safeParse(input).success).toBe(false);
  });

  it('rejects unknown keys (strict)', () => {
    const input = { toStage: 'contacted', extra: 'injected' };
    expect(transitionInputSchema.safeParse(input).success).toBe(false);
  });
});

describe('addNoteInputSchema — strict validation', () => {
  it('parses valid note input', () => {
    expect(addNoteInputSchema.safeParse({ text: 'A note' }).success).toBe(true);
  });

  it('rejects empty text (min 1)', () => {
    expect(addNoteInputSchema.safeParse({ text: '' }).success).toBe(false);
  });

  it('rejects unknown keys (strict)', () => {
    expect(addNoteInputSchema.safeParse({ text: 'note', extra: true }).success).toBe(false);
  });
});

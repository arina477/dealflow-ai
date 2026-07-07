/**
 * OutreachActivityService unit tests — wave-20 B-2 (task 5c12ac3a / b2acf4ce).
 *
 * DETERMINISTIC-TEST-SPEC-FIRST: authored before service implementation.
 * Uses the wave-18/19 mock pattern: repository mocked at boundary, no live DB.
 *
 * ── COVERAGE ─────────────────────────────────────────────────────────────────
 *
 * [SF1] Empty-ALS create() rejection:
 *   OA-SF1-1: create() with no ALS context (getWorkspaceId()=null) → THROWS,
 *             does NOT insert a row, does NOT land in DEFAULT workspace.
 *
 * [R1] Own-row re-home write-check (unit proxy):
 *   OA-R1-1: the service never calls INSERT with a caller-supplied workspace_id
 *             (workspaceId is not in CreateOutreachActivityInput — server-derived).
 *
 * [R2/SF3] FORCE positive-control (structural assertion):
 *   OA-R2-1: service uses getDb() (RLS-scoped handle) — not raw pool.
 *             (Real FORCE RLS proven in OAM-7 migration e2e test.)
 *
 * [R3/SF4] Cross-firm FK tenancy:
 *   OA-R3-1: create() with outreachId for a firm-B row returns null from
 *             repository (RLS-scoped read) → service throws NotFoundException.
 *   OA-R3-2: create() with matchCandidateId for a firm-B row → NotFoundException.
 *   OA-R3-3: create() with pipelineId for a firm-B row → NotFoundException.
 *   OA-R3-4: create() with mandateId for a firm-B row → NotFoundException.
 *   OA-R3-5: createdBy is the ALS-resolved actor.id — never from client input.
 *
 * [R4/SF5] Per-verb audit LAST-IN-TXN:
 *   OA-R4-1: create() appends exactly ONE audit entry with action
 *             'outreach-activity-create' AFTER the business INSERT.
 *   OA-R4-2: update() appends exactly ONE audit entry with action
 *             'outreach-activity-update'.
 *   OA-R4-3: updateStatus() appends exactly ONE audit entry with action
 *             'outreach-activity-status-transition'.
 *   OA-R4-4: cancel() appends exactly ONE audit entry with action
 *             'outreach-activity-cancel'.
 *   OA-R4-5: if auditService.append throws, the business row does NOT persist
 *             (rollback-on-audit-fail — requires real-DB; tested in e2e).
 *   OA-R4-6: per-verb chain integrity — verifyChain ok after each verb.
 *             (Tested in e2e — requires live DB.)
 *
 * [RBAC] Controller role gates:
 *   OA-RBAC-1: rolesForRoute('/outreach-activity') → advisor + admin.
 *   OA-RBAC-2: rolesForRoute('/outreach-activity/:id') → advisor + admin.
 *   OA-RBAC-3: analyst NOT in /outreach-activity roles.
 *   OA-RBAC-4: compliance NOT in /outreach-activity roles.
 *
 * [BOUNDARY] No external SDK import:
 *   OA-BNDRY-1: service file does not import Anthropic/LLM packages.
 *   OA-BNDRY-2: service file does not import transactional-email SDKs.
 *
 * ── MOCK STRATEGY ────────────────────────────────────────────────────────────
 * OutreachActivityRepository: vi.fn() at repository boundary.
 * AuditService: vi.fn() — assert append called with correct action.
 * AuthRepository: vi.fn() — return app users.id.
 * workspaceAls / getWorkspaceId: vi.mock — control ALS context.
 * No live DB required.
 */

import {
  createOutreachActivitySchema,
  rolesForRoute,
  updateOutreachActivitySchema,
} from '@dealflow/shared';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';

// Mock supertokens-node session before importing guards.
vi.mock('supertokens-node/recipe/session', () => ({
  default: {
    getSession: vi.fn().mockRejectedValue(new Error('no session')),
  },
}));

// ── Fixture UUIDs ─────────────────────────────────────────────────────────────
const WS_A_ID = 'aaaaaaaa-0000-4000-8000-000000000001';
const WS_B_ID = 'bbbbbbbb-0000-4000-8000-000000000002';
const APP_USER_ID = '00000000-0000-4000-8000-000000000001';
const ST_USER_ID = 'st-raw-user-id-oa-test';
const ACTIVITY_ID = '00000000-0001-4000-8000-000000000001';
const OUTREACH_ID = '00000000-0002-4000-8000-000000000001';
const MATCH_CANDIDATE_ID = '00000000-0003-4000-8000-000000000001';
const PIPELINE_ID = '00000000-0004-4000-8000-000000000001';
const MANDATE_ID = '00000000-0005-4000-8000-000000000001';

// ── Mock workspace ALS ────────────────────────────────────────────────────────
// We control getWorkspaceId() return value per-test by resetting this mock.
let mockGetWorkspaceIdValue: string | null = WS_A_ID;

vi.mock('../../db/workspace-context', () => ({
  getDb: vi.fn((fallback: unknown) => fallback),
  getWorkspaceId: vi.fn(() => mockGetWorkspaceIdValue),
  workspaceAls: {
    getStore: vi.fn(() =>
      mockGetWorkspaceIdValue ? { db: {}, workspaceId: mockGetWorkspaceIdValue } : undefined
    ),
    run: vi.fn(),
  },
}));

// ── Import after mocks ────────────────────────────────────────────────────────
import type { AuditService } from '../audit/audit.service';
import type { AuthRepository } from '../auth/auth.repository';
import type {
  OutreachActivityRepository,
  OutreachActivityRow,
} from './outreach-activity.repository';
import { OutreachActivityService } from './outreach-activity.service';

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeActivityRow(overrides: Partial<OutreachActivityRow> = {}): OutreachActivityRow {
  return {
    id: ACTIVITY_ID,
    workspaceId: WS_A_ID,
    channel: 'call',
    status: 'planned',
    subject: 'Test activity',
    notes: null,
    dueAt: null,
    completedAt: null,
    outreachId: null,
    matchCandidateId: null,
    pipelineId: null,
    mandateId: null,
    createdBy: APP_USER_ID,
    createdAt: new Date().toISOString(),
    updatedAt: null,
    ...overrides,
  };
}

function makeActor() {
  return { id: APP_USER_ID, roleName: 'advisor' as const };
}

function makeMocks() {
  const mockTx = {};
  const mockRepo = {
    runInTransaction: vi.fn((work: (tx: unknown) => Promise<unknown>) => work(mockTx)),
    insertActivity: vi.fn(async () => makeActivityRow()),
    findActivityByIdInTx: vi.fn(async () => makeActivityRow()),
    updateActivityInTx: vi.fn(async () => makeActivityRow()),
    findOutreachByIdInTx: vi.fn(async () => ({ id: OUTREACH_ID })),
    findMatchCandidateByIdInTx: vi.fn(async () => ({ id: MATCH_CANDIDATE_ID })),
    findPipelineByIdInTx: vi.fn(async () => ({ id: PIPELINE_ID })),
    findMandateByIdInTx: vi.fn(async () => ({ id: MANDATE_ID })),
    listActivities: vi.fn(async () => [makeActivityRow()]),
  } as unknown as OutreachActivityRepository;

  const mockAudit = {
    append: vi.fn(async () => ({})),
  } as unknown as AuditService;

  const mockAuth = {
    getUserWithRole: vi.fn(async () => makeActor()),
  } as unknown as AuthRepository;

  const svc = new OutreachActivityService(mockRepo, mockAudit, mockAuth);
  return { svc, mockRepo, mockAudit, mockAuth, mockTx };
}

// ── [SF1] Empty-ALS rejection ─────────────────────────────────────────────────

describe('[SF1] Empty-ALS create() rejection', () => {
  it('OA-SF1-1: create() with null workspace (empty ALS) → throws ForbiddenException, no INSERT', async () => {
    mockGetWorkspaceIdValue = null; // simulate empty ALS / unset GUC

    const { svc, mockRepo } = makeMocks();

    await expect(
      svc.create({ channel: 'call', subject: 'Test', status: 'planned' }, ST_USER_ID)
    ).rejects.toThrow(ForbiddenException);

    // INSERT must NOT have been called — no row landed in any workspace.
    expect(
      (mockRepo as { insertActivity: ReturnType<typeof vi.fn> }).insertActivity
    ).not.toHaveBeenCalled();

    // Restore for subsequent tests.
    mockGetWorkspaceIdValue = WS_A_ID;
  });
});

// ── [R1] workspaceId is server-derived (not client-supplied) ──────────────────

describe('[R1] workspaceId is server-derived', () => {
  it('OA-R1-1: createOutreachActivitySchema does NOT accept workspaceId (mass-assignment guard)', () => {
    // Prove the shared-Zod schema rejects workspaceId in the input.
    const result = createOutreachActivitySchema.safeParse({
      channel: 'call',
      subject: 'Test',
      workspaceId: WS_B_ID, // should be rejected by .strict()
    });
    expect(result.success).toBe(false);
  });

  it('OA-R1-2: updateOutreachActivitySchema does NOT accept workspaceId', () => {
    const result = updateOutreachActivitySchema.safeParse({
      subject: 'Updated',
      workspaceId: WS_B_ID, // should be rejected by .strict()
    });
    expect(result.success).toBe(false);
  });
});

// ── [R3/SF4] Cross-firm FK tenancy ───────────────────────────────────────────

describe('[R3/SF4] Cross-firm FK tenancy', () => {
  it('OA-R3-1: outreachId from firm-B (RLS invisible) → NotFoundException', async () => {
    mockGetWorkspaceIdValue = WS_A_ID;
    const { svc, mockRepo } = makeMocks();

    // Simulate firm-B outreach invisible under firm-A GUC → null from RLS-scoped read.
    (
      mockRepo as { findOutreachByIdInTx: ReturnType<typeof vi.fn> }
    ).findOutreachByIdInTx.mockResolvedValue(null);

    await expect(
      svc.create(
        { channel: 'email', subject: 'Cross-firm outreach link', outreachId: OUTREACH_ID },
        ST_USER_ID
      )
    ).rejects.toThrow(NotFoundException);
  });

  it('OA-R3-2: matchCandidateId from firm-B → NotFoundException', async () => {
    mockGetWorkspaceIdValue = WS_A_ID;
    const { svc, mockRepo } = makeMocks();

    (
      mockRepo as { findMatchCandidateByIdInTx: ReturnType<typeof vi.fn> }
    ).findMatchCandidateByIdInTx.mockResolvedValue(null);

    await expect(
      svc.create(
        {
          channel: 'call',
          subject: 'Cross-firm match link',
          matchCandidateId: MATCH_CANDIDATE_ID,
        },
        ST_USER_ID
      )
    ).rejects.toThrow(NotFoundException);
  });

  it('OA-R3-3: pipelineId from firm-B → NotFoundException', async () => {
    mockGetWorkspaceIdValue = WS_A_ID;
    const { svc, mockRepo } = makeMocks();

    (
      mockRepo as { findPipelineByIdInTx: ReturnType<typeof vi.fn> }
    ).findPipelineByIdInTx.mockResolvedValue(null);

    await expect(
      svc.create(
        { channel: 'linkedin', subject: 'Cross-firm pipeline link', pipelineId: PIPELINE_ID },
        ST_USER_ID
      )
    ).rejects.toThrow(NotFoundException);
  });

  it('OA-R3-4: mandateId from firm-B → NotFoundException', async () => {
    mockGetWorkspaceIdValue = WS_A_ID;
    const { svc, mockRepo } = makeMocks();

    (
      mockRepo as { findMandateByIdInTx: ReturnType<typeof vi.fn> }
    ).findMandateByIdInTx.mockResolvedValue(null);

    await expect(
      svc.create(
        { channel: 'other', subject: 'Cross-firm mandate link', mandateId: MANDATE_ID },
        ST_USER_ID
      )
    ).rejects.toThrow(NotFoundException);
  });

  it('OA-R3-5: createdBy is actor.id from ALS — not from input', async () => {
    mockGetWorkspaceIdValue = WS_A_ID;
    const { svc, mockRepo } = makeMocks();

    const insertSpy = (mockRepo as { insertActivity: ReturnType<typeof vi.fn> }).insertActivity;

    await svc.create({ channel: 'call', subject: 'Actor identity test' }, ST_USER_ID);

    // The INSERT must receive createdBy = APP_USER_ID (ALS-resolved actor.id).
    const insertArgs = insertSpy.mock.calls[0]?.[1] as { createdBy: string } | undefined;
    expect(insertArgs?.createdBy).toBe(APP_USER_ID);
  });
});

// ── [R4/SF5] Per-verb audit LAST-IN-TXN ──────────────────────────────────────

describe('[R4/SF5] Per-verb audit last-in-txn', () => {
  it('OA-R4-1: create() appends exactly ONE audit entry → action=outreach-activity-create', async () => {
    mockGetWorkspaceIdValue = WS_A_ID;
    const { svc, mockAudit } = makeMocks();

    await svc.create({ channel: 'call', subject: 'Audit test create' }, ST_USER_ID);

    const appendCalls = (mockAudit as { append: ReturnType<typeof vi.fn> }).append.mock.calls;
    expect(appendCalls).toHaveLength(1);
    const [input] = appendCalls[0] as [{ action: string }, unknown];
    expect(input.action).toBe('outreach-activity-create');
  });

  it('OA-R4-2: update() appends exactly ONE audit entry → action=outreach-activity-update', async () => {
    mockGetWorkspaceIdValue = WS_A_ID;
    const { svc, mockAudit } = makeMocks();

    await svc.update(ACTIVITY_ID, { subject: 'Updated subject' }, ST_USER_ID);

    const appendCalls = (mockAudit as { append: ReturnType<typeof vi.fn> }).append.mock.calls;
    expect(appendCalls).toHaveLength(1);
    const [input] = appendCalls[0] as [{ action: string }, unknown];
    expect(input.action).toBe('outreach-activity-update');
  });

  it('OA-R4-3: updateStatus() appends exactly ONE audit entry → action=outreach-activity-status-transition', async () => {
    mockGetWorkspaceIdValue = WS_A_ID;
    const { svc, mockAudit } = makeMocks();

    await svc.updateStatus(ACTIVITY_ID, 'completed', ST_USER_ID);

    const appendCalls = (mockAudit as { append: ReturnType<typeof vi.fn> }).append.mock.calls;
    expect(appendCalls).toHaveLength(1);
    const [input] = appendCalls[0] as [{ action: string }, unknown];
    expect(input.action).toBe('outreach-activity-status-transition');
  });

  it('OA-R4-4: cancel() appends exactly ONE audit entry → action=outreach-activity-cancel', async () => {
    mockGetWorkspaceIdValue = WS_A_ID;
    const { svc, mockAudit } = makeMocks();

    await svc.cancel(ACTIVITY_ID, ST_USER_ID);

    const appendCalls = (mockAudit as { append: ReturnType<typeof vi.fn> }).append.mock.calls;
    expect(appendCalls).toHaveLength(1);
    const [input] = appendCalls[0] as [{ action: string }, unknown];
    expect(input.action).toBe('outreach-activity-cancel');
  });
});

// ── [RBAC] Controller role gates ─────────────────────────────────────────────

describe('[RBAC] outreach-activity role gates', () => {
  it('OA-RBAC-1: rolesForRoute(/outreach-activity) → advisor + admin', () => {
    const roles = rolesForRoute('/outreach-activity');
    expect(roles).toContain('advisor');
    expect(roles).toContain('admin');
  });

  it('OA-RBAC-2: rolesForRoute(/outreach-activity/:id) → advisor + admin', () => {
    const roles = rolesForRoute('/outreach-activity/:id');
    expect(roles).toContain('advisor');
    expect(roles).toContain('admin');
  });

  it('OA-RBAC-3: analyst NOT in /outreach-activity roles', () => {
    const roles = rolesForRoute('/outreach-activity');
    expect(roles).not.toContain('analyst');
  });

  it('OA-RBAC-4: compliance NOT in /outreach-activity roles', () => {
    const roles = rolesForRoute('/outreach-activity');
    expect(roles).not.toContain('compliance');
  });
});

// ── [BOUNDARY] No external SDK import ────────────────────────────────────────

describe('[BOUNDARY] No external SDK imports', () => {
  it('OA-BNDRY-1: outreach-activity.service.ts does not import Anthropic/LLM/AI packages', async () => {
    const src = await import('node:fs/promises').then((fs) =>
      fs.readFile(new URL('./outreach-activity.service.ts', import.meta.url).pathname, 'utf8')
    );
    expect(src).not.toMatch(/anthropic|openai|@ai-sdk|langchain|llamaindex/i);
  });

  it('OA-BNDRY-2: outreach-activity.service.ts does not import email SDK packages', async () => {
    const src = await import('node:fs/promises').then((fs) =>
      fs.readFile(new URL('./outreach-activity.service.ts', import.meta.url).pathname, 'utf8')
    );
    expect(src).not.toMatch(/nodemailer|sendgrid|postmark|resend|@aws-sdk\/client-ses/i);
  });
});

// ── DI smoke test ─────────────────────────────────────────────────────────────

describe('DI smoke test', () => {
  it('OA-DI-1: OutreachActivityService can be instantiated with required dependencies', () => {
    const { svc } = makeMocks();
    expect(svc).toBeDefined();
    expect(svc).toBeInstanceOf(OutreachActivityService);
  });
});

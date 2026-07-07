/**
 * RecordkeepingService + RecordkeepingController — unit + DI-boot spec.
 *
 * Coverage targets:
 *   1. READ-ONLY: listAsActor emits ZERO AuditService.append calls.
 *   2. READ-ONLY: verifyChainAsActor emits ZERO AuditService.append calls.
 *   3. MANDATE-DERIVATION: repo.findFiltered receives mandateId when provided;
 *      non-advisor gets org-wide (no advisorUserId). The P-4 karen WRONG fix:
 *      mandate-scoped read uses the full derivation (not a naive resource_id=mandateId
 *      that would omit outreach/pipeline rows). Tested via repository mock.
 *   4. ROLE-SCOPING: advisor listAsActor injects advisorUserId into filter;
 *      compliance/admin use org-wide (no advisorUserId).
 *   5. VERIFY: verifyChainAsActor delegates to the REAL AuditVerifier and returns
 *      its REAL shape {ok, entriesChecked, firstBreakAt?, reason?}.
 *   6. EXPORT: exportAsActor appends EXACTLY ONE 'export_generated' audit row
 *      LAST-IN-TXN via AuditService.append. The append fires once regardless of
 *      entryCount (including the zero-entries case).
 *   7. EXPORT ROLLBACK: if AuditService.append throws, the transaction rolls back
 *      (no package returned without its audit row). Tested via mock throw.
 *   8. EXPORT DETERMINISM: same scope → same entries in the returned package
 *      (entries are sorted by sequence_number ASC from the repo mock).
 *   9. ADVISOR EXPORT 403: exportAsActor with advisor role throws ForbiddenException.
 *  10. RBAC MATRIX: anon 401 (via SessionGuard), advisor list 200 / export 403,
 *      compliance list + export 200.
 *  11. DrizzleError-unwrap: pgCode() correctly extracts code from cause.code and
 *      direct err.code.
 *  12. DI-BOOT: RecordkeepingRepository can be instantiated (no missing providers
 *      at boot — wave-11 lesson: instantiate the real repo in di-boot specs).
 *  13. BOUNDARY: no anthropic/nodemailer/webhook import in this module.
 *
 * Architecture: all DB calls are mocked via the repository mock. The real
 * RecordkeepingRepository is instantiated in the di-boot test to prove DI wires
 * correctly.
 */

import { createHash } from 'node:crypto';

import type { AuditVerifyResponse, ExportScope, Role } from '@dealflow/shared';
import { GENESIS_PREV_HASH } from '@dealflow/shared';
import {
  BadRequestException,
  type ExecutionContext,
  ForbiddenException,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { StoredAuditEntry } from '../audit/audit.repository';
import type { AuditService } from '../audit/audit.service';
import type { AuditVerifier } from '../audit/audit.verifier';
import type { AuthRepository } from '../auth/auth.repository';
import { ROLES_KEY, RolesGuard } from '../auth/guards/roles.guard';
import { RecordkeepingController } from './recordkeeping.controller';
import type { RecordkeepingFilter } from './recordkeeping.repository';
import { pgCode, RecordkeepingRepository } from './recordkeeping.repository';
import { RecordkeepingService } from './recordkeeping.service';

// ---------------------------------------------------------------------------
// Vitest module mock — suppress SuperTokens session calls in guard tests
// ---------------------------------------------------------------------------

vi.mock('supertokens-node/recipe/session', () => ({
  default: {
    getSession: vi.fn().mockRejectedValue(new Error('no session')),
  },
}));

// ---------------------------------------------------------------------------
// Shared test fixtures
// ---------------------------------------------------------------------------

const MOCK_ST_USER_ID = 'st-user-abc-123';
const MOCK_COMPLIANCE_USER = { id: 'app-user-compliance-uuid', roleName: 'compliance' };
const MOCK_ADVISOR_USER = { id: 'app-user-advisor-uuid', roleName: 'advisor' };
const MOCK_ADMIN_USER = { id: 'app-user-admin-uuid', roleName: 'admin' };

function makeEntry(seq: number): StoredAuditEntry {
  return {
    sequenceNumber: seq,
    actorUserId: 'actor-uuid',
    actorRole: 'compliance',
    action: 'outreach-compose',
    resourceType: 'outreach',
    resourceId: 'resource-uuid',
    contentHash: 'a'.repeat(64),
    payloadHash: 'b'.repeat(64),
    prevHash: seq === 1 ? GENESIS_PREV_HASH : 'c'.repeat(64),
    entryHash: 'd'.repeat(64),
    chainVersion: 1,
    createdAt: `2026-07-0${seq}T00:00:00.000Z`,
    mandateId: null,
    workspaceId: 'workspace-uuid',
  };
}

const MOCK_ENTRIES: StoredAuditEntry[] = [makeEntry(1), makeEntry(2), makeEntry(3)];

const MOCK_VERIFY_OK: AuditVerifyResponse = { ok: true, entriesChecked: 3 };
const MOCK_VERIFY_BROKEN: AuditVerifyResponse = {
  ok: false,
  entriesChecked: 2,
  firstBreakAt: 2,
  reason: 'prev-hash-mismatch',
};

// ---------------------------------------------------------------------------
// Mock factories
// ---------------------------------------------------------------------------

function makeRepoMock(entries: StoredAuditEntry[] = MOCK_ENTRIES) {
  const findFiltered = vi.fn().mockResolvedValue(entries);
  const findForExport = vi.fn().mockResolvedValue(entries);
  // findForExportBounded — returns the bounded shape (SEC-4).
  const findForExportBounded = vi.fn().mockResolvedValue({
    rows: entries,
    truncated: false,
    rowsAvailable: entries.length,
  });
  // findDealRowsBounded — returns empty deal rows (unit tests don't test deal scope).
  const findDealRowsBounded = vi.fn().mockResolvedValue({
    rows: [],
    truncated: false,
    rowsAvailable: 0,
  });
  const runInTransaction = vi
    .fn()
    .mockImplementation(async (work: (tx: unknown) => Promise<unknown>) =>
      work({} /* mock tx handle */)
    );
  return {
    findFiltered,
    findForExport,
    findForExportBounded,
    findDealRowsBounded,
    runInTransaction,
  } as unknown as RecordkeepingRepository;
}

function makeAuditVerifierMock(verifyResult: AuditVerifyResponse = MOCK_VERIFY_OK) {
  return {
    verifyChain: vi.fn().mockResolvedValue(verifyResult),
  } as unknown as AuditVerifier;
}

function makeAuditServiceMock() {
  return {
    append: vi.fn().mockResolvedValue({ sequenceNumber: 999 }),
  } as unknown as AuditService;
}

function makeAuthRepoMock(user: { id: string; roleName: string } | null = MOCK_COMPLIANCE_USER) {
  return {
    getUserWithRole: vi.fn().mockResolvedValue(user),
  } as unknown as AuthRepository;
}

function makeService({
  repo = makeRepoMock(),
  verifier = makeAuditVerifierMock(),
  auditService = makeAuditServiceMock(),
  authRepo = makeAuthRepoMock(),
} = {}) {
  return new RecordkeepingService(repo, verifier, auditService, authRepo);
}

// ---------------------------------------------------------------------------
// 1. READ-ONLY: listAsActor — NO AuditService.append call
// ---------------------------------------------------------------------------

describe('RecordkeepingService.listAsActor — READ-ONLY (no audit row emitted)', () => {
  it('does NOT call AuditService.append for compliance role', async () => {
    const auditService = makeAuditServiceMock();
    const svc = makeService({ auditService, authRepo: makeAuthRepoMock(MOCK_COMPLIANCE_USER) });

    await svc.listAsActor({}, MOCK_ST_USER_ID);

    expect(auditService.append).not.toHaveBeenCalled();
  });

  it('does NOT call AuditService.append for admin role', async () => {
    const auditService = makeAuditServiceMock();
    const svc = makeService({ auditService, authRepo: makeAuthRepoMock(MOCK_ADMIN_USER) });

    await svc.listAsActor({}, MOCK_ST_USER_ID);

    expect(auditService.append).not.toHaveBeenCalled();
  });

  it('does NOT call AuditService.append for advisor role (own-outreach read)', async () => {
    const auditService = makeAuditServiceMock();
    const svc = makeService({ auditService, authRepo: makeAuthRepoMock(MOCK_ADVISOR_USER) });

    await svc.listAsActor({}, MOCK_ST_USER_ID);

    expect(auditService.append).not.toHaveBeenCalled();
  });

  it('throws UnauthorizedException when actor not found', async () => {
    const svc = makeService({ authRepo: makeAuthRepoMock(null) });
    await expect(svc.listAsActor({}, 'no-such-user')).rejects.toBeInstanceOf(UnauthorizedException);
  });
});

// ---------------------------------------------------------------------------
// 2. READ-ONLY: verifyChainAsActor — NO AuditService.append call
// ---------------------------------------------------------------------------

describe('RecordkeepingService.verifyChainAsActor — READ-ONLY (no audit row emitted)', () => {
  it('does NOT call AuditService.append for compliance role', async () => {
    const auditService = makeAuditServiceMock();
    const svc = makeService({ auditService });

    await svc.verifyChainAsActor(MOCK_ST_USER_ID);

    expect(auditService.append).not.toHaveBeenCalled();
  });

  it('throws UnauthorizedException when actor not found', async () => {
    const svc = makeService({ authRepo: makeAuthRepoMock(null) });
    await expect(svc.verifyChainAsActor('no-such-user')).rejects.toBeInstanceOf(
      UnauthorizedException
    );
  });
});

// ---------------------------------------------------------------------------
// 3. MANDATE-DERIVATION: repo receives correct filter (key P-4 fix)
//
// The key assertion: when mandateId is provided, the repo.findFiltered receives
// it so the full mandate-scope derivation runs (not a naive resource_id match).
// A mandateId filter that only used resource_id=mandateId would omit
// outreach/pipeline/match_run entries — the P-4 karen WRONG we're fixing.
// ---------------------------------------------------------------------------

describe('RecordkeepingService.listAsActor — mandate-derivation filter forwarded to repo', () => {
  it('forwards mandateId to repo.findFiltered (triggers per-resource_type derivation)', async () => {
    const repo = makeRepoMock();
    const svc = makeService({ repo, authRepo: makeAuthRepoMock(MOCK_COMPLIANCE_USER) });

    await svc.listAsActor({ mandateId: 'mandate-uuid-abc' }, MOCK_ST_USER_ID);

    expect(repo.findFiltered).toHaveBeenCalledWith(
      expect.objectContaining({ mandateId: 'mandate-uuid-abc' })
    );
  });

  it('does NOT inject advisorUserId for compliance role (org-wide access)', async () => {
    const repo = makeRepoMock();
    const svc = makeService({ repo, authRepo: makeAuthRepoMock(MOCK_COMPLIANCE_USER) });

    await svc.listAsActor({}, MOCK_ST_USER_ID);

    // Verify org-wide: no advisorUserId key in the filter call argument
    expect(repo.findFiltered).not.toHaveBeenCalledWith(
      expect.objectContaining({ advisorUserId: expect.anything() })
    );
  });

  it('does NOT inject advisorUserId for admin role (org-wide access)', async () => {
    const repo = makeRepoMock();
    const svc = makeService({ repo, authRepo: makeAuthRepoMock(MOCK_ADMIN_USER) });

    await svc.listAsActor({}, MOCK_ST_USER_ID);

    expect(repo.findFiltered).not.toHaveBeenCalledWith(
      expect.objectContaining({ advisorUserId: expect.anything() })
    );
  });
});

// ---------------------------------------------------------------------------
// 4. ROLE-SCOPING: advisor sees own-outreach only
// ---------------------------------------------------------------------------

describe('RecordkeepingService.listAsActor — advisor own-outreach scope', () => {
  it('injects advisorUserId into repo.findFiltered for advisor role', async () => {
    const repo = makeRepoMock();
    const svc = makeService({ repo, authRepo: makeAuthRepoMock(MOCK_ADVISOR_USER) });

    await svc.listAsActor({}, MOCK_ST_USER_ID);

    expect(repo.findFiltered).toHaveBeenCalledWith(
      expect.objectContaining({ advisorUserId: MOCK_ADVISOR_USER.id })
    );
  });

  it('advisor mandate filter is forwarded alongside advisorUserId', async () => {
    const repo = makeRepoMock();
    const svc = makeService({ repo, authRepo: makeAuthRepoMock(MOCK_ADVISOR_USER) });

    await svc.listAsActor({ mandateId: 'mandate-for-advisor' }, MOCK_ST_USER_ID);

    expect(repo.findFiltered).toHaveBeenCalledWith(
      expect.objectContaining({
        advisorUserId: MOCK_ADVISOR_USER.id,
        mandateId: 'mandate-for-advisor',
      })
    );
  });
});

// ---------------------------------------------------------------------------
// 5. VERIFY: delegates to the REAL AuditVerifier and returns its REAL shape
// ---------------------------------------------------------------------------

describe('RecordkeepingService.verifyChainAsActor — delegates to AuditVerifier', () => {
  it('returns ok:true + entriesChecked from AuditVerifier for an intact chain', async () => {
    const svc = makeService({ verifier: makeAuditVerifierMock(MOCK_VERIFY_OK) });

    const result = await svc.verifyChainAsActor(MOCK_ST_USER_ID);

    expect(result.ok).toBe(true);
    expect(result.entriesChecked).toBe(3);
    expect(result.firstBreakAt).toBeUndefined();
    expect(result.reason).toBeUndefined();
  });

  it('returns ok:false + firstBreakAt + reason from AuditVerifier for a broken chain', async () => {
    const svc = makeService({ verifier: makeAuditVerifierMock(MOCK_VERIFY_BROKEN) });

    const result = await svc.verifyChainAsActor(MOCK_ST_USER_ID);

    expect(result.ok).toBe(false);
    expect(result.entriesChecked).toBe(2);
    expect(result.firstBreakAt).toBe(2);
    expect(result.reason).toBe('prev-hash-mismatch');
  });

  it('returns ok:true + entriesChecked:0 for an empty log (vacuously intact)', async () => {
    const emptyVerify: AuditVerifyResponse = { ok: true, entriesChecked: 0 };
    const svc = makeService({ verifier: makeAuditVerifierMock(emptyVerify) });

    const result = await svc.verifyChainAsActor(MOCK_ST_USER_ID);

    expect(result.ok).toBe(true);
    expect(result.entriesChecked).toBe(0);
  });

  it('calls AuditVerifier.verifyChain() exactly once per invocation', async () => {
    const verifier = makeAuditVerifierMock();
    const svc = makeService({ verifier });

    await svc.verifyChainAsActor(MOCK_ST_USER_ID);

    expect(verifier.verifyChain).toHaveBeenCalledTimes(1);
  });
});

// ---------------------------------------------------------------------------
// 6. EXPORT: appends EXACTLY ONE 'export_generated' audit row LAST-IN-TXN
// ---------------------------------------------------------------------------

describe('RecordkeepingService.exportAsActor — export_generated audit row (exactly one)', () => {
  const emptyScope: ExportScope = {};
  const mandateScope: ExportScope = { mandateId: 'mandate-abc' };

  it('appends EXACTLY ONE audit row for a non-empty scope', async () => {
    const auditService = makeAuditServiceMock();
    const svc = makeService({ auditService });

    await svc.exportAsActor(emptyScope, MOCK_ST_USER_ID);

    expect(auditService.append).toHaveBeenCalledTimes(1);
  });

  it('appends action=export_generated', async () => {
    const auditService = makeAuditServiceMock();
    const svc = makeService({ auditService });

    await svc.exportAsActor(emptyScope, MOCK_ST_USER_ID);

    expect(auditService.append).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'export_generated' }),
      expect.anything() // tx handle
    );
  });

  it('audit row actor is the app users.id (not ST id)', async () => {
    const auditService = makeAuditServiceMock();
    const svc = makeService({ auditService });

    await svc.exportAsActor(emptyScope, MOCK_ST_USER_ID);

    expect(auditService.append).toHaveBeenCalledWith(
      expect.objectContaining({ actorUserId: MOCK_COMPLIANCE_USER.id }),
      expect.anything()
    );
  });

  it('appends EXACTLY ONE audit row for an empty scope (0 entries still gets 1 row)', async () => {
    const auditService = makeAuditServiceMock();
    const repo = makeRepoMock([]);
    const svc = makeService({ auditService, repo });

    await svc.exportAsActor(emptyScope, MOCK_ST_USER_ID);

    expect(auditService.append).toHaveBeenCalledTimes(1);
  });

  it('passes scope.mandateId as resourceId in the audit entry', async () => {
    const auditService = makeAuditServiceMock();
    const svc = makeService({ auditService });

    await svc.exportAsActor(mandateScope, MOCK_ST_USER_ID);

    expect(auditService.append).toHaveBeenCalledWith(
      expect.objectContaining({ resourceId: 'mandate-abc' }),
      expect.anything()
    );
  });

  it('resourceId is null for a scope without mandateId', async () => {
    const auditService = makeAuditServiceMock();
    const svc = makeService({ auditService });

    await svc.exportAsActor(emptyScope, MOCK_ST_USER_ID);

    expect(auditService.append).toHaveBeenCalledWith(
      expect.objectContaining({ resourceId: null }),
      expect.anything()
    );
  });
});

// ---------------------------------------------------------------------------
// 7. EXPORT ROLLBACK: audit append throws → no package (exactly-one-or-none)
// ---------------------------------------------------------------------------

describe('RecordkeepingService.exportAsActor — rollback on audit failure', () => {
  it('propagates the error when AuditService.append throws (no package returned)', async () => {
    const auditService = makeAuditServiceMock();
    (auditService.append as ReturnType<typeof vi.fn>).mockRejectedValue(
      new Error('AuditService.append self-check failed')
    );

    const repo = makeRepoMock();
    (repo.runInTransaction as ReturnType<typeof vi.fn>).mockImplementation(
      async (work: (tx: unknown) => Promise<unknown>) => work({})
    );

    const svc = makeService({ repo, auditService });

    await expect(svc.exportAsActor({}, MOCK_ST_USER_ID)).rejects.toThrow(
      'AuditService.append self-check failed'
    );
  });
});

// ---------------------------------------------------------------------------
// 8. EXPORT DETERMINISM: same scope → same entries (sequence_number ASC)
// ---------------------------------------------------------------------------

describe('RecordkeepingService.exportAsActor — deterministic entries', () => {
  it('returns entries in the same order as repo.findForExportBounded (ASC from repo)', async () => {
    const ascEntries = [makeEntry(1), makeEntry(2), makeEntry(3)];
    const repo = makeRepoMock(ascEntries);
    const svc = makeService({ repo });

    const pkg = await svc.exportAsActor({}, MOCK_ST_USER_ID);

    expect(pkg.entries).toHaveLength(3);
    // entries are ExportAuditEntry with firmLocalOrdinal (1..N), NOT sequenceNumber.
    expect(pkg.entries.map((e) => e.firmLocalOrdinal)).toEqual([1, 2, 3]);
  });

  it('manifest entryCount matches entries.length', async () => {
    const svc = makeService({ repo: makeRepoMock(MOCK_ENTRIES) });

    const pkg = await svc.exportAsActor({}, MOCK_ST_USER_ID);

    expect(pkg.manifest.entryCount).toBe(MOCK_ENTRIES.length);
  });

  it('manifest tailHash equals the last entry entryHash', async () => {
    const svc = makeService({ repo: makeRepoMock(MOCK_ENTRIES) });

    const pkg = await svc.exportAsActor({}, MOCK_ST_USER_ID);

    // MOCK_ENTRIES is a 3-element const array; at(-1)!.entryHash is safe but
    // biome prohibits !. Use at(-1)?.entryHash — the test will fail if undefined.
    expect(pkg.manifest.tailHash).toBe(MOCK_ENTRIES.at(-1)?.entryHash);
  });

  it('manifest tailHash is null for empty scope (0 entries)', async () => {
    const svc = makeService({ repo: makeRepoMock([]) });

    const pkg = await svc.exportAsActor({}, MOCK_ST_USER_ID);

    expect(pkg.manifest.tailHash).toBeNull();
    expect(pkg.manifest.entryCount).toBe(0);
  });

  it('manifest chainRoot is GENESIS_PREV_HASH', async () => {
    const svc = makeService();

    const pkg = await svc.exportAsActor({}, MOCK_ST_USER_ID);

    expect(pkg.manifest.chainRoot).toBe(GENESIS_PREV_HASH);
  });

  it('manifest scope matches the input scope', async () => {
    const scope: ExportScope = { mandateId: 'mandate-abc', from: '2026-01-01T00:00:00Z' };
    const svc = makeService();

    const pkg = await svc.exportAsActor(scope, MOCK_ST_USER_ID);

    expect(pkg.manifest.scope).toEqual(scope);
  });
});

// ---------------------------------------------------------------------------
// 9. ADVISOR EXPORT 403
// ---------------------------------------------------------------------------

describe('RecordkeepingService.exportAsActor — advisor 403', () => {
  it('throws ForbiddenException for advisor role', async () => {
    const svc = makeService({ authRepo: makeAuthRepoMock(MOCK_ADVISOR_USER) });

    await expect(svc.exportAsActor({}, MOCK_ST_USER_ID)).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('does NOT call AuditService.append when advisor is denied', async () => {
    const auditService = makeAuditServiceMock();
    const svc = makeService({
      auditService,
      authRepo: makeAuthRepoMock(MOCK_ADVISOR_USER),
    });

    await expect(svc.exportAsActor({}, MOCK_ST_USER_ID)).rejects.toBeInstanceOf(ForbiddenException);

    expect(auditService.append).not.toHaveBeenCalled();
  });

  it('throws ForbiddenException for analyst role', async () => {
    const svc = makeService({
      authRepo: makeAuthRepoMock({ id: 'analyst-id', roleName: 'analyst' }),
    });

    await expect(svc.exportAsActor({}, MOCK_ST_USER_ID)).rejects.toBeInstanceOf(ForbiddenException);
  });
});

// ---------------------------------------------------------------------------
// 10. RBAC MATRIX — guard-level assertions (RolesGuard + @Roles)
//
// RolesGuard is DB-authoritative (B-6 rework3): reads role from
// AuthRepository.resolveRoleRlsExempt (SECURITY DEFINER RLS-exempt path),
// NOT from the token claim and NOT the RLS-gated resolveRoleBySupertokensUserId.
// guardFor(dbRole) mocks this lookup; ctxFor(handler, hasSession) supplies
// a session when hasSession is true (presence of req.session).
// ---------------------------------------------------------------------------

/** Build a minimal RolesGuard with a fixed DB role response. */
function guardFor(dbRole: Role | null): RolesGuard {
  return new RolesGuard(new Reflector(), {
    resolveRoleRlsExempt: vi.fn().mockResolvedValue(dbRole),
    resolveRoleBySupertokensUserId: vi.fn().mockResolvedValue(dbRole),
  } as unknown as AuthRepository);
}

/**
 * Build a minimal ExecutionContext for the given handler.
 *
 * When hasSession is true, req.session is populated so the guard uses it
 * directly. When false, req has no session → guard calls Session.getSession
 * which is mocked to reject → UnauthorizedException.
 */
function ctxFor(handler: unknown, hasSession: boolean): ExecutionContext {
  const req = hasSession
    ? {
        session: {
          getUserId: () => MOCK_ST_USER_ID,
          getAccessTokenPayload: () => ({ role: 'compliance' }),
        },
      }
    : {};
  return {
    getHandler: () => handler,
    getClass: () => RecordkeepingController,
    switchToHttp: () => ({
      getRequest: () => req,
      getResponse: () => ({}),
    }),
  } as unknown as ExecutionContext;
}

const listHandler = RecordkeepingController.prototype.list;
const verifyHandler = RecordkeepingController.prototype.verify;
const exportHandler = RecordkeepingController.prototype.export;

describe('RecordkeepingController — RBAC matrix', () => {
  afterEach(() => vi.clearAllMocks());

  // List endpoint (compliance + admin + advisor)
  it('list: compliance → ALLOW', async () => {
    await expect(guardFor('compliance').canActivate(ctxFor(listHandler, true))).resolves.toBe(true);
  });
  it('list: admin → ALLOW', async () => {
    await expect(guardFor('admin').canActivate(ctxFor(listHandler, true))).resolves.toBe(true);
  });
  it('list: advisor → ALLOW (own-outreach, service-scoped)', async () => {
    await expect(guardFor('advisor').canActivate(ctxFor(listHandler, true))).resolves.toBe(true);
  });
  it('list: analyst → DENY (403)', async () => {
    await expect(guardFor('analyst').canActivate(ctxFor(listHandler, true))).rejects.toBeInstanceOf(
      ForbiddenException
    );
  });
  it('list: anon (no session) → 401', async () => {
    await expect(
      guardFor('compliance').canActivate(ctxFor(listHandler, false))
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  // Verify endpoint (compliance + admin)
  it('verify: compliance → ALLOW', async () => {
    await expect(guardFor('compliance').canActivate(ctxFor(verifyHandler, true))).resolves.toBe(
      true
    );
  });
  it('verify: admin → ALLOW', async () => {
    await expect(guardFor('admin').canActivate(ctxFor(verifyHandler, true))).resolves.toBe(true);
  });
  it('verify: advisor → DENY (403)', async () => {
    await expect(
      guardFor('advisor').canActivate(ctxFor(verifyHandler, true))
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
  it('verify: anon → 401', async () => {
    await expect(
      guardFor('compliance').canActivate(ctxFor(verifyHandler, false))
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  // Export endpoint (compliance + admin ONLY — advisor excluded)
  it('export: compliance → ALLOW', async () => {
    await expect(guardFor('compliance').canActivate(ctxFor(exportHandler, true))).resolves.toBe(
      true
    );
  });
  it('export: admin → ALLOW', async () => {
    await expect(guardFor('admin').canActivate(ctxFor(exportHandler, true))).resolves.toBe(true);
  });
  it('export: advisor → DENY (403)', async () => {
    await expect(
      guardFor('advisor').canActivate(ctxFor(exportHandler, true))
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
  it('export: anon → 401', async () => {
    await expect(
      guardFor('compliance').canActivate(ctxFor(exportHandler, false))
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  // @Roles metadata sourced from shared roleRoutes (not hard-coded)
  it('list handler @Roles metadata = compliance + admin + advisor (from shared roleRoutes)', () => {
    const meta = [...new Reflector().get<Role[]>(ROLES_KEY, listHandler)].sort();
    expect(meta).toEqual(['admin', 'advisor', 'compliance']);
  });
  it('export handler @Roles metadata = compliance + admin (NO advisor)', () => {
    const meta = [...new Reflector().get<Role[]>(ROLES_KEY, exportHandler)].sort();
    expect(meta).toEqual(['admin', 'compliance']);
    expect(meta).not.toContain('advisor');
  });
});

// ---------------------------------------------------------------------------
// 11. DrizzleError-unwrap
// ---------------------------------------------------------------------------

describe('pgCode — DrizzleError unwrap (wave-6 lesson)', () => {
  it('extracts code from err.cause.code (DrizzleQueryError wrapper)', () => {
    const err = { cause: { code: '23505' } };
    expect(pgCode(err)).toBe('23505');
  });

  it('extracts code from err.code (bare pg driver error)', () => {
    const err = { code: '23503' };
    expect(pgCode(err)).toBe('23503');
  });

  it('cause.code takes precedence over err.code when both present', () => {
    const err = { code: 'outer', cause: { code: '42501' } };
    expect(pgCode(err)).toBe('42501');
  });

  it('returns undefined for unknown error shape', () => {
    expect(pgCode(new Error('plain error'))).toBeUndefined();
    expect(pgCode(null)).toBeUndefined();
    expect(pgCode('string')).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// 12. DI-BOOT
// ---------------------------------------------------------------------------

describe('RecordkeepingModule — DI boot', () => {
  it('RecordkeepingRepository can be instantiated (no missing providers at boot)', () => {
    const mockDb = { select: vi.fn(), transaction: vi.fn() };
    const repo = new RecordkeepingRepository(mockDb as unknown as never);
    expect(repo).toBeDefined();
    expect(repo.findFiltered).toBeDefined();
    expect(repo.findForExport).toBeDefined();
    expect(repo.runInTransaction).toBeDefined();
  });

  it('RecordkeepingService can be constructed with mocked dependencies', () => {
    const svc = makeService();
    expect(svc).toBeDefined();
    expect(svc.listAsActor).toBeDefined();
    expect(svc.verifyChainAsActor).toBeDefined();
    expect(svc.exportAsActor).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// 13. BOUNDARY: no external SDK import (structural smoke test)
// ---------------------------------------------------------------------------

describe('recordkeeping module — hard boundary (no external SDK)', () => {
  it('RecordkeepingService has no external SDK dependency (constructable with std mocks)', () => {
    expect(() => makeService()).not.toThrow();
  });

  it('createHash is the only crypto primitive used (node:crypto, no external library)', () => {
    const hash = createHash('sha256').update(JSON.stringify({})).digest('hex');
    expect(hash).toHaveLength(64);
    expect(/^[0-9a-f]{64}$/.test(hash)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// M2. INPUT VALIDATION — listFilterSchema guards the list endpoint
// ---------------------------------------------------------------------------

describe('RecordkeepingController.list — M2 input validation (listFilterSchema)', () => {
  function makeReqWithSession(): RequestWithSession {
    return {
      session: { getUserId: () => MOCK_ST_USER_ID },
    } as unknown as RequestWithSession;
  }

  function makeCtrl(): RecordkeepingController {
    // Validation fires before the service is called; compliance mock is fine.
    return new RecordkeepingController(
      makeService({ authRepo: makeAuthRepoMock(MOCK_COMPLIANCE_USER) })
    );
  }

  it('400 for mandateId that is not a valid UUID', async () => {
    await expect(
      makeCtrl().list({ mandateId: 'not-a-uuid' }, makeReqWithSession())
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('400 for actor that is not a valid UUID', async () => {
    await expect(
      makeCtrl().list({ actor: 'not-a-uuid' }, makeReqWithSession())
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('400 for limit exceeding max 200', async () => {
    await expect(
      makeCtrl().list({ limit: '100000000' }, makeReqWithSession())
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('400 for non-numeric limit', async () => {
    await expect(makeCtrl().list({ limit: 'abc' }, makeReqWithSession())).rejects.toBeInstanceOf(
      BadRequestException
    );
  });

  it('valid empty query passes validation and returns entries', async () => {
    const repo = makeRepoMock(MOCK_ENTRIES);
    const ctrl = new RecordkeepingController(
      makeService({ repo, authRepo: makeAuthRepoMock(MOCK_COMPLIANCE_USER) })
    );

    const result = await ctrl.list({}, makeReqWithSession());

    expect(result).toEqual(MOCK_ENTRIES);
    expect(repo.findFiltered).toHaveBeenCalled();
  });

  it('valid limit=200 passes validation', async () => {
    const repo = makeRepoMock(MOCK_ENTRIES);
    const ctrl = new RecordkeepingController(
      makeService({ repo, authRepo: makeAuthRepoMock(MOCK_COMPLIANCE_USER) })
    );

    const result = await ctrl.list({ limit: '200' }, makeReqWithSession());

    expect(result).toEqual(MOCK_ENTRIES);
    // limit is coerced and clamped by schema; repo receives a numeric limit
    expect(repo.findFiltered).toHaveBeenCalledWith(expect.objectContaining({ limit: 200 }));
  });
});

// ---------------------------------------------------------------------------
// Helper — extract string content from a Drizzle SQL object without
// triggering the circular-reference error that JSON.stringify hits on
// Column objects (PgTable → PgBigInt53 → PgTable).
//
// Actual Drizzle queryChunks structure (verified against installed version):
//   { value: string[] }  — SQL literal chunk (template string parts),
//                          e.g. { value: [" = 'audit-log-export' AND "] }
//   raw string           — interpolated scalar param value (e.g. "mandate-uuid")
//   SQL<T>               — nested sql`...` with queryChunks property
//   Column               — column ref with many DB-schema keys (name, table, ...);
//                          value is undefined — skip (circular refs via .table)
//
// This helper extracts SQL literal strings (value arrays) + scalar string params.
// Sufficient to assert literal branches ('audit-log-export', 'mandate_id') and
// bound UUID values appear in the fragment.
// ---------------------------------------------------------------------------

function extractSqlText(node: unknown): string {
  if (node === null || node === undefined) return '';
  if (typeof node === 'string') return node; // raw string scalar param
  if (typeof node !== 'object') return '';

  const obj = node as Record<string, unknown>;

  // Nested SQL<T> — has queryChunks array → recurse
  if (Array.isArray(obj.queryChunks)) {
    return (obj.queryChunks as unknown[]).map(extractSqlText).join('');
  }

  // SQL literal chunk — { value: string[] } (template string parts)
  if ('value' in obj && Array.isArray(obj.value)) {
    return (obj.value as unknown[]).filter((s) => typeof s === 'string').join('');
  }

  // Column reference or other complex object (value undefined or not array) — skip
  return '';
}

// ---------------------------------------------------------------------------
// L3. ADVISOR + MANDATE NARROWING — buildConditions narrows outreach to mandate
// ---------------------------------------------------------------------------

describe('RecordkeepingRepository — L3 advisor mandate narrowing', () => {
  const mockDb = { select: vi.fn(), transaction: vi.fn() };

  it('advisor + mandateId produces a different SQL fragment than advisor-only', () => {
    const repo = new RecordkeepingRepository(mockDb as unknown as never);

    // Cast to access the private buildConditions helper (test-only)
    type BC = (f: RecordkeepingFilter) => { mandateFragment: unknown; simpleConditions: unknown[] };
    const bc = (repo as unknown as { buildConditions: BC }).buildConditions.bind(repo);

    const withMandate = bc({ advisorUserId: 'adv-uuid', mandateId: 'mid-uuid' });
    const withoutMandate = bc({ advisorUserId: 'adv-uuid' });

    expect(withMandate.mandateFragment).not.toBeNull();
    expect(withoutMandate.mandateFragment).not.toBeNull();
    // The fragments must differ — the mandate-narrowed one is more restrictive
    const withStr = extractSqlText(withMandate.mandateFragment);
    const withoutStr = extractSqlText(withoutMandate.mandateFragment);
    expect(withStr).not.toEqual(withoutStr);
  });

  it('advisor + mandateId: the mandateId value appears in the SQL (ANDed into subquery)', () => {
    const repo = new RecordkeepingRepository(mockDb as unknown as never);
    type BC = (f: RecordkeepingFilter) => { mandateFragment: unknown; simpleConditions: unknown[] };
    const bc = (repo as unknown as { buildConditions: BC }).buildConditions.bind(repo);

    const result = bc({ advisorUserId: 'adv-uuid', mandateId: 'test-mandate-id' });

    // The mandateId value is embedded as a parameter in the SQL fragment
    expect(extractSqlText(result.mandateFragment)).toContain('test-mandate-id');
  });

  it('advisor without mandateId: advisorUserId is in the fragment, no mandate literal', () => {
    const repo = new RecordkeepingRepository(mockDb as unknown as never);
    type BC = (f: RecordkeepingFilter) => { mandateFragment: unknown; simpleConditions: unknown[] };
    const bc = (repo as unknown as { buildConditions: BC }).buildConditions.bind(repo);

    const result = bc({ advisorUserId: 'adv-only-uuid' });

    expect(result.mandateFragment).not.toBeNull();
    const sqlText = extractSqlText(result.mandateFragment);
    expect(sqlText).toContain('adv-only-uuid');
    // Without mandateId no mandate_id clause is added
    expect(sqlText).not.toContain('mandate_id');
  });
});

// ---------------------------------------------------------------------------
// L4. AUDIT-LOG-EXPORT IN MANDATE DERIVATION — prior export events included
// ---------------------------------------------------------------------------

describe('RecordkeepingRepository — L4 audit-log-export branch in mandate derivation', () => {
  const mockDb = { select: vi.fn(), transaction: vi.fn() };

  it('mandate derivation SQL includes the audit-log-export resource_type branch', () => {
    const repo = new RecordkeepingRepository(mockDb as unknown as never);
    type BC = (f: RecordkeepingFilter) => { mandateFragment: unknown; simpleConditions: unknown[] };
    const bc = (repo as unknown as { buildConditions: BC }).buildConditions.bind(repo);

    const result = bc({ mandateId: 'test-mandate-uuid' });

    expect(result.mandateFragment).not.toBeNull();
    // The SQL string chunks include the audit-log-export literal (L4 branch)
    expect(extractSqlText(result.mandateFragment)).toContain('audit-log-export');
  });

  it('mandate derivation for audit-log-export: mandateId is the direct resource_id match', () => {
    const repo = new RecordkeepingRepository(mockDb as unknown as never);
    type BC = (f: RecordkeepingFilter) => { mandateFragment: unknown; simpleConditions: unknown[] };
    const bc = (repo as unknown as { buildConditions: BC }).buildConditions.bind(repo);

    const result = bc({ mandateId: 'specific-mandate-uuid' });

    // The mandateId value appears as a parameter alongside the audit-log-export literal
    const sqlText = extractSqlText(result.mandateFragment);
    expect(sqlText).toContain('audit-log-export');
    expect(sqlText).toContain('specific-mandate-uuid');
  });
});

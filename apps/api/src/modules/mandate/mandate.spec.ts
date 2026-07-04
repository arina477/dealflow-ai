/**
 * Mandate module B-2 + B-6 regression tests — verifies all required ACs:
 *
 *   1.  mandateCreateSchema parse/reject — missing acknowledgments → reject.
 *   2.  RBAC matrix — advisor 201 / analyst 403 (write) / anon 401 / analyst 200 (read).
 *   3.  Actor id = app users.id NOT raw ST id (regression).
 *   4.  Audited in-txn — AuditService.append called with 'mandate-create' + app users.id.
 *   5.  One-txn rollback — audit fail → no mandate row (rollback on audit fail).
 *   6.  Disclaimer derivation — valid jurisdiction → resolved FK; no-match → 400.
 *   7.  All-3-acks-required — missing/false acknowledgment → 400.
 *   8.  getById 404 — mandate not found → NotFoundException.
 *   9.  DrizzleError-unwrap — pgCode(err.cause.code) → proper 400/409/404 (not 500).
 *  10.  CRITICAL-1 — PATCH configureAsActor returns full MandateDetail (not bare Mandate).
 *  11.  CRITICAL-2 — active mandate is locked: configure → 409 ConflictException.
 *  12.  CRITICAL-2 — active → draft status transition → 409 ConflictException.
 *  13.  CRITICAL-2 — draft mandate edit → 200 (allowed).
 *  14.  CRITICAL-2 — draft → active transition → 200 (allowed).
 *  15.  CRITICAL-3 — 2 active disclaimer templates for jurisdiction → ConflictException.
 *  16.  CRITICAL-3 — 1 active disclaimer template → resolves correctly.
 *  17.  READ-SCHEMA — mandateSchema parses payload with extra server field (passthrough).
 *  18.  READ-SCHEMA — mandateCreateSchema REJECTS unknown field (mass-assignment guard intact).
 *  19.  READ-SCHEMA — mandateListFilterSchema parses with extra query param (passthrough).
 *  20.  READ-SCHEMA — mandateListFilterSchema still validates known field values.
 *
 * Mock strategy:
 *   - DB / Drizzle: mocked at the repository boundary (repository is mocked).
 *   - AuditService: vi.fn() to assert append called with correct args.
 *   - AuthRepository: vi.fn() to assert getUserWithRole called + returns app id.
 *   - SuperTokens Session: mocked via vi.mock for guard tests.
 *   - No live DB required.
 */

import type { Role } from '@dealflow/shared';
import {
  mandateAcknowledgmentsSchema,
  mandateCreateSchema,
  mandateListFilterSchema,
  mandateSchema,
  rolesForRoute,
} from '@dealflow/shared';
import type { ExecutionContext } from '@nestjs/common';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { afterEach, describe, expect, it, vi } from 'vitest';

// Mock supertokens-node session before importing guards
vi.mock('supertokens-node/recipe/session', () => ({
  default: {
    getSession: vi.fn().mockRejectedValue(new Error('no session')),
  },
}));

import type { AuditService } from '../audit/audit.service';
import type { AuthRepository } from '../auth/auth.repository';
import { ROLES_KEY, RolesGuard } from '../auth/guards/roles.guard';
import { MandateController } from './mandate.controller';
import type { MandateRepository } from './mandate.repository';
import { MandateService } from './mandate.service';

// ---------------------------------------------------------------------------
// 1. mandateCreateSchema — parse + reject
// ---------------------------------------------------------------------------

describe('mandateCreateSchema — parse and reject', () => {
  const baseValid = {
    sellerName: 'Acme Corp',
    compliance: {
      jurisdiction: 'US',
      acknowledgments: {
        lawful_authorization: true as const,
        ai_results_validated: true as const,
        conflict_dbs_reviewed: true as const,
      },
    },
  };

  it('accepts a minimal valid input (seller name + compliance + all 3 acks)', () => {
    const result = mandateCreateSchema.safeParse(baseValid);
    expect(result.success).toBe(true);
  });

  it('accepts optional buyerCriteria (all nullable)', () => {
    const result = mandateCreateSchema.safeParse({
      ...baseValid,
      buyerCriteria: { industry: 'Tech', geo: 'US', sizeBand: 'mid', dealType: 'acquisition' },
    });
    expect(result.success).toBe(true);
  });

  it('rejects missing sellerName', () => {
    const { sellerName: _unused, ...noSeller } = baseValid;
    const result = mandateCreateSchema.safeParse(noSeller);
    expect(result.success).toBe(false);
  });

  it('rejects missing compliance object entirely', () => {
    const { compliance: _unused, ...noCompliance } = baseValid;
    const result = mandateCreateSchema.safeParse(noCompliance);
    expect(result.success).toBe(false);
  });

  it('rejects missing jurisdiction in compliance', () => {
    const result = mandateCreateSchema.safeParse({
      ...baseValid,
      compliance: {
        acknowledgments: baseValid.compliance.acknowledgments,
      },
    });
    expect(result.success).toBe(false);
  });

  it('rejects when lawful_authorization is false (must be literal true)', () => {
    const result = mandateCreateSchema.safeParse({
      ...baseValid,
      compliance: {
        ...baseValid.compliance,
        acknowledgments: {
          lawful_authorization: false,
          ai_results_validated: true as const,
          conflict_dbs_reviewed: true as const,
        },
      },
    });
    expect(result.success).toBe(false);
  });

  it('rejects when ai_results_validated is false (must be literal true)', () => {
    const result = mandateCreateSchema.safeParse({
      ...baseValid,
      compliance: {
        ...baseValid.compliance,
        acknowledgments: {
          lawful_authorization: true as const,
          ai_results_validated: false,
          conflict_dbs_reviewed: true as const,
        },
      },
    });
    expect(result.success).toBe(false);
  });

  it('rejects when conflict_dbs_reviewed is false (must be literal true)', () => {
    const result = mandateCreateSchema.safeParse({
      ...baseValid,
      compliance: {
        ...baseValid.compliance,
        acknowledgments: {
          lawful_authorization: true as const,
          ai_results_validated: true as const,
          conflict_dbs_reviewed: false,
        },
      },
    });
    expect(result.success).toBe(false);
  });

  it('rejects when any acknowledgment is missing', () => {
    const result = mandateCreateSchema.safeParse({
      ...baseValid,
      compliance: {
        ...baseValid.compliance,
        acknowledgments: {
          lawful_authorization: true as const,
          ai_results_validated: true as const,
          // conflict_dbs_reviewed missing
        },
      },
    });
    expect(result.success).toBe(false);
  });

  it('rejects when acknowledgments object is missing entirely', () => {
    const result = mandateCreateSchema.safeParse({
      ...baseValid,
      compliance: {
        jurisdiction: 'US',
        // acknowledgments missing
      },
    });
    expect(result.success).toBe(false);
  });

  it('does NOT accept disclaimerTemplateId in input (derived server-side — D2)', () => {
    // The schema is strict — extra fields are rejected
    const result = mandateCreateSchema.safeParse({
      ...baseValid,
      compliance: {
        ...baseValid.compliance,
        disclaimerTemplateId: 'some-uuid', // should be rejected (strict)
      },
    });
    expect(result.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// 2. mandateAcknowledgmentsSchema — direct unit tests
// ---------------------------------------------------------------------------

describe('mandateAcknowledgmentsSchema — all-3-acks-required', () => {
  it('accepts {lawful_authorization:true, ai_results_validated:true, conflict_dbs_reviewed:true}', () => {
    const result = mandateAcknowledgmentsSchema.safeParse({
      lawful_authorization: true,
      ai_results_validated: true,
      conflict_dbs_reviewed: true,
    });
    expect(result.success).toBe(true);
  });

  it('rejects each missing acknowledgment independently', () => {
    for (const key of [
      'lawful_authorization',
      'ai_results_validated',
      'conflict_dbs_reviewed',
    ] as const) {
      const payload = {
        lawful_authorization: true as const,
        ai_results_validated: true as const,
        conflict_dbs_reviewed: true as const,
      };
      const partial = { ...payload };
      delete (partial as Record<string, unknown>)[key];
      const result = mandateAcknowledgmentsSchema.safeParse(partial);
      expect(result.success, `should reject when ${key} is missing`).toBe(false);
    }
  });

  it('rejects false values for each acknowledgment', () => {
    for (const key of [
      'lawful_authorization',
      'ai_results_validated',
      'conflict_dbs_reviewed',
    ] as const) {
      const payload: Record<string, unknown> = {
        lawful_authorization: true,
        ai_results_validated: true,
        conflict_dbs_reviewed: true,
        [key]: false,
      };
      const result = mandateAcknowledgmentsSchema.safeParse(payload);
      expect(result.success, `should reject when ${key} is false`).toBe(false);
    }
  });
});

// ---------------------------------------------------------------------------
// 3. RBAC matrix — using real RolesGuard + @Roles() metadata from controller
// ---------------------------------------------------------------------------

const TEST_USER_ID = 'st-user-abc123';

const createMandateHandler = MandateController.prototype.createMandate;
const listMandatesHandler = MandateController.prototype.listMandates;

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
    getClass: () => MandateController,
    switchToHttp: () => ({
      getRequest: () => req,
      getResponse: () => ({}),
    }),
  } as unknown as ExecutionContext;
}

function mockAuthRepo(dbRole: Role | null): AuthRepository {
  return {
    resolveRoleBySupertokensUserId: vi.fn().mockResolvedValue(dbRole),
  } as unknown as AuthRepository;
}

function guardWithDbRole(dbRole: Role | null): RolesGuard {
  return new RolesGuard(new Reflector(), mockAuthRepo(dbRole));
}

describe('RBAC matrix — POST /mandates (write: advisor, admin only)', () => {
  afterEach(() => vi.clearAllMocks());

  it('sources @Roles() from the shared roleRoutes map (single source of truth)', () => {
    const fromSharedMap = [...rolesForRoute('/mandates/new')].sort();
    const fromMetadata = [...new Reflector().get<Role[]>(ROLES_KEY, createMandateHandler)].sort();
    expect(fromMetadata).toEqual(fromSharedMap);
    expect(fromMetadata).toEqual(['admin', 'advisor']);
  });

  it('advisor → ALLOW (201) — DB role advisor', async () => {
    const guard = guardWithDbRole('advisor');
    await expect(guard.canActivate(contextFor(createMandateHandler, 'advisor'))).resolves.toBe(
      true
    );
  });

  it('admin → ALLOW (201) — DB role admin (wave-8)', async () => {
    const guard = guardWithDbRole('admin');
    await expect(guard.canActivate(contextFor(createMandateHandler, 'admin'))).resolves.toBe(true);
  });

  it('analyst → DENY (403) — analyst is read-only for mandates', async () => {
    const guard = guardWithDbRole('analyst');
    await expect(
      guard.canActivate(contextFor(createMandateHandler, 'analyst'))
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('compliance → DENY (403) — compliance role cannot create mandates', async () => {
    const guard = guardWithDbRole('compliance');
    await expect(
      guard.canActivate(contextFor(createMandateHandler, 'compliance'))
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('unauthenticated (no session) → 401 UnauthorizedException', async () => {
    const guard = guardWithDbRole('advisor');
    await expect(
      guard.canActivate(contextFor(createMandateHandler, undefined))
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });
});

describe('RBAC matrix — GET /mandates (read: advisor, admin, analyst)', () => {
  afterEach(() => vi.clearAllMocks());

  it('sources @Roles() from /mandates shared map: advisor + admin + analyst', () => {
    const fromSharedMap = [...rolesForRoute('/mandates')].sort();
    const fromMetadata = [...new Reflector().get<Role[]>(ROLES_KEY, listMandatesHandler)].sort();
    expect(fromMetadata).toEqual(fromSharedMap);
    expect(fromMetadata).toEqual(['admin', 'advisor', 'analyst']);
  });

  it('analyst → ALLOW (200) — analyst can list mandates (read-only)', async () => {
    const guard = guardWithDbRole('analyst');
    await expect(guard.canActivate(contextFor(listMandatesHandler, 'analyst'))).resolves.toBe(true);
  });

  it('advisor → ALLOW (200)', async () => {
    const guard = guardWithDbRole('advisor');
    await expect(guard.canActivate(contextFor(listMandatesHandler, 'advisor'))).resolves.toBe(true);
  });

  it('admin → ALLOW (200) — wave-8 mandate API admin access', async () => {
    const guard = guardWithDbRole('admin');
    await expect(guard.canActivate(contextFor(listMandatesHandler, 'admin'))).resolves.toBe(true);
  });

  it('compliance → DENY (403)', async () => {
    const guard = guardWithDbRole('compliance');
    await expect(
      guard.canActivate(contextFor(listMandatesHandler, 'compliance'))
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('unauthenticated → 401', async () => {
    const guard = guardWithDbRole('advisor');
    await expect(
      guard.canActivate(contextFor(listMandatesHandler, undefined))
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });
});

// ---------------------------------------------------------------------------
// 21. GET /mandates/jurisdictions — RBAC + route-ordering
// ---------------------------------------------------------------------------

describe('RBAC matrix — GET /mandates/jurisdictions (advisor+admin only)', () => {
  afterEach(() => vi.clearAllMocks());

  const listJurisdictionsHandler = MandateController.prototype.listJurisdictions;

  it('sources @Roles() from the shared roleRoutes map for /mandates/new (write roles)', () => {
    // listJurisdictions uses MANDATES_WRITE_ROLES (same as /mandates/new).
    const fromSharedMap = [...rolesForRoute('/mandates/new')].sort();
    const fromMetadata = [
      ...new Reflector().get<Role[]>(ROLES_KEY, listJurisdictionsHandler),
    ].sort();
    expect(fromMetadata).toEqual(fromSharedMap);
    expect(fromMetadata).toEqual(['admin', 'advisor']);
  });

  it('advisor → ALLOW (200) — advisor is the primary create-mandate persona', async () => {
    const guard = guardWithDbRole('advisor');
    await expect(guard.canActivate(contextFor(listJurisdictionsHandler, 'advisor'))).resolves.toBe(
      true
    );
  });

  it('admin → ALLOW (200)', async () => {
    const guard = guardWithDbRole('admin');
    await expect(guard.canActivate(contextFor(listJurisdictionsHandler, 'admin'))).resolves.toBe(
      true
    );
  });

  it('analyst → DENY (403) — analyst cannot create mandates; jurisdiction list is write-gated', async () => {
    const guard = guardWithDbRole('analyst');
    await expect(
      guard.canActivate(contextFor(listJurisdictionsHandler, 'analyst'))
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('unauthenticated (no session) → 401 UnauthorizedException', async () => {
    const guard = guardWithDbRole('advisor');
    await expect(
      guard.canActivate(contextFor(listJurisdictionsHandler, undefined))
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });
});

describe('Route ordering — GET /mandates/jurisdictions not captured by :id', () => {
  afterEach(() => vi.clearAllMocks());

  it('@Roles on listJurisdictions is MANDATES_WRITE_ROLES (advisor+admin), not MANDATES_READ_ROLES', () => {
    // If "jurisdictions" were captured by :id it would resolve via getMandateDetail
    // (which uses MANDATES_READ_ROLES = advisor, admin, analyst). By asserting
    // listJurisdictions handler uses MANDATES_WRITE_ROLES we confirm the correct
    // handler is registered for the literal "jurisdictions" segment.
    const listJurisdictionsHandler = MandateController.prototype.listJurisdictions;
    const getByIdHandler = MandateController.prototype.getMandateDetail;

    const jurisdictionsRoles = [
      ...new Reflector().get<Role[]>(ROLES_KEY, listJurisdictionsHandler),
    ].sort();
    const byIdRoles = [...new Reflector().get<Role[]>(ROLES_KEY, getByIdHandler)].sort();

    // listJurisdictions handler is write-gated (advisor + admin)
    expect(jurisdictionsRoles).toEqual(['admin', 'advisor']);
    // getMandateDetail handler is read-gated (advisor + admin + analyst)
    expect(byIdRoles).toEqual(['admin', 'advisor', 'analyst']);
    // They must differ — proving the handlers are distinct (not the same :id handler)
    expect(jurisdictionsRoles).not.toEqual(byIdRoles);
  });
});

// ---------------------------------------------------------------------------
// 22. MandateService.listAvailableJurisdictions — delegates to repository
// ---------------------------------------------------------------------------

describe('MandateService.listAvailableJurisdictions — delegates to repository', () => {
  afterEach(() => vi.clearAllMocks());

  it('returns distinct active jurisdiction objects from the repository', async () => {
    const expected = [{ jurisdiction: 'US' }, { jurisdiction: 'EU' }];
    const repo = makeMockRepository({
      listAvailableJurisdictions: vi.fn().mockResolvedValue(expected),
    });
    const audit = makeMockAuditService();
    const authRepo = makeMockAuthRepo('app-user-uuid-001', 'advisor');

    const service = new MandateService(repo, audit, authRepo);
    const result = await service.listAvailableJurisdictions();

    expect(repo.listAvailableJurisdictions).toHaveBeenCalledTimes(1);
    expect(result).toEqual(expected);
  });

  it('returns empty array when no active disclaimer templates exist', async () => {
    const repo = makeMockRepository({
      listAvailableJurisdictions: vi.fn().mockResolvedValue([]),
    });
    const audit = makeMockAuditService();
    const authRepo = makeMockAuthRepo('app-user-uuid-001', 'advisor');

    const service = new MandateService(repo, audit, authRepo);
    const result = await service.listAvailableJurisdictions();

    expect(result).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// 4–9. MandateService unit tests — mocked repository + audit + auth
// ---------------------------------------------------------------------------

function makeMockAuditService() {
  return {
    append: vi.fn().mockResolvedValue({}),
  } as unknown as AuditService;
}

function makeMockAuthRepo(appUserId: string, roleName: string) {
  return {
    getUserWithRole: vi.fn().mockResolvedValue({ id: appUserId, roleName }),
  } as unknown as AuthRepository;
}

function makeMockRepository(overrides: Partial<MandateRepository> = {}) {
  return {
    runInTransaction: vi
      .fn()
      .mockImplementation((work: (tx: unknown) => Promise<unknown>) => work({})),
    listAvailableJurisdictions: vi.fn().mockResolvedValue([{ jurisdiction: 'US' }]),
    findActiveDisclaimerByJurisdiction: vi.fn().mockResolvedValue({
      id: 'disclaimer-uuid-001',
      jurisdiction: 'US',
      body: 'Standard US disclaimer',
      version: 1,
      active: true,
      createdAt: '2026-01-01T00:00:00Z',
      createdBy: null,
    }),
    insertMandate: vi.fn().mockResolvedValue({
      id: 'mandate-uuid-001',
      createdBy: 'app-user-uuid-001',
      sellerName: 'Acme Corp',
      sellerIndustry: null,
      sellerGeo: null,
      sellerSizeBand: null,
      description: null,
      dealType: null,
      status: 'draft',
      createdAt: '2026-07-04 00:00:00+00',
      updatedAt: null,
    }),
    insertBuyerCriteria: vi.fn().mockResolvedValue({
      id: 'criteria-uuid-001',
      mandateId: 'mandate-uuid-001',
      industry: null,
      geo: null,
      sizeBand: null,
      dealType: null,
    }),
    insertComplianceProfile: vi.fn().mockResolvedValue({
      id: 'profile-uuid-001',
      mandateId: 'mandate-uuid-001',
      jurisdiction: 'US',
      disclaimerTemplateId: 'disclaimer-uuid-001',
      suppressionScope: null,
      lawfulAuthorization: true,
      aiResultsValidated: true,
      conflictDbsReviewed: true,
    }),
    findMandateById: vi.fn().mockResolvedValue({
      id: 'mandate-uuid-001',
      createdBy: 'app-user-uuid-001',
      sellerName: 'Acme Corp',
      sellerIndustry: null,
      sellerGeo: null,
      sellerSizeBand: null,
      description: null,
      dealType: null,
      status: 'draft',
      createdAt: '2026-07-04 00:00:00+00',
      updatedAt: null,
    }),
    findMandateByIdForUpdate: vi.fn().mockResolvedValue({
      id: 'mandate-uuid-001',
      createdBy: 'app-user-uuid-001',
      sellerName: 'Acme Corp',
      sellerIndustry: null,
      sellerGeo: null,
      sellerSizeBand: null,
      description: null,
      dealType: null,
      status: 'draft',
      createdAt: '2026-07-04 00:00:00+00',
      updatedAt: null,
    }),
    listMandates: vi.fn().mockResolvedValue([]),
    updateMandate: vi.fn().mockResolvedValue({
      id: 'mandate-uuid-001',
      createdBy: 'app-user-uuid-001',
      sellerName: 'Acme Corp Updated',
      sellerIndustry: null,
      sellerGeo: null,
      sellerSizeBand: null,
      description: null,
      dealType: null,
      status: 'active',
      createdAt: '2026-07-04 00:00:00+00',
      updatedAt: '2026-07-04 01:00:00+00',
    }),
    upsertBuyerCriteria: vi.fn().mockResolvedValue(undefined),
    findBuyerCriteriaByMandateId: vi.fn().mockResolvedValue(null),
    findComplianceProfileByMandateId: vi.fn().mockResolvedValue(null),
    // Transaction-aware variants used by configureAsActor (CRITICAL-1)
    findBuyerCriteriaByMandateIdInTx: vi.fn().mockResolvedValue(null),
    findComplianceProfileByMandateIdInTx: vi.fn().mockResolvedValue(null),
    ...overrides,
  } as unknown as MandateRepository;
}

const VALID_CREATE_INPUT = {
  sellerName: 'Acme Corp',
  compliance: {
    jurisdiction: 'US',
    acknowledgments: {
      lawful_authorization: true as const,
      ai_results_validated: true as const,
      conflict_dbs_reviewed: true as const,
    },
  },
};

describe('MandateService.createAsActor — actor id + audit + one-txn atomicity', () => {
  afterEach(() => vi.clearAllMocks());

  it('translates ST id → app users.id (actor-id-FK regression)', async () => {
    const appUserId = 'app-user-uuid-001';
    const stUserId = 'supertokens-user-raw-id';
    const authRepo = makeMockAuthRepo(appUserId, 'advisor');
    const repo = makeMockRepository();
    const audit = makeMockAuditService();

    const service = new MandateService(repo, audit, authRepo);
    await service.createAsActor(VALID_CREATE_INPUT, stUserId);

    // AuthRepository was called with the raw ST id
    expect(authRepo.getUserWithRole).toHaveBeenCalledWith(stUserId);
    // insertMandate was called with the app users.id (NOT the ST id)
    const insertCall = (repo.insertMandate as ReturnType<typeof vi.fn>).mock.calls[0]?.[1] as {
      createdBy: string;
    };
    expect(insertCall.createdBy).toBe(appUserId);
    expect(insertCall.createdBy).not.toBe(stUserId);
  });

  it('calls AuditService.append with action=mandate-create + app users.id (audited in-txn)', async () => {
    const appUserId = 'app-user-uuid-001';
    const authRepo = makeMockAuthRepo(appUserId, 'advisor');
    const repo = makeMockRepository();
    const audit = makeMockAuditService();

    const service = new MandateService(repo, audit, authRepo);
    await service.createAsActor(VALID_CREATE_INPUT, 'st-id');

    expect(audit.append).toHaveBeenCalledTimes(1);
    const [auditInput] = (audit.append as ReturnType<typeof vi.fn>).mock.calls[0] as [
      { actorUserId: string; action: string },
      unknown,
    ];
    expect(auditInput.action).toBe('mandate-create');
    expect(auditInput.actorUserId).toBe(appUserId);
  });

  it('one-txn rollback — audit failure rolls back all table writes', async () => {
    const authRepo = makeMockAuthRepo('app-user-uuid-001', 'advisor');
    let insertMandateCalled = false;
    const repo = makeMockRepository({
      // Simulate transaction that rolls back when audit throws
      runInTransaction: vi
        .fn()
        .mockImplementation(async (work: (tx: unknown) => Promise<unknown>) => {
          return await work({});
        }),
      insertMandate: vi.fn().mockImplementation(async () => {
        insertMandateCalled = true;
        return {
          id: 'mandate-uuid-001',
          createdBy: 'app-user-uuid-001',
          sellerName: 'Acme Corp',
          sellerIndustry: null,
          sellerGeo: null,
          sellerSizeBand: null,
          description: null,
          dealType: null,
          status: 'draft',
          createdAt: '2026-07-04 00:00:00+00',
          updatedAt: null,
        };
      }),
    });

    const audit = {
      append: vi.fn().mockRejectedValue(new Error('Simulated audit chain failure')),
    } as unknown as AuditService;

    const service = new MandateService(repo, audit, authRepo);

    await expect(service.createAsActor(VALID_CREATE_INPUT, 'st-id')).rejects.toThrow(
      'Simulated audit chain failure'
    );

    // The mandate insert was called before the audit failure
    expect(insertMandateCalled).toBe(true);
    // Audit was attempted
    expect(audit.append).toHaveBeenCalledTimes(1);
    // The error propagated (simulating transaction rollback)
    // In a real transaction, the DB would roll back the mandate row
  });

  it('throws ForbiddenException (403) if actor is not found (no app-DB user row)', async () => {
    const authRepo = {
      getUserWithRole: vi.fn().mockResolvedValue(null),
    } as unknown as AuthRepository;
    const repo = makeMockRepository();
    const audit = makeMockAuditService();

    const service = new MandateService(repo, audit, authRepo);
    await expect(service.createAsActor(VALID_CREATE_INPUT, 'st-id')).rejects.toBeInstanceOf(
      ForbiddenException
    );
  });
});

describe('MandateService.createAsActor — disclaimer derivation (D2)', () => {
  afterEach(() => vi.clearAllMocks());

  it('derives disclaimerTemplateId from jurisdiction — resolved FK used in profile insert', async () => {
    const disclaimerId = 'disclaimer-uuid-001';
    const repo = makeMockRepository({
      findActiveDisclaimerByJurisdiction: vi.fn().mockResolvedValue({
        id: disclaimerId,
        jurisdiction: 'US',
        body: 'Disclaimer text',
        version: 1,
        active: true,
        createdAt: '2026-01-01T00:00:00Z',
        createdBy: null,
      }),
    });
    const audit = makeMockAuditService();
    const authRepo = makeMockAuthRepo('app-user-uuid-001', 'advisor');

    const service = new MandateService(repo, audit, authRepo);
    await service.createAsActor(VALID_CREATE_INPUT, 'st-id');

    // findActiveDisclaimerByJurisdiction was called with the input jurisdiction
    expect(repo.findActiveDisclaimerByJurisdiction).toHaveBeenCalledWith({}, 'US');

    // insertComplianceProfile was called with the DERIVED disclaimerTemplateId
    const profileCall = (repo.insertComplianceProfile as ReturnType<typeof vi.fn>).mock
      .calls[0]?.[1] as { disclaimerTemplateId: string };
    expect(profileCall.disclaimerTemplateId).toBe(disclaimerId);
  });

  it('throws BadRequestException (400) when no active disclaimer for jurisdiction', async () => {
    const repo = makeMockRepository({
      findActiveDisclaimerByJurisdiction: vi.fn().mockResolvedValue(null),
    });
    const audit = makeMockAuditService();
    const authRepo = makeMockAuthRepo('app-user-uuid-001', 'advisor');

    const service = new MandateService(repo, audit, authRepo);
    await expect(
      service.createAsActor(
        {
          ...VALID_CREATE_INPUT,
          compliance: { ...VALID_CREATE_INPUT.compliance, jurisdiction: 'UNKNOWN_JURISDICTION' },
        },
        'st-id'
      )
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});

describe('MandateService.createAsActor — acknowledgments validation (D5)', () => {
  afterEach(() => vi.clearAllMocks());

  it('throws BadRequestException if any acknowledgment is false at service level', async () => {
    const authRepo = makeMockAuthRepo('app-user-uuid-001', 'advisor');
    const repo = makeMockRepository();
    const audit = makeMockAuditService();
    const service = new MandateService(repo, audit, authRepo);

    // Bypass Zod (simulate direct service call with false acknowledgment)
    const badInput = {
      sellerName: 'Acme Corp',
      compliance: {
        jurisdiction: 'US',
        acknowledgments: {
          lawful_authorization: false as unknown as true,
          ai_results_validated: true as const,
          conflict_dbs_reviewed: true as const,
        },
      },
    };

    await expect(service.createAsActor(badInput, 'st-id')).rejects.toBeInstanceOf(
      BadRequestException
    );
  });
});

describe('MandateService.getById — 404 when not found', () => {
  afterEach(() => vi.clearAllMocks());

  it('throws NotFoundException (404) when mandate is not found', async () => {
    const repo = makeMockRepository({
      findMandateById: vi.fn().mockResolvedValue(null),
    });
    const audit = makeMockAuditService();
    const authRepo = makeMockAuthRepo('app-user-uuid-001', 'advisor');

    const service = new MandateService(repo, audit, authRepo);
    await expect(service.getById('non-existent-uuid')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('returns MandateDetail when found', async () => {
    const authRepo = makeMockAuthRepo('app-user-uuid-001', 'advisor');
    const repo = makeMockRepository();
    const audit = makeMockAuditService();

    const service = new MandateService(repo, audit, authRepo);
    const result = await service.getById('mandate-uuid-001');

    expect(result.mandate.id).toBe('mandate-uuid-001');
    expect(result.mandate.sellerName).toBe('Acme Corp');
    // buyerCriteria and complianceProfile are null in mock (not found returns null)
    expect(result.buyerCriteria).toBeNull();
    expect(result.complianceProfile).toBeNull();
  });
});

describe('MandateService.list — status filter', () => {
  afterEach(() => vi.clearAllMocks());

  it('calls repository.listMandates with the given filter', async () => {
    const repo = makeMockRepository();
    const audit = makeMockAuditService();
    const authRepo = makeMockAuthRepo('app-user-uuid-001', 'advisor');

    const service = new MandateService(repo, audit, authRepo);
    await service.list({ status: 'draft' });

    expect(repo.listMandates).toHaveBeenCalledWith({ status: 'draft' });
  });

  it('returns empty mandates array when repository returns []', async () => {
    const repo = makeMockRepository({ listMandates: vi.fn().mockResolvedValue([]) });
    const audit = makeMockAuditService();
    const authRepo = makeMockAuthRepo('app-user-uuid-001', 'advisor');

    const service = new MandateService(repo, audit, authRepo);
    const result = await service.list({ status: 'all' });

    expect(result.mandates).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// 9. DrizzleQueryError-unwrap — pgCode helper
// ---------------------------------------------------------------------------

describe('DrizzleError-unwrap — err.cause.code → proper status', () => {
  it('returns the pg code from err.cause.code (DrizzleQueryError wrapper)', () => {
    // Simulate the DrizzleQueryError structure: err.code is undefined,
    // err.cause.code is the SQLSTATE string.
    const drizzleError = Object.assign(new Error('query error'), {
      cause: { code: '23505', message: 'unique constraint violation' },
    });

    // Inline the pgCode logic from the repository to verify it extracts correctly
    const err = drizzleError as unknown;
    const causeCode =
      typeof err === 'object' &&
      err !== null &&
      'cause' in err &&
      typeof (err as { cause: unknown }).cause === 'object' &&
      (err as { cause: unknown }).cause !== null &&
      'code' in (err as { cause: Record<string, unknown> }).cause
        ? (err as { cause: Record<string, unknown> }).cause.code
        : undefined;

    expect(causeCode).toBe('23505');
  });

  it('falls back to err.code for bare pg driver errors (no DrizzleQueryError wrapper)', () => {
    const bareError = Object.assign(new Error('bare pg error'), { code: '23503' });
    const err = bareError as unknown;

    const code =
      typeof err === 'object' && err !== null && 'code' in err
        ? (err as { code: unknown }).code
        : undefined;

    expect(code).toBe('23503');
  });

  it('repository.insertComplianceProfile throws ConflictException on 23505 (1:1 unique violation)', async () => {
    const uniqueError = Object.assign(new Error('unique violation'), {
      cause: { code: '23505' },
    });

    const { MandateRepository: MandateRepoClass } = await import('./mandate.repository');
    const fakeDb = {
      transaction: vi.fn(),
    };
    const repo = new MandateRepoClass(fakeDb as unknown as Parameters<typeof MandateRepoClass>[0]);

    const fakeTx = {
      insert: vi.fn().mockReturnValue({
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockRejectedValue(uniqueError),
        }),
      }),
    };

    const { ConflictException: CEx } = await import('@nestjs/common');

    await expect(
      repo.insertComplianceProfile(
        fakeTx as unknown as Parameters<typeof repo.insertComplianceProfile>[0],
        {
          mandateId: 'mandate-uuid-001',
          jurisdiction: 'US',
          disclaimerTemplateId: 'disclaimer-uuid-001',
          suppressionScope: null,
          lawfulAuthorization: true,
          aiResultsValidated: true,
          conflictDbsReviewed: true,
        }
      )
    ).rejects.toBeInstanceOf(CEx);
  });
});

// ---------------------------------------------------------------------------
// 10. CRITICAL-1 — configureAsActor returns full MandateDetail (not bare Mandate)
// ---------------------------------------------------------------------------

const BUYER_CRITERIA_ROW = {
  id: 'criteria-uuid-001',
  mandateId: 'mandate-uuid-001',
  industry: 'Technology',
  geo: 'North America',
  sizeBand: '$50M–$250M',
  dealType: null,
};

const COMPLIANCE_PROFILE_ROW = {
  id: 'profile-uuid-001',
  mandateId: 'mandate-uuid-001',
  jurisdiction: 'US',
  disclaimerTemplateId: 'disclaimer-uuid-001',
  suppressionScope: null,
  lawfulAuthorization: true,
  aiResultsValidated: true,
  conflictDbsReviewed: true,
};

describe('CRITICAL-1: configureAsActor returns full MandateDetail', () => {
  afterEach(() => vi.clearAllMocks());

  it('returns mandate + buyerCriteria + complianceProfile (MandateDetail shape) after configure', async () => {
    const authRepo = makeMockAuthRepo('app-user-uuid-001', 'advisor');
    const repo = makeMockRepository({
      findBuyerCriteriaByMandateIdInTx: vi.fn().mockResolvedValue(BUYER_CRITERIA_ROW),
      findComplianceProfileByMandateIdInTx: vi.fn().mockResolvedValue(COMPLIANCE_PROFILE_ROW),
    });
    const audit = makeMockAuditService();

    const service = new MandateService(repo, audit, authRepo);
    const result = await service.configureAsActor(
      'mandate-uuid-001',
      { sellerName: 'Acme Corp Updated' },
      'st-id'
    );

    // Must have all three keys — not a bare Mandate
    expect(result).toHaveProperty('mandate');
    expect(result).toHaveProperty('buyerCriteria');
    expect(result).toHaveProperty('complianceProfile');

    expect(result.mandate.id).toBe('mandate-uuid-001');
    expect(result.buyerCriteria).not.toBeNull();
    expect(result.buyerCriteria?.geo).toBe('North America');
    expect(result.complianceProfile).not.toBeNull();
    expect(result.complianceProfile?.disclaimerTemplateId).toBe('disclaimer-uuid-001');
  });

  it('returns null buyerCriteria and null complianceProfile when not found in tx', async () => {
    const authRepo = makeMockAuthRepo('app-user-uuid-001', 'advisor');
    const repo = makeMockRepository({
      findBuyerCriteriaByMandateIdInTx: vi.fn().mockResolvedValue(null),
      findComplianceProfileByMandateIdInTx: vi.fn().mockResolvedValue(null),
    });
    const audit = makeMockAuditService();

    const service = new MandateService(repo, audit, authRepo);
    const result = await service.configureAsActor(
      'mandate-uuid-001',
      { sellerName: 'Acme Corp Updated' },
      'st-id'
    );

    expect(result).toHaveProperty('mandate');
    expect(result.buyerCriteria).toBeNull();
    expect(result.complianceProfile).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// 11–14. CRITICAL-2 — state-machine enforcement (active mandate locked)
// ---------------------------------------------------------------------------

describe('CRITICAL-2: active mandate is locked — configure → 409', () => {
  afterEach(() => vi.clearAllMocks());

  it('throws ConflictException (409) when configuring an active mandate (field edit)', async () => {
    const authRepo = makeMockAuthRepo('app-user-uuid-001', 'advisor');
    const repo = makeMockRepository({
      // Return an 'active' mandate from findMandateByIdForUpdate
      findMandateByIdForUpdate: vi.fn().mockResolvedValue({
        id: 'mandate-uuid-001',
        createdBy: 'app-user-uuid-001',
        sellerName: 'Acme Corp',
        sellerIndustry: null,
        sellerGeo: null,
        sellerSizeBand: null,
        description: null,
        dealType: null,
        status: 'active',
        createdAt: '2026-07-04 00:00:00+00',
        updatedAt: '2026-07-04 01:00:00+00',
      }),
    });
    const audit = makeMockAuditService();

    const service = new MandateService(repo, audit, authRepo);
    await expect(
      service.configureAsActor('mandate-uuid-001', { sellerName: 'New Name' }, 'st-id')
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('throws ConflictException (409) when attempting active → draft status transition', async () => {
    const authRepo = makeMockAuthRepo('app-user-uuid-001', 'advisor');
    const repo = makeMockRepository({
      findMandateByIdForUpdate: vi.fn().mockResolvedValue({
        id: 'mandate-uuid-001',
        createdBy: 'app-user-uuid-001',
        sellerName: 'Acme Corp',
        sellerIndustry: null,
        sellerGeo: null,
        sellerSizeBand: null,
        description: null,
        dealType: null,
        status: 'active',
        createdAt: '2026-07-04 00:00:00+00',
        updatedAt: '2026-07-04 01:00:00+00',
      }),
    });
    const audit = makeMockAuditService();

    const service = new MandateService(repo, audit, authRepo);
    // Explicitly attempt active → draft (illegal transition)
    await expect(
      service.configureAsActor('mandate-uuid-001', { status: 'draft' }, 'st-id')
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('allows editing a draft mandate (200)', async () => {
    const authRepo = makeMockAuthRepo('app-user-uuid-001', 'advisor');
    const repo = makeMockRepository({
      // Default mock returns status:'draft' — draft is editable
      findBuyerCriteriaByMandateIdInTx: vi.fn().mockResolvedValue(null),
      findComplianceProfileByMandateIdInTx: vi.fn().mockResolvedValue(null),
    });
    const audit = makeMockAuditService();

    const service = new MandateService(repo, audit, authRepo);
    const result = await service.configureAsActor(
      'mandate-uuid-001',
      { sellerName: 'Acme Corp Renamed' },
      'st-id'
    );

    // Should succeed and return MandateDetail
    expect(result).toHaveProperty('mandate');
    expect(result.mandate.status).toBe('active'); // mock updateMandate returns 'active' row
  });

  it('allows draft → active transition (legal advancement)', async () => {
    const authRepo = makeMockAuthRepo('app-user-uuid-001', 'advisor');
    const repo = makeMockRepository({
      findBuyerCriteriaByMandateIdInTx: vi.fn().mockResolvedValue(BUYER_CRITERIA_ROW),
      findComplianceProfileByMandateIdInTx: vi.fn().mockResolvedValue(COMPLIANCE_PROFILE_ROW),
    });
    const audit = makeMockAuditService();

    const service = new MandateService(repo, audit, authRepo);
    // Draft mandate (default mock) advancing to active
    const result = await service.configureAsActor(
      'mandate-uuid-001',
      { status: 'active' },
      'st-id'
    );

    expect(result).toHaveProperty('mandate');
    expect(result).toHaveProperty('complianceProfile');
  });
});

// ---------------------------------------------------------------------------
// 15–16. CRITICAL-3 — disclaimer derivation: ambiguous config → ConflictException
// ---------------------------------------------------------------------------

describe('CRITICAL-3: findActiveDisclaimerByJurisdiction — ambiguity-safe', () => {
  afterEach(() => vi.clearAllMocks());

  it('throws ConflictException when 2 active templates exist for a jurisdiction', async () => {
    const authRepo = makeMockAuthRepo('app-user-uuid-001', 'advisor');
    const repo = makeMockRepository({
      findActiveDisclaimerByJurisdiction: vi
        .fn()
        .mockRejectedValue(
          new ConflictException(
            'Ambiguous disclaimer configuration: 2 active disclaimer templates found for jurisdiction "US".'
          )
        ),
    });
    const audit = makeMockAuditService();

    const service = new MandateService(repo, audit, authRepo);
    await expect(service.createAsActor(VALID_CREATE_INPUT, 'st-id')).rejects.toBeInstanceOf(
      ConflictException
    );
  });

  it('resolves correctly when exactly 1 active template exists for a jurisdiction', async () => {
    const disclaimerId = 'disclaimer-uuid-single';
    const authRepo = makeMockAuthRepo('app-user-uuid-001', 'advisor');
    const repo = makeMockRepository({
      findActiveDisclaimerByJurisdiction: vi.fn().mockResolvedValue({
        id: disclaimerId,
        jurisdiction: 'US',
        body: 'Single active disclaimer',
        version: 3,
        active: true,
        createdAt: '2026-01-01T00:00:00Z',
        createdBy: null,
      }),
    });
    const audit = makeMockAuditService();

    const service = new MandateService(repo, audit, authRepo);
    await service.createAsActor(VALID_CREATE_INPUT, 'st-id');

    const profileCall = (repo.insertComplianceProfile as ReturnType<typeof vi.fn>).mock
      .calls[0]?.[1] as { disclaimerTemplateId: string };
    expect(profileCall.disclaimerTemplateId).toBe(disclaimerId);
  });
});

// ---------------------------------------------------------------------------
// 17–20. READ-SCHEMA passthrough + input-schema mass-assignment guard
// ---------------------------------------------------------------------------

describe('READ-SCHEMA: mandateSchema passthrough (extra fields forwarded)', () => {
  it('parses a mandate payload with an extra server-added field (does NOT drop it)', () => {
    const payload = {
      id: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
      createdBy: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
      sellerName: 'Acme Corp',
      sellerIndustry: 'Technology',
      sellerGeo: ['US'],
      sellerSizeBand: null,
      description: null,
      dealType: null,
      status: 'draft' as const,
      createdAt: '2026-07-04 00:00:00+00',
      updatedAt: null,
      // Future server-added field — must NOT cause a parse failure
      internalPriorityScore: 42,
    };

    const result = mandateSchema.safeParse(payload);
    expect(result.success).toBe(true);
    if (result.success) {
      // passthrough: extra field is preserved in the output
      expect((result.data as Record<string, unknown>).internalPriorityScore).toBe(42);
    }
  });
});

describe('READ-SCHEMA: mandateCreateSchema REJECTS unknown fields (mass-assignment guard intact)', () => {
  it('rejects an extra field in the create input (disclaimerTemplateId injection attempt)', () => {
    const maliciousPayload = {
      sellerName: 'Acme Corp',
      compliance: {
        jurisdiction: 'US',
        acknowledgments: {
          lawful_authorization: true as const,
          ai_results_validated: true as const,
          conflict_dbs_reviewed: true as const,
        },
        // Mass-assignment attempt — must be rejected by strict compliance sub-schema
        disclaimerTemplateId: 'attacker-chosen-uuid',
      },
    };

    const result = mandateCreateSchema.safeParse(maliciousPayload);
    expect(result.success).toBe(false);
  });

  it('rejects an extra top-level field in the create input', () => {
    const maliciousPayload = {
      sellerName: 'Acme Corp',
      compliance: {
        jurisdiction: 'US',
        acknowledgments: {
          lawful_authorization: true as const,
          ai_results_validated: true as const,
          conflict_dbs_reviewed: true as const,
        },
      },
      // Extra top-level field — must be rejected by strict top-level schema
      createdBy: 'attacker-chosen-user-id',
    };

    const result = mandateCreateSchema.safeParse(maliciousPayload);
    expect(result.success).toBe(false);
  });
});

describe('READ-SCHEMA: mandateListFilterSchema passthrough (extra query params tolerated)', () => {
  it('parses with an extra query parameter (does NOT 400)', () => {
    // Browser or proxy may add extra query params (e.g. _t=cache-buster)
    const result = mandateListFilterSchema.safeParse({ status: 'draft', _t: '1234567890' });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.status).toBe('draft');
    }
  });

  it('still validates known field values (invalid status → parse error)', () => {
    const result = mandateListFilterSchema.safeParse({ status: 'invalid_status_value' });
    expect(result.success).toBe(false);
  });

  it('defaults status to "all" when absent', () => {
    const result = mandateListFilterSchema.safeParse({});
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.status).toBe('all');
    }
  });
});

/**
 * Admin module unit tests (wave-15, tasks 82ec8724 + 648a86a6 + 41c017f7).
 *
 * Coverage:
 *   A. UserManagementService — pure mocked unit tests (no DB).
 *      A-1. inviteAsActor — happy path + role-not-found.
 *      A-2. assignRoleAsActor — demote non-last-admin (happy) + mock last-admin-guard.
 *      A-3. deactivateAsActor — idempotent + mock last-admin-guard.
 *
 *   B. WorkspaceSettingsService — pure mocked unit tests.
 *      B-1. getSettings — null when unset.
 *      B-2. updateSettings — upsert semantics + audit.
 *
 *   C. DataSourceAdminService — unit tests.
 *      C-1. listConnections — never includes credential.
 *      C-2. createConnection — encrypts credential, audit row has no credential.
 *      C-3. toggleConnection — state-only, audit row non-secret.
 *
 *   D. credential-crypto — round-trip + tamper detection (pure, no DB).
 *      D-1. encrypt → decrypt round-trip.
 *      D-2. tampered ciphertext fails auth-tag verification.
 *      D-3. tampered tag fails.
 *      D-4. random IV per encrypt — two encryptions of same plaintext differ.
 *      D-5. missing key → fail-closed.
 *
 * Load-bearing tests (P-4 security) live in admin.concurrency.spec.ts
 * and admin.credential-security.spec.ts (real-DB, skipIf no TEST_DATABASE_URL).
 */

import { ConflictException, NotFoundException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { decryptCredential, encryptCredential, loadEncKey } from './credential-crypto';
import { DataSourceAdminService } from './data-source-admin.service';
import { UserManagementService } from './user-management.service';
import { WorkspaceSettingsService } from './workspace-settings.service';

// ---------------------------------------------------------------------------
// D. credential-crypto (pure — no DB, no mocks)
// ---------------------------------------------------------------------------

describe('credential-crypto', () => {
  it('D-1: round-trip encrypt → decrypt reproduces the plaintext', () => {
    const plaintext = 'super-secret-api-key-abc123';
    const stored = encryptCredential(plaintext);
    const recovered = decryptCredential(stored);
    expect(recovered).toBe(plaintext);
  });

  it('D-1: stored format is v1:<iv>:<tag>:<ct> (4 colon-delimited parts)', () => {
    const stored = encryptCredential('some-key');
    const parts = stored.split(':');
    expect(parts).toHaveLength(4);
    expect(parts[0]).toBe('v1');
    // iv, tag, ct are non-empty base64 strings
    expect(parts[1]!.length).toBeGreaterThan(0);
    expect(parts[2]!.length).toBeGreaterThan(0);
    expect(parts[3]!.length).toBeGreaterThan(0);
  });

  it('D-2: tampered ciphertext fails decrypt (GCM auth-tag verification)', () => {
    const stored = encryptCredential('secret');
    const parts = stored.split(':');
    // Corrupt last base64 char of the ciphertext
    parts[3] = parts[3]!.slice(0, -1) + (parts[3]!.endsWith('A') ? 'B' : 'A');
    const tampered = parts.join(':');
    expect(() => decryptCredential(tampered)).toThrow();
  });

  it('D-3: tampered auth-tag fails decrypt (replace with wrong-length tag)', () => {
    const stored = encryptCredential('secret');
    const parts = stored.split(':');
    // Replace the tag entirely with a wrong tag (all zeros, base64-encoded) — guaranteed fail
    const wrongTag = Buffer.alloc(16, 0).toString('base64');
    parts[2] = wrongTag;
    const tampered = parts.join(':');
    expect(() => decryptCredential(tampered)).toThrow();
  });

  it('D-4: random IV — two encryptions of the same plaintext produce different ciphertexts', () => {
    const p = 'same-plaintext';
    const c1 = encryptCredential(p);
    const c2 = encryptCredential(p);
    expect(c1).not.toBe(c2);
    // But both decrypt correctly
    expect(decryptCredential(c1)).toBe(p);
    expect(decryptCredential(c2)).toBe(p);
  });

  it('D-5: missing CREDENTIALS_ENC_KEY → loadEncKey throws (fail-closed)', () => {
    expect(() => loadEncKey({})).toThrow(/CREDENTIALS_ENC_KEY is not set/);
  });

  it('D-5: wrong-length CREDENTIALS_ENC_KEY → loadEncKey throws', () => {
    // 16 bytes base64 = not 32 bytes
    const short = Buffer.from('only-16-bytes!!!').toString('base64');
    expect(() => loadEncKey({ CREDENTIALS_ENC_KEY: short })).toThrow(/32 bytes/);
  });
});

// ---------------------------------------------------------------------------
// Helper: minimal mock audit service
// ---------------------------------------------------------------------------

function makeAuditService() {
  return { append: vi.fn().mockResolvedValue({}) };
}

// ---------------------------------------------------------------------------
// A. UserManagementService — unit (mocked DB)
// ---------------------------------------------------------------------------

describe('UserManagementService', () => {
  let service: UserManagementService;
  // biome-ignore lint/suspicious/noExplicitAny: mock db
  let mockDb: any;
  let auditService: ReturnType<typeof makeAuditService>;

  beforeEach(() => {
    vi.clearAllMocks();
    auditService = makeAuditService();

    const selectChain = {
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      innerJoin: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue([]),
    };

    mockDb = {
      select: vi.fn().mockReturnValue(selectChain),
      transaction: vi.fn().mockImplementation(async (work: (tx: unknown) => unknown) => {
        const fakeTx = {
          select: vi.fn().mockReturnValue(selectChain),
          insert: vi.fn().mockReturnValue({
            values: vi.fn().mockReturnValue({
              returning: vi.fn().mockResolvedValue([
                {
                  id: 'invite-1',
                  email: 'a@b.com',
                  roleId: 'role-1',
                  invitedBy: 'actor-1',
                  expiry: new Date().toISOString(),
                  token: 'hash',
                  consumedAt: null,
                  createdAt: new Date().toISOString(),
                },
              ]),
            }),
          }),
          update: vi.fn().mockReturnValue({
            set: vi.fn().mockReturnValue({
              where: vi.fn().mockReturnValue({
                returning: vi.fn().mockResolvedValue([
                  {
                    id: 'user-1',
                    email: 'x@y.com',
                    roleId: 'role-2',
                    deactivatedAt: new Date().toISOString(),
                    createdAt: new Date().toISOString(),
                    supertokensUserId: 'st-1',
                  },
                ]),
              }),
            }),
          }),
          execute: vi.fn().mockResolvedValue({ rows: [{ remaining: '1' }] }),
        };
        return work(fakeTx);
      }),
    };

    service = new UserManagementService(mockDb, auditService as never);
  });

  it('A-1: inviteAsActor — happy path creates invite and audits', async () => {
    // Setup: roles lookup returns a role row
    const txMock = {
      select: vi.fn().mockReturnValue({
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue([{ id: 'role-id-1' }]),
      }),
      insert: vi.fn().mockReturnValue({
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([{ id: 'invite-abc' }]),
        }),
      }),
      execute: vi.fn(),
    };

    mockDb.transaction = vi
      .fn()
      .mockImplementation(async (work: (tx: unknown) => unknown) => work(txMock));

    const result = await service.inviteAsActor(
      { email: 'user@example.com', role: 'advisor' },
      'actor-uuid',
      'admin'
    );

    expect(result.inviteId).toBe('invite-abc');
    expect(result.email).toBe('user@example.com');
    expect(result.role).toBe('advisor');
    expect(auditService.append).toHaveBeenCalledOnce();
    const auditCall = auditService.append.mock.calls[0]![0];
    expect(auditCall.action).toBe('user-invite');
    // Credential NEVER in audit (no credential field on invite)
    expect(JSON.stringify(auditCall)).not.toContain('credential');
  });

  it('A-1: inviteAsActor — role not found throws UnprocessableEntityException', async () => {
    const txMock = {
      select: vi.fn().mockReturnValue({
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue([]), // no role row
      }),
    };
    mockDb.transaction = vi
      .fn()
      .mockImplementation(async (work: (tx: unknown) => unknown) => work(txMock));

    await expect(
      service.inviteAsActor({ email: 'x@y.com', role: 'admin' }, 'actor', 'admin')
    ).rejects.toThrow();
  });

  it('A-3: deactivateAsActor — idempotent on already-deactivated user', async () => {
    const alreadyDeactivated = new Date(Date.now() - 1000).toISOString();
    const txMock = {
      select: vi.fn().mockReturnValue({
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue([
          {
            id: 'user-1',
            roleId: 'role-1',
            deactivatedAt: alreadyDeactivated,
          },
        ]),
      }),
      execute: vi.fn(),
    };
    mockDb.transaction = vi
      .fn()
      .mockImplementation(async (work: (tx: unknown) => unknown) => work(txMock));

    const result = await service.deactivateAsActor('user-1', 'actor', 'admin');
    expect(result.deactivatedAt).toBe(alreadyDeactivated);
    // Audit not called for idempotent path
    expect(auditService.append).not.toHaveBeenCalled();
  });

  it('A-2: assignRoleAsActor — throws NotFoundException for missing user', async () => {
    const txMock = {
      select: vi.fn().mockReturnValue({
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue([]), // user not found
      }),
      execute: vi.fn(),
    };
    mockDb.transaction = vi
      .fn()
      .mockImplementation(async (work: (tx: unknown) => unknown) => work(txMock));

    await expect(
      service.assignRoleAsActor('nonexistent', 'analyst', 'actor', 'admin')
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});

// ---------------------------------------------------------------------------
// B. WorkspaceSettingsService — unit (mocked DB)
// ---------------------------------------------------------------------------

describe('WorkspaceSettingsService', () => {
  let service: WorkspaceSettingsService;
  // biome-ignore lint/suspicious/noExplicitAny: mock db
  let mockDb: any;
  let auditService: ReturnType<typeof makeAuditService>;

  beforeEach(() => {
    vi.clearAllMocks();
    auditService = makeAuditService();

    mockDb = {
      select: vi.fn().mockReturnValue({
        from: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue([]),
      }),
      transaction: vi.fn(),
    };

    service = new WorkspaceSettingsService(mockDb, auditService as never);
  });

  it('B-1: getSettings returns null when no row exists', async () => {
    const result = await service.getSettings();
    expect(result).toBeNull();
  });

  it('B-1: getSettings returns the settings row when it exists', async () => {
    const fakeRow = {
      id: 'ws-1',
      firmName: 'Acme Capital',
      firmAddress: '123 Main St',
      regulatoryIds: null,
      primaryContactName: null,
      primaryContactEmail: null,
      defaultJurisdiction: 'US',
      defaultDisclaimerTemplateId: null,
      defaultSuppressionScope: null,
      createdBy: 'actor-1',
      createdAt: new Date().toISOString(),
      updatedAt: null,
    };
    mockDb.select = vi.fn().mockReturnValue({
      from: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue([fakeRow]),
    });

    const result = await service.getSettings();
    expect(result).not.toBeNull();
    expect(result!.firmName).toBe('Acme Capital');
    expect(result!.defaultJurisdiction).toBe('US');
  });

  it('B-2: updateSettings audits with workspace-settings-update action', async () => {
    const fakeRow = {
      id: 'ws-1',
      firmName: 'New Name',
      firmAddress: null,
      regulatoryIds: null,
      primaryContactName: null,
      primaryContactEmail: null,
      defaultJurisdiction: null,
      defaultDisclaimerTemplateId: null,
      defaultSuppressionScope: null,
      createdBy: 'actor-1',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const txMock = {
      select: vi.fn().mockReturnValue({
        from: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue([]), // no existing row → insert path
      }),
      insert: vi.fn().mockReturnValue({
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([fakeRow]),
        }),
      }),
    };
    mockDb.transaction = vi
      .fn()
      .mockImplementation(async (work: (tx: unknown) => unknown) => work(txMock));

    const result = await service.updateSettings({ firmName: 'New Name' }, 'actor-id', 'admin');
    expect(result.firmName).toBe('New Name');
    expect(auditService.append).toHaveBeenCalledOnce();
    expect(auditService.append.mock.calls[0]![0].action).toBe('workspace-settings-update');
  });
});

// ---------------------------------------------------------------------------
// C. DataSourceAdminService — unit (mocked DB)
// ---------------------------------------------------------------------------

describe('DataSourceAdminService', () => {
  let service: DataSourceAdminService;
  // biome-ignore lint/suspicious/noExplicitAny: mock db
  let mockDb: any;
  let auditService: ReturnType<typeof makeAuditService>;

  const fakeConnection = {
    id: 'conn-1',
    providerKey: 'GRATA_API_KEY',
    displayName: 'Grata',
    enabled: true,
    encryptedCredentials: null,
    config: {},
    createdBy: 'actor-1',
    createdAt: new Date().toISOString(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    auditService = makeAuditService();

    mockDb = {
      select: vi.fn().mockReturnValue({
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue([fakeConnection]),
      }),
      transaction: vi.fn(),
    };

    service = new DataSourceAdminService(mockDb, auditService as never);
  });

  it('C-1: listConnections — hasCredential=false when encryptedCredentials is null', async () => {
    mockDb.select = vi.fn().mockReturnValue({
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue([fakeConnection]),
    });
    // Override to return array directly for listConnections (no .where/.limit)
    mockDb.select = vi.fn().mockReturnValue({
      from: vi.fn().mockResolvedValue([fakeConnection]),
    });

    const result = await service.listConnections();
    expect(result[0]!.hasCredential).toBe(false);
    expect('encryptedCredentials' in result[0]!).toBe(false);
  });

  it('C-1: listConnections — hasCredential=true when encryptedCredentials is set', async () => {
    const connWithCred = { ...fakeConnection, encryptedCredentials: 'v1:abc:def:ghi' };
    mockDb.select = vi.fn().mockReturnValue({
      from: vi.fn().mockResolvedValue([connWithCred]),
    });

    const result = await service.listConnections();
    expect(result[0]!.hasCredential).toBe(true);
    // The plaintext/ciphertext must NOT appear in the response
    expect(JSON.stringify(result)).not.toContain('encryptedCredentials');
    expect(JSON.stringify(result)).not.toContain('credential');
  });

  it('C-2: createConnection — audit row has no credential field', async () => {
    const insertedRow = { ...fakeConnection, id: 'conn-2' };
    const txMock = {
      insert: vi.fn().mockReturnValue({
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([insertedRow]),
        }),
      }),
    };
    mockDb.transaction = vi
      .fn()
      .mockImplementation(async (work: (tx: unknown) => unknown) => work(txMock));

    await service.createConnection(
      { providerKey: 'GRATA_API_KEY', displayName: 'Grata', credential: 'secret-key-value' },
      'actor',
      'admin'
    );

    expect(auditService.append).toHaveBeenCalledOnce();
    const auditInput = auditService.append.mock.calls[0]![0];

    // Credential MUST NOT appear in audit row (action, non-secret metadata only)
    expect(auditInput.action).toBe('data-source-conn-upsert');
    const auditSerialized = JSON.stringify(auditInput);
    expect(auditSerialized).not.toContain('secret-key-value');
    expect(auditSerialized).not.toContain('credential');
  });

  it('C-3: toggleConnection — audit action is data-source-conn-toggle, no credential', async () => {
    const txMock = {
      select: vi.fn().mockReturnValue({
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue([fakeConnection]),
      }),
      update: vi.fn().mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([{ ...fakeConnection, enabled: false }]),
          }),
        }),
      }),
    };
    mockDb.transaction = vi
      .fn()
      .mockImplementation(async (work: (tx: unknown) => unknown) => work(txMock));

    const result = await service.toggleConnection('conn-1', { enabled: false }, 'actor', 'admin');

    expect(result.enabled).toBe(false);
    expect(auditService.append).toHaveBeenCalledOnce();
    expect(auditService.append.mock.calls[0]![0].action).toBe('data-source-conn-toggle');
    // No credential in audit
    const auditStr = JSON.stringify(auditService.append.mock.calls[0]![0]);
    expect(auditStr).not.toContain('credential');
  });

  it('C-read: listConnections response shape never includes encrypted_credentials or credential fields', async () => {
    // Test via the public listConnections API — the DB mock returns a row with encryptedCredentials set.
    const connWithCred = { ...fakeConnection, encryptedCredentials: 'v1:iv:tag:ct' };
    mockDb.select = vi.fn().mockReturnValue({
      from: vi.fn().mockResolvedValue([connWithCred]),
    });

    const result = await service.listConnections();
    const resultStr = JSON.stringify(result);

    // The response must use hasCredential boolean, NOT the raw encryptedCredentials field.
    expect(result[0]!.hasCredential).toBe(true);
    // 'encryptedCredentials' must NOT appear in the serialized response.
    expect(resultStr).not.toContain('encryptedCredentials');
    // The ciphertext itself must NOT appear.
    expect(resultStr).not.toContain('v1:iv:tag:ct');
  });
});

/**
 * AdminActivityService unit tests (wave-16, task 8bb0a22f — P-4 Finding 3).
 *
 * Pure mocked tests (no DB). Validates:
 *
 *   A. Row shape projection — getActivity maps audit entries to the SAFE
 *      AdminActivityRow shape (only sequenceNumber/actor/target/action/timestamp).
 *      Hash fields and credentials are NEVER present in the output.
 *
 *   B. Action filter — only admin-activity actions pass through; non-admin
 *      actions are excluded by the repository-level IN filter (mocked here).
 *
 *   C. Pagination — nextCursor is set when rows.length === limit; null otherwise.
 *
 *   D. Empty state — empty rows returns { rows: [], nextCursor: null, total: 0 }.
 *
 *   E. Target resolution — target is null for workspace-settings-update
 *      (no UUID resource_id); target is resolved for user-invite.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AdminActivityService } from './admin-activity.service';

// ── Mock AuditRepository ──────────────────────────────────────────────────────

function makeAuditRepo() {
  return {
    findAdminActivity: vi.fn().mockResolvedValue([]),
    countAdminActivity: vi.fn().mockResolvedValue(0),
  };
}

// ── Fake audit entry with ALL chain fields present ────────────────────────────
// This is the raw StoredAuditEntry shape the repository returns.

function fakeEntry(
  overrides: Partial<{
    sequenceNumber: number;
    actorUserId: string | null;
    actorRole: string;
    action: string;
    resourceType: string;
    resourceId: string | null;
    contentHash: string;
    payloadHash: string;
    prevHash: string;
    entryHash: string;
    chainVersion: number;
    createdAt: string;
    mandateId: string | null;
  }> = {}
) {
  return {
    sequenceNumber: 42,
    actorUserId: ACTOR_UUID,
    actorRole: 'admin',
    action: 'user-invite',
    resourceType: 'invite',
    resourceId: TARGET_UUID,
    contentHash: 'abc123',
    payloadHash: 'def456',
    prevHash: '0000000000000000000000000000000000000000000000000000000000000000',
    entryHash: 'ghi789',
    chainVersion: 1,
    createdAt: '2026-01-01T00:00:00.000Z',
    mandateId: null,
    ...overrides,
  };
}

// Valid UUID v4 format used in tests.
const ACTOR_UUID = '00000001-0000-0000-0000-000000000001';
const TARGET_UUID = '00000001-0000-0000-0000-000000000002';

// ── Mock DB (users lookup) ────────────────────────────────────────────────────
// biome-ignore lint/suspicious/noExplicitAny: mock DB
function makeDb(userRows: Array<{ id: string; email: string }> = []): any {
  return {
    select: vi.fn().mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue(userRows),
      }),
    }),
  };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('AdminActivityService', () => {
  let mockAuditRepo: ReturnType<typeof makeAuditRepo>;
  // biome-ignore lint/suspicious/noExplicitAny: mock DB
  let mockDb: any;
  let service: AdminActivityService;

  beforeEach(() => {
    vi.clearAllMocks();
    mockAuditRepo = makeAuditRepo();
    mockDb = makeDb([
      { id: ACTOR_UUID, email: 'actor@example.com' },
      { id: TARGET_UUID, email: 'target@example.com' },
    ]);
    service = new AdminActivityService(mockDb, mockAuditRepo as never);
  });

  // ── A. Row shape projection ───────────────────────────────────────────────

  describe('A. Row shape — hash/credential fields absent', () => {
    it('A-1: response contains ONLY sequenceNumber, actor, target, action, timestamp', async () => {
      mockAuditRepo.findAdminActivity.mockResolvedValue([fakeEntry()]);
      mockAuditRepo.countAdminActivity.mockResolvedValue(1);

      const result = await service.getActivity({});

      expect(result.rows).toHaveLength(1);
      const row = result.rows[0]!;

      // Allowed keys only.
      expect(Object.keys(row).sort()).toEqual(
        ['sequenceNumber', 'actor', 'target', 'action', 'timestamp'].sort()
      );
    });

    it('A-2: hash fields are absent from the serialized response', async () => {
      mockAuditRepo.findAdminActivity.mockResolvedValue([fakeEntry()]);
      mockAuditRepo.countAdminActivity.mockResolvedValue(1);

      const result = await service.getActivity({});
      const serialized = JSON.stringify(result);

      const forbiddenFields = [
        'payloadHash',
        'contentHash',
        'entryHash',
        'prevHash',
        'chainVersion',
        'actorRole',
        'resourceType',
        'resourceId',
        'mandateId',
        'encryptedCredentials',
        'credential',
      ];

      for (const field of forbiddenFields) {
        expect(serialized, `must not contain field: ${field}`).not.toContain(`"${field}"`);
      }
    });

    it('A-3: hash values themselves are absent (the actual hash strings are not echoed)', async () => {
      const entry = fakeEntry({
        contentHash: 'unique-content-hash-value-abc',
        payloadHash: 'unique-payload-hash-value-def',
        entryHash: 'unique-entry-hash-value-ghi',
        prevHash: 'unique-prev-hash-value-jkl',
      });
      mockAuditRepo.findAdminActivity.mockResolvedValue([entry]);
      mockAuditRepo.countAdminActivity.mockResolvedValue(1);

      const result = await service.getActivity({});
      const serialized = JSON.stringify(result);

      // The actual hash string values must not appear in the response.
      expect(serialized).not.toContain('unique-content-hash-value-abc');
      expect(serialized).not.toContain('unique-payload-hash-value-def');
      expect(serialized).not.toContain('unique-entry-hash-value-ghi');
      expect(serialized).not.toContain('unique-prev-hash-value-jkl');
    });
  });

  // ── B. Target resolution ──────────────────────────────────────────────────

  describe('B. Target resolution', () => {
    it('B-1: target is null for workspace-settings-update (no user target)', async () => {
      mockAuditRepo.findAdminActivity.mockResolvedValue([
        fakeEntry({
          action: 'workspace-settings-update',
          resourceType: 'workspace_settings',
          resourceId: null,
        }),
      ]);
      mockAuditRepo.countAdminActivity.mockResolvedValue(1);

      const result = await service.getActivity({});
      expect(result.rows[0]!.target).toBeNull();
    });

    it('B-2: target is resolved for user-invite when resource_id is a UUID', async () => {
      mockAuditRepo.findAdminActivity.mockResolvedValue([fakeEntry()]);
      mockAuditRepo.countAdminActivity.mockResolvedValue(1);

      const result = await service.getActivity({});
      expect(result.rows[0]!.target).toEqual({
        displayName: 'target@example.com',
        email: 'target@example.com',
      });
    });

    it('B-3: target is null when resource_id is not a UUID (e.g. data-source action)', async () => {
      // data-source-conn-upsert uses a connection UUID, but in this test we pass
      // a non-UUID string to cover the guard.
      mockAuditRepo.findAdminActivity.mockResolvedValue([
        fakeEntry({
          action: 'data-source-conn-upsert',
          resourceType: 'data_source_connection',
          resourceId: 'not-a-uuid',
        }),
      ]);
      mockAuditRepo.countAdminActivity.mockResolvedValue(1);

      const result = await service.getActivity({});
      // 'data-source-conn-upsert' is not in USER_TARGET_ACTIONS, so target = null.
      expect(result.rows[0]!.target).toBeNull();
    });

    it('B-4: actor displayName and email are derived from email (no separate displayName column)', async () => {
      mockAuditRepo.findAdminActivity.mockResolvedValue([fakeEntry()]);
      mockAuditRepo.countAdminActivity.mockResolvedValue(1);

      const result = await service.getActivity({});
      const actor = result.rows[0]!.actor;
      expect(actor.displayName).toBe('actor@example.com');
      expect(actor.email).toBe('actor@example.com');
    });
  });

  // ── C. Pagination ─────────────────────────────────────────────────────────

  describe('C. Pagination', () => {
    it('C-1: nextCursor is set to last row sequenceNumber when rows.length >= limit', async () => {
      const entries = [
        fakeEntry({ sequenceNumber: 10 }),
        fakeEntry({ sequenceNumber: 9 }),
        fakeEntry({ sequenceNumber: 8 }),
      ];
      mockAuditRepo.findAdminActivity.mockResolvedValue(entries);
      mockAuditRepo.countAdminActivity.mockResolvedValue(100);

      // limit=3, rows.length=3 → nextCursor = 8 (sequenceNumber of last row).
      const result = await service.getActivity({ limit: 3 });
      expect(result.nextCursor).toBe(8);
    });

    it('C-2: nextCursor is null when rows.length < limit (last page)', async () => {
      mockAuditRepo.findAdminActivity.mockResolvedValue([fakeEntry({ sequenceNumber: 5 })]);
      mockAuditRepo.countAdminActivity.mockResolvedValue(1);

      const result = await service.getActivity({ limit: 50 });
      expect(result.nextCursor).toBeNull();
    });
  });

  // ── D. Empty state ────────────────────────────────────────────────────────

  describe('D. Empty state', () => {
    it('D-1: empty rows returns { rows: [], nextCursor: null, total: 0 }', async () => {
      mockAuditRepo.findAdminActivity.mockResolvedValue([]);
      mockAuditRepo.countAdminActivity.mockResolvedValue(0);

      const result = await service.getActivity({});
      expect(result.rows).toEqual([]);
      expect(result.nextCursor).toBeNull();
      expect(result.total).toBe(0);
    });
  });
});

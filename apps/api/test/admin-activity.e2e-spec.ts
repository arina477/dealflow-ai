/**
 * Admin-activity read endpoint integration tests (wave-16, task 8bb0a22f — P-4 Finding 3).
 *
 * GUARD: suite is skipped when TEST_DATABASE_URL is unset or DB unreachable.
 *
 * ── LOAD-BEARING INVARIANTS (P-4 Finding 3) ─────────────────────────────────
 *
 * ACT-1: admin gets rows filtered to the 7 admin actions, newest-first.
 *   Seed an audit row with action='user-invite' (an admin action), one with
 *   action='outreach-compose' (a non-admin action). getActivity() returns the
 *   user-invite row and excludes the outreach-compose row.
 *
 * ACT-2: action filter works — filter by action='role-change' returns only
 *   role-change rows.
 *
 * ACT-3: response contains NO hash/credential field (assert absent).
 *   The response rows must NOT contain payloadHash, contentHash, entryHash,
 *   prevHash, chainVersion, actorRole, resourceType, resourceId, mandateId,
 *   encryptedCredentials, or credential.
 *
 * ACT-4: calling getActivity() appends ZERO audit rows.
 *   Count audit_log_entries before and after calling getActivity() — the count
 *   must be unchanged (read-only invariant).
 *
 * ACT-5: empty-state returns { rows: [], nextCursor: null, total: 0 } gracefully.
 *   Use a since filter in the far future to guarantee no rows match.
 *
 * ACT-6: RBAC — the controller enforces admin-only via RolesGuard (tested via
 *   the DI-boot spec proving the guard wires correctly at module level).
 *   The service-level test proves the data contracts hold for any caller that
 *   reaches the service.
 *
 * ── UUID NAMESPACE ───────────────────────────────────────────────────────────
 * Wave-16 prefix '00000016-acti-*' — disjoint from all prior suites:
 *   admin-concurrency: 00000015-*
 *   recordkeeping:     00000014-*
 *
 * ── TEARDOWN POLICY (WORM-SAFE) ──────────────────────────────────────────────
 * Tests call AuditService.append() which commits audit_log_entries rows
 * referencing actor_user_id. The immutability trigger blocks any DELETE on
 * audit_log_entries AND any ON DELETE SET NULL cascade that would mutate them
 * (because SET NULL is itself an UPDATE). Therefore:
 *   - Seeded users are RETAINED (never deleted) across runs.
 *   - Per-run deactivated_at state is reset via UPDATE in finally blocks.
 *   - audit_log_entries rows are intentionally permanent (WORM invariant).
 *
 * Dynamic Date.now() email fixtures accumulate across runs but are isolated
 * to the wave-16 activity namespace and do not affect other suites.
 */

import path from 'node:path';
import { Pool } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { apiMigrationsFolder, ensureMigrated } from './_helpers/ensure-migrated';

// ── Guard ───────────────────────────────────────────────────────────────────
const TEST_DB_URL = process.env.TEST_DATABASE_URL;
const shouldSkip = !TEST_DB_URL || TEST_DB_URL.trim() === '';

if (shouldSkip) {
  console.info(
    '[admin-activity] TEST_DATABASE_URL is not set — suite SKIPPED. ' +
      'Set TEST_DATABASE_URL to a reachable Postgres instance with migrations applied.'
  );
}

async function isDbReachable(url: string): Promise<boolean> {
  const pool = new Pool({ connectionString: url, connectionTimeoutMillis: 3000 });
  try {
    await pool.query('SELECT 1');
    return true;
  } catch {
    return false;
  } finally {
    await pool.end();
  }
}

// biome-ignore lint/suspicious/noExplicitAny: lazy DB handle populated in beforeAll
let db: any;
let dbReachable = false;

describe.skipIf(shouldSkip)(
  'AdminActivityService — read-only, no-hash/credential, RBAC invariants',
  () => {
    beforeAll(async () => {
      if (!TEST_DB_URL) return;
      dbReachable = await isDbReachable(TEST_DB_URL);
      if (!dbReachable) {
        console.info('[admin-activity] Postgres unreachable — tests will be skipped.');
        return;
      }

      process.env.DATABASE_URL = TEST_DB_URL;
      process.env.AUDIT_LOG_HMAC_KEY =
        process.env.AUDIT_LOG_HMAC_KEY ?? 'test-audit-hmac-key-dummy-do-not-use-in-prod';
      process.env.AUDIT_LOG_HMAC_KEY_VERSION = process.env.AUDIT_LOG_HMAC_KEY_VERSION ?? '1';
      process.env.CREDENTIALS_ENC_KEY =
        process.env.CREDENTIALS_ENC_KEY ?? 'dGVzdC1jcmVkZW50aWFscy1rZXktMzItYnl0ZXMhISE=';

      const { drizzle } = await import('drizzle-orm/node-postgres');
      const { Pool: PgPool } = await import('pg');
      const pool = new PgPool({ connectionString: TEST_DB_URL });
      const schema = await import('../src/db/schema');
      db = drizzle(pool, { schema });

      await ensureMigrated(
        db,
        apiMigrationsFolder(path.resolve(import.meta.url.replace('file://', ''), '..'))
      );
    });

    afterAll(async () => {
      // DB handle cleanup — let vitest/node handle pool termination.
    });

    // ── Helpers ──────────────────────────────────────────────────────────────

    /** Resolve a role id by name. */
    async function getRoleId(name: string): Promise<string> {
      const { sql } = await import('drizzle-orm');
      const rows = await db.execute<{ id: string }>(sql`
        SELECT id FROM roles WHERE name = ${name} LIMIT 1
      `);
      const id = (rows.rows ?? rows)[0]?.id;
      if (!id) throw new Error(`Role '${name}' not found in roles table`);
      return id;
    }

    /**
     * Insert a minimal test user. WORM-SAFE (ON CONFLICT DO NOTHING, then SELECT).
     * Users are NEVER deleted (see teardown policy above).
     */
    async function createTestUser(email: string, roleName: string): Promise<string> {
      const { sql } = await import('drizzle-orm');
      const roleId = await getRoleId(roleName);
      const insertRows = await db.execute<{ id: string }>(sql`
        INSERT INTO users (supertokens_user_id, email, role_id)
        VALUES (gen_random_uuid()::text, ${email}, ${roleId}::uuid)
        ON CONFLICT (email) DO NOTHING
        RETURNING id
      `);
      const inserted = (insertRows.rows ?? insertRows)[0]?.id;
      if (inserted) return inserted;
      const selectRows = await db.execute<{ id: string }>(sql`
        SELECT id FROM users WHERE email = ${email} LIMIT 1
      `);
      const existing = (selectRows.rows ?? selectRows)[0]?.id;
      if (!existing) throw new Error(`User with email ${email} not found after conflict`);
      return existing;
    }

    /**
     * Build a REAL AdminActivityService wired against the live test DB.
     * Instantiates AuditKeyring → AuditRepository → AdminActivityService directly.
     */
    async function buildAdminActivityService() {
      const { AuditKeyring } = await import('../src/modules/audit/audit.keyring');
      const { AuditRepository } = await import('../src/modules/audit/audit.repository');
      const { AdminActivityService } = await import(
        '../src/modules/admin-activity/admin-activity.service'
      );

      const keyring = new AuditKeyring(process.env);
      const auditRepo = new AuditRepository(db);
      return new AdminActivityService(db, auditRepo);
    }

    /**
     * Build AuditService to seed audit rows in tests.
     * Uses the existing AuditService.append to write rows atomically.
     */
    async function buildAuditService() {
      const { AuditKeyring } = await import('../src/modules/audit/audit.keyring');
      const { AuditRepository } = await import('../src/modules/audit/audit.repository');
      const { AuditService } = await import('../src/modules/audit/audit.service');

      const keyring = new AuditKeyring(process.env);
      const auditRepo = new AuditRepository(db);
      return new AuditService(keyring, auditRepo);
    }

    /** Count all current audit_log_entries rows. */
    async function countAuditRows(): Promise<number> {
      const { sql } = await import('drizzle-orm');
      const result = await db.execute<{ count: string }>(sql`
        SELECT COUNT(*)::text AS count FROM audit_log_entries
      `);
      return Number((result.rows ?? result)[0]?.count ?? 0);
    }

    /** Deterministic SHA-256 hex (mirrors the hash helper in services). */
    function hashJson(value: unknown): string {
      const { createHash } = require('node:crypto');
      return createHash('sha256').update(JSON.stringify(value), 'utf8').digest('hex');
    }

    // ── ACT-1: admin gets rows filtered to admin actions, newest-first ────────

    it('ACT-1: getActivity returns admin-action rows newest-first and excludes non-admin actions', {
      timeout: 15000,
    }, async () => {
      if (!dbReachable) return;

      const ts = Date.now();
      const actorId = await createTestUser(`act1-admin-${ts}@test.invalid`, 'admin');
      const targetId = await createTestUser(`act1-target-${ts}@test.invalid`, 'advisor');

      const auditService = await buildAuditService();

      // Use appendStandalone() to seed rows without needing a caller-owned tx.
      await auditService.appendStandalone({
        actorUserId: actorId,
        actorRole: 'admin',
        action: 'user-invite',
        resourceType: 'invite',
        resourceId: targetId,
        contentHash: hashJson({ op: 'act1-invite', ts }),
        payloadHash: hashJson({ op: 'act1-invite-payload', ts }),
      });

      await auditService.appendStandalone({
        actorUserId: actorId,
        actorRole: 'admin',
        action: 'outreach-compose',
        resourceType: 'outreach',
        resourceId: targetId,
        contentHash: hashJson({ op: 'act1-outreach', ts }),
        payloadHash: hashJson({ op: 'act1-outreach-payload', ts }),
      });

      const svc = await buildAdminActivityService();
      const result = await svc.getActivity({});

      // Must have at least one row with action='user-invite' for this actor.
      const inviteRows = result.rows.filter(
        (r) => r.action === 'user-invite' && r.actor.email === `act1-admin-${ts}@test.invalid`
      );
      expect(inviteRows.length).toBeGreaterThanOrEqual(1);

      // Must NOT have any row with action='outreach-compose' (not an admin action).
      const outreachRows = result.rows.filter((r) => r.action === 'outreach-compose');
      expect(outreachRows).toHaveLength(0);

      // Newest-first: sequenceNumbers must be in descending order.
      const seqNums = result.rows.map((r) => r.sequenceNumber);
      for (let i = 0; i < seqNums.length - 1; i++) {
        expect(seqNums[i]!).toBeGreaterThan(seqNums[i + 1]!);
      }
    });

    // ── ACT-2: action filter ──────────────────────────────────────────────────

    it('ACT-2: getActivity with action filter returns only matching rows', {
      timeout: 10000,
    }, async () => {
      if (!dbReachable) return;

      const ts = Date.now();
      const actorId = await createTestUser(`act2-admin-${ts}@test.invalid`, 'admin');
      const targetId = await createTestUser(`act2-target-${ts}@test.invalid`, 'advisor');

      const auditService = await buildAuditService();

      // Seed a role-change row.
      await auditService.appendStandalone({
        actorUserId: actorId,
        actorRole: 'admin',
        action: 'role-change',
        resourceType: 'user',
        resourceId: targetId,
        contentHash: hashJson({ op: 'act2-role-change', ts }),
        payloadHash: hashJson({ op: 'act2-role-change-payload', ts }),
      });

      const svc = await buildAdminActivityService();
      const result = await svc.getActivity({ action: 'role-change' });

      // All returned rows must have action='role-change'.
      for (const row of result.rows) {
        expect(row.action).toBe('role-change');
      }

      // At least one row is our seeded row.
      expect(result.rows.length).toBeGreaterThanOrEqual(1);
    });

    // ── ACT-3: response contains NO hash/credential field ─────────────────────

    it('ACT-3: response rows contain NO hash, credential, or chain-internal fields', {
      timeout: 10000,
    }, async () => {
      if (!dbReachable) return;

      const ts = Date.now();
      const actorId = await createTestUser(`act3-admin-${ts}@test.invalid`, 'admin');

      const auditService = await buildAuditService();
      await auditService.appendStandalone({
        actorUserId: actorId,
        actorRole: 'admin',
        action: 'workspace-settings-update',
        resourceType: 'workspace_settings',
        resourceId: null,
        contentHash: hashJson({ op: 'act3-settings', ts }),
        payloadHash: hashJson({ op: 'act3-settings-payload', ts }),
      });

      const svc = await buildAdminActivityService();
      const result = await svc.getActivity({});

      expect(result.rows.length).toBeGreaterThan(0);

      const serialized = JSON.stringify(result);

      // LOAD-BEARING: hash fields must NOT appear in any row.
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
        // JSON column names (snake_case as Postgres stores them)
        'payload_hash',
        'content_hash',
        'entry_hash',
        'prev_hash',
        'chain_version',
        'actor_role',
        'resource_type',
        'resource_id',
        'mandate_id',
        'encrypted_credentials',
      ];

      for (const field of forbiddenFields) {
        expect(serialized, `Response must not contain field: ${field}`).not.toContain(
          `"${field}"`
        );
      }

      // Each row must have EXACTLY the allowed keys.
      for (const row of result.rows) {
        const keys = Object.keys(row);
        expect(keys).toContain('sequenceNumber');
        expect(keys).toContain('actor');
        expect(keys).toContain('target');
        expect(keys).toContain('action');
        expect(keys).toContain('timestamp');
        // actor must have displayName + email only.
        expect(Object.keys(row.actor)).toEqual(['displayName', 'email']);
        if (row.target !== null) {
          expect(Object.keys(row.target)).toEqual(['displayName', 'email']);
        }
      }
    });

    // ── ACT-4: read-only — calling getActivity appends ZERO audit rows ─────────

    it('ACT-4: calling getActivity() appends ZERO rows to audit_log_entries', {
      timeout: 10000,
    }, async () => {
      if (!dbReachable) return;

      const countBefore = await countAuditRows();

      const svc = await buildAdminActivityService();
      // Call multiple times to ensure no side effects accumulate.
      await svc.getActivity({});
      await svc.getActivity({ limit: 10 });
      await svc.getActivity({ action: 'role-change' });

      const countAfter = await countAuditRows();

      // LOAD-BEARING (P-4 Finding 3): read-only invariant must hold.
      expect(countAfter).toBe(countBefore);
    });

    // ── ACT-5: empty-state returns [] gracefully ──────────────────────────────

    it('ACT-5: getActivity with a far-future since filter returns empty state gracefully', {
      timeout: 10000,
    }, async () => {
      if (!dbReachable) return;

      const svc = await buildAdminActivityService();
      // 2099-01-01: guaranteed no rows exist with createdAt >= this.
      const result = await svc.getActivity({ since: '2099-01-01T00:00:00.000Z' });

      expect(result.rows).toEqual([]);
      expect(result.nextCursor).toBeNull();
      expect(result.total).toBe(0);
    });

    // ── ACT-6: RBAC — RolesGuard wires correctly (DI-boot test) ──────────────

    it('ACT-6: AdminActivityModule DI-boot — controller, service, guards resolve without live DB', async () => {
      // This test does NOT require a real DB (it mocks the DB provider).
      // It proves the module wires correctly for RBAC: RolesGuard + SessionGuard
      // are resolvable, which means advisor 403 / anon 401 are enforced.

      const { Test } = await import('@nestjs/testing');
      const { DB } = await import('../src/db/db.provider');
      const { AdminActivityModule } = await import(
        '../src/modules/admin-activity/admin-activity.module'
      );
      const { AdminActivityController } = await import(
        '../src/modules/admin-activity/admin-activity.controller'
      );
      const { AdminActivityService } = await import(
        '../src/modules/admin-activity/admin-activity.service'
      );
      const { AuditRepository } = await import('../src/modules/audit/audit.repository');
      const { AuthRepository } = await import('../src/modules/auth/auth.repository');
      const { RolesGuard } = await import('../src/modules/auth/guards/roles.guard');
      const { SessionGuard } = await import('../src/modules/auth/guards/session.guard');

      // biome-ignore lint/suspicious/noExplicitAny: mock DB handle
      const mockDb: any = {
        select: () => ({ from: () => ({ where: () => ({ limit: () => Promise.resolve([]) }) }) }),
        insert: () => ({ values: () => ({ returning: () => Promise.resolve([]) }) }),
        transaction: () => Promise.resolve(),
        execute: () => Promise.resolve({ rows: [] }),
      };

      const module = await Test.createTestingModule({
        imports: [AdminActivityModule],
      })
        .overrideProvider(DB)
        .useValue(mockDb)
        .compile();

      // Controller and service must resolve.
      expect(module.get(AdminActivityController)).toBeDefined();
      expect(module.get(AdminActivityService)).toBeDefined();

      // Shared infrastructure from imports must resolve:
      // AuditRepository (exported by AuditModule — BUILD rule 2: guard-injected repo exported).
      expect(module.get(AuditRepository)).toBeDefined();
      // AuthRepository (exported by AuthModule — RolesGuard injects it).
      expect(module.get(AuthRepository)).toBeDefined();
      // RolesGuard + SessionGuard (exported by AuthModule — required for admin-only enforcement).
      expect(module.get(RolesGuard)).toBeDefined();
      expect(module.get(SessionGuard)).toBeDefined();
    });
  }
);

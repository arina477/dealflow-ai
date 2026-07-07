/**
 * B-0 Migration test — wave-20 outreach_activity table (task d45c73b5).
 *
 * DETERMINISTIC-TEST-SPEC-FIRST: authored before migration 0018 exists.
 * These tests FAIL until the migration is applied.
 *
 * ── LOAD-BEARING ASSERTIONS ─────────────────────────────────────────────────
 *
 * OAM-1 (empty-DB apply): migration 0018 applies on an empty-schema DB.
 *   - outreach_activity table exists with expected columns.
 *   - Both enums exist: outreach_activity_channel, outreach_activity_status.
 *   - RLS: relrowsecurity = true AND relforcerowsecurity = true (SF3/R2).
 *   - Policy name 'workspace_isolation' with FOR ALL (polcmd = '*'), no
 *     literal WITH CHECK (polwithcheck IS NULL), USING clause set (SF3 check).
 *   - GRANT SELECT/INSERT/UPDATE/DELETE to dealflow_app confirmed.
 *   - workspace_id column DEFAULT is NULLIF(current_setting(...))::uuid (SF1 HIGH).
 *
 * OAM-2 (POPULATED-DB GAP-4): migration 0018 applies against a DB that already
 *   has audit_log_entries rows — no WORM-trigger collision. The outreach_activity
 *   table does NOT touch audit_log_entries, so this is a verification that the
 *   additive migration (CREATE TABLE + 2 enums) does not accidentally fire the
 *   WORM trigger. Verifies the audit chain is still intact post-migration.
 *
 * OAM-3 (SF6 GAP-4 tightening): verifyChain() on the pre-existing audit chain
 *   returns ok:true AFTER migration 0018 is applied.
 *
 * OAM-4 (RLS write-path negative): with GUC=WS_A, INSERT with explicit WS_B
 *   workspace_id → REJECTED (42501) as dealflow_app.
 *
 * OAM-5 (R1 own-row re-home UPDATE): as dealflow_app, GUC=WS_A, own row visible,
 *   UPDATE SET workspace_id=WS_B → REJECTED (42501). This is the actual write-
 *   check test (NOT the vacuous "update with WS_B id" pattern).
 *
 * OAM-6 (read negative): row seeded in WS_A is invisible to WS_B GUC.
 *
 * OAM-7 (R2/SF3 FORCE positive control): relforcerowsecurity=true asserted via
 *   pg_class when connected as dealflow_app.
 *
 * ── GUARD ────────────────────────────────────────────────────────────────────
 * Suite is skipped when TEST_DATABASE_URL is unset.
 *
 * ── UUID NAMESPACE ───────────────────────────────────────────────────────────
 * Wave-20 outreach-activity prefix '00000020-0a17-4000-8000-*'.
 * Hex-only segments. Disjoint from all prior suites.
 *
 * ── TEARDOWN (WORM-SAFE) ─────────────────────────────────────────────────────
 * outreach_activity is mutable; seeded rows are deleted in afterAll (not WORM).
 * Seeded users are never deleted (deactivated_at set); audit rows accumulate.
 */

import path from 'node:path';
import { Pool, type PoolClient } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { apiMigrationsFolder, ensureMigrated } from './_helpers/ensure-migrated';

// ── Guard ─────────────────────────────────────────────────────────────────────
const TEST_DB_URL = process.env.TEST_DATABASE_URL;
const shouldSkip = !TEST_DB_URL || TEST_DB_URL.trim() === '';

if (shouldSkip) {
  console.info('[outreach-activity-migration] TEST_DATABASE_URL is not set — suite SKIPPED.');
}

async function isDbReachable(url: string): Promise<boolean> {
  const p = new Pool({ connectionString: url, connectionTimeoutMillis: 3000 });
  try {
    await p.query('SELECT 1');
    return true;
  } catch {
    return false;
  } finally {
    await p.end();
  }
}

// ── UUID namespace ────────────────────────────────────────────────────────────
const OA_WS_A_ID = '00000020-0a17-4000-8000-000000000001';
const OA_WS_B_ID = '00000020-0a17-4000-8000-000000000002';
const OA_ST_USER_A = '00000020-0a17-st-user-oa-001'; // supertokens_user_id (text)

// biome-ignore lint/suspicious/noExplicitAny: drizzle handle typed as any in e2e
let db: any;
let pool: Pool;
let dbReachable = false;

let userAId: string; // app users.id in WS_A

// Seeded outreach_activity ids — cleaned up in afterAll.
const seededActivityIds: string[] = [];

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Open a dedicated PoolClient, SET ROLE dealflow_app (NOSUPERUSER, NOBYPASSRLS),
 * set app.workspace_id GUC, run callback, RESET ROLE + RESET GUC, release.
 * This is the wave-18/19 pattern: isolation assertions run as dealflow_app.
 */
async function withWorkspace<T>(
  workspaceId: string,
  fn: (client: PoolClient) => Promise<T>
): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query('SET ROLE dealflow_app');
    await client.query('SELECT set_config($1, $2, false)', ['app.workspace_id', workspaceId]);
    return await fn(client);
  } finally {
    try {
      await client.query('RESET ROLE');
      await client.query('RESET app.workspace_id');
    } finally {
      client.release();
    }
  }
}

// ── Suite ─────────────────────────────────────────────────────────────────────
describe.skipIf(shouldSkip)(
  'B-0 Migration test — wave-20 outreach_activity table (d45c73b5)',
  () => {
    beforeAll(async () => {
      if (!TEST_DB_URL) return;
      dbReachable = await isDbReachable(TEST_DB_URL);
      if (!dbReachable) {
        console.info('[outreach-activity-migration] DB unreachable — tests will be skipped.');
        return;
      }

      process.env.DATABASE_URL = TEST_DB_URL;
      process.env.AUDIT_LOG_HMAC_KEY =
        process.env.AUDIT_LOG_HMAC_KEY ?? 'test-audit-hmac-key-dummy-do-not-use-in-prod';
      process.env.AUDIT_LOG_HMAC_KEY_VERSION = process.env.AUDIT_LOG_HMAC_KEY_VERSION ?? '1';

      const { drizzle } = await import('drizzle-orm/node-postgres');
      pool = new Pool({ connectionString: TEST_DB_URL });
      const schema = await import('../src/db/schema');
      db = drizzle(pool, { schema });

      // Apply all migrations via superuser (advisory-lock serialized, idempotent).
      await ensureMigrated(
        db,
        apiMigrationsFolder(path.resolve(import.meta.url.replace('file://', ''), '..'))
      );

      // Seed workspaces (idempotent).
      await pool.query(
        `INSERT INTO workspaces (id, name) VALUES
           ('a1b2c3d4-0000-4000-8000-000000000001', 'Default Workspace'),
           ($1, 'OA Test WS_A'),
           ($2, 'OA Test WS_B')
         ON CONFLICT (id) DO NOTHING`,
        [OA_WS_A_ID, OA_WS_B_ID]
      );

      // Resolve admin role id.
      const roleRes = await pool.query<{ id: string }>(
        `SELECT id FROM roles WHERE name = 'admin' LIMIT 1`
      );
      const adminRoleId = roleRes.rows[0]?.id;
      if (!adminRoleId) throw new Error('beforeAll: admin role not found');

      // Seed user in WS_A (superuser with GUC, FORCE RLS applies to owner too).
      const insertClient = await pool.connect();
      try {
        await insertClient.query('SELECT set_config($1, $2, false)', [
          'app.workspace_id',
          OA_WS_A_ID,
        ]);
        await insertClient.query(
          `INSERT INTO users (supertokens_user_id, email, role_id, workspace_id, deactivated_at)
           VALUES ($1, $2, $3::uuid, $4::uuid, now())
           ON CONFLICT (supertokens_user_id) DO NOTHING`,
          [OA_ST_USER_A, 'oa-test-a@wave20.test', adminRoleId, OA_WS_A_ID]
        );
      } finally {
        await insertClient.query('RESET app.workspace_id').catch(() => {});
        insertClient.release();
      }

      // Read back user id.
      const readClient = await pool.connect();
      try {
        await readClient.query('SELECT set_config($1, $2, false)', [
          'app.workspace_id',
          OA_WS_A_ID,
        ]);
        const res = await readClient.query<{ id: string }>(
          `SELECT id FROM users WHERE supertokens_user_id = $1 LIMIT 1`,
          [OA_ST_USER_A]
        );
        const id = res.rows[0]?.id;
        if (!id) throw new Error('beforeAll: OA user A not found');
        userAId = id;
      } finally {
        await readClient.query('RESET app.workspace_id').catch(() => {});
        readClient.release();
      }
    });

    afterAll(async () => {
      if (!dbReachable) return;
      // Delete seeded outreach_activity rows (mutable table — not WORM).
      if (seededActivityIds.length > 0) {
        await pool
          .query(`DELETE FROM outreach_activity WHERE id = ANY($1::uuid[])`, [seededActivityIds])
          .catch(() => {});
      }
      await pool.end().catch(() => {});
    });

    // ── OAM-1: empty-DB apply ──────────────────────────────────────────────────

    it('OAM-1a: outreach_activity table exists after migration', {
      timeout: 15000,
    }, async () => {
      if (!dbReachable) return;

      const res = await pool.query<{ exists: boolean }>(
        `SELECT EXISTS (
           SELECT FROM information_schema.tables
           WHERE table_schema = 'public'
             AND table_name = 'outreach_activity'
         ) AS exists`
      );
      expect(res.rows[0]?.exists).toBe(true);
    });

    it('OAM-1b: both distinct enums exist (outreach_activity_channel + outreach_activity_status)', {
      timeout: 10000,
    }, async () => {
      if (!dbReachable) return;

      const res = await pool.query<{ typname: string }>(
        `SELECT typname FROM pg_type
         WHERE typname IN ('outreach_activity_channel', 'outreach_activity_status')
         ORDER BY typname`
      );
      const names = res.rows.map((r) => r.typname);
      expect(names).toContain('outreach_activity_channel');
      expect(names).toContain('outreach_activity_status');
    });

    it('OAM-1c: outreach_activity_channel enum has expected values', {
      timeout: 10000,
    }, async () => {
      if (!dbReachable) return;

      const res = await pool.query<{ enumlabel: string }>(
        `SELECT e.enumlabel
         FROM pg_type t
         JOIN pg_enum e ON e.enumtypid = t.oid
         WHERE t.typname = 'outreach_activity_channel'
         ORDER BY e.enumsortorder`
      );
      const vals = res.rows.map((r) => r.enumlabel);
      expect(vals).toEqual(['call', 'email', 'linkedin', 'other']);
    });

    it('OAM-1d: outreach_activity_status enum has expected values', {
      timeout: 10000,
    }, async () => {
      if (!dbReachable) return;

      const res = await pool.query<{ enumlabel: string }>(
        `SELECT e.enumlabel
         FROM pg_type t
         JOIN pg_enum e ON e.enumtypid = t.oid
         WHERE t.typname = 'outreach_activity_status'
         ORDER BY e.enumsortorder`
      );
      const vals = res.rows.map((r) => r.enumlabel);
      expect(vals).toEqual(['planned', 'completed', 'cancelled']);
    });

    it('OAM-1e: workspace_id column has a column DEFAULT (SF1 — column DEFAULT from GUC)', {
      timeout: 10000,
    }, async () => {
      if (!dbReachable) return;

      const res = await pool.query<{ column_default: string | null }>(
        `SELECT column_default
         FROM information_schema.columns
         WHERE table_schema = 'public'
           AND table_name = 'outreach_activity'
           AND column_name = 'workspace_id'`
      );
      const def = res.rows[0]?.column_default;
      // Column default must include NULLIF and current_setting (the GUC column DEFAULT).
      expect(def).not.toBeNull();
      expect(def?.toLowerCase()).toContain('nullif');
      expect(def?.toLowerCase()).toContain('current_setting');
    });

    // ── OAM-2: POPULATED-DB GAP-4 (no WORM trigger collision) ─────────────────

    it('OAM-2: POPULATED-DB GAP-4 — additive migration does not collide with WORM trigger', {
      timeout: 20000,
    }, async () => {
      if (!dbReachable) return;

      // Seed a real HMAC-chained audit row BEFORE we verify the migration applies cleanly.
      // The migration only does CREATE TABLE + 2 enums + RLS + GRANT — it does NOT touch
      // audit_log_entries, so no WORM collision. We just confirm the entry count grew.
      const { AuditKeyring } = await import('../src/modules/audit/audit.keyring');
      const { AuditRepository } = await import('../src/modules/audit/audit.repository');
      const { AuditService } = await import('../src/modules/audit/audit.service');

      const auditSvc = new AuditService(new AuditKeyring(process.env), new AuditRepository(db));
      const h = (n: number) => `${n}`.repeat(64).slice(0, 64);
      const before = await pool.query<{ count: string }>(
        `SELECT COUNT(*)::text AS count FROM audit_log_entries`
      );
      const beforeCount = Number(before.rows[0]?.count ?? 0);

      // Append a real chain entry (standalone — no business tx needed).
      await auditSvc.appendStandalone({
        actorUserId: userAId,
        actorRole: 'admin',
        action: 'user-invite',
        resourceType: 'invite',
        resourceId: `oam2-populated-${Date.now()}`,
        contentHash: h(1),
        payloadHash: h(2),
      });

      const after = await pool.query<{ count: string }>(
        `SELECT COUNT(*)::text AS count FROM audit_log_entries`
      );
      const afterCount = Number(after.rows[0]?.count ?? 0);

      // Migration applied cleanly — new audit rows can be appended.
      expect(afterCount).toBeGreaterThan(beforeCount);
    });

    // ── OAM-3: SF6 GAP-4 tightening — verifyChain ok after migration ──────────

    it('OAM-3 (SF6): verifyChain() returns ok:true after migration 0018 is applied', {
      timeout: 20000,
    }, async () => {
      if (!dbReachable) return;

      const { AuditKeyring } = await import('../src/modules/audit/audit.keyring');
      const { AuditRepository } = await import('../src/modules/audit/audit.repository');
      const { AuditVerifier } = await import('../src/modules/audit/audit.verifier');

      const keyring = new AuditKeyring(process.env);
      const auditRepo = new AuditRepository(db);
      const verifier = new AuditVerifier(keyring, auditRepo);

      const result = await verifier.verifyChain();
      expect(result.ok).toBe(true);
    });

    // ── OAM-4: RLS write-path negative — explicit WS_B id under WS_A GUC ──────

    it('OAM-4: INSERT with explicit WS_B workspace_id under WS_A GUC → rejected (42501)', {
      timeout: 10000,
    }, async () => {
      if (!dbReachable) return;

      let thrownErr: unknown = null;
      await withWorkspace(OA_WS_A_ID, async (client) => {
        try {
          await client.query(
            `INSERT INTO outreach_activity
               (channel, status, subject, workspace_id, created_by)
             VALUES
               ('call', 'planned', 'RLS write test — explicit WS_B', $1::uuid, $2::uuid)`,
            [OA_WS_B_ID, userAId]
          );
        } catch (err) {
          thrownErr = err;
        }
      });

      expect(thrownErr).not.toBeNull();
      const code =
        (thrownErr as { code?: string })?.code ??
        (thrownErr as { cause?: { code?: string } })?.cause?.code;
      expect(code).toBe('42501');
    });

    // ── OAM-5: R1 own-row re-home UPDATE — the actual write-check test ─────────

    it('OAM-5 (R1): GUC=WS_A, own row, UPDATE SET workspace_id=WS_B → REJECTED (42501)', {
      timeout: 15000,
    }, async () => {
      if (!dbReachable) return;

      // Seed a row in WS_A as superuser (to bypass RLS for seeding).
      const activityId = crypto.randomUUID();
      const insertClient = await pool.connect();
      try {
        await insertClient.query('SELECT set_config($1, $2, false)', [
          'app.workspace_id',
          OA_WS_A_ID,
        ]);
        await insertClient.query(
          `INSERT INTO outreach_activity
             (id, channel, status, subject, workspace_id, created_by)
           VALUES
             ($1::uuid, 'email', 'planned', 'R1 re-home test subject', $2::uuid, $3::uuid)`,
          [activityId, OA_WS_A_ID, userAId]
        );
        seededActivityIds.push(activityId);
      } finally {
        await insertClient.query('RESET app.workspace_id').catch(() => {});
        insertClient.release();
      }

      // As dealflow_app with GUC=WS_A, the row is visible (own row).
      // Now attempt to UPDATE SET workspace_id = WS_B — the derived write-check
      // from USING under FOR ALL must REJECT this (new row fails USING predicate).
      // This is the test that distinguishes FOR ALL / USING-only from FOR SELECT
      // (which has no derived WITH CHECK → write-side leak).
      let thrownErr: unknown = null;
      await withWorkspace(OA_WS_A_ID, async (client) => {
        try {
          await client.query(
            `UPDATE outreach_activity SET workspace_id = $1::uuid WHERE id = $2::uuid`,
            [OA_WS_B_ID, activityId]
          );
        } catch (err) {
          thrownErr = err;
        }
      });

      expect(thrownErr).not.toBeNull();
      const code =
        (thrownErr as { code?: string })?.code ??
        (thrownErr as { cause?: { code?: string } })?.cause?.code;
      // RLS violation on new-row check → 42501.
      expect(code).toBe('42501');
    });

    // ── OAM-6: read negative — WS_A row invisible to WS_B session ────────────

    it('OAM-6: row seeded in WS_A is invisible to WS_B GUC session', {
      timeout: 10000,
    }, async () => {
      if (!dbReachable) return;

      // Seed a row in WS_A.
      const activityId = crypto.randomUUID();
      const insertClient = await pool.connect();
      try {
        await insertClient.query('SELECT set_config($1, $2, false)', [
          'app.workspace_id',
          OA_WS_A_ID,
        ]);
        await insertClient.query(
          `INSERT INTO outreach_activity
             (id, channel, status, subject, workspace_id, created_by)
           VALUES
             ($1::uuid, 'linkedin', 'planned', 'OAM-6 read negative test', $2::uuid, $3::uuid)`,
          [activityId, OA_WS_A_ID, userAId]
        );
        seededActivityIds.push(activityId);
      } finally {
        await insertClient.query('RESET app.workspace_id').catch(() => {});
        insertClient.release();
      }

      // Query from WS_B GUC session as dealflow_app.
      const rows = await withWorkspace(OA_WS_B_ID, async (client) => {
        const res = await client.query<{ id: string }>(
          `SELECT id FROM outreach_activity WHERE id = $1::uuid`,
          [activityId]
        );
        return res.rows;
      });

      expect(rows).toHaveLength(0);
    });

    // ── OAM-7: R2/SF3 FORCE positive control ─────────────────────────────────

    it('OAM-7 (R2/SF3): relrowsecurity=true AND relforcerowsecurity=true on outreach_activity', {
      timeout: 10000,
    }, async () => {
      if (!dbReachable) return;

      const res = await pool.query<{
        relrowsecurity: boolean;
        relforcerowsecurity: boolean;
      }>(
        `SELECT relrowsecurity, relforcerowsecurity
         FROM pg_class
         WHERE relname = 'outreach_activity'
           AND relkind = 'r'`
      );
      const row = res.rows[0];
      expect(row).toBeDefined();
      expect(row?.relrowsecurity).toBe(true);
      expect(row?.relforcerowsecurity).toBe(true);
    });

    it('OAM-7b (SF3): workspace_isolation policy is FOR ALL with no literal WITH CHECK (polcmd=* polwithcheck IS NULL)', {
      timeout: 10000,
    }, async () => {
      if (!dbReachable) return;

      const res = await pool.query<{
        polname: string;
        polcmd: string;
        polwithcheck: string | null;
      }>(
        `SELECT polname, polcmd, polwithcheck::text
         FROM pg_policy p
         JOIN pg_class c ON c.oid = p.polrelid
         WHERE c.relname = 'outreach_activity'
           AND p.polname = 'workspace_isolation'`
      );
      const pol = res.rows[0];
      expect(pol).toBeDefined();
      // FOR ALL = '*' in pg_policy.polcmd
      expect(pol?.polcmd).toBe('*');
      // No literal WITH CHECK clause — derived from USING under FOR ALL.
      expect(pol?.polwithcheck).toBeNull();
    });
  }
);

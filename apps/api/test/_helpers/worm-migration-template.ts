/**
 * worm-migration-template.ts — COPY-ABLE SKELETON for populated-DB migration tests.
 *
 * INSTRUCTIONS: Copy this file to apps/api/test/<your-migration-name>.e2e-spec.ts
 * and adapt the marked ADAPT sections. Do NOT import from this file — it is a
 * documentation artifact, not a runtime import.
 *
 * Reference implementation: apps/api/test/audit-migration-populated-db.e2e-spec.ts
 * Thin helpers: apps/api/test/_helpers/worm-migration-test-utils.ts
 * Standing policy: command-center/testing/worm-migration-testing-policy.md
 *
 * ── WHEN TO USE ────────────────────────────────────────────────────────────────
 * Use this template when your migration performs INSERT/UPDATE/backfill/ALTER on a
 * DB-trigger-enforced WORM table (currently: audit_log_entries). See the policy doc.
 *
 * ── WHAT THIS TEMPLATE PROVES ─────────────────────────────────────────────────
 * WMT-1: Seeds real chained audit rows BEFORE the migration applies.
 * WMT-2: Applies the migration on a populated DB (via ensureMigrated).
 * WMT-3: Asserts the migration applies without error.
 * WMT-4: Asserts per-row HMAC hash-exclusion is intact (verifyChain ok:true equivalent).
 * WMT-5: Fault-killing — asserts the WORM trigger is still active post-migration
 *         (an UPDATE without DISABLE TRIGGER throws P0001).
 *
 * ── UUID NAMESPACE RULE ───────────────────────────────────────────────────────
 * Use a UUID namespace that encodes your wave number and a suite suffix.
 * Format: '000000<wave>-<hex-suffix>-4000-8000-<counter>'
 * <hex-suffix> must be exactly 4 hex characters. Disjoint from all prior suites.
 * Example for wave-24: '00000024-ab24-4000-8000-000000000001'
 *
 * ── REGISTRATION REQUIRED ─────────────────────────────────────────────────────
 * After creating your test, add an entry to:
 *   apps/api/test/_helpers/worm-migration-coverage-registry.ts
 * The CI check will fail until you do.
 */

// ─────────────────────────────────────────────────────────────────────────────
// BEGIN COPY-ABLE SKELETON
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Populated-DB migration test — <ADAPT: migration name and purpose>.
 *
 * <ADAPT: describe the migration step that touches audit_log_entries and why
 * a populated-DB test is needed (e.g. "0099 backfills new_column on
 * audit_log_entries — requires DISABLE/ENABLE TRIGGER wrap")>
 */

import path from 'node:path';
import { Pool } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { apiMigrationsFolder, ensureMigrated } from './_helpers/ensure-migrated';
import {
  assertVerifyChainOkForRows,
  seedChainedAuditRows,
} from './_helpers/worm-migration-test-utils';

// ── Guard ────────────────────────────────────────────────────────────────────
const TEST_DB_URL = process.env.TEST_DATABASE_URL;
const shouldSkip = !TEST_DB_URL || TEST_DB_URL.trim() === '';

if (shouldSkip) {
  console.info(
    '[worm-migration-template] TEST_DATABASE_URL is not set — suite SKIPPED. ' +
      'Set TEST_DATABASE_URL to a reachable Postgres instance with migrations applied.'
  );
}

// ── ADAPT: UUID namespace (unique per suite, hex-only segments) ───────────────
// Wave-XX template prefix '000000XX-XXXX-4000-8000-*'.
const SUITE_WS_ID = '000000XX-XXXX-4000-8000-000000000001'; // ADAPT: use your wave UUIDs
const SUITE_ST_USER_ID = '000000XX-XXXX-st-wmttest-0001'; // ADAPT: must be unique text

// biome-ignore lint/suspicious/noExplicitAny: drizzle handle is typed as any in e2e context
let db: any;
let pool: Pool;
let dbReachable = false;
let seededUserId: string;

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

// ── Suite ─────────────────────────────────────────────────────────────────────
describe.skipIf(shouldSkip)(
  // ADAPT: suite name
  'Populated-DB migration test — <migration-id> <short-description>',
  () => {
    beforeAll(async () => {
      if (!TEST_DB_URL) return;
      dbReachable = await isDbReachable(TEST_DB_URL);
      if (!dbReachable) {
        console.info('[worm-migration-template] Postgres unreachable — tests will be skipped.');
        return;
      }

      process.env.DATABASE_URL = TEST_DB_URL;
      process.env.AUDIT_LOG_HMAC_KEY =
        process.env.AUDIT_LOG_HMAC_KEY ?? 'test-audit-hmac-key-dummy-do-not-use-in-prod';
      process.env.AUDIT_LOG_HMAC_KEY_VERSION = process.env.AUDIT_LOG_HMAC_KEY_VERSION ?? '1';

      const { drizzle } = await import('drizzle-orm/node-postgres');
      const { Pool: PgPool } = await import('pg');
      pool = new PgPool({ connectionString: TEST_DB_URL });
      const schema = await import('../../src/db/schema');
      db = drizzle(pool, { schema });

      // Apply all migrations (idempotent via advisory lock).
      await ensureMigrated(
        db,
        apiMigrationsFolder(path.resolve(import.meta.url.replace('file://', ''), '..'))
      );

      // Resolve admin role id.
      const roleRes = await pool.query<{ id: string }>(
        `SELECT id FROM roles WHERE name = 'admin' LIMIT 1`
      );
      const adminRoleId = roleRes.rows[0]?.id;
      if (!adminRoleId) throw new Error('beforeAll: admin role not found');

      // Seed the default workspace if absent (idempotent).
      await pool.query(
        `INSERT INTO workspaces (id, name)
         VALUES ('a1b2c3d4-0000-4000-8000-000000000001', 'Default Workspace')
         ON CONFLICT (id) DO NOTHING`
      );

      // Seed the suite workspace.
      await pool.query(
        `INSERT INTO workspaces (id, name)
         VALUES ($1, 'WMT Test Workspace')
         ON CONFLICT (id) DO NOTHING`,
        [SUITE_WS_ID]
      );

      // Seed a test user (deactivated — WORM-safe teardown).
      const insertClient = await pool.connect();
      try {
        await insertClient.query('SELECT set_config($1, $2, false)', [
          'app.workspace_id',
          SUITE_WS_ID,
        ]);
        await insertClient.query(
          `INSERT INTO users (supertokens_user_id, email, role_id, workspace_id, deactivated_at)
           VALUES ($1, $2, $3::uuid, $4::uuid, now())
           ON CONFLICT (supertokens_user_id) DO NOTHING`,
          [SUITE_ST_USER_ID, 'wmt-test@worm-migration.test', adminRoleId, SUITE_WS_ID]
        );
      } finally {
        await insertClient.query('RESET app.workspace_id').catch(() => {});
        insertClient.release();
      }

      // Read back the user id.
      const readClient = await pool.connect();
      try {
        await readClient.query('SELECT set_config($1, $2, false)', [
          'app.workspace_id',
          SUITE_WS_ID,
        ]);
        const res = await readClient.query<{ id: string }>(
          `SELECT id FROM users WHERE supertokens_user_id = $1 LIMIT 1`,
          [SUITE_ST_USER_ID]
        );
        const id = res.rows[0]?.id;
        if (!id) throw new Error('beforeAll: seeded user not found');
        seededUserId = id;
      } finally {
        await readClient.query('RESET app.workspace_id').catch(() => {});
        readClient.release();
      }
    });

    afterAll(async () => {
      if (!dbReachable) return;
      await pool.end().catch(() => {});
    });

    /**
     * WMT-1/WMT-2/WMT-3: Seed real chained rows, apply migration, assert no error.
     * WMT-4: Per-row HMAC recompute confirms hash-exclusion of the migrated column.
     *
     * ADAPT: rename this test and add assertions specific to your migration
     * (e.g. check that the backfilled column has the expected value after migration).
     */
    it('WMT-1/WMT-3/WMT-4: seeds real chained rows → migration applies without error → per-row HMAC ok', {
      timeout: 15000,
    }, async () => {
      if (!dbReachable) return;

      // WMT-1: Seed real HMAC-chained audit rows.
      const seeded = await seedChainedAuditRows(db, {
        pool,
        actorUserId: seededUserId,
        count: 3,
        resourceIdPrefix: `wmt-seed-${Date.now()}`,
      });

      expect(seeded).toHaveLength(3);
      const seqNums = seeded.map((e) => e.sequenceNumber);

      // WMT-3: ensureMigrated already ran in beforeAll without error.
      // If the migration failed on populated rows the beforeAll would have thrown,
      // and all tests would be marked as failed. No additional assertion needed here.

      // WMT-4: per-row HMAC recompute (immune to parallel-suite interleaving).
      const rows = await assertVerifyChainOkForRows(pool, seqNums, expect);

      // ADAPT: add migration-specific assertions here.
      // Example: assert backfilled column value after migration.
      // for (const row of rows) {
      //   expect((row as { new_column: string }).new_column).toBe(EXPECTED_VALUE);
      // }
      expect(rows).toHaveLength(3);
    });

    /**
     * WMT-5: Fault-killing — WORM trigger is still active post-migration.
     * Attempting an UPDATE without DISABLE TRIGGER throws P0001.
     *
     * This test MUST NOT be removed. It proves the ENABLE TRIGGER at the end of the
     * migration's trigger-disable window is load-bearing and was not accidentally omitted.
     */
    it('WMT-5: fault-killing — UPDATE without DISABLE TRIGGER throws P0001 (WORM trigger active)', {
      timeout: 10000,
    }, async () => {
      if (!dbReachable) return;

      const countRes = await pool.query<{ count: string }>(
        `SELECT COUNT(*)::text AS count FROM audit_log_entries`
      );
      const count = Number(countRes.rows[0]?.count ?? 0);
      expect(count).toBeGreaterThan(0);

      let thrownError: Error | null = null;
      try {
        await pool.query(
          `UPDATE audit_log_entries SET actor_role = 'advisor' WHERE sequence_number = 1`
        );
      } catch (err) {
        thrownError = err as Error;
      }

      expect(thrownError).not.toBeNull();
      const errCode =
        (thrownError as { code?: string })?.code ??
        (thrownError as { cause?: { code?: string } })?.cause?.code;
      expect(errCode).toBe('P0001');
      expect(thrownError?.message).toMatch(/audit_log_entries is append-only/);
    });

    // ADAPT: add migration-specific tests here (e.g. WMT-6 for a specific backfill
    // verification matching your migration's trigger-disable pattern).
  }
);

// ─────────────────────────────────────────────────────────────────────────────
// END COPY-ABLE SKELETON
// ─────────────────────────────────────────────────────────────────────────────

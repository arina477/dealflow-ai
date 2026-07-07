/**
 * Seller-intent cross-firm negative-read e2e (wave-23, tasks 9e54cc11 / 12947422).
 *
 * Mirrors analytics-isolation.e2e-spec.ts (wave-18 B-6 rework pattern): invokes the
 * REAL SellerIntentService via workspaceAls.run with a dealflow_app GUC-bound Drizzle
 * handle.
 *
 * GUARD: suite is skipped when TEST_DATABASE_URL is unset or DB unreachable.
 *
 * ── LOAD-BEARING INVARIANTS (T-8) ────────────────────────────────────────────
 *
 * SIT-1: Cross-firm negative read — seller-intent results for firm A never include
 *   firm B's mandate IDs.
 *   - Seed WS_A with 2 mandates + 2 completed outreach_activity rows (mandate scoped).
 *   - Seed WS_B with 2 mandates (no activities — enough to prove they don't leak).
 *   - Run SellerIntentService.getList() inside workspaceAls.run(WS_A GUC).
 *   - Assert: WS_B mandate IDs are NOT in the result (cross-tenant leak = 0).
 *   - Assert: WS_A mandate IDs ARE in the result (positive side of the same assertion).
 *
 * SIT-2: Positive control — WS_A results are non-empty and scores are computed.
 *   - The 2 completed activities seeded for WS_A mandate A1 must drive
 *     outreachEngagement > 0 for that mandate.
 *
 * SIT-3: FAULT-KILLING — no-ALS call THROWS (fail-closed getWorkspaceId() check).
 *   - Instantiate SellerIntentService with a singleton Drizzle handle (no ALS context).
 *   - Call service.getList() WITHOUT workspaceAls.run.
 *   - Assert: the call THROWS with the fail-closed error message.
 *   - This proves the explicit getWorkspaceId() null-check is active and enforced.
 *   - REGRESSION-CATCHING: if the null check is removed AND getDb is bypassed, SIT-1
 *     would catch the cross-firm leak (WS_B mandate IDs would appear in results).
 *
 * ── HOW THE REAL SERVICE IS INVOKED ─────────────────────────────────────────
 * 1. Check out a PoolClient from the test pool.
 * 2. SET ROLE dealflow_app — drops superuser privilege, FORCE RLS applies.
 * 3. SELECT set_config('app.workspace_id', WS_A_ID, false) — GUC live on this client.
 * 4. drizzle(client, { schema }) → gucHandle (same pattern as WorkspaceInterceptor).
 * 5. workspaceAls.run({ db: gucHandle, workspaceId: WS_A_ID }, () => service.getList())
 *    → inside the callback getDb(this.db) returns gucHandle (ALS store is set).
 * 6. RESET ROLE + RESET app.workspace_id + release in finally.
 *
 * ── UUID NAMESPACE (wave-23 seller-intent) ───────────────────────────────────
 * Wave-23 prefix '00000023-a100-*'. Disjoint from prior suites:
 *   workspace-isolation: 00000017-aa17-*
 *   admin-activity:      00000016-acti-*
 *   analytics-isolation: 00000018-a4a1-*
 *
 * ── TEARDOWN POLICY (WORM-SAFE, T-4 rule 1) ──────────────────────────────────
 * audit_log_entries rows are WORM — not deleted. All other seeded rows are
 * cleaned in finally/afterAll using the superuser pool with the correct GUC.
 * Teardown is idempotent (ON CONFLICT DO NOTHING for inserts; DELETE is no-op
 * when rows are already gone). Seeded row IDs are tracked for cleanup.
 *
 * ── T-4 RULE 2 — SCOPED TO OWN SEEDED ROWS ──────────────────────────────────
 * Assertions check for mandateId membership (WS_A IDs in result, WS_B IDs absent),
 * not for total-table counts. Safe on a shared DB where other runs may have left rows.
 */

import path from 'node:path';
import { Pool, type PoolClient } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { apiMigrationsFolder, ensureMigrated } from './_helpers/ensure-migrated';

// ── Guard ─────────────────────────────────────────────────────────────────────

const TEST_DB_URL = process.env.TEST_DATABASE_URL;
const shouldSkip = !TEST_DB_URL || TEST_DB_URL.trim() === '';

if (shouldSkip) {
  console.info(
    '[seller-intent-isolation] TEST_DATABASE_URL is not set — suite SKIPPED. ' +
      'Set TEST_DATABASE_URL to a reachable Postgres instance with migrations applied.'
  );
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

// ── UUID namespace (wave-23 seller-intent) ────────────────────────────────────

const WS_A_ID = '00000023-a100-4000-8000-000000000001';
const WS_B_ID = '00000023-a100-4000-8000-000000000002';

// ── Module-level state ────────────────────────────────────────────────────────

let pool: Pool;
let dbReachable = false;
let adminRoleId: string;

// Seeded entity IDs — tracked for WORM-safe teardown (T-4 rule 1).
const seededUserIds: string[] = [];
const seededMandateIds: string[] = [];
const seededActivityIds: string[] = [];

// WS_A mandate IDs (set in beforeAll — used in assertions).
const wsMandateAIds: string[] = [];
// WS_B mandate IDs (must NOT appear in WS_A results).
const wsMandateBIds: string[] = [];

// ── Workspace helpers ─────────────────────────────────────────────────────────

/**
 * withWorkspace — dedicated PoolClient + SET ROLE dealflow_app + GUC.
 * NOSUPERUSER NOBYPASSRLS → FORCE RLS applies. Mirrors analytics-isolation pattern.
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

/**
 * withSuperuserGuc — superuser PoolClient + GUC (no SET ROLE).
 * Used for seeding only — superuser bypasses FORCE RLS during setup.
 */
async function withSuperuserGuc<T>(
  workspaceId: string,
  fn: (client: PoolClient) => Promise<T>
): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query('SELECT set_config($1, $2, false)', ['app.workspace_id', workspaceId]);
    return await fn(client);
  } finally {
    try {
      await client.query('RESET app.workspace_id');
    } finally {
      client.release();
    }
  }
}

// ── Seed helpers ──────────────────────────────────────────────────────────────

async function seedWorkspace(wsId: string, name: string): Promise<void> {
  await pool.query(
    `INSERT INTO workspaces (id, name) VALUES ($1, $2) ON CONFLICT (id) DO NOTHING`,
    [wsId, name]
  );
}

async function seedUser(
  workspaceId: string,
  supertokensUserId: string,
  email: string
): Promise<string> {
  const userId = crypto.randomUUID();
  await withSuperuserGuc(workspaceId, async (client) => {
    await client.query(
      `INSERT INTO users (id, supertokens_user_id, email, role_id, workspace_id, deactivated_at)
       VALUES ($1, $2, $3, $4, $5, now())
       ON CONFLICT (supertokens_user_id) DO NOTHING`,
      [userId, supertokensUserId, email, adminRoleId, workspaceId]
    );
  });
  // Read back the actual id (idempotent — ON CONFLICT may preserve a prior row).
  const res = await withSuperuserGuc(workspaceId, async (client) =>
    client.query<{ id: string }>(
      'SELECT id FROM users WHERE supertokens_user_id = $1 LIMIT 1',
      [supertokensUserId]
    )
  );
  const id = res.rows[0]?.id;
  if (!id) throw new Error(`seedUser: no row for stUserId=${supertokensUserId}`);
  seededUserIds.push(id);
  return id;
}

async function seedMandate(
  workspaceId: string,
  userId: string,
  status: 'draft' | 'active' = 'draft'
): Promise<string> {
  const id = crypto.randomUUID();
  await withSuperuserGuc(workspaceId, async (client) => {
    await client.query(
      `INSERT INTO mandates (id, seller_name, created_by, workspace_id, status)
       VALUES ($1, $2, $3, $4, $5)`,
      [id, `SI-test mandate ${id.slice(0, 8)}`, userId, workspaceId, status]
    );
  });
  seededMandateIds.push(id);
  return id;
}

/**
 * seedOutreachActivity — seeds a completed outreach_activity row linked to a mandate.
 *
 * Uses withSuperuserGuc for INSERT (bypasses FORCE RLS in setup only).
 * The workspace_id column is included explicitly rather than relying on column DEFAULT
 * (belt+suspenders: the column DEFAULT captures GUC too, but explicit is clearer).
 *
 * outreach_activity required NOT NULL columns:
 *   workspace_id, channel, status, subject, created_by
 *
 * Optional FK set here:
 *   mandate_id → drives outreachEngagement signal in seller-intent scorer.
 */
async function seedOutreachActivity(
  workspaceId: string,
  userId: string,
  mandateId: string,
  channel: 'email' | 'call' | 'linkedin' | 'other' = 'email'
): Promise<string> {
  const id = crypto.randomUUID();
  await withSuperuserGuc(workspaceId, async (client) => {
    await client.query(
      `INSERT INTO outreach_activity
         (id, workspace_id, channel, status, subject, created_by, mandate_id, completed_at)
       VALUES ($1, $2, $3, 'completed', $4, $5, $6, now())`,
      [id, workspaceId, channel, `SI-test activity ${id.slice(0, 8)}`, userId, mandateId]
    );
  });
  seededActivityIds.push(id);
  return id;
}

// ── Suite ─────────────────────────────────────────────────────────────────────

describe.skipIf(shouldSkip)(
  'Seller-intent cross-firm negative read — workspace-A results exclude workspace-B (T-8)',
  () => {
    let wsAUserId: string;
    let mandateA1Id: string; // WS_A mandate with activities seeded

    beforeAll(async () => {
      if (!TEST_DB_URL) return;
      dbReachable = await isDbReachable(TEST_DB_URL);
      if (!dbReachable) {
        console.info('[seller-intent-isolation] Postgres unreachable — tests will be skipped.');
        return;
      }

      process.env.DATABASE_URL = TEST_DB_URL;
      process.env.AUDIT_LOG_HMAC_KEY =
        process.env.AUDIT_LOG_HMAC_KEY ?? 'test-audit-hmac-key-dummy-do-not-use-in-prod';
      process.env.AUDIT_LOG_HMAC_KEY_VERSION = process.env.AUDIT_LOG_HMAC_KEY_VERSION ?? '1';

      pool = new Pool({ connectionString: TEST_DB_URL });

      // Run migrations via the helper.
      const { drizzle } = await import('drizzle-orm/node-postgres');
      const schema = await import('../src/db/schema');
      const db = drizzle(pool, { schema });
      await ensureMigrated(
        db,
        apiMigrationsFolder(path.resolve(import.meta.url.replace('file://', ''), '..'))
      );

      // Resolve admin role id.
      const roleRes = await pool.query<{ id: string }>(
        `SELECT id FROM roles WHERE name = 'admin' LIMIT 1`
      );
      const rId = roleRes.rows[0]?.id;
      if (!rId) throw new Error('seller-intent-isolation beforeAll: admin role not found');
      adminRoleId = rId;

      // Seed workspaces.
      await seedWorkspace(WS_A_ID, 'SI Test Workspace A');
      await seedWorkspace(WS_B_ID, 'SI Test Workspace B');

      // Seed users.
      wsAUserId = await seedUser(
        WS_A_ID,
        '00000023-a100-st-a-000000000001',
        'si-a@seller-intent-isolation.test'
      );
      const wsBUserId = await seedUser(
        WS_B_ID,
        '00000023-a100-st-b-000000000001',
        'si-b@seller-intent-isolation.test'
      );
      void wsBUserId; // used only for seeding WS_B mandates

      // ── Seed WS_A data ────────────────────────────────────────────────────
      // 2 mandates, with 2 completed outreach_activity rows on mandate A1
      // (to drive outreachEngagement > 0 → positive-control assertion in SIT-2).
      mandateA1Id = await seedMandate(WS_A_ID, wsAUserId, 'active');
      const mandateA2Id = await seedMandate(WS_A_ID, wsAUserId, 'draft');
      wsMandateAIds.push(mandateA1Id, mandateA2Id);

      // 2 completed activities on mandate A1 (2 channels → outreachEngagement > 0).
      await seedOutreachActivity(WS_A_ID, wsAUserId, mandateA1Id, 'email');
      await seedOutreachActivity(WS_A_ID, wsAUserId, mandateA1Id, 'call');

      // ── Seed WS_B data (must NOT appear in WS_A results) ─────────────────
      // 2 mandates with NO activities (just mandates — enough to test cross-firm isolation).
      const mandateB1Id = await seedMandate(WS_B_ID, wsBUserId, 'draft');
      const mandateB2Id = await seedMandate(WS_B_ID, wsBUserId, 'draft');
      wsMandateBIds.push(mandateB1Id, mandateB2Id);
    });

    afterAll(async () => {
      if (!dbReachable || !pool) return;

      // WORM-safe teardown: delete seeded rows in FK-safe order.
      // Uses superuser pool (no SET ROLE) + correct GUC for each workspace.
      const deleteScoped = async (wsId: string, table: string, ids: string[]): Promise<void> => {
        if (ids.length === 0) return;
        for (const id of ids) {
          const client = await pool.connect();
          try {
            await client.query('SELECT set_config($1, $2, false)', ['app.workspace_id', wsId]);
            await client.query(`DELETE FROM ${table} WHERE id = $1`, [id]);
          } catch {
            // Non-fatal — row may already be gone via cascade.
          } finally {
            await client.query('RESET app.workspace_id').catch(() => {});
            client.release();
          }
        }
      };

      const tryDeleteBothWs = async (table: string, ids: string[]): Promise<void> => {
        for (const wsId of [WS_A_ID, WS_B_ID]) {
          await deleteScoped(wsId, table, ids);
        }
      };

      // Delete in FK-safe order (children before parents).
      await tryDeleteBothWs('outreach_activity', seededActivityIds);
      await tryDeleteBothWs('mandates', seededMandateIds);
      // Users: already soft-deleted (deactivated_at = now()) — no additional teardown.

      await pool.end().catch(() => {});
    });

    // ── Helper: run the REAL SellerIntentService inside a GUC-bound ALS context ──
    //
    // Same pattern as analytics-isolation.e2e-spec.ts runServiceInAls():
    //   1. Check out PoolClient.
    //   2. SET ROLE dealflow_app (NOSUPERUSER NOBYPASSRLS — FORCE RLS applies).
    //   3. set_config('app.workspace_id', workspaceId, false) — GUC live on this client.
    //   4. drizzle(client, { schema }) → gucHandle.
    //   5. new SellerIntentRepository(gucHandle) + new SellerIntentService(repo).
    //   6. workspaceAls.run({ db: gucHandle, workspaceId }, () => service.getList())
    //      → getDb(this.db) returns gucHandle (ALS store set) inside the callback.
    //   7. RESET ROLE + RESET GUC + release in finally.

    async function runServiceInAls(
      workspaceId: string
    ): Promise<import('@dealflow/shared').SellerIntentListResponse> {
      const { drizzle } = await import('drizzle-orm/node-postgres');
      const schema = await import('../src/db/schema');
      const { workspaceAls } = await import('../src/db/workspace-context');
      const { SellerIntentRepository } = await import(
        '../src/modules/seller-intent/seller-intent.repository'
      );
      const { SellerIntentService } = await import(
        '../src/modules/seller-intent/seller-intent.service'
      );

      const client = await pool.connect();
      try {
        // SET ROLE dealflow_app: NOSUPERUSER NOBYPASSRLS → FORCE RLS applies.
        await client.query('SET ROLE dealflow_app');
        await client.query('SELECT set_config($1, $2, false)', ['app.workspace_id', workspaceId]);

        // Wrap GUC-bound client in Drizzle handle — same as WorkspaceInterceptor.
        // biome-ignore lint/suspicious/noExplicitAny: drizzle handle cast — mirrors workspace.interceptor.ts
        const gucHandle = drizzle(client, { schema }) as any;

        // Instantiate the REAL repository + service (no mocks).
        const repo = new SellerIntentRepository(gucHandle);
        const service = new SellerIntentService(repo);

        // Run getList() inside workspaceAls.run so getDb(this.db) resolves
        // to gucHandle (ALS store's db), not this.db (the fallback).
        return await new Promise((resolve, reject) => {
          workspaceAls.run({ db: gucHandle, workspaceId }, () => {
            service.getList().then(resolve, reject);
          });
        });
      } finally {
        try {
          await client.query('RESET ROLE');
          await client.query('RESET app.workspace_id');
        } finally {
          client.release();
        }
      }
    }

    // ── SIT-1: Cross-firm negative read via REAL SellerIntentService ──────────

    it('SIT-1 (real service): WS_A mandateIds appear in results; WS_B mandateIds are fully absent', async () => {
      if (!dbReachable) return;

      // Run REAL SellerIntentService through workspaceAls.run(WS_A GUC).
      // getDb(this.db) resolves to gucHandle (dealflow_app, FORCE RLS, GUC=WS_A_ID).
      const results = await runServiceInAls(WS_A_ID);
      const resultMandateIds = new Set(results.map((r) => r.mandateId));

      // WS_A mandates MUST appear (we seeded them into WS_A).
      for (const id of wsMandateAIds) {
        expect(resultMandateIds.has(id)).toBe(true);
      }

      // WS_B mandates MUST NOT appear (cross-firm isolation).
      for (const id of wsMandateBIds) {
        expect(resultMandateIds.has(id)).toBe(false);
      }

      // SECONDARY: raw-SQL confirmation WS_B mandates are zero under WS_A's GUC.
      const wsBCountViaSql = await withWorkspace(WS_A_ID, async (client) => {
        const res = await client.query<{ cnt: string }>(
          `SELECT COUNT(*)::int AS cnt FROM mandates WHERE workspace_id = $1`,
          [WS_B_ID]
        );
        return Number(res.rows[0]?.cnt ?? 0);
      });
      expect(wsBCountViaSql).toBe(0);
    });

    // ── SIT-2: Positive control ───────────────────────────────────────────────

    it('SIT-2: positive control — WS_A results non-empty; mandate A1 has outreachEngagement > 0', async () => {
      if (!dbReachable) return;

      const results = await runServiceInAls(WS_A_ID);

      // Non-empty (WS_A has 2 seeded mandates).
      expect(results.length).toBeGreaterThan(0);

      // Mandate A1 (2 completed activities, 2 channels) must have outreachEngagement > 0.
      const a1 = results.find((r) => r.mandateId === mandateA1Id);
      expect(a1).toBeDefined();
      expect(a1?.breakdown.outreachEngagement).toBeGreaterThan(0);
      expect(a1?.score).toBeGreaterThan(0);

      // direction is a valid enum value.
      expect(['heating', 'cooling', 'flat']).toContain(a1?.direction);
    });

    // ── SIT-3: FAULT-KILLING — no-ALS call THROWS ────────────────────────────
    //
    // SellerIntentService.getList() calls getWorkspaceId() at the START and throws
    // when it returns null (no ALS request context). This test proves:
    //   (a) The fail-closed null-check is active and enforced.
    //   (b) Any future removal of the null-check would cause a cross-firm leak that
    //       SIT-1 would catch (WS_B mandates would appear in results).
    //
    // The fault-killing here differs from analytics (which checks a count inequality):
    // the sell-intent service's explicit throw is the primary guard. SIT-1 is the
    // secondary regression catch for the getDb bypass path.

    it('SIT-3 (fault-killing): SellerIntentService.getList() without workspaceAls.run THROWS (fail-closed)', async () => {
      if (!dbReachable) return;

      const { drizzle } = await import('drizzle-orm/node-postgres');
      const schema = await import('../src/db/schema');
      const { SellerIntentRepository } = await import(
        '../src/modules/seller-intent/seller-intent.repository'
      );
      const { SellerIntentService } = await import(
        '../src/modules/seller-intent/seller-intent.service'
      );

      // Instantiate service with the module-level singleton handle (backed by test pool).
      // NO workspaceAls.run → getWorkspaceId() returns null → service MUST throw.
      // biome-ignore lint/suspicious/noExplicitAny: drizzle handle cast — mirrors analytics-isolation.e2e
      const singletonHandle = drizzle(pool, { schema }) as any;
      const repoNoAls = new SellerIntentRepository(singletonHandle);
      const serviceNoAls = new SellerIntentService(repoNoAls);

      // getList() called OUTSIDE workspaceAls.run → getWorkspaceId() === null → THROWS.
      // The thrown message contains 'fail-closed' as specified in seller-intent.service.ts.
      await expect(serviceNoAls.getList()).rejects.toThrow('fail-closed');
    });
  }
);

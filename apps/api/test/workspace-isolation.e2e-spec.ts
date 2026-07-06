/**
 * Workspace isolation e2e tests (wave-17, M8 pilot-partner data-isolation).
 *
 * GUARD: suite is skipped when TEST_DATABASE_URL is unset or DB unreachable.
 *
 * ── LOAD-BEARING INVARIANTS ──────────────────────────────────────────────────
 *
 * ISO-1: Cross-tenant negative read = 0.
 *   Seed mandates in WS_A. Open a connection with app.workspace_id = WS_B_ID.
 *   Query mandates → 0 rows. RLS deny-by-default confirmed.
 *
 * ISO-2: Positive control — workspace owner sees own rows.
 *   Open a connection with app.workspace_id = WS_A_ID.
 *   Query mandates → seeded WS_A rows visible.
 *
 * ISO-3: Bidirectional isolation.
 *   Seed mandate in WS_B. WS_A connection still returns only WS_A rows.
 *
 * ISO-4: GUC-leak guard (P-4 F1).
 *   After RESET app.workspace_id, queries return 0 rows (fail-closed,
 *   no COALESCE-to-default). Confirms the fail-closed predicate:
 *   workspace_id = current_setting('app.workspace_id', true)::uuid
 *   evaluates to workspace_id = NULL → no rows match.
 *
 * ISO-5: WORM trigger rejects UPDATE on audit_log_entries.
 *   Seed an audit entry. Attempt UPDATE → expect SQLSTATE P0001 (raise_exception).
 *   Confirms the BEFORE-UPDATE trigger unconditionally rejects mutations.
 *
 * ── UUID NAMESPACE ───────────────────────────────────────────────────────────
 * Wave-17 prefix '00000017-wspc-*'. Disjoint from prior suites:
 *   admin-activity:    00000016-acti-*
 *   admin-concurrency: 00000015-*
 *   recordkeeping:     00000014-*
 *
 * ── TEARDOWN POLICY (WORM-SAFE, T-4 rule 1) ─────────────────────────────────
 * audit_log_entries is append-only. The WORM trigger blocks DELETE and UPDATE.
 * Any seeded users row referenced by audit_log_entries cannot be hard-deleted
 * (FK CASCADE would trigger an UPDATE/SET NULL on audit rows, also blocked).
 * Strategy: seed users with deactivated_at already set; reset via UPDATE
 * in finally blocks. The ISO-5 user is seeded with deactivated_at = now()
 * so the actor row stays alive (WORM-safe) across runs. audit_log_entries
 * rows from ISO-5 accumulate (intentional — WORM invariant).
 */

import path from 'node:path';
import { Pool, type PoolClient } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { apiMigrationsFolder, ensureMigrated } from './_helpers/ensure-migrated';

// ── Guard ────────────────────────────────────────────────────────────────────
const TEST_DB_URL = process.env.TEST_DATABASE_URL;
const shouldSkip = !TEST_DB_URL || TEST_DB_URL.trim() === '';

if (shouldSkip) {
  console.info(
    '[workspace-isolation] TEST_DATABASE_URL is not set — suite SKIPPED. ' +
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

// ── UUID namespace (wave-17 workspace-isolation) ─────────────────────────────
const WS_A_ID = '00000017-wspc-4000-8000-000000000001';
const WS_B_ID = '00000017-wspc-4000-8000-000000000002';

// Admin role for seeded users — resolved in beforeAll.
let adminRoleId: string;

// biome-ignore lint/suspicious/noExplicitAny: drizzle handle is typed as any in e2e context
let db: any;
let pool: Pool;
let dbReachable = false;

// Mandate UUIDs seeded during the test run — tracked for teardown.
const seededMandateIds: string[] = [];

// ── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Open a fresh dedicated PoolClient, SET app.workspace_id, run a callback,
 * then RESET app.workspace_id and release.
 * Mirrors the interceptor's F1 pattern: checkout → SET GUC → work → RESET GUC → release.
 */
async function withWorkspace<T>(
  workspaceId: string,
  fn: (client: PoolClient) => Promise<T>
): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query(`SET app.workspace_id = '${workspaceId}'`);
    return await fn(client);
  } finally {
    // Surgical RESET — not DISCARD ALL (P-4 F1 CARRY [c]).
    await client.query('RESET app.workspace_id');
    client.release();
  }
}

/**
 * Seed a mandate row with explicit workspaceId via direct SQL.
 * Returns the seeded mandate id.
 */
async function seedMandate(workspaceId: string, adminUserId: string): Promise<string> {
  const mandateId = crypto.randomUUID();
  await withWorkspace(workspaceId, async (client) => {
    await client.query(
      `INSERT INTO mandates (id, name, deal_type, stage, created_by, workspace_id)
       VALUES ($1, $2, 'pe_buyout', 'sourcing', $3, $4)`,
      [mandateId, `ISO-test mandate ${mandateId.slice(0, 8)}`, adminUserId, workspaceId]
    );
  });
  seededMandateIds.push(mandateId);
  return mandateId;
}

/**
 * Seed a user row for the given workspace. Returns the user id.
 * User is seeded as already-deactivated (deactivated_at = now()) so it is
 * safe if audit rows reference it — deactivated state is reset via UPDATE
 * in teardown, not DELETE (T-4 rule 1).
 */
async function seedUser(
  workspaceId: string,
  supertokensUserId: string,
  email: string
): Promise<string> {
  const userId = crypto.randomUUID();
  // roles table is NOT RLS-guarded (global RBAC lookup), so no GUC needed for this read.
  await pool.query(
    `INSERT INTO users (id, supertokens_user_id, email, role_id, workspace_id, deactivated_at)
     VALUES ($1, $2, $3, $4, $5, now())
     ON CONFLICT (supertokens_user_id) DO NOTHING`,
    [userId, supertokensUserId, email, adminRoleId, workspaceId]
  );
  // Return the actual id (may differ if ON CONFLICT fired).
  const res = await pool.query<{ id: string }>(
    'SELECT id FROM users WHERE supertokens_user_id = $1 LIMIT 1',
    [supertokensUserId]
  );
  const id = res.rows[0]?.id;
  if (!id) throw new Error(`seedUser: no row found for supertokensUserId=${supertokensUserId}`);
  return id;
}

// ── Suite ─────────────────────────────────────────────────────────────────────

describe.skipIf(shouldSkip)(
  'Workspace RLS isolation — cross-tenant negative read, GUC-leak guard, WORM trigger',
  () => {
    // User IDs seeded for each workspace — needed for mandate FK.
    let wsAUserId: string;
    let wsBUserId: string;

    beforeAll(async () => {
      if (!TEST_DB_URL) return;
      dbReachable = await isDbReachable(TEST_DB_URL);
      if (!dbReachable) {
        console.info('[workspace-isolation] Postgres unreachable — tests will be skipped.');
        return;
      }

      process.env.DATABASE_URL = TEST_DB_URL;
      process.env.AUDIT_LOG_HMAC_KEY =
        process.env.AUDIT_LOG_HMAC_KEY ?? 'test-audit-hmac-key-dummy-do-not-use-in-prod';
      process.env.AUDIT_LOG_HMAC_KEY_VERSION = process.env.AUDIT_LOG_HMAC_KEY_VERSION ?? '1';

      const { drizzle } = await import('drizzle-orm/node-postgres');
      const { Pool: PgPool } = await import('pg');
      pool = new PgPool({ connectionString: TEST_DB_URL });
      const schema = await import('../src/db/schema');
      db = drizzle(pool, { schema });

      await ensureMigrated(
        db,
        apiMigrationsFolder(path.resolve(import.meta.url.replace('file://', ''), '..'))
      );

      // Resolve admin role id (roles table is global, no RLS guard).
      const roleRes = await pool.query<{ id: string }>(
        `SELECT id FROM roles WHERE name = 'admin' LIMIT 1`
      );
      const rId = roleRes.rows[0]?.id;
      if (!rId) throw new Error('beforeAll: admin role not found');
      adminRoleId = rId;

      // Seed workspace rows (ON CONFLICT DO NOTHING — idempotent across runs).
      await pool.query(
        `INSERT INTO workspaces (id, name)
         VALUES
           ($1, 'ISO Test Workspace A'),
           ($2, 'ISO Test Workspace B')
         ON CONFLICT (id) DO NOTHING`,
        [WS_A_ID, WS_B_ID]
      );

      // Seed one user per workspace.
      wsAUserId = await seedUser(
        WS_A_ID,
        '00000017-wspc-st-a-000000000001',
        'iso-a@workspace-isolation.test'
      );
      wsBUserId = await seedUser(
        WS_B_ID,
        '00000017-wspc-st-b-000000000001',
        'iso-b@workspace-isolation.test'
      );
    });

    afterAll(async () => {
      if (!dbReachable) return;

      // Teardown: soft-clean mandates seeded in this run.
      // mandates is not FK-referenced by audit_log_entries in this test
      // (we never called AuditService here), so DELETE is safe.
      if (seededMandateIds.length > 0) {
        // Use WS_A GUC for WS_A mandates — but since we're cleaning up, use
        // a superuser-level approach: DISCARD ALL is not allowed; use direct pool
        // queries per workspace to stay GUC-correct.
        // Simpler: use pool.query with explicit WHERE workspace_id IN (...) which
        // doesn't need RLS bypass because we hold a PoolClient that can SET GUC.
        // For teardown, use a BYPASSRLS approach via the SECURITY DEFINER / direct
        // pool if pool user has BYPASSRLS, otherwise use GUC per workspace.
        //
        // Since the test DB user is the table owner with FORCE RLS, we need to SET
        // the GUC even in teardown. Use WS_A GUC to delete WS_A mandates, etc.
        // Simpler approach: just clean them all using a single GUC cycle.
        try {
          for (const mid of seededMandateIds) {
            // Read the workspace_id from the mandate to know which GUC to use.
            // This query itself would need a GUC... which creates a chicken-and-egg.
            // Use a dedicated admin function approach: since teardown needs to bypass
            // RLS, use a raw client with BYPASSRLS attribute if available.
            // Fallback: use WS_A and WS_B GUC in sequence and ignore 0-row deletes.
            for (const wsId of [WS_A_ID, WS_B_ID]) {
              await withWorkspace(wsId, async (client) => {
                await client.query('DELETE FROM mandates WHERE id = $1', [mid]);
              });
            }
          }
        } catch {
          // Teardown errors are non-fatal — rows are keyed by stable UUIDs
          // and will be skipped on next run via ON CONFLICT DO NOTHING patterns.
        }
      }

      // Pool cleanup.
      await pool.end().catch(() => {});
    });

    it.skipIf(!dbReachable)(
      'ISO-1: cross-tenant negative read — WS_B GUC cannot see WS_A mandates',
      async () => {
        // Seed a mandate in WS_A.
        const mandateId = await seedMandate(WS_A_ID, wsAUserId);

        // Open a WS_B connection and query mandates.
        const rows = await withWorkspace(WS_B_ID, async (client) => {
          const res = await client.query<{ id: string }>(`SELECT id FROM mandates WHERE id = $1`, [
            mandateId,
          ]);
          return res.rows;
        });

        // WS_B MUST NOT see WS_A's mandate row.
        expect(rows).toHaveLength(0);
      }
    );

    it.skipIf(!dbReachable)(
      'ISO-2: positive control — WS_A GUC can see WS_A mandates',
      async () => {
        // At least one mandate was seeded in WS_A by ISO-1 (above).
        const rows = await withWorkspace(WS_A_ID, async (client) => {
          const res = await client.query<{ id: string }>(
            `SELECT id FROM mandates WHERE workspace_id = $1`,
            [WS_A_ID]
          );
          return res.rows;
        });

        // WS_A MUST see its own rows.
        expect(rows.length).toBeGreaterThan(0);
      }
    );

    it.skipIf(!dbReachable)(
      'ISO-3: bidirectional isolation — WS_A cannot see WS_B mandates',
      async () => {
        // Seed a mandate in WS_B.
        const wsBMandateId = await seedMandate(WS_B_ID, wsBUserId);

        // WS_A GUC should not see it.
        const rows = await withWorkspace(WS_A_ID, async (client) => {
          const res = await client.query<{ id: string }>(`SELECT id FROM mandates WHERE id = $1`, [
            wsBMandateId,
          ]);
          return res.rows;
        });

        expect(rows).toHaveLength(0);
      }
    );

    it.skipIf(!dbReachable)(
      'ISO-4: GUC-leak guard — RESET app.workspace_id → 0 rows (fail-closed)',
      async () => {
        // Open a raw PoolClient without setting the GUC.
        // This simulates a leaked connection where RESET was called.
        const client = await pool.connect();
        try {
          // Explicitly RESET to ensure the GUC is unset (mirrors the interceptor
          // RESET in the finally block — this is the state AFTER a request completes).
          await client.query('RESET app.workspace_id');

          const res = await client.query<{ id: string }>(
            `SELECT id FROM mandates WHERE workspace_id = $1 LIMIT 5`,
            [WS_A_ID]
          );

          // With GUC unset: current_setting('app.workspace_id', true) = NULL
          // NULL = WS_A_ID → false → no rows returned (fail-closed).
          expect(res.rows).toHaveLength(0);
        } finally {
          client.release();
        }
      }
    );

    it.skipIf(!dbReachable)('ISO-5: WORM trigger rejects UPDATE on audit_log_entries', async () => {
      // Seed a minimal audit_log_entries row directly (bypassing the service to
      // avoid dependency on the keyring env var in CI). Use WS_A GUC.
      const entryId = crypto.randomUUID();
      const fakeHash = 'a'.repeat(64);

      await withWorkspace(WS_A_ID, async (client) => {
        await client.query(
          `INSERT INTO audit_log_entries
               (id, actor_user_id, actor_role, action, resource_type, resource_id,
                content_hash, payload_hash, prev_hash, entry_hash, chain_version,
                workspace_id)
             VALUES
               ($1, $2, 'admin', 'workspace-settings-update', 'workspace_settings',
                $3, $4, $4, $4, $4, 1, $5)
             ON CONFLICT (id) DO NOTHING`,
          [entryId, wsAUserId, entryId, fakeHash, WS_A_ID]
        );
      });

      // Attempt UPDATE — must be rejected by the WORM BEFORE-UPDATE trigger.
      let thrownError: Error | null = null;
      try {
        await withWorkspace(WS_A_ID, async (client) => {
          await client.query(`UPDATE audit_log_entries SET actor_role = 'advisor' WHERE id = $1`, [
            entryId,
          ]);
        });
      } catch (err) {
        thrownError = err as Error;
      }

      expect(thrownError).not.toBeNull();
      // WORM trigger raises an exception → SQLSTATE P0001 (raise_exception) or
      // the pg driver surfaces it as an error with code P0001 / 'P0001'.
      const errCode =
        (thrownError as { code?: string })?.code ??
        (thrownError as { cause?: { code?: string } })?.cause?.code;
      expect(errCode).toBe('P0001');
    });
  }
);

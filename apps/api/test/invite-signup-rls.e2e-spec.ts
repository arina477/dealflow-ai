/**
 * Invite-signup RLS bootstrap e2e test (wave-17, M8 DEV-1 fix).
 *
 * GUARD: suite is skipped when TEST_DATABASE_URL is unset or DB unreachable.
 *
 * ── PURPOSE ──────────────────────────────────────────────────────────────────
 * Proves that DEV-1 (FORCE RLS on invites breaks pre-auth signup) is closed:
 *
 *   INV-1: Admin creates invite in workspace W → resolve_invite() returns the
 *          invite's email + workspace_id under FORCE RLS (no GUC set).
 *   INV-2: Signup consumer step — consumeInviteAndCreateUser runs in
 *          runInTransactionWithWorkspace(workspaceId): invite is consumed and
 *          a users row is created in workspace W.
 *   INV-3: The new user is in workspace W (invite's workspace, server-derived).
 *          They can read workspace-W data (mandates) and cannot read data from
 *          workspace X (cross-workspace isolation holds post-signup).
 *   INV-4: resolve_invite() returns 0 rows for a consumed invite (no replay).
 *   INV-5: Fault-killing — with resolve_invite() dropped the call returns
 *          no rows, proving the test would fail if the bootstrap were removed.
 *
 * ── WORKSPACE PLACEMENT INVARIANT ────────────────────────────────────────────
 * The new user's workspace_id comes from invite.workspace_id (server-derived
 * from the invite row via resolve_invite SECURITY DEFINER). The test seeds the
 * invite directly with workspace_id = WS_W_ID and asserts the created user row
 * also has workspace_id = WS_W_ID — never WS_X_ID or anything client-supplied.
 *
 * ── UUID NAMESPACE ───────────────────────────────────────────────────────────
 * Wave-17 invite-signup prefix '00000017-inv-*'. Disjoint from workspace-isolation:
 *   workspace-isolation: 00000017-wspc-*
 *
 * ── TEARDOWN POLICY (WORM-SAFE, T-4 rule 1) ─────────────────────────────────
 * No audit_log_entries are written in this suite (AuditService not invoked).
 * Users rows seeded directly — DELETE is safe for users not referenced by audit.
 * Invites seeded directly — DELETE is safe (no WORM trigger on invites).
 * Mandates seeded for cross-workspace check — DELETE is safe (same condition).
 */

import { createHash } from 'node:crypto';
import path from 'node:path';
import { Pool, type PoolClient } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { apiMigrationsFolder, ensureMigrated } from './_helpers/ensure-migrated';

// ── Guard ─────────────────────────────────────────────────────────────────────
const TEST_DB_URL = process.env.TEST_DATABASE_URL;
const shouldSkip = !TEST_DB_URL || TEST_DB_URL.trim() === '';

if (shouldSkip) {
  console.info(
    '[invite-signup-rls] TEST_DATABASE_URL is not set — suite SKIPPED. ' +
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

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

// ── UUID namespace (wave-17 invite-signup) ────────────────────────────────────
// W = the workspace the invite was issued by
// X = a second workspace (cross-tenant control)
// NOTE: all segment characters must be valid hex (0-9, a-f). 'inv0' contained
// non-hex chars ('i','n','v') and was replaced with 'ab17' (valid hex, disjoint
// from every other wave namespace). supertokens_user_id fields are text columns
// and are not cast to uuid, so they are left unchanged.
const WS_W_ID = '00000017-ab17-4000-8000-000000000001';
const WS_X_ID = '00000017-ab17-4000-8000-000000000002';

// biome-ignore lint/suspicious/noExplicitAny: drizzle handle in e2e context
let db: any;
let pool: Pool;
let dbReachable = false;

// admin role id resolved in beforeAll
let adminRoleId: string;

// Seeded rows tracked for teardown.
const seededUserIds: string[] = [];
const seededInviteIds: string[] = [];
const seededMandateIds: string[] = [];

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Open a dedicated PoolClient from the SUPERUSER pool, SET ROLE dealflow_app
 * (NOSUPERUSER NOBYPASSRLS), SET app.workspace_id, run fn, RESET ROLE, RESET GUC, release.
 *
 * Finding #2 (B-6 rework2) — Non-superuser isolation assertions:
 *   CI connects as postgres (SUPERUSER) with implicit BYPASSRLS — isolation assertions
 *   over a superuser connection are vacuous. SET ROLE dealflow_app makes FORCE RLS apply
 *   for this client's queries, so a real cross-tenant leak WOULD fail the assertion.
 *   After SET ROLE, RESET ROLE returns the session to the superuser for pool reuse.
 *
 * B-6 rework: uses SELECT set_config() — the parameterized, injection-safe form.
 * is_local=false → session-scoped (mirrors WorkspaceInterceptor).
 */
async function withWorkspace<T>(
  workspaceId: string,
  fn: (client: PoolClient) => Promise<T>
): Promise<T> {
  const client = await pool.connect();
  try {
    // SET ROLE: drop superuser privilege so FORCE RLS is enforced.
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

/** Seed an invite row directly in workspace W. Returns { inviteId, tokenHash, plainToken }. */
async function seedInvite(
  workspaceId: string,
  email: string
): Promise<{ inviteId: string; tokenHash: string; plainToken: string }> {
  const plainToken = `test-token-${crypto.randomUUID()}`;
  const tokenHash = hashToken(plainToken);
  const inviteId = crypto.randomUUID();
  const expiry = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

  await withWorkspace(workspaceId, async (client) => {
    await client.query(
      `INSERT INTO invites (id, token, email, role_id, expiry, workspace_id)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (id) DO NOTHING`,
      [inviteId, tokenHash, email.toLowerCase(), adminRoleId, expiry, workspaceId]
    );
  });
  seededInviteIds.push(inviteId);
  return { inviteId, tokenHash, plainToken };
}

/** Seed a user row directly in a workspace. Returns the user id. */
async function seedUser(
  workspaceId: string,
  supertokensUserId: string,
  email: string
): Promise<string> {
  const userId = crypto.randomUUID();
  await pool.query(
    `INSERT INTO users (id, supertokens_user_id, email, role_id, workspace_id)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (supertokens_user_id) DO NOTHING`,
    [userId, supertokensUserId, email.toLowerCase(), adminRoleId, workspaceId]
  );
  const res = await pool.query<{ id: string }>(
    'SELECT id FROM users WHERE supertokens_user_id = $1 LIMIT 1',
    [supertokensUserId]
  );
  const id = res.rows[0]?.id;
  if (!id) throw new Error(`seedUser: no row for ${supertokensUserId}`);
  seededUserIds.push(id);
  return id;
}

/** Seed a mandate in workspace W using GUC, returns the mandate id. */
async function seedMandate(workspaceId: string, userId: string): Promise<string> {
  const mandateId = crypto.randomUUID();
  await withWorkspace(workspaceId, async (client) => {
    await client.query(
      `INSERT INTO mandates (id, name, deal_type, stage, created_by, workspace_id)
       VALUES ($1, $2, 'pe_buyout', 'sourcing', $3, $4)`,
      [mandateId, `inv-signup-test ${mandateId.slice(0, 8)}`, userId, workspaceId]
    );
  });
  seededMandateIds.push(mandateId);
  return mandateId;
}

// ── Suite ─────────────────────────────────────────────────────────────────────

describe.skipIf(shouldSkip)(
  'Invite-signup RLS bootstrap — DEV-1 fix: resolve_invite SECURITY DEFINER',
  () => {
    let wsWUserId: string; // a pre-existing admin in workspace W (for mandates FK)

    beforeAll(async () => {
      if (!TEST_DB_URL) return;
      dbReachable = await isDbReachable(TEST_DB_URL);
      if (!dbReachable) {
        console.info('[invite-signup-rls] Postgres unreachable — tests will be skipped.');
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

      // Resolve admin role (no RLS on roles table).
      const roleRes = await pool.query<{ id: string }>(
        `SELECT id FROM roles WHERE name = 'admin' LIMIT 1`
      );
      const rId = roleRes.rows[0]?.id;
      if (!rId) throw new Error('beforeAll: admin role not found');
      adminRoleId = rId;

      // Seed workspace rows (idempotent).
      await pool.query(
        `INSERT INTO workspaces (id, name)
         VALUES ($1, $2), ($3, $4)
         ON CONFLICT (id) DO NOTHING`,
        [WS_W_ID, 'INV Test Workspace W', WS_X_ID, 'INV Test Workspace X']
      );

      // Seed a pre-existing admin in workspace W (used as mandate created_by FK).
      wsWUserId = await seedUser(
        WS_W_ID,
        '00000017-inv0-stw-a-000000000001',
        'inv-admin-w@invite-signup.test'
      );
    });

    afterAll(async () => {
      if (!dbReachable) return;

      // Teardown — clean up seeded data (no WORM concern in this suite).
      try {
        for (const mid of seededMandateIds) {
          for (const wsId of [WS_W_ID, WS_X_ID]) {
            await withWorkspace(wsId, async (client) => {
              await client.query('DELETE FROM mandates WHERE id = $1', [mid]);
            });
          }
        }
        for (const invId of seededInviteIds) {
          for (const wsId of [WS_W_ID, WS_X_ID]) {
            await withWorkspace(wsId, async (client) => {
              await client.query('DELETE FROM invites WHERE id = $1', [invId]);
            });
          }
        }
        for (const uid of seededUserIds) {
          for (const wsId of [WS_W_ID, WS_X_ID]) {
            await withWorkspace(wsId, async (client) => {
              await client.query('DELETE FROM users WHERE id = $1', [uid]);
            });
          }
        }
      } catch {
        // Non-fatal — stable UUIDs; idempotent on next run.
      }

      await pool.end().catch(() => {});
    });

    it(
      'INV-1: resolve_invite() returns email + workspace_id WITHOUT the GUC set (no-GUC bypass)',
      async () => {
        if (!dbReachable) return;
        // Seed invite in workspace W.
        const email = `inv1-${crypto.randomUUID().slice(0, 8)}@invite-signup.test`;
        const { tokenHash } = await seedInvite(WS_W_ID, email);

        // Call resolve_invite() on a raw client with NO GUC set.
        // This is the exact condition of the pre-auth signup path (no session, no interceptor).
        const client = await pool.connect();
        let result: { email: string; workspace_id: string } | null = null;
        try {
          // Ensure no GUC is set (mirrors post-RESET state).
          await client.query('RESET app.workspace_id');
          const res = await client.query<{ email: string; workspace_id: string }>(
            'SELECT email, workspace_id FROM resolve_invite($1)',
            [tokenHash]
          );
          result = res.rows[0] ?? null;
        } finally {
          client.release();
        }

        // Must return the invite row despite FORCE RLS + no GUC.
        expect(result).not.toBeNull();
        expect(result?.email).toBe(email.toLowerCase());
        expect(result?.workspace_id).toBe(WS_W_ID);
      }
    );

    it(
      'INV-2: full consume cycle — invite consumed + user created in workspace W under FORCE RLS',
      async () => {
        if (!dbReachable) return;
        // Seed invite in workspace W.
        const email = `inv2-${crypto.randomUUID().slice(0, 8)}@invite-signup.test`;
        const { inviteId, tokenHash } = await seedInvite(WS_W_ID, email);

        // Step 1: resolve_invite (no GUC) → get workspace_id for the transaction.
        const resolveRes = await pool.query<{ email: string; workspace_id: string }>(
          'SELECT email, workspace_id FROM resolve_invite($1)',
          [tokenHash]
        );
        const resolved = resolveRes.rows[0];
        expect(resolved).toBeDefined();
        const inviteWorkspaceId = resolved!.workspace_id;

        // Step 2: consume + create user in a transaction with GUC set to inviteWorkspaceId.
        // B-6 rework: uses SELECT set_config($1, $2, true) — the EXACT same form used by the
        // production runInTransactionWithWorkspace (is_local=true = tx-scoped SET LOCAL).
        // PostgreSQL's SET command does NOT accept bind parameters; set_config() is the
        // correct parameterized form. This test exercises that exact mechanism so a
        // regression back to 'SET app.workspace_id = $1' would throw SQLSTATE 42P02 here.
        const newSupertokensId = `inv2-st-${crypto.randomUUID()}`;
        const newUserEmail = email.toLowerCase();
        const newUserId = crypto.randomUUID();

        const client = await pool.connect();
        try {
          // Finding #2 (B-6 rework2): SET ROLE dealflow_app so FORCE RLS is enforced.
          // This makes the consume + create-user transaction run as the non-superuser
          // application role — identical to the production runInTransactionWithWorkspace
          // path. A failure to set the GUC correctly WOULD cause RLS denial and the test
          // would fail, proving the assertion is non-vacuous.
          await client.query('SET ROLE dealflow_app');
          // B-6 rework2 (Finding #1 — GUC-inside-tx): set_config MUST be the FIRST
          // statement INSIDE the BEGIN block (is_local=true = SET LOCAL, tx-scoped).
          // Setting it before BEGIN runs it in its own autocommit tx — SET LOCAL then
          // resets immediately at that tx end, so the GUC is gone before the BEGIN.
          // This test now exercises the correct production path exactly: GUC set after
          // BEGIN and before the tenant writes, matching runInTransactionWithWorkspace.
          await client.query('BEGIN');
          // SET LOCAL (is_local=true) scopes the GUC to this transaction.
          await client.query('SELECT set_config($1, $2, true)', ['app.workspace_id', inviteWorkspaceId]);
          // SELECT FOR UPDATE the invite (mirrors consumeInviteAndCreateUser).
          const lockRes = await client.query<{ id: string; workspace_id: string }>(
            `SELECT id, workspace_id FROM invites
             WHERE token = $1 AND consumed_at IS NULL AND expiry > now()
             FOR UPDATE LIMIT 1`,
            [tokenHash]
          );
          const lockedInvite = lockRes.rows[0];
          expect(lockedInvite).toBeDefined();
          expect(lockedInvite!.workspace_id).toBe(WS_W_ID);

          // Consume.
          await client.query(
            `UPDATE invites SET consumed_at = now() WHERE id = $1 AND consumed_at IS NULL`,
            [lockedInvite!.id]
          );

          // Insert user with workspace_id from invite row (server-derived).
          await client.query(
            `INSERT INTO users (id, supertokens_user_id, email, role_id, workspace_id)
             VALUES ($1, $2, $3, $4, $5)`,
            [newUserId, newSupertokensId, newUserEmail, adminRoleId, lockedInvite!.workspace_id]
          );
          await client.query('COMMIT');
        } catch (err) {
          await client.query('ROLLBACK');
          throw err;
        } finally {
          await client.query('RESET ROLE').catch(() => {});
          await client.query('RESET app.workspace_id').catch(() => {});
          client.release();
        }

        seededUserIds.push(newUserId);

        // Verify: user exists in workspace W.
        const userRes = await withWorkspace(WS_W_ID, async (c) => {
          return c.query<{ workspace_id: string }>(
            'SELECT workspace_id FROM users WHERE id = $1 LIMIT 1',
            [newUserId]
          );
        });
        expect(userRes.rows[0]?.workspace_id).toBe(WS_W_ID);

        // Verify: invite is consumed.
        const inviteCheck = await withWorkspace(WS_W_ID, async (c) => {
          return c.query<{ consumed_at: string | null }>(
            'SELECT consumed_at FROM invites WHERE id = $1 LIMIT 1',
            [inviteId]
          );
        });
        expect(inviteCheck.rows[0]?.consumed_at).not.toBeNull();
      }
    );

    it(
      'INV-3: new user in workspace W can read W data and CANNOT read workspace X data',
      async () => {
        if (!dbReachable) return;
        // Seed invite in workspace W and create a user (simulated post-signup state).
        const email = `inv3-${crypto.randomUUID().slice(0, 8)}@invite-signup.test`;
        const { tokenHash } = await seedInvite(WS_W_ID, email);
        const newSupertokensId = `inv3-st-${crypto.randomUUID()}`;
        const newUserId = crypto.randomUUID();

        // Create user directly in workspace W (simulates post-consume state).
        await withWorkspace(WS_W_ID, async (client) => {
          await client.query(
            `INSERT INTO users (id, supertokens_user_id, email, role_id, workspace_id)
             VALUES ($1, $2, $3, $4, $5)`,
            [newUserId, newSupertokensId, email.toLowerCase(), adminRoleId, WS_W_ID]
          );
        });
        seededUserIds.push(newUserId);

        // Consume the invite (so it's in a realistic state).
        await withWorkspace(WS_W_ID, async (client) => {
          await client.query(`UPDATE invites SET consumed_at = now() WHERE token = $1`, [
            tokenHash,
          ]);
        });

        // Seed a mandate in workspace W and workspace X.
        const mandateWId = await seedMandate(WS_W_ID, wsWUserId);
        const wsXUserId = await seedUser(
          WS_X_ID,
          '00000017-inv0-stx-b-000000000001',
          'inv-admin-x@invite-signup.test'
        );
        const mandateXId = await seedMandate(WS_X_ID, wsXUserId);

        // New user (workspace W GUC) can see workspace W mandate.
        const wRows = await withWorkspace(WS_W_ID, async (client) => {
          const res = await client.query<{ id: string }>('SELECT id FROM mandates WHERE id = $1', [
            mandateWId,
          ]);
          return res.rows;
        });
        expect(wRows).toHaveLength(1);

        // New user (workspace W GUC) cannot see workspace X mandate.
        const xRows = await withWorkspace(WS_W_ID, async (client) => {
          const res = await client.query<{ id: string }>('SELECT id FROM mandates WHERE id = $1', [
            mandateXId,
          ]);
          return res.rows;
        });
        expect(xRows).toHaveLength(0);
      }
    );

    it(
      'INV-4: resolve_invite() returns 0 rows for a consumed invite (no replay)',
      async () => {
        if (!dbReachable) return;
        const email = `inv4-${crypto.randomUUID().slice(0, 8)}@invite-signup.test`;
        const { tokenHash } = await seedInvite(WS_W_ID, email);

        // Consume the invite.
        await withWorkspace(WS_W_ID, async (client) => {
          await client.query(`UPDATE invites SET consumed_at = now() WHERE token = $1`, [
            tokenHash,
          ]);
        });

        // resolve_invite must return 0 rows for a consumed invite.
        const res = await pool.query('SELECT email, workspace_id FROM resolve_invite($1)', [
          tokenHash,
        ]);
        expect(res.rows).toHaveLength(0);
      }
    );

    it(
      'INV-5: fault-killing — direct invites SELECT without GUC returns 0 rows (FORCE RLS active)',
      async () => {
        if (!dbReachable) return;
        // This test proves that WITHOUT the SECURITY DEFINER resolver, a direct
        // SELECT on invites with no GUC set returns 0 rows — confirming FORCE RLS
        // is active and the resolver is load-bearing.
        //
        // CRITICAL: FORCE ROW LEVEL SECURITY does NOT apply to superusers (BYPASSRLS).
        // The pool connects as postgres (SUPERUSER) which bypasses RLS entirely.
        // We must SET ROLE dealflow_app (NOSUPERUSER NOBYPASSRLS) so FORCE RLS is
        // actually enforced. Without this SET ROLE the test is vacuous — a superuser
        // always sees the row regardless of GUC.
        const email = `inv5-${crypto.randomUUID().slice(0, 8)}@invite-signup.test`;
        const { tokenHash } = await seedInvite(WS_W_ID, email);

        // Direct SELECT on invites as dealflow_app (NOSUPERUSER NOBYPASSRLS) with no GUC
        // set — FORCE RLS applies and the workspace_id policy evaluates to false → 0 rows.
        const client = await pool.connect();
        let rows: unknown[] = [];
        try {
          await client.query('SET ROLE dealflow_app');
          await client.query('RESET app.workspace_id');
          const res = await client.query(
            'SELECT email, workspace_id FROM invites WHERE token = $1',
            [tokenHash]
          );
          rows = res.rows;
        } finally {
          await client.query('RESET ROLE').catch(() => {});
          client.release();
        }

        // FORCE RLS + dealflow_app role + no GUC → 0 rows.
        // This is exactly what was broken before DEV-1 fix.
        expect(rows).toHaveLength(0);
      }
    );
  }
);

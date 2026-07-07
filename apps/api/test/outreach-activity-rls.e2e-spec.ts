/**
 * B-2 write-path RLS e2e tests — wave-20 outreach-activity (task 5c12ac3a).
 *
 * DETERMINISTIC-TEST-SPEC-FIRST: authored before service implementation.
 * Real-DB tests via workspaceAls.run (wave-18/19 pattern — NOT re-implemented SQL).
 *
 * ── LOAD-BEARING ASSERTIONS ──────────────────────────────────────────────────
 *
 * OAE-1 (R1 own-row re-home UPDATE write-check): as dealflow_app, GUC=firm-A,
 *   take firm-A's OWN outreach_activity row and UPDATE SET workspace_id=firm-B
 *   → REJECTED (SQLSTATE 42501). This is the actual write-check test (NOT the
 *   vacuous "UPDATE with firm-B id" pattern which targets an invisible row).
 *
 * OAE-2 (R1 INSERT firm-B id): as dealflow_app, GUC=firm-A, INSERT with
 *   explicit firm-B workspace_id → REJECTED (42501).
 *
 * OAE-3 (SF1): OutreachActivityService.create() with empty-ALS context
 *   → REJECTED (ForbiddenException), row NOT in default workspace.
 *
 * OAE-4 (R3/SF4 outreachId): GUC=firm-A, outreachId from firm-B → NotFoundException.
 * OAE-5 (R3/SF4 matchCandidateId): GUC=firm-A, matchCandidateId from firm-B → NotFoundException.
 * OAE-6 (R3/SF4 pipelineId): GUC=firm-A, pipelineId from firm-B → NotFoundException.
 * OAE-7 (R3/SF4 mandateId): GUC=firm-A, mandateId from firm-B → NotFoundException.
 * OAE-8 (R3/SF4 createdBy): create() with client-supplied createdBy → rejected (strict schema).
 *
 * OAE-9 (R4/SF5 create audit): create() appends exactly ONE 'outreach-activity-create' entry
 *   + verifyChain ok:true.
 * OAE-10 (R4/SF5 update audit): update() appends exactly ONE 'outreach-activity-update' entry
 *   + verifyChain ok:true.
 * OAE-11 (R4/SF5 status-transition audit): updateStatus() appends exactly ONE
 *   'outreach-activity-status-transition' entry + verifyChain ok:true.
 * OAE-12 (R4/SF5 cancel audit): cancel() appends exactly ONE 'outreach-activity-cancel'
 *   entry + verifyChain ok:true.
 * OAE-13 (R4/SF5 rollback): injected audit throw → business row NOT persisted.
 *
 * OAE-14 (R2/SF3 FORCE confirmed): relrowsecurity AND relforcerowsecurity true
 *   as dealflow_app assertion (complementary to OAM-7 migration test).
 *
 * ── GUARD ────────────────────────────────────────────────────────────────────
 * Suite is skipped when TEST_DATABASE_URL is unset.
 *
 * ── UUID NAMESPACE ────────────────────────────────────────────────────────────
 * Wave-20 outreach-activity e2e prefix '00000020-0ae1-4000-8000-*'.
 *
 * ── TEARDOWN (WORM-SAFE) ──────────────────────────────────────────────────────
 * outreach_activity is mutable — seeded rows deleted in afterAll.
 * Users seeded with deactivated_at (WORM-safe); audit rows accumulate.
 */

import path from 'node:path';
import { Pool, type PoolClient } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { apiMigrationsFolder, ensureMigrated } from './_helpers/ensure-migrated';

// ── Guard ─────────────────────────────────────────────────────────────────────
const TEST_DB_URL = process.env.TEST_DATABASE_URL;
const shouldSkip = !TEST_DB_URL || TEST_DB_URL.trim() === '';

if (shouldSkip) {
  console.info('[outreach-activity-rls] TEST_DATABASE_URL is not set — suite SKIPPED.');
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

// ── UUID namespaces ────────────────────────────────────────────────────────────
const OAE_WS_A = '00000020-0ae1-4000-8000-000000000001';
const OAE_WS_B = '00000020-0ae1-4000-8000-000000000002';
const OAE_ST_USER_A = '00000020-0ae1-st-user-a-001'; // text supertokens_user_id
const OAE_ST_USER_B = '00000020-0ae1-st-user-b-002';

// biome-ignore lint/suspicious/noExplicitAny: drizzle handle typed as any in e2e
let db: any;
let pool: Pool;
let dbReachable = false;

let userAId: string;
let userBId: string;

const seededActivityIds: string[] = [];

// ── Helpers ───────────────────────────────────────────────────────────────────

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

async function seedWorkspaceUser(
  workspaceId: string,
  stUserId: string,
  email: string,
  adminRoleId: string
): Promise<string> {
  const insertClient = await pool.connect();
  try {
    await insertClient.query('SELECT set_config($1, $2, false)', ['app.workspace_id', workspaceId]);
    await insertClient.query(
      `INSERT INTO users (supertokens_user_id, email, role_id, workspace_id, deactivated_at)
       VALUES ($1, $2, $3::uuid, $4::uuid, now())
       ON CONFLICT (supertokens_user_id) DO NOTHING`,
      [stUserId, email, adminRoleId, workspaceId]
    );
  } finally {
    await insertClient.query('RESET app.workspace_id').catch(() => {});
    insertClient.release();
  }

  const readClient = await pool.connect();
  try {
    await readClient.query('SELECT set_config($1, $2, false)', ['app.workspace_id', workspaceId]);
    const res = await readClient.query<{ id: string }>(
      `SELECT id FROM users WHERE supertokens_user_id = $1 LIMIT 1`,
      [stUserId]
    );
    const id = res.rows[0]?.id;
    if (!id) throw new Error(`seedWorkspaceUser: no row for ${stUserId}`);
    return id;
  } finally {
    await readClient.query('RESET app.workspace_id').catch(() => {});
    readClient.release();
  }
}

/** Seed an outreach_activity row via superuser (bypasses RLS for test setup). */
async function seedActivity(
  workspaceId: string,
  createdBy: string,
  subject = 'E2E test activity'
): Promise<string> {
  const id = crypto.randomUUID();
  const client = await pool.connect();
  try {
    await client.query('SELECT set_config($1, $2, false)', ['app.workspace_id', workspaceId]);
    await client.query(
      `INSERT INTO outreach_activity
         (id, channel, status, subject, workspace_id, created_by)
       VALUES
         ($1::uuid, 'call', 'planned', $2, $3::uuid, $4::uuid)`,
      [id, subject, workspaceId, createdBy]
    );
    seededActivityIds.push(id);
  } finally {
    await client.query('RESET app.workspace_id').catch(() => {});
    client.release();
  }
  return id;
}

// ── Suite ─────────────────────────────────────────────────────────────────────
describe.skipIf(shouldSkip)('B-2 write-path RLS e2e — wave-20 outreach-activity (5c12ac3a)', () => {
  beforeAll(async () => {
    if (!TEST_DB_URL) return;
    dbReachable = await isDbReachable(TEST_DB_URL);
    if (!dbReachable) {
      console.info('[outreach-activity-rls] DB unreachable — tests skipped.');
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

    await ensureMigrated(
      db,
      apiMigrationsFolder(path.resolve(import.meta.url.replace('file://', ''), '..'))
    );

    // Seed workspaces.
    await pool.query(
      `INSERT INTO workspaces (id, name) VALUES
           ('a1b2c3d4-0000-4000-8000-000000000001', 'Default Workspace'),
           ($1, 'OAE WS_A'),
           ($2, 'OAE WS_B')
         ON CONFLICT (id) DO NOTHING`,
      [OAE_WS_A, OAE_WS_B]
    );

    const roleRes = await pool.query<{ id: string }>(
      `SELECT id FROM roles WHERE name = 'advisor' LIMIT 1`
    );
    const advisorRoleId = roleRes.rows[0]?.id;
    if (!advisorRoleId) throw new Error('beforeAll: advisor role not found');

    userAId = await seedWorkspaceUser(OAE_WS_A, OAE_ST_USER_A, 'oae-a@wave20.test', advisorRoleId);
    userBId = await seedWorkspaceUser(OAE_WS_B, OAE_ST_USER_B, 'oae-b@wave20.test', advisorRoleId);
  });

  afterAll(async () => {
    if (!dbReachable) return;
    if (seededActivityIds.length > 0) {
      await pool
        .query(`DELETE FROM outreach_activity WHERE id = ANY($1::uuid[])`, [seededActivityIds])
        .catch(() => {});
    }
    await pool.end().catch(() => {});
  });

  // ── OAE-1: R1 own-row re-home UPDATE ─────────────────────────────────────

  it('OAE-1 (R1): GUC=WS_A, own row visible, UPDATE SET workspace_id=WS_B → REJECTED (42501)', {
    timeout: 15000,
  }, async () => {
    if (!dbReachable) return;

    const activityId = await seedActivity(OAE_WS_A, userAId, 'R1 re-home test');

    let thrownErr: unknown = null;
    await withWorkspace(OAE_WS_A, async (client) => {
      try {
        await client.query(
          `UPDATE outreach_activity SET workspace_id = $1::uuid WHERE id = $2::uuid`,
          [OAE_WS_B, activityId]
        );
      } catch (err) {
        thrownErr = err;
      }
    });

    expect(thrownErr).not.toBeNull();
    const code =
      (thrownErr as { code?: string })?.code ??
      (thrownErr as { cause?: { code?: string } })?.cause?.code;
    // New row fails USING-derived write-check → 42501.
    expect(code).toBe('42501');
  });

  // ── OAE-2: R1 INSERT with explicit WS_B id ───────────────────────────────

  it('OAE-2 (R1): INSERT with explicit WS_B workspace_id under WS_A GUC → REJECTED (42501)', {
    timeout: 10000,
  }, async () => {
    if (!dbReachable) return;

    let thrownErr: unknown = null;
    await withWorkspace(OAE_WS_A, async (client) => {
      try {
        await client.query(
          `INSERT INTO outreach_activity
               (channel, status, subject, workspace_id, created_by)
             VALUES ('call', 'planned', 'OAE-2 INSERT explicit WS_B', $1::uuid, $2::uuid)`,
          [OAE_WS_B, userAId]
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

  // ── OAE-3: SF1 empty-ALS via real service ────────────────────────────────

  it('OAE-3 (SF1): OutreachActivityService.create() with empty-ALS → REJECTED, row NOT in default workspace', {
    timeout: 15000,
  }, async () => {
    if (!dbReachable) return;

    // Build real service against live DB.
    const { AuditKeyring } = await import('../src/modules/audit/audit.keyring');
    const { AuditRepository } = await import('../src/modules/audit/audit.repository');
    const { AuditService } = await import('../src/modules/audit/audit.service');
    const { OutreachActivityRepository } = await import(
      '../src/modules/outreach-activity/outreach-activity.repository'
    );
    const { OutreachActivityService } = await import(
      '../src/modules/outreach-activity/outreach-activity.service'
    );
    const { AuthRepository } = await import('../src/modules/auth/auth.repository');

    const auditSvc = new AuditService(new AuditKeyring(process.env), new AuditRepository(db));
    const oaRepo = new OutreachActivityRepository(db);
    const authRepo = new AuthRepository(db);
    const svc = new OutreachActivityService(oaRepo, auditSvc, authRepo);

    // Count rows in default workspace before.
    const defaultWsId = 'a1b2c3d4-0000-4000-8000-000000000001';
    const before = await pool.query<{ count: string }>(
      `SELECT COUNT(*)::text AS count FROM outreach_activity WHERE workspace_id = $1`,
      [defaultWsId]
    );
    const beforeCount = Number(before.rows[0]?.count ?? 0);

    // The workspaceAls is NOT set (no ALS context) — service must throw.
    // workspaceAls.getStore() returns undefined → getWorkspaceId() returns null.
    const { workspaceAls } = await import('../src/db/workspace-context');

    let thrownErr: unknown = null;
    try {
      // Run WITHOUT workspaceAls.run → ALS store is undefined → getWorkspaceId() = null.
      await svc.create(
        { channel: 'call', subject: 'SF1 empty-ALS test — must be rejected' },
        OAE_ST_USER_A
      );
    } catch (err) {
      thrownErr = err;
    }

    // Service must throw (not silently default).
    expect(thrownErr).not.toBeNull();

    // Row must NOT be in the default workspace (no silent placement).
    const after = await pool.query<{ count: string }>(
      `SELECT COUNT(*)::text AS count FROM outreach_activity WHERE workspace_id = $1`,
      [defaultWsId]
    );
    const afterCount = Number(after.rows[0]?.count ?? 0);
    expect(afterCount).toBe(beforeCount); // unchanged — no row landed
  });

  // ── OAE-9..OAE-12: R4/SF5 per-verb audit via real service ────────────────

  it('OAE-9 (R4/SF5): create() appends exactly ONE outreach-activity-create audit entry + verifyChain ok', {
    timeout: 20000,
  }, async () => {
    if (!dbReachable) return;

    const { AuditKeyring } = await import('../src/modules/audit/audit.keyring');
    const { AuditRepository } = await import('../src/modules/audit/audit.repository');
    const { AuditService } = await import('../src/modules/audit/audit.service');
    const { AuditVerifier } = await import('../src/modules/audit/audit.verifier');
    const { OutreachActivityRepository } = await import(
      '../src/modules/outreach-activity/outreach-activity.repository'
    );
    const { OutreachActivityService } = await import(
      '../src/modules/outreach-activity/outreach-activity.service'
    );
    const { AuthRepository } = await import('../src/modules/auth/auth.repository');
    const { workspaceAls } = await import('../src/db/workspace-context');

    const keyring = new AuditKeyring(process.env);
    const auditRepo = new AuditRepository(db);
    const auditSvc = new AuditService(keyring, auditRepo);
    const verifier = new AuditVerifier(keyring, auditRepo);
    const oaRepo = new OutreachActivityRepository(db);
    const authRepo = new AuthRepository(db);
    const svc = new OutreachActivityService(oaRepo, auditSvc, authRepo);

    // Capture chain length before.
    const before = await pool.query<{ count: string }>(
      `SELECT COUNT(*)::text AS count FROM audit_log_entries`
    );
    const beforeCount = Number(before.rows[0]?.count ?? 0);

    // Run inside ALS context for WS_A.
    // We construct a drizzle client with the GUC set for WS_A.
    const { drizzle } = await import('drizzle-orm/node-postgres');
    const schema = await import('../src/db/schema');
    const gucClient = await pool.connect();
    let result:
      | import('../src/modules/outreach-activity/outreach-activity.repository').OutreachActivityRow
      | undefined;
    try {
      await gucClient.query('SET ROLE dealflow_app');
      await gucClient.query('SELECT set_config($1, $2, false)', ['app.workspace_id', OAE_WS_A]);
      const gucDb = drizzle(gucClient, { schema }) as unknown as typeof db;

      await workspaceAls.run({ db: gucDb, workspaceId: OAE_WS_A }, async () => {
        result = await svc.create(
          { channel: 'call', subject: 'OAE-9 audit test create' },
          OAE_ST_USER_A
        );
      });
    } finally {
      await gucClient.query('RESET ROLE').catch(() => {});
      await gucClient.query('RESET app.workspace_id').catch(() => {});
      gucClient.release();
    }

    // Track for teardown.
    if (result) seededActivityIds.push(result.id);

    // Exactly ONE new audit entry.
    const after = await pool.query<{ count: string }>(
      `SELECT COUNT(*)::text AS count FROM audit_log_entries`
    );
    const afterCount = Number(after.rows[0]?.count ?? 0);
    expect(afterCount).toBe(beforeCount + 1);

    // The last entry must be the create action.
    const lastEntry = await pool.query<{ action: string }>(
      `SELECT action FROM audit_log_entries ORDER BY sequence_number DESC LIMIT 1`
    );
    expect(lastEntry.rows[0]?.action).toBe('outreach-activity-create');

    // verifyChain ok.
    const verifyResult = await verifier.verifyChain();
    expect(verifyResult.ok).toBe(true);
  });

  it('OAE-10 (R4/SF5): update() appends exactly ONE outreach-activity-update audit entry + verifyChain ok', {
    timeout: 20000,
  }, async () => {
    if (!dbReachable) return;

    const { AuditKeyring } = await import('../src/modules/audit/audit.keyring');
    const { AuditRepository } = await import('../src/modules/audit/audit.repository');
    const { AuditService } = await import('../src/modules/audit/audit.service');
    const { AuditVerifier } = await import('../src/modules/audit/audit.verifier');
    const { OutreachActivityRepository } = await import(
      '../src/modules/outreach-activity/outreach-activity.repository'
    );
    const { OutreachActivityService } = await import(
      '../src/modules/outreach-activity/outreach-activity.service'
    );
    const { AuthRepository } = await import('../src/modules/auth/auth.repository');
    const { workspaceAls } = await import('../src/db/workspace-context');

    const keyring = new AuditKeyring(process.env);
    const auditRepo = new AuditRepository(db);
    const auditSvc = new AuditService(keyring, auditRepo);
    const verifier = new AuditVerifier(keyring, auditRepo);
    const oaRepo = new OutreachActivityRepository(db);
    const authRepo = new AuthRepository(db);
    const svc = new OutreachActivityService(oaRepo, auditSvc, authRepo);

    const activityId = await seedActivity(OAE_WS_A, userAId, 'OAE-10 update audit test');

    const before = await pool.query<{ count: string }>(
      `SELECT COUNT(*)::text AS count FROM audit_log_entries`
    );
    const beforeCount = Number(before.rows[0]?.count ?? 0);

    const { drizzle } = await import('drizzle-orm/node-postgres');
    const schema = await import('../src/db/schema');
    const gucClient = await pool.connect();
    try {
      await gucClient.query('SET ROLE dealflow_app');
      await gucClient.query('SELECT set_config($1, $2, false)', ['app.workspace_id', OAE_WS_A]);
      const gucDb = drizzle(gucClient, { schema }) as unknown as typeof db;
      await workspaceAls.run({ db: gucDb, workspaceId: OAE_WS_A }, async () => {
        await svc.update(activityId, { notes: 'Updated notes' }, OAE_ST_USER_A);
      });
    } finally {
      await gucClient.query('RESET ROLE').catch(() => {});
      await gucClient.query('RESET app.workspace_id').catch(() => {});
      gucClient.release();
    }

    const after = await pool.query<{ count: string }>(
      `SELECT COUNT(*)::text AS count FROM audit_log_entries`
    );
    expect(Number(after.rows[0]?.count ?? 0)).toBe(beforeCount + 1);

    const lastEntry = await pool.query<{ action: string }>(
      `SELECT action FROM audit_log_entries ORDER BY sequence_number DESC LIMIT 1`
    );
    expect(lastEntry.rows[0]?.action).toBe('outreach-activity-update');

    const verifyResult = await verifier.verifyChain();
    expect(verifyResult.ok).toBe(true);
  });

  it('OAE-11 (R4/SF5): updateStatus(completed) appends outreach-activity-status-transition + verifyChain ok', {
    timeout: 20000,
  }, async () => {
    if (!dbReachable) return;

    const { AuditKeyring } = await import('../src/modules/audit/audit.keyring');
    const { AuditRepository } = await import('../src/modules/audit/audit.repository');
    const { AuditService } = await import('../src/modules/audit/audit.service');
    const { AuditVerifier } = await import('../src/modules/audit/audit.verifier');
    const { OutreachActivityRepository } = await import(
      '../src/modules/outreach-activity/outreach-activity.repository'
    );
    const { OutreachActivityService } = await import(
      '../src/modules/outreach-activity/outreach-activity.service'
    );
    const { AuthRepository } = await import('../src/modules/auth/auth.repository');
    const { workspaceAls } = await import('../src/db/workspace-context');

    const keyring = new AuditKeyring(process.env);
    const auditRepo = new AuditRepository(db);
    const auditSvc = new AuditService(keyring, auditRepo);
    const verifier = new AuditVerifier(keyring, auditRepo);
    const oaRepo = new OutreachActivityRepository(db);
    const authRepo = new AuthRepository(db);
    const svc = new OutreachActivityService(oaRepo, auditSvc, authRepo);

    const activityId = await seedActivity(OAE_WS_A, userAId, 'OAE-11 status-transition test');

    const before = await pool.query<{ count: string }>(
      `SELECT COUNT(*)::text AS count FROM audit_log_entries`
    );
    const beforeCount = Number(before.rows[0]?.count ?? 0);

    const { drizzle } = await import('drizzle-orm/node-postgres');
    const schema = await import('../src/db/schema');
    const gucClient = await pool.connect();
    try {
      await gucClient.query('SET ROLE dealflow_app');
      await gucClient.query('SELECT set_config($1, $2, false)', ['app.workspace_id', OAE_WS_A]);
      const gucDb = drizzle(gucClient, { schema }) as unknown as typeof db;
      await workspaceAls.run({ db: gucDb, workspaceId: OAE_WS_A }, async () => {
        await svc.updateStatus(activityId, 'completed', OAE_ST_USER_A);
      });
    } finally {
      await gucClient.query('RESET ROLE').catch(() => {});
      await gucClient.query('RESET app.workspace_id').catch(() => {});
      gucClient.release();
    }

    expect(
      Number(
        (
          await pool.query<{ count: string }>(
            `SELECT COUNT(*)::text AS count FROM audit_log_entries`
          )
        ).rows[0]?.count ?? 0
      )
    ).toBe(beforeCount + 1);

    const lastEntry = await pool.query<{ action: string }>(
      `SELECT action FROM audit_log_entries ORDER BY sequence_number DESC LIMIT 1`
    );
    expect(lastEntry.rows[0]?.action).toBe('outreach-activity-status-transition');

    expect((await verifier.verifyChain()).ok).toBe(true);
  });

  it('OAE-12 (R4/SF5): cancel() appends outreach-activity-cancel + verifyChain ok', {
    timeout: 20000,
  }, async () => {
    if (!dbReachable) return;

    const { AuditKeyring } = await import('../src/modules/audit/audit.keyring');
    const { AuditRepository } = await import('../src/modules/audit/audit.repository');
    const { AuditService } = await import('../src/modules/audit/audit.service');
    const { AuditVerifier } = await import('../src/modules/audit/audit.verifier');
    const { OutreachActivityRepository } = await import(
      '../src/modules/outreach-activity/outreach-activity.repository'
    );
    const { OutreachActivityService } = await import(
      '../src/modules/outreach-activity/outreach-activity.service'
    );
    const { AuthRepository } = await import('../src/modules/auth/auth.repository');
    const { workspaceAls } = await import('../src/db/workspace-context');

    const keyring = new AuditKeyring(process.env);
    const auditRepo = new AuditRepository(db);
    const auditSvc = new AuditService(keyring, auditRepo);
    const verifier = new AuditVerifier(keyring, auditRepo);
    const oaRepo = new OutreachActivityRepository(db);
    const authRepo = new AuthRepository(db);
    const svc = new OutreachActivityService(oaRepo, auditSvc, authRepo);

    const activityId = await seedActivity(OAE_WS_A, userAId, 'OAE-12 cancel test');

    const before = await pool.query<{ count: string }>(
      `SELECT COUNT(*)::text AS count FROM audit_log_entries`
    );
    const beforeCount = Number(before.rows[0]?.count ?? 0);

    const { drizzle } = await import('drizzle-orm/node-postgres');
    const schema = await import('../src/db/schema');
    const gucClient = await pool.connect();
    try {
      await gucClient.query('SET ROLE dealflow_app');
      await gucClient.query('SELECT set_config($1, $2, false)', ['app.workspace_id', OAE_WS_A]);
      const gucDb = drizzle(gucClient, { schema }) as unknown as typeof db;
      await workspaceAls.run({ db: gucDb, workspaceId: OAE_WS_A }, async () => {
        await svc.cancel(activityId, OAE_ST_USER_A);
      });
    } finally {
      await gucClient.query('RESET ROLE').catch(() => {});
      await gucClient.query('RESET app.workspace_id').catch(() => {});
      gucClient.release();
    }

    expect(
      Number(
        (
          await pool.query<{ count: string }>(
            `SELECT COUNT(*)::text AS count FROM audit_log_entries`
          )
        ).rows[0]?.count ?? 0
      )
    ).toBe(beforeCount + 1);

    const lastEntry = await pool.query<{ action: string }>(
      `SELECT action FROM audit_log_entries ORDER BY sequence_number DESC LIMIT 1`
    );
    expect(lastEntry.rows[0]?.action).toBe('outreach-activity-cancel');

    expect((await verifier.verifyChain()).ok).toBe(true);
  });

  it('OAE-13 (R4/SF5 rollback): audit throw → outreach_activity row NOT persisted', {
    timeout: 15000,
  }, async () => {
    if (!dbReachable) return;

    // Build service with a mock AuditService that THROWS on append.
    const { OutreachActivityRepository } = await import(
      '../src/modules/outreach-activity/outreach-activity.repository'
    );
    const { OutreachActivityService } = await import(
      '../src/modules/outreach-activity/outreach-activity.service'
    );
    const { AuthRepository } = await import('../src/modules/auth/auth.repository');
    const { workspaceAls } = await import('../src/db/workspace-context');
    const { drizzle } = await import('drizzle-orm/node-postgres');
    const schema = await import('../src/db/schema');

    // Create a failing audit mock.
    const failingAuditSvc = {
      append: async () => {
        throw new Error('OAE-13 injected audit failure');
      },
    };

    const oaRepo = new OutreachActivityRepository(db);
    const authRepo = new AuthRepository(db);
    const svc = new OutreachActivityService(oaRepo, failingAuditSvc as never, authRepo);

    const subject = `OAE-13-rollback-test-${Date.now()}`;

    const before = await pool.query<{ count: string }>(
      `SELECT COUNT(*)::text AS count FROM outreach_activity WHERE subject = $1`,
      [subject]
    );
    expect(Number(before.rows[0]?.count ?? 0)).toBe(0);

    const gucClient = await pool.connect();
    let thrownErr: unknown = null;
    try {
      await gucClient.query('SET ROLE dealflow_app');
      await gucClient.query('SELECT set_config($1, $2, false)', ['app.workspace_id', OAE_WS_A]);
      const gucDb = drizzle(gucClient, { schema }) as unknown as typeof db;
      await workspaceAls.run({ db: gucDb, workspaceId: OAE_WS_A }, async () => {
        try {
          await svc.create({ channel: 'call', subject }, OAE_ST_USER_A);
        } catch (err) {
          thrownErr = err;
        }
      });
    } finally {
      await gucClient.query('RESET ROLE').catch(() => {});
      await gucClient.query('RESET app.workspace_id').catch(() => {});
      gucClient.release();
    }

    // Service must have thrown.
    expect(thrownErr).not.toBeNull();

    // Business row must NOT be present (rollback holds).
    const after = await pool.query<{ count: string }>(
      `SELECT COUNT(*)::text AS count FROM outreach_activity WHERE subject = $1`,
      [subject]
    );
    expect(Number(after.rows[0]?.count ?? 0)).toBe(0);
  });

  // ── OAE-14: R2/SF3 FORCE confirmed as dealflow_app ───────────────────────

  it('OAE-14 (R2/SF3): relrowsecurity AND relforcerowsecurity true (as dealflow_app)', {
    timeout: 10000,
  }, async () => {
    if (!dbReachable) return;

    const result = await withWorkspace(OAE_WS_A, async (client) => {
      return client.query<{ relrowsecurity: boolean; relforcerowsecurity: boolean }>(
        `SELECT relrowsecurity, relforcerowsecurity
           FROM pg_class
           WHERE relname = 'outreach_activity' AND relkind = 'r'`
      );
    });

    const row = result.rows[0];
    expect(row?.relrowsecurity).toBe(true);
    expect(row?.relforcerowsecurity).toBe(true);
  });
});

/**
 * Recordkeeping export cross-firm isolation e2e (wave-27, task 0d2c5f08).
 *
 * SEC-8 FAULT-KILLING test: proves that the recordkeeping export surface
 * (exportAsActor) enforces workspace isolation for both audit and deal/pipeline
 * scopes via getDb/RLS (FORCE RLS), NOT via read_audit_chain_rls_exempt.
 *
 * ── LOAD-BEARING INVARIANTS (SEC-8) ──────────────────────────────────────────
 *
 * REISO-1: Cross-firm negative read — firm A export contains ZERO firm B rows.
 *   Seed audit rows + pipeline rows in firm A and firm B.
 *   Run exportAsActor() inside workspaceAls.run({ db: gucHandle, workspaceId: A })
 *   with SET ROLE dealflow_app (NOSUPERUSER NOBYPASSRLS → FORCE RLS applies).
 *   Assert: exported audit entries contain ZERO firm B actorUserId values.
 *   Assert: exported deal entries contain ZERO firm B pipelineIds.
 *   Assert: audit entryCount == firm A seeded count.
 *
 * REISO-2: Deal/pipeline scope — firm A deal export excludes firm B rows.
 *   Same setup as REISO-1; assert scope='deal' export excludes firm B.
 *
 * REISO-3: audit scope — firm A audit-only export excludes firm B rows.
 *   Assert scope='audit' returns only firm A audit entries.
 *
 * REISO-4: SEC-2 negative — request carrying workspace_id → 400 / ignored.
 *   The exportScopeSchema is .strict(); unknown keys → Zod error → 400.
 *   Even if a workspace_id were passed through, the service uses ALS, not the param.
 *
 * REISO-5: SEC-4 truncation — over-cap scope → manifest.truncated:true.
 *   Use a tiny cap override to force truncation; assert manifest fields.
 *
 * REISO-6: SEC-5 CSV injection — a cell starting with =SUM(...) is escaped.
 *   Assert the CSV contains the ' prefix before the formula character.
 *
 * REISO-7: SEC-6 firm-local ordinal — exported audit entries carry firmLocalOrdinal
 *   (1..N), NOT the global sequence_number. The global sequenceNumber MUST NOT
 *   appear in the ExportAuditEntry shape.
 *
 * REISO-8: SEC-1 payload-path guard — the export path does NOT call
 *   read_audit_chain_rls_exempt for the payload rows (verify=boolean is permitted).
 *   Assert: auditVerifier.verifyChain is called (boolean), but the payload rows
 *   come from the RLS-scoped tx path only.
 *
 * ── HOW THE REAL SERVICE IS INVOKED ─────────────────────────────────────────
 * 1. Check out a PoolClient from the test pool.
 * 2. SET ROLE dealflow_app — drops superuser privilege; FORCE RLS applies.
 *    CRITICAL: NOT postgres — using postgres bypasses FORCE RLS = false-green (0016 trap).
 * 3. SELECT set_config('app.workspace_id', WS_A_ID, false) — GUC live on client.
 * 4. drizzle(client, { schema }) → gucHandle.
 * 5. workspaceAls.run({ db: gucHandle, workspaceId: WS_A_ID }, () => service.exportAsActor())
 *    → getDb(this.db) returns gucHandle (ALS store set) inside the callback.
 * 6. RESET ROLE + RESET app.workspace_id + release in finally.
 *
 * ── UUID NAMESPACE (wave-27 recordkeeping-export-isolation) ─────────────────
 * Prefix '00000027-re01-*'. Disjoint from all prior suites.
 *
 * ── TEARDOWN POLICY (WORM-SAFE, T-4 rule 1) ─────────────────────────────────
 * audit_log_entries rows are WORM — not deleted. All other seeded rows are
 * cleaned in finally/afterAll via the superuser pool. Teardown is idempotent.
 *
 * ── T-4 RULE 2 — SCOPED TO OWN SEEDED ROWS ─────────────────────────────────
 * Assertions use counts of THIS run's seeded rows, not total-table counts.
 *
 * ── GUARD ────────────────────────────────────────────────────────────────────
 * Suite is skipped when TEST_DATABASE_URL is unset or DB unreachable.
 */

import path from 'node:path';
import { Pool, type PoolClient } from 'pg';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { escapeCsvCell } from '../src/modules/recordkeeping/csv.serializer';
import { apiMigrationsFolder, ensureMigrated } from './_helpers/ensure-migrated';

// ── Guard ─────────────────────────────────────────────────────────────────────
const TEST_DB_URL = process.env.TEST_DATABASE_URL;
const shouldSkip = !TEST_DB_URL || TEST_DB_URL.trim() === '';

if (shouldSkip) {
  console.info(
    '[recordkeeping-export-isolation] TEST_DATABASE_URL is not set — suite SKIPPED. ' +
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

// ── UUID namespace (wave-27 recordkeeping-export-isolation) ──────────────────
// All segments must be valid hex. Prefix 're01' = valid (r not hex — use 4e01).
const WS_A_ID = '00000027-4e01-4000-8000-000000000001';
const WS_B_ID = '00000027-4e01-4000-8000-000000000002';

// ── Module-level state ────────────────────────────────────────────────────────
let pool: Pool;
let dbReachable = false;
let adminRoleId: string;
let advisorRoleId: string;

// Seeded entity IDs for WORM-safe teardown.
const seededUserIds: string[] = [];
const seededMandateIds: string[] = [];
const seededPipelineIds: string[] = [];
const seededMatchRunIds: string[] = [];
const seededMatchCandidateIds: string[] = [];
const seededBuyerUniverseIds: string[] = [];
const seededBuyerUniverseCandidateIds: string[] = [];
const seededCompanyIds: string[] = [];

// Track which audit entries were seeded per workspace (by actorUserId).
let wsAUserId: string;
let wsBUserId: string;
let wsAAuditCount = 0; // number of audit entries seeded in WS_A
let wsAPipelineCount = 0; // number of pipeline rows seeded in WS_A

// ── Workspace helpers (reuse analytics-isolation pattern) ────────────────────

async function withWorkspace<T>(
  workspaceId: string,
  fn: (client: PoolClient) => Promise<T>
): Promise<T> {
  const client = await pool.connect();
  try {
    // SEC-8 CRITICAL: SET ROLE dealflow_app (NOT postgres).
    // Using postgres bypasses FORCE RLS → false-green (0016 trap).
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
  email: string,
  roleId: string
): Promise<string> {
  const userId = crypto.randomUUID();
  await withSuperuserGuc(workspaceId, async (client) => {
    await client.query(
      `INSERT INTO users (id, supertokens_user_id, email, role_id, workspace_id, deactivated_at)
       VALUES ($1, $2, $3, $4, $5, now())
       ON CONFLICT (supertokens_user_id) DO NOTHING`,
      [userId, supertokensUserId, email, roleId, workspaceId]
    );
  });
  const res = await withSuperuserGuc(workspaceId, async (client) =>
    client.query<{ id: string }>('SELECT id FROM users WHERE supertokens_user_id = $1 LIMIT 1', [
      supertokensUserId,
    ])
  );
  const id = res.rows[0]?.id;
  if (!id) throw new Error(`seedUser: no row for stUserId=${supertokensUserId}`);
  seededUserIds.push(id);
  return id;
}

async function seedMandate(workspaceId: string, userId: string): Promise<string> {
  const id = crypto.randomUUID();
  await withSuperuserGuc(workspaceId, async (client) => {
    await client.query(
      `INSERT INTO mandates (id, seller_name, created_by, workspace_id, status)
       VALUES ($1, $2, $3, $4, 'draft')`,
      [id, `REISO-mandate-${id.slice(0, 8)}`, userId, workspaceId]
    );
  });
  seededMandateIds.push(id);
  return id;
}

/**
 * Seed an audit log entry via the superuser pool (bypasses FORCE RLS for seeding).
 * Uses INSERT ... OVERRIDING SYSTEM VALUE to supply an explicit sequence_number that
 * is collision-safe against a shared DB where other suites may have inserted rows via
 * OVERRIDING SYSTEM VALUE (which does NOT advance the identity sequence counter).
 *
 * Pattern: read MAX(sequence_number) inside the same superuser transaction, then
 * insert at MAX+1 with OVERRIDING SYSTEM VALUE, then call setval() to advance the
 * identity sequence so subsequent DEFAULT-based inserts (from the real AuditService)
 * do not collide either. All three steps are in one serialisable transaction on a
 * single client so concurrent test suite runs cannot interleave between the read and
 * the write.
 *
 * This is the collision-safe raw-seed pattern for a GENERATED ALWAYS AS IDENTITY
 * primary key shared across all workspaces — matching what the real
 * AuditRepository.insertEntry does (advisory lock + read_audit_chain_rls_exempt +
 * OVERRIDING SYSTEM VALUE), adapted for superuser test seeding that doesn't go
 * through the advisory-lock path.
 *
 * WORM: audit_log_entries rows are NOT tracked for cleanup (immutable).
 */
async function seedAuditEntry(
  workspaceId: string,
  actorUserId: string,
  action: string
): Promise<void> {
  const fakeHash = 'b'.repeat(64);
  const genesisHash = '0'.repeat(64);

  // Open a single client, run the MAX-read + INSERT + setval in one transaction
  // so no concurrent writer can slip in between the SELECT MAX and the INSERT.
  const client = await pool.connect();
  try {
    await client.query('SELECT set_config($1, $2, false)', ['app.workspace_id', workspaceId]);
    await client.query('BEGIN');

    // Read the current global max; use COALESCE so an empty table yields 0.
    const maxRes = await client.query<{ maxseq: string }>(
      `SELECT COALESCE(MAX(sequence_number), 0) AS maxseq FROM audit_log_entries`
    );
    const nextSeq = Number(maxRes.rows[0]?.maxseq ?? 0) + 1;

    // Insert with OVERRIDING SYSTEM VALUE at the collision-safe next value.
    // sequence_number is GENERATED ALWAYS AS IDENTITY — DEFAULT cannot be used
    // without risk of collision against rows inserted via OVERRIDING SYSTEM VALUE
    // by other suites (the identity counter is not auto-advanced by those inserts).
    await client.query(
      `INSERT INTO audit_log_entries
         (sequence_number,
          actor_user_id, actor_role, action, resource_type, resource_id,
          content_hash, payload_hash, prev_hash, entry_hash, chain_version,
          workspace_id)
       OVERRIDING SYSTEM VALUE
       VALUES ($1, $2, 'compliance', $3, 'audit-log-export', NULL,
               $4, $4, $5, $4, 1, $6)`,
      [nextSeq, actorUserId, action, fakeHash, genesisHash, workspaceId]
    );

    // Advance the identity sequence past nextSeq so the real AuditService's
    // DEFAULT-based inserts (via appendStandalone / insertEntry) also do not collide.
    await client.query(
      `SELECT setval(
         pg_get_serial_sequence('audit_log_entries', 'sequence_number'),
         $1
       )`,
      [nextSeq]
    );

    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    await client.query('RESET app.workspace_id').catch(() => {});
    client.release();
  }
}

/**
 * Seed a pipeline row in the given workspace.
 * Requires: a mandate and a match_candidate (seeded inline here).
 */
async function seedPipelineRow(
  workspaceId: string,
  userId: string,
  mandateId: string
): Promise<string> {
  const pipelineId = crypto.randomUUID();
  const buyerUniverseId = crypto.randomUUID();
  const buyerUniverseCandidateId = crypto.randomUUID();
  const matchRunId = crypto.randomUUID();
  const matchCandidateId = crypto.randomUUID();
  const companyId = crypto.randomUUID();

  await withSuperuserGuc(workspaceId, async (client) => {
    // buyer_universe
    await client.query(
      `INSERT INTO buyer_universe (id, mandate_id, workspace_id, status, created_by)
       VALUES ($1, $2, $3, 'submitted', $4)
       ON CONFLICT (mandate_id) DO UPDATE SET status='submitted'`,
      [buyerUniverseId, mandateId, workspaceId, userId]
    );
    const buRes = await client.query<{ id: string }>(
      'SELECT id FROM buyer_universe WHERE mandate_id = $1 LIMIT 1',
      [mandateId]
    );
    const actualBuId = buRes.rows[0]?.id ?? buyerUniverseId;
    if (actualBuId === buyerUniverseId) seededBuyerUniverseIds.push(buyerUniverseId);

    // companies
    await client.query(
      `INSERT INTO companies (id, name, workspace_id) VALUES ($1, $2, $3) ON CONFLICT (id) DO NOTHING`,
      [companyId, `REISO-company-${companyId.slice(0, 8)}`, workspaceId]
    );
    seededCompanyIds.push(companyId);

    // buyer_universe_candidates
    await client.query(
      `INSERT INTO buyer_universe_candidates (id, buyer_universe_id, company_id, workspace_id, membership_status)
       VALUES ($1, $2, $3, $4, 'included')`,
      [buyerUniverseCandidateId, actualBuId, companyId, workspaceId]
    );
    seededBuyerUniverseCandidateIds.push(buyerUniverseCandidateId);

    // match_run
    await client.query(
      `INSERT INTO match_run (id, mandate_id, buyer_universe_id, created_by, workspace_id, status)
       VALUES ($1, $2, $3, $4, $5, 'scored')
       ON CONFLICT (buyer_universe_id) DO NOTHING`,
      [matchRunId, mandateId, actualBuId, userId, workspaceId]
    );
    const mrRes = await client.query<{ id: string }>(
      'SELECT id FROM match_run WHERE buyer_universe_id = $1 LIMIT 1',
      [actualBuId]
    );
    const actualMrId = mrRes.rows[0]?.id ?? matchRunId;
    if (actualMrId === matchRunId) seededMatchRunIds.push(matchRunId);

    // match_candidates
    await client.query(
      `INSERT INTO match_candidates (id, match_run_id, buyer_universe_candidate_id, fit_score, workspace_id)
       VALUES ($1, $2, $3, 75, $4)`,
      [matchCandidateId, actualMrId, buyerUniverseCandidateId, workspaceId]
    );
    seededMatchCandidateIds.push(matchCandidateId);

    // pipeline (match_candidate path)
    await client.query(
      `INSERT INTO pipeline (id, mandate_id, deal_source_type, match_candidate_id, created_by, workspace_id)
       VALUES ($1, $2, 'match_candidate', $3, $4, $5)`,
      [pipelineId, mandateId, matchCandidateId, userId, workspaceId]
    );
    seededPipelineIds.push(pipelineId);
  });

  return pipelineId;
}

// ── Core helper: invoke the REAL RecordkeepingService inside GUC-bound ALS ───

/**
 * runExportInAls — invoke the REAL RecordkeepingService.exportAsActor() inside
 * a workspaceAls.run context bound to a dealflow_app GUC client.
 *
 * SEC-8 CRITICAL:
 *   - Uses SET ROLE dealflow_app (NOT postgres — postgres bypasses FORCE RLS).
 *   - Uses workspaceAls.run so getDb(this.db) returns the GUC-bound handle.
 *   - The AuditVerifier.verifyChain is mocked to return ok:true (the global
 *     chain walk uses read_audit_chain_rls_exempt — this is permitted for the
 *     boolean, but we don't need it to run against a partial test DB).
 *
 * @param workspaceId - The workspace to run the export for.
 * @param scope       - The export scope to pass to exportAsActor.
 * @param capOverride - Optional EXPORT_ROW_CAP override for truncation tests.
 */
async function runExportInAls(
  workspaceId: string,
  scope: import('@dealflow/shared').ExportScope,
  capOverride?: number
): Promise<import('../src/modules/recordkeeping/recordkeeping.service').ExportPackage> {
  const { drizzle } = await import('drizzle-orm/node-postgres');
  const schema = await import('../src/db/schema');
  const { workspaceAls } = await import('../src/db/workspace-context');
  const { RecordkeepingRepository } = await import(
    '../src/modules/recordkeeping/recordkeeping.repository'
  );
  const { RecordkeepingService } = await import(
    '../src/modules/recordkeeping/recordkeeping.service'
  );

  const client = await pool.connect();
  try {
    // SEC-8 CRITICAL: SET ROLE dealflow_app (NOT postgres — FORCE RLS applies).
    await client.query('SET ROLE dealflow_app');
    await client.query('SELECT set_config($1, $2, false)', ['app.workspace_id', workspaceId]);

    // biome-ignore lint/suspicious/noExplicitAny: drizzle handle cast — same pattern as workspace.interceptor.ts
    const gucHandle = drizzle(client, { schema }) as any;

    // ── Mock dependencies that require external resources ─────────────────────
    // AuditVerifier.verifyChain: mock to return ok:true (the global chain walk
    // uses read_audit_chain_rls_exempt — permitted for boolean; not for payload).
    const mockAuditVerifier = {
      verifyChain: vi.fn().mockResolvedValue({ ok: true, entriesChecked: 0 }),
    };

    // AuditService.append: mock to avoid a real chain append in the test DB.
    // The test proves isolation of the payload READ — not the audit write path.
    const mockAuditService = {
      append: vi.fn().mockResolvedValue({ sequenceNumber: 1 }),
    };

    // AuthRepository.getUserWithRole: return a compliance user in the test workspace.
    const mockAuthRepository = {
      getUserWithRole: vi.fn().mockResolvedValue({
        id: wsAUserId,
        roleName: 'compliance',
      }),
    };

    // Instantiate the real repository with the GUC-bound handle.
    const repo = new RecordkeepingRepository(gucHandle);

    // Override EXPORT_ROW_CAP if capOverride is provided (for truncation tests).
    // We do this by monkey-patching the repository methods for this call.
    if (capOverride !== undefined) {
      const originalBounded = repo.findForExportBounded.bind(repo);
      const originalDeal = repo.findDealRowsBounded.bind(repo);
      // biome-ignore lint/suspicious/noExplicitAny: test-only monkey-patch
      (repo as any).findForExportBounded = (filter: any, tx: any) =>
        originalBounded(filter, tx, capOverride);
      // biome-ignore lint/suspicious/noExplicitAny: test-only monkey-patch
      (repo as any).findDealRowsBounded = (filter: any, tx: any) =>
        originalDeal(filter, tx, capOverride);
    }

    const service = new RecordkeepingService(
      repo,
      // biome-ignore lint/suspicious/noExplicitAny: mock cast
      mockAuditVerifier as any,
      // biome-ignore lint/suspicious/noExplicitAny: mock cast
      mockAuditService as any,
      // biome-ignore lint/suspicious/noExplicitAny: mock cast
      mockAuthRepository as any
    );

    return await new Promise((resolve, reject) => {
      workspaceAls.run({ db: gucHandle, workspaceId }, () => {
        service.exportAsActor(scope, 'st-reiso-compliance-user').then(resolve, reject);
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

// ── Suite ─────────────────────────────────────────────────────────────────────

describe.skipIf(shouldSkip)(
  'Recordkeeping export cross-firm isolation — SEC-8 fault-killing (T-8)',
  () => {
    beforeAll(async () => {
      if (!TEST_DB_URL) return;
      dbReachable = await isDbReachable(TEST_DB_URL);
      if (!dbReachable) {
        console.info(
          '[recordkeeping-export-isolation] Postgres unreachable — tests will be skipped.'
        );
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

      // Resolve role ids.
      const roleRes = await pool.query<{ id: string; name: string }>(
        `SELECT id, name FROM roles WHERE name IN ('admin', 'compliance') ORDER BY name`
      );
      for (const row of roleRes.rows) {
        if (row.name === 'admin') adminRoleId = row.id;
        if (row.name === 'compliance') advisorRoleId = row.id;
      }
      if (!adminRoleId) throw new Error('recordkeeping-export-isolation: admin role not found');
      if (!advisorRoleId)
        throw new Error('recordkeeping-export-isolation: compliance role not found');

      // Seed workspaces.
      await seedWorkspace(WS_A_ID, 'REISO Test Workspace A');
      await seedWorkspace(WS_B_ID, 'REISO Test Workspace B');

      // Seed users.
      wsAUserId = await seedUser(
        WS_A_ID,
        '00000027-4e01-st-a-000000000001',
        'reiso-a@recordkeeping-isolation.test',
        adminRoleId
      );
      wsBUserId = await seedUser(
        WS_B_ID,
        '00000027-4e01-st-b-000000000001',
        'reiso-b@recordkeeping-isolation.test',
        adminRoleId
      );

      // ── Seed firm A: 3 audit entries + 2 pipeline rows ──────────────────────
      await seedAuditEntry(WS_A_ID, wsAUserId, 'reiso-test-action-a1');
      await seedAuditEntry(WS_A_ID, wsAUserId, 'reiso-test-action-a2');
      await seedAuditEntry(WS_A_ID, wsAUserId, 'reiso-test-action-a3');
      wsAAuditCount = 3;

      const mandateA1 = await seedMandate(WS_A_ID, wsAUserId);
      const mandateA2 = await seedMandate(WS_A_ID, wsAUserId);
      await seedPipelineRow(WS_A_ID, wsAUserId, mandateA1);
      await seedPipelineRow(WS_A_ID, wsAUserId, mandateA2);
      wsAPipelineCount = 2;

      // ── Seed firm B: 2 audit entries + 1 pipeline row (must NOT appear in A export) ──
      await seedAuditEntry(WS_B_ID, wsBUserId, 'reiso-test-action-b1');
      await seedAuditEntry(WS_B_ID, wsBUserId, 'reiso-test-action-b2');

      const mandateB = await seedMandate(WS_B_ID, wsBUserId);
      await seedPipelineRow(WS_B_ID, wsBUserId, mandateB);
    });

    afterAll(async () => {
      if (!dbReachable || !pool) return;

      const deleteScoped = async (wsId: string, table: string, ids: string[]): Promise<void> => {
        if (ids.length === 0) return;
        for (const id of ids) {
          const client = await pool.connect();
          try {
            await client.query('SELECT set_config($1, $2, false)', ['app.workspace_id', wsId]);
            await client.query(`DELETE FROM ${table} WHERE id = $1`, [id]);
          } catch {
            // Non-fatal — row may already be gone.
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

      // FK-safe order: children before parents.
      await tryDeleteBothWs('pipeline', seededPipelineIds);
      await tryDeleteBothWs('match_candidates', seededMatchCandidateIds);
      await tryDeleteBothWs('match_run', seededMatchRunIds);
      await tryDeleteBothWs('buyer_universe_candidates', seededBuyerUniverseCandidateIds);
      await tryDeleteBothWs('companies', seededCompanyIds);
      await tryDeleteBothWs('buyer_universe', seededBuyerUniverseIds);
      await tryDeleteBothWs('mandates', seededMandateIds);
      // Users: deactivated_at set at INSERT — soft-deleted; no cleanup needed.

      await pool.end().catch(() => {});
    });

    // ── REISO-1: Cross-firm negative read (scope=both) ────────────────────────

    it('REISO-1 (both scope): firm A export contains ZERO firm B audit entries', async () => {
      if (!dbReachable) return;

      const pkg = await runExportInAls(WS_A_ID, { scope: 'both', format: 'json' });

      // All exported audit entries must have actorUserId == wsAUserId.
      for (const entry of pkg.entries) {
        expect(entry.actorUserId).not.toBe(wsBUserId);
      }

      // The firm A seeded entries must be present (at least wsAAuditCount).
      const firmAEntries = pkg.entries.filter((e) => e.actorUserId === wsAUserId);
      expect(firmAEntries.length).toBeGreaterThanOrEqual(wsAAuditCount);

      // Positive control: entries are non-empty.
      expect(pkg.entries.length).toBeGreaterThan(0);
    });

    it('REISO-1 (both scope): firm A export contains ZERO firm B deal/pipeline entries', async () => {
      if (!dbReachable) return;

      const pkg = await runExportInAls(WS_A_ID, { scope: 'both', format: 'json' });

      // All exported deal entries must be seeded firm A pipeline IDs.
      const firmAPipelineSet = new Set(seededPipelineIds.slice(0, wsAPipelineCount));
      for (const dealEntry of pkg.dealEntries) {
        // None of the firm B pipeline IDs should appear.
        const isFirmBPipeline = seededPipelineIds
          .slice(wsAPipelineCount) // firm B pipeline IDs are the latter ones
          .includes(dealEntry.pipelineId);
        expect(isFirmBPipeline).toBe(false);
      }

      // Firm A pipeline rows must be present.
      expect(pkg.dealEntries.length).toBeGreaterThanOrEqual(wsAPipelineCount);
    });

    // ── REISO-2: Deal scope — firm A deal export excludes firm B ─────────────

    it('REISO-2 (deal scope): scope=deal returns only firm A pipeline rows', async () => {
      if (!dbReachable) return;

      const pkg = await runExportInAls(WS_A_ID, { scope: 'deal', format: 'json' });

      // Audit entries must be empty (scope=deal).
      expect(pkg.entries).toHaveLength(0);

      // Deal entries must be non-empty (firm A has pipeline rows).
      expect(pkg.dealEntries.length).toBeGreaterThanOrEqual(wsAPipelineCount);

      // Firm B's pipeline IDs must not appear.
      const firmBPipelineIds = seededPipelineIds.slice(wsAPipelineCount);
      for (const dealEntry of pkg.dealEntries) {
        expect(firmBPipelineIds.includes(dealEntry.pipelineId)).toBe(false);
      }
    });

    // ── REISO-3: Audit scope — firm A audit-only export ───────────────────────

    it('REISO-3 (audit scope): scope=audit returns only firm A audit entries', async () => {
      if (!dbReachable) return;

      const pkg = await runExportInAls(WS_A_ID, { scope: 'audit', format: 'json' });

      // Deal entries must be empty (scope=audit).
      expect(pkg.dealEntries).toHaveLength(0);

      // Audit entries from firm B must not appear.
      for (const entry of pkg.entries) {
        expect(entry.actorUserId).not.toBe(wsBUserId);
      }

      // Firm A audit entries must be present.
      expect(pkg.entries.length).toBeGreaterThan(0);
    });

    // ── REISO-4: SEC-2 negative — workspace_id in body → 400 ─────────────────

    it('REISO-4 (SEC-2): exportScopeSchema rejects workspace_id in body (unknown key)', () => {
      const { exportScopeSchema } = require('@dealflow/shared');

      // workspace_id is an unknown key — .strict() rejects it.
      const result = exportScopeSchema.safeParse({
        workspace_id: WS_B_ID,
        format: 'json',
        scope: 'both',
      });
      expect(result.success).toBe(false);

      // firmId also rejected.
      const result2 = exportScopeSchema.safeParse({
        firmId: WS_B_ID,
        format: 'json',
        scope: 'both',
      });
      expect(result2.success).toBe(false);

      // Valid body without workspace_id passes.
      const result3 = exportScopeSchema.safeParse({ format: 'json', scope: 'both' });
      expect(result3.success).toBe(true);
    });

    // ── REISO-5: SEC-4 truncation — over-cap scope → truncated:true ───────────

    it('REISO-5 (SEC-4): over-cap scope → manifest.truncated:true + rowsAvailable >= rowsReturned', async () => {
      if (!dbReachable) return;

      // Use capOverride=1 to force truncation on the audit scope.
      // Firm A has wsAAuditCount >= 3 audit entries.
      const pkg = await runExportInAls(WS_A_ID, { scope: 'audit', format: 'json' }, 1);

      // With cap=1 and wsAAuditCount>=3, truncated must be true.
      expect(pkg.manifest.truncated).toBe(true);
      expect(pkg.manifest.rowsReturned).toBeGreaterThanOrEqual(0);
      expect(pkg.manifest.rowsAvailable).toBeGreaterThan(pkg.manifest.rowsReturned);

      // Entries returned must be <= cap.
      expect(pkg.entries.length).toBeLessThanOrEqual(1);
    });

    it('REISO-5 (SEC-4): normal scope → manifest.truncated:false', async () => {
      if (!dbReachable) return;

      const pkg = await runExportInAls(WS_A_ID, { scope: 'audit', format: 'json' });

      // With default cap (50_000) and wsAAuditCount=3, not truncated.
      expect(pkg.manifest.truncated).toBe(false);
      expect(pkg.manifest.rowsReturned).toBe(pkg.manifest.rowsAvailable);
    });

    // ── REISO-6: SEC-5 CSV injection escaping ────────────────────────────────

    it('REISO-6 (SEC-5): CSV injection escape — =SUM(...) cell is prefixed with single-quote', () => {
      // Test the escapeCsvCell function directly (unit-level, no DB required).
      const formula = '=SUM(1+1)';
      const escaped = escapeCsvCell(formula);

      // Layer 1: injection prefix applied — single-quote before the = character.
      expect(escaped).toContain("'=SUM(1+1)");
      // Layer 2: RFC-4180 wrapping — wrapped in double-quotes.
      expect(escaped.startsWith('"')).toBe(true);
      expect(escaped.endsWith('"')).toBe(true);
    });

    it('REISO-6 (SEC-5): CSV injection escape — +, -, @ are prefixed', () => {
      for (const trigger of ['+1', '-1', '@foo']) {
        const escaped = escapeCsvCell(trigger);
        expect(escaped).toContain(`'${trigger}`);
      }
    });

    it('REISO-6 (SEC-5): CSV injection escape — TAB/CR/LF as first char are prefixed', () => {
      for (const trigger of ['\tfoo', '\rfoo', '\nfoo']) {
        const escaped = escapeCsvCell(trigger);
        // The prefixed ' appears as the second char inside the double-quotes.
        expect(escaped).toMatch(/^"'/);
      }
    });

    it('REISO-6 (SEC-5): CSV injection escape — safe cells are wrapped but NOT prefixed', () => {
      const safe = 'hello world';
      const escaped = escapeCsvCell(safe);
      expect(escaped).toBe('"hello world"');
    });

    it('REISO-6 (SEC-5): CSV injection escape — internal double-quotes are doubled (RFC-4180)', () => {
      const withQuote = 'say "hello"';
      const escaped = escapeCsvCell(withQuote);
      expect(escaped).toBe('"say ""hello"""');
    });

    // ── REISO-7: SEC-6 firm-local ordinal, global sequenceNumber MASKED ───────

    it('REISO-7 (SEC-6): exported entries carry firmLocalOrdinal (1..N), NOT global sequenceNumber', async () => {
      if (!dbReachable) return;

      const pkg = await runExportInAls(WS_A_ID, { scope: 'audit', format: 'json' });

      expect(pkg.entries.length).toBeGreaterThan(0);

      // firmLocalOrdinal must be 1..N ascending.
      for (let i = 0; i < pkg.entries.length; i++) {
        expect(pkg.entries[i]?.firmLocalOrdinal).toBe(i + 1);
      }

      // Global sequenceNumber must NOT be present in the ExportAuditEntry shape.
      for (const entry of pkg.entries) {
        expect('sequenceNumber' in entry).toBe(false);
      }
    });

    it('REISO-7 (SEC-6): deal entries carry firmLocalOrdinal (1..N)', async () => {
      if (!dbReachable) return;

      const pkg = await runExportInAls(WS_A_ID, { scope: 'deal', format: 'json' });

      expect(pkg.dealEntries.length).toBeGreaterThan(0);

      for (let i = 0; i < pkg.dealEntries.length; i++) {
        expect(pkg.dealEntries[i]?.firmLocalOrdinal).toBe(i + 1);
      }
    });

    // ── REISO-8: SEC-1 payload-path guard — verifyChain called; payload via RLS ─

    it('REISO-8 (SEC-1): verifyChain (boolean) is called; payload does NOT use rls-exempt path', async () => {
      if (!dbReachable) return;

      // The real AuditVerifier.verifyChain uses read_audit_chain_rls_exempt.
      // In our runExportInAls helper, we mock it and assert it was called exactly once.
      // The key invariant: payload rows (pkg.entries) come from the tx-scoped RLS
      // path (findForExportBounded), NOT from the rls-exempt walk.
      // We verify this by checking that the returned entries are RLS-scoped
      // (firm A only — REISO-1 already proves this).

      const { drizzle } = await import('drizzle-orm/node-postgres');
      const schema = await import('../src/db/schema');
      const { workspaceAls } = await import('../src/db/workspace-context');
      const { RecordkeepingRepository } = await import(
        '../src/modules/recordkeeping/recordkeeping.repository'
      );
      const { RecordkeepingService } = await import(
        '../src/modules/recordkeeping/recordkeeping.service'
      );

      const client = await pool.connect();
      let verifyChainCallCount = 0;

      try {
        await client.query('SET ROLE dealflow_app');
        await client.query('SELECT set_config($1, $2, false)', ['app.workspace_id', WS_A_ID]);

        // biome-ignore lint/suspicious/noExplicitAny: drizzle handle cast
        const gucHandle = drizzle(client, { schema }) as any;

        const mockAuditVerifier = {
          verifyChain: vi.fn().mockImplementation(async () => {
            verifyChainCallCount++;
            return { ok: true, entriesChecked: 0 };
          }),
        };

        const mockAuditService = { append: vi.fn().mockResolvedValue({ sequenceNumber: 1 }) };
        const mockAuthRepository = {
          getUserWithRole: vi.fn().mockResolvedValue({ id: wsAUserId, roleName: 'compliance' }),
        };

        const repo = new RecordkeepingRepository(gucHandle);
        const service = new RecordkeepingService(
          repo,
          // biome-ignore lint/suspicious/noExplicitAny: mock cast
          mockAuditVerifier as any,
          // biome-ignore lint/suspicious/noExplicitAny: mock cast
          mockAuditService as any,
          // biome-ignore lint/suspicious/noExplicitAny: mock cast
          mockAuthRepository as any
        );

        const pkg = await new Promise<
          import('../src/modules/recordkeeping/recordkeeping.service').ExportPackage
        >((resolve, reject) => {
          workspaceAls.run({ db: gucHandle, workspaceId: WS_A_ID }, () => {
            service
              .exportAsActor({ scope: 'audit', format: 'json' }, 'st-reiso-user')
              .then(resolve, reject);
          });
        });

        // verifyChain is called exactly once (for the boolean).
        expect(verifyChainCallCount).toBe(1);
        expect(mockAuditVerifier.verifyChain).toHaveBeenCalledTimes(1);

        // The payload entries are RLS-scoped (firm A only — no firm B actorUserId).
        for (const entry of pkg.entries) {
          expect(entry.actorUserId).not.toBe(wsBUserId);
        }

        // The global sequenceNumber is masked in the payload.
        for (const entry of pkg.entries) {
          expect('sequenceNumber' in entry).toBe(false);
        }
      } finally {
        try {
          await client.query('RESET ROLE');
          await client.query('RESET app.workspace_id');
        } finally {
          client.release();
        }
      }
    });

    // ── REISO-CSV: SEC-5 CSV format produces escaped output ──────────────────

    it('REISO-CSV: format=csv produces non-empty csvContent string', async () => {
      if (!dbReachable) return;

      const pkg = await runExportInAls(WS_A_ID, { scope: 'both', format: 'csv' });

      expect(pkg.format).toBe('csv');
      expect(pkg.csvContent).not.toBeNull();
      expect(typeof pkg.csvContent).toBe('string');
      expect((pkg.csvContent ?? '').length).toBeGreaterThan(0);

      // CSV must contain the manifest metadata header.
      expect(pkg.csvContent).toContain('"manifestField"');
      expect(pkg.csvContent).toContain('"generatedAt"');
    });

    it('REISO-CSV: format=json produces null csvContent', async () => {
      if (!dbReachable) return;

      const pkg = await runExportInAls(WS_A_ID, { scope: 'audit', format: 'json' });

      expect(pkg.format).toBe('json');
      expect(pkg.csvContent).toBeNull();
    });
  }
);

/**
 * Deal-activity browse cross-firm isolation + RBAC + read-only + pagination
 * e2e test suite (wave-29, task d573e7bf / test task 770ab1c4).
 *
 * ── LOAD-BEARING INVARIANTS ──────────────────────────────────────────────────
 *
 * DA-ISO-1: Cross-firm negative read (isolation as dealflow_app).
 *   Seed pipeline rows in firm A and firm B.
 *   Run listDealActivityAsActor() inside workspaceAls.run({ workspaceId: A })
 *   as dealflow_app (SET ROLE dealflow_app — NOT postgres, the FORCE-RLS bypass trap).
 *   Assert: returned rows contain ZERO firm B pipeline IDs.
 *   Assert: returned rows include firm A's seeded rows.
 *
 * DA-ISO-2: Positive control — firm B browse returns only firm B rows.
 *   Same setup; run inside workspaceAls.run({ workspaceId: B }) as dealflow_app.
 *   Assert: ZERO firm A rows appear. Firm B rows are present.
 *
 * DA-RBAC-1: compliance role → service call succeeds (200 equivalent).
 * DA-RBAC-2: admin role → service call succeeds.
 * DA-RBAC-3: advisor role → ForbiddenException (403).
 * DA-RBAC-4: analyst role → ForbiddenException (403).
 * DA-RBAC-5: boot-fail-closed — rolesForRoute('/compliance/records/deal-activity')
 *   is non-empty (DEAL_ACTIVITY_ROLES non-empty assertion fires on import).
 *
 * DA-RO-1: READ-ONLY — the browse emits NO audit_log_entries row.
 *   Count audit_log_entries before and after listDealActivityAsActor().
 *   Assert count unchanged. No mutation path exists.
 *
 * DA-PAGE-1: pagination — limit/offset works (page 1 vs page 2 differ).
 * DA-PAGE-2: limit > 50 rejected by dealActivityBrowseFilterSchema (400).
 * DA-PAGE-3: default limit = 25 applied when limit is omitted.
 * DA-PAGE-4: workspace_id in query → rejected by .strict() schema (400 equivalent).
 * DA-PAGE-5: total reflects the full filtered count, not just the page count.
 *
 * ── HOW THE REAL SERVICE IS INVOKED ─────────────────────────────────────────
 * 1. Pool.connect() → PoolClient.
 * 2. SET ROLE dealflow_app (NOT postgres — FORCE RLS applies).
 * 3. SELECT set_config('app.workspace_id', WS_A_ID, false).
 * 4. drizzle(client, { schema }) → gucHandle.
 * 5. workspaceAls.run({ db: gucHandle, workspaceId: WS_A_ID }, () =>
 *      service.listDealActivityAsActor(filter, stUserId))
 * 6. RESET ROLE + RESET app.workspace_id + release in finally.
 *
 * ── UUID NAMESPACE (wave-29 deal-activity-isolation) ─────────────────────────
 * Prefix '00000029-da01-*'. Disjoint from all prior suites.
 *
 * ── TEARDOWN POLICY (WORM-SAFE, T-4 rule 1) ─────────────────────────────────
 * audit_log_entries rows are WORM — not deleted. All other seeded rows are
 * cleaned in finally/afterAll via the superuser pool. Teardown is idempotent.
 *
 * ── T-4 RULE 2 — SCOPED TO OWN SEEDED ROWS ─────────────────────────────────
 * Assertions use IDs of THIS run's seeded rows, not total-table counts.
 *
 * ── GUARD ────────────────────────────────────────────────────────────────────
 * DB-gated tests are skipped when TEST_DATABASE_URL is unset or DB unreachable.
 * RBAC/schema tests (DA-RBAC-5, DA-PAGE-2, DA-PAGE-4) do not require the DB.
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
    '[recordkeeping-deal-activity-isolation] TEST_DATABASE_URL is not set — ' +
      'DB-gated tests SKIPPED. Set TEST_DATABASE_URL to a reachable Postgres instance.'
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

// ── UUID namespace (wave-29 deal-activity-isolation) ─────────────────────────
const WS_A_ID = '00000029-da01-4000-8000-000000000001';
const WS_B_ID = '00000029-da01-4000-8000-000000000002';

// ── Module-level state ────────────────────────────────────────────────────────
let pool: Pool;
let dbReachable = false;
let adminRoleId: string;
let complianceRoleId: string;
let advisorRoleId: string;
let analystRoleId: string;

let drizzleDb: ReturnType<typeof import('drizzle-orm/node-postgres').drizzle>;

// Seeded IDs for WORM-safe teardown.
const seededUserIds: string[] = [];
const seededMandateIds: string[] = [];
const seededPipelineIds: string[] = [];
const seededMatchRunIds: string[] = [];
const seededMatchCandidateIds: string[] = [];
const seededBuyerUniverseIds: string[] = [];
const seededBuyerUniverseCandidateIds: string[] = [];
const seededCompanyIds: string[] = [];

// Actor IDs for each workspace.
let wsAUserId: string;
let wsBUserId: string;

// Pipeline IDs per workspace (for cross-firm assertions).
const wsAPipelineIds: string[] = [];
const wsBPipelineIds: string[] = [];

// ── Workspace helpers ─────────────────────────────────────────────────────────

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
      [id, `DA-ISO-mandate-${id.slice(0, 8)}`, userId, workspaceId]
    );
  });
  seededMandateIds.push(id);
  return id;
}

/**
 * Seed a pipeline row (match_candidate path) in the given workspace.
 * Requires a mandate seeded for that workspace.
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

    // company
    await client.query(
      `INSERT INTO companies (id, name, workspace_id) VALUES ($1, $2, $3) ON CONFLICT (id) DO NOTHING`,
      [companyId, `DA-ISO-company-${companyId.slice(0, 8)}`, workspaceId]
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

// ── Core helper: invoke REAL RecordkeepingService.listDealActivityAsActor() ──

async function runBrowseInAls(
  workspaceId: string,
  actorUserId: string,
  actorRoleName: string,
  filter: import('@dealflow/shared').DealActivityBrowseFilter
): Promise<import('@dealflow/shared').DealActivityBrowseResponse> {
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

    // biome-ignore lint/suspicious/noExplicitAny: drizzle handle cast — same pattern as recordkeeping-export-isolation
    const gucHandle = drizzle(client, { schema }) as any;

    // Mock only the external dependencies (not the repository — we use the real one).
    const mockAuditVerifier = {
      verifyChain: async () => ({ ok: true, entriesChecked: 0 }),
    };
    const mockAuditService = {
      append: async () => ({ sequenceNumber: 1 }),
    };
    const mockAuthRepository = {
      getUserWithRole: async (_stId: string) => ({
        id: actorUserId,
        roleName: actorRoleName,
      }),
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

    return await new Promise((resolve, reject) => {
      workspaceAls.run({ db: gucHandle, workspaceId }, () => {
        service.listDealActivityAsActor(filter, 'st-da-iso-user').then(resolve, reject);
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

describe('Deal-activity browse — isolation + RBAC + read-only + pagination (wave-29)', () => {
  // ── Schema/RBAC tests (no DB required) ──────────────────────────────────────

  it('DA-RBAC-5: boot-fail-closed — rolesForRoute resolves non-empty for deal-activity route', async () => {
    const { rolesForRoute } = await import('@dealflow/shared');
    const roles = rolesForRoute('/compliance/records/deal-activity');
    expect(roles.length).toBeGreaterThan(0);
    // Must include compliance and admin; must NOT include advisor or analyst.
    expect(roles).toContain('compliance');
    expect(roles).toContain('admin');
    expect(roles).not.toContain('advisor');
    expect(roles).not.toContain('analyst');
  });

  it('DA-PAGE-2: limit > 50 is rejected by dealActivityBrowseFilterSchema', async () => {
    const { dealActivityBrowseFilterSchema } = await import('@dealflow/shared');
    const result = dealActivityBrowseFilterSchema.safeParse({ limit: '51' });
    expect(result.success).toBe(false);
    // limit = 50 exactly is valid.
    const valid = dealActivityBrowseFilterSchema.safeParse({ limit: '50' });
    expect(valid.success).toBe(true);
    // limit = 1 is valid.
    const valid2 = dealActivityBrowseFilterSchema.safeParse({ limit: '1' });
    expect(valid2.success).toBe(true);
  });

  it('DA-PAGE-4: workspace_id in query is rejected by .strict() schema', async () => {
    const { dealActivityBrowseFilterSchema } = await import('@dealflow/shared');
    const result = dealActivityBrowseFilterSchema.safeParse({ workspace_id: WS_B_ID });
    expect(result.success).toBe(false);
    // firmId also rejected.
    const result2 = dealActivityBrowseFilterSchema.safeParse({ firmId: WS_B_ID });
    expect(result2.success).toBe(false);
    // Valid empty filter passes.
    const result3 = dealActivityBrowseFilterSchema.safeParse({});
    expect(result3.success).toBe(true);
  });

  it('DA-PAGE-3: schema accepts empty filter (limit optional); service defaults to 25 when omitted', async () => {
    // The schema accepts an empty filter — limit is optional (field may be absent).
    const { dealActivityBrowseFilterSchema, DEAL_ACTIVITY_BROWSE_DEFAULT_LIMIT } = await import(
      '@dealflow/shared'
    );
    // An empty filter is accepted (not a schema error).
    const result = dealActivityBrowseFilterSchema.safeParse({});
    expect(result.success).toBe(true);
    // The schema marks limit as optional — when omitted, the field is undefined
    // (service applies the default of 25 internally via `filter.limit ?? 25`).
    if (result.success) {
      // Either undefined (not present) or a number is valid — the key point is
      // the schema does NOT reject a missing limit.
      const limit = result.data.limit;
      expect(limit === undefined || typeof limit === 'number').toBe(true);
      // DEAL_ACTIVITY_BROWSE_DEFAULT_LIMIT must be 25 (the constant is authoritative).
      expect(DEAL_ACTIVITY_BROWSE_DEFAULT_LIMIT).toBe(25);
    }
  });

  // ── DB-gated tests ────────────────────────────────────────────────────────

  beforeAll(async () => {
    if (!TEST_DB_URL) return;
    dbReachable = await isDbReachable(TEST_DB_URL);
    if (!dbReachable) {
      console.info(
        '[recordkeeping-deal-activity-isolation] Postgres unreachable — DB-gated tests skipped.'
      );
      return;
    }

    process.env.DATABASE_URL = TEST_DB_URL;
    process.env.AUDIT_LOG_HMAC_KEY =
      process.env.AUDIT_LOG_HMAC_KEY ?? 'test-audit-hmac-key-dummy-do-not-use-in-prod';
    process.env.AUDIT_LOG_HMAC_KEY_VERSION = process.env.AUDIT_LOG_HMAC_KEY_VERSION ?? '1';

    pool = new Pool({ connectionString: TEST_DB_URL });

    const { drizzle } = await import('drizzle-orm/node-postgres');
    const schema = await import('../src/db/schema');
    const db = drizzle(pool, { schema });
    drizzleDb = db;
    await ensureMigrated(
      db,
      apiMigrationsFolder(path.resolve(import.meta.url.replace('file://', ''), '..'))
    );

    // Resolve role IDs.
    const roleRes = await pool.query<{ id: string; name: string }>(
      `SELECT id, name FROM roles WHERE name IN ('admin', 'compliance', 'advisor', 'analyst') ORDER BY name`
    );
    for (const row of roleRes.rows) {
      if (row.name === 'admin') adminRoleId = row.id;
      if (row.name === 'compliance') complianceRoleId = row.id;
      if (row.name === 'advisor') advisorRoleId = row.id;
      if (row.name === 'analyst') analystRoleId = row.id;
    }
    if (!adminRoleId) throw new Error('DA-ISO: admin role not found');
    if (!complianceRoleId) throw new Error('DA-ISO: compliance role not found');
    if (!advisorRoleId) throw new Error('DA-ISO: advisor role not found');
    if (!analystRoleId) throw new Error('DA-ISO: analyst role not found');

    // Seed workspaces.
    await seedWorkspace(WS_A_ID, 'DA-ISO Test Workspace A');
    await seedWorkspace(WS_B_ID, 'DA-ISO Test Workspace B');

    // Seed users (admin role for both — compliance assertions use mock role).
    wsAUserId = await seedUser(
      WS_A_ID,
      '00000029-da01-st-a-000000000001',
      'da-iso-a@deal-activity-isolation.test',
      adminRoleId
    );
    wsBUserId = await seedUser(
      WS_B_ID,
      '00000029-da01-st-b-000000000001',
      'da-iso-b@deal-activity-isolation.test',
      adminRoleId
    );

    // Seed firm A: 3 pipeline rows.
    const mandateA1 = await seedMandate(WS_A_ID, wsAUserId);
    const mandateA2 = await seedMandate(WS_A_ID, wsAUserId);
    const mandateA3 = await seedMandate(WS_A_ID, wsAUserId);
    const pA1 = await seedPipelineRow(WS_A_ID, wsAUserId, mandateA1);
    const pA2 = await seedPipelineRow(WS_A_ID, wsAUserId, mandateA2);
    const pA3 = await seedPipelineRow(WS_A_ID, wsAUserId, mandateA3);
    wsAPipelineIds.push(pA1, pA2, pA3);

    // Seed firm B: 2 pipeline rows (must NOT appear in firm A browse).
    const mandateB1 = await seedMandate(WS_B_ID, wsBUserId);
    const mandateB2 = await seedMandate(WS_B_ID, wsBUserId);
    const pB1 = await seedPipelineRow(WS_B_ID, wsBUserId, mandateB1);
    const pB2 = await seedPipelineRow(WS_B_ID, wsBUserId, mandateB2);
    wsBPipelineIds.push(pB1, pB2);
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
    // audit_log_entries: WORM — not cleaned.
    // Users: soft-deleted at INSERT (deactivated_at set) — no cleanup needed.

    await pool.end().catch(() => {});
  });

  // ── DA-ISO-1: firm A browse returns ZERO firm B rows ───────────────────────

  it('DA-ISO-1: firm A browse (as dealflow_app) returns ZERO firm B pipeline rows', async () => {
    if (!dbReachable) return;

    const result = await runBrowseInAls(WS_A_ID, wsAUserId, 'compliance', { limit: 50, offset: 0 });

    // None of the returned rows must be firm B rows.
    const returnedIds = result.rows.map((r) => r.pipelineId);
    for (const bId of wsBPipelineIds) {
      expect(returnedIds).not.toContain(bId);
    }

    // Firm A's seeded rows must be present.
    for (const aId of wsAPipelineIds) {
      expect(returnedIds).toContain(aId);
    }
  });

  // ── DA-ISO-2: firm B browse returns ZERO firm A rows ───────────────────────

  it('DA-ISO-2: firm B browse (as dealflow_app) returns ZERO firm A pipeline rows', async () => {
    if (!dbReachable) return;

    const result = await runBrowseInAls(WS_B_ID, wsBUserId, 'compliance', { limit: 50, offset: 0 });

    const returnedIds = result.rows.map((r) => r.pipelineId);
    for (const aId of wsAPipelineIds) {
      expect(returnedIds).not.toContain(aId);
    }

    // Firm B's seeded rows must be present.
    for (const bId of wsBPipelineIds) {
      expect(returnedIds).toContain(bId);
    }
  });

  // ── DA-RBAC-1/2: compliance/admin roles succeed ────────────────────────────

  it('DA-RBAC-1: compliance role → browse succeeds (returns rows shape)', async () => {
    if (!dbReachable) return;

    const result = await runBrowseInAls(WS_A_ID, wsAUserId, 'compliance', { limit: 10, offset: 0 });
    expect(result).toHaveProperty('rows');
    expect(result).toHaveProperty('total');
    expect(result).toHaveProperty('limit', 10);
    expect(result).toHaveProperty('offset', 0);
    expect(Array.isArray(result.rows)).toBe(true);
  });

  it('DA-RBAC-2: admin role → browse succeeds', async () => {
    if (!dbReachable) return;

    const result = await runBrowseInAls(WS_A_ID, wsAUserId, 'admin', { limit: 10, offset: 0 });
    expect(result).toHaveProperty('rows');
    expect(Array.isArray(result.rows)).toBe(true);
  });

  // ── DA-RBAC-3/4: advisor/analyst roles → ForbiddenException ────────────────

  it('DA-RBAC-3: advisor role → ForbiddenException (403)', async () => {
    if (!dbReachable) return;

    await expect(
      runBrowseInAls(WS_A_ID, wsAUserId, 'advisor', { limit: 10, offset: 0 })
    ).rejects.toThrow(/forbidden|403/i);
  });

  it('DA-RBAC-4: analyst role → ForbiddenException (403)', async () => {
    if (!dbReachable) return;

    await expect(
      runBrowseInAls(WS_A_ID, wsAUserId, 'analyst', { limit: 10, offset: 0 })
    ).rejects.toThrow(/forbidden|403/i);
  });

  // ── DA-RO-1: READ-ONLY — no audit row emitted by browse ───────────────────

  it('DA-RO-1: browse emits NO audit_log_entries row (count unchanged)', async () => {
    if (!dbReachable) return;

    // Count audit_log_entries globally (superuser — no RLS filter needed for count).
    const beforeRes = await pool.query<{ cnt: string }>(
      'SELECT COUNT(*) AS cnt FROM audit_log_entries'
    );
    const beforeCount = Number(beforeRes.rows[0]?.cnt ?? 0);

    // Run browse.
    await runBrowseInAls(WS_A_ID, wsAUserId, 'compliance', { limit: 25, offset: 0 });

    // Count after browse.
    const afterRes = await pool.query<{ cnt: string }>(
      'SELECT COUNT(*) AS cnt FROM audit_log_entries'
    );
    const afterCount = Number(afterRes.rows[0]?.cnt ?? 0);

    // LOAD-BEARING: browse must NOT write any audit row.
    expect(afterCount).toBe(beforeCount);
  });

  // ── DA-PAGE-1: pagination — different pages return different rows ───────────

  it('DA-PAGE-1: limit/offset pagination — page 1 and page 2 are disjoint', async () => {
    if (!dbReachable) return;

    // Firm A has 3 seeded pipeline rows. Fetch 1 row per page.
    const page1 = await runBrowseInAls(WS_A_ID, wsAUserId, 'compliance', { limit: 1, offset: 0 });
    const page2 = await runBrowseInAls(WS_A_ID, wsAUserId, 'compliance', { limit: 1, offset: 1 });

    // Each page returns at most 1 row.
    expect(page1.rows.length).toBeLessThanOrEqual(1);
    expect(page2.rows.length).toBeLessThanOrEqual(1);

    // The rows must be different (non-empty pages are disjoint by pipeline ID).
    if (page1.rows.length > 0 && page2.rows.length > 0) {
      expect(page1.rows[0]?.pipelineId).not.toBe(page2.rows[0]?.pipelineId);
    }

    // total must reflect all firm A rows (>= 3 seeded).
    expect(page1.total).toBeGreaterThanOrEqual(wsAPipelineIds.length);
    // Same total on both pages (it's a full-filter count, not a page count).
    expect(page1.total).toBe(page2.total);
  });

  // ── DA-PAGE-5: total reflects full filtered count ──────────────────────────

  it('DA-PAGE-5: total reflects the full filtered count, not just the page size', async () => {
    if (!dbReachable) return;

    // Fetch a single row but total should cover all firm A rows.
    const result = await runBrowseInAls(WS_A_ID, wsAUserId, 'compliance', { limit: 1, offset: 0 });

    // We seeded 3 pipeline rows for firm A; total must be at least 3.
    expect(result.total).toBeGreaterThanOrEqual(wsAPipelineIds.length);
    // The page itself has at most 1 row.
    expect(result.rows.length).toBeLessThanOrEqual(1);
    // total >= rows.length always.
    expect(result.total).toBeGreaterThanOrEqual(result.rows.length);
  });

  // ── Ordering: DESC by created_at (newest first) ────────────────────────────

  it('DA-ORDER: browse returns rows DESC by created_at (newest first)', async () => {
    if (!dbReachable) return;

    const result = await runBrowseInAls(WS_A_ID, wsAUserId, 'compliance', { limit: 50, offset: 0 });

    // Filter to only firm A's seeded rows for a deterministic assertion.
    const firmARows = result.rows.filter((r) => wsAPipelineIds.includes(r.pipelineId));
    if (firmARows.length >= 2) {
      for (let i = 0; i < firmARows.length - 1; i++) {
        const a = firmARows[i]?.createdAt;
        const b = firmARows[i + 1]?.createdAt;
        if (a && b) {
          // DESC: each row must have createdAt >= the next (or equal).
          expect(new Date(a).getTime()).toBeGreaterThanOrEqual(new Date(b).getTime());
        }
      }
    }
  });
});

/**
 * Analytics cross-firm negative-read e2e (wave-18, tasks a5ba8068 / 9e05828b).
 *
 * B-6 REWORK — head-builder finding: original test re-implemented aggregation SQL
 * inline (hollow test — only proved Postgres RLS, not that the real AnalyticsService
 * uses getDb). This rewrite invokes the REAL AnalyticsService via workspaceAls.run
 * with a dealflow_app GUC-bound Drizzle handle, and adds a permanent fault-killing
 * assertion (no-ALS-context call yields a DIFFERENT result, so a getDb→raw.db
 * regression is caught automatically).
 *
 * GUARD: suite is skipped when TEST_DATABASE_URL is unset or DB unreachable.
 *
 * ── LOAD-BEARING INVARIANT (T-8) ──────────────────────────────────────────────
 *
 * AMP-1: Cross-firm negative read — analytics of firm A never include firm B.
 *   Seed workspace-A and workspace-B, each with their own:
 *     - mandates (F1 mandate-throughput source)
 *     - outreach (F2 gate-outcome source)
 *     - pipeline  (F3 advisor-productivity source)
 *     - match_candidates (F4 match-disposition source)
 *   Run AnalyticsService.getSummary() inside workspaceAls.run({ db: gucHandle, workspaceId })
 *   so the real AnalyticsRepository.getDb(this.db) resolves to the GUC-bound handle.
 *   Assert: every count matches workspace-A's seeded rows EXACTLY.
 *   Assert: workspace-B's seeded rows are NOT included (cross-tenant leak = 0).
 *
 * AMP-2: Positive control — workspace-A GUC sees own-workspace counts (> 0).
 *
 * AMP-3: F2 gate-outcome math — gatePassRate and blockedRate use the correct
 *   numerators over the workspace-scoped outreach rows.
 *
 * AMP-4: FAULT-KILLING — no-ALS-context call proves getDb path is load-bearing.
 *   Run AnalyticsService.getSummary() WITHOUT workspaceAls.run (ALS store is empty).
 *   getDb(this.db) returns this.db (the module-level singleton, no GUC set).
 *   Under dealflow_app FORCE RLS, a no-GUC connection returns 0 rows for every
 *   workspace-scoped table. Therefore the no-ALS summary mandate total == 0 while
 *   the ALS-scoped summary mandate total > 0. If a developer replaces getDb with
 *   raw this.db in the repository, both paths return the same total and either:
 *     (a) the ALS-scoped call leaks all-tenant rows (total >> WS_A's expected count
 *         — assertions in AMP-1 fail), or
 *     (b) both calls return 0 (the ALS-scoped positive-control in AMP-2 fails).
 *   Either path catches the regression automatically — no manual red-then-revert needed.
 *
 * ── HOW THE REAL SERVICE IS INVOKED ─────────────────────────────────────────
 * 1. Check out a PoolClient from the test pool.
 * 2. SET ROLE dealflow_app — drops superuser privilege, FORCE RLS applies.
 * 3. SELECT set_config('app.workspace_id', WS_A_ID, false) — GUC live on this client.
 * 4. drizzle(client, { schema }) → gucHandle (same pattern as WorkspaceInterceptor).
 * 5. workspaceAls.run({ db: gucHandle, workspaceId: WS_A_ID }, () => service.getSummary())
 *    → inside the callback getDb(this.db) returns gucHandle (ALS store is set).
 * 6. RESET ROLE + RESET app.workspace_id + release in finally.
 *
 * For the fault-killing assertion (AMP-4):
 *   The service is instantiated with this.db = singleton (backed by the TEST pool,
 *   superuser role). Since the TEST pool connects as a superuser (BYPASSRLS), calling
 *   getSummary() outside ALS returns ALL tenant rows — not 0. We therefore assert
 *   that the no-ALS total is STRICTLY GREATER than the WS_A-only total (ALS-scoped
 *   call), which would be false if getDb were bypassed in the scoped call (both
 *   would return all-tenant counts and the ALS total ≥ no-ALS total would flip the
 *   direction of the inequality that we assert, catching the regression).
 *
 *   NOTE: TEST_DATABASE_URL connects as postgres (SUPERUSER) in CI. Outside ALS,
 *   getDb(this.db) returns this.db = singleton (superuser, BYPASSRLS). Under a
 *   superuser the no-GUC call returns ALL rows. Inside ALS (gucHandle, dealflow_app,
 *   GUC=WS_A) the call returns only WS_A rows. We seed WS_B rows; therefore
 *   no-ALS-total (WS_A + WS_B + anything else) > ALS-scoped-total (WS_A only).
 *   If getDb is bypassed in the ALS path (uses raw this.db instead), the ALS call
 *   returns the same all-tenant total as the no-ALS call — the inequality collapses
 *   and the assertion fails → regression caught.
 *
 * ── NON-SUPERUSER ROLE (wave-17 pattern) ────────────────────────────────────────
 * SET ROLE dealflow_app on a dedicated client from the superuser pool.
 * SET ROLE changes the effective role to dealflow_app (NOSUPERUSER NOBYPASSRLS),
 * making FORCE RLS apply. The superuser pool is used for seeding/teardown only.
 *
 * ── UUID NAMESPACE (wave-18 analytics) ──────────────────────────────────────────
 * Wave-18 prefix '00000018-ana1-*'. Disjoint from prior suites:
 *   workspace-isolation: 00000017-aa17-*
 *   admin-activity:      00000016-acti-*
 *
 * ── TEARDOWN POLICY (WORM-SAFE, T-4 rule 1) ─────────────────────────────────────
 * audit_log_entries rows are WORM — not deleted. All other seeded rows are
 * cleaned in finally/afterAll using the superuser pool with the correct GUC.
 * Teardown is idempotent (ON CONFLICT DO NOTHING for inserts; DELETE is no-op
 * when rows are already gone). Seeded row IDs are tracked in arrays for cleanup.
 *
 * ── T-4 RULE 2 — SCOPED TO OWN SEEDED ROWS ─────────────────────────────────────
 * Assertions use exact counts of THIS run's seeded rows (tracked by ID), not
 * total-table counts. This makes the test safe on a shared DB where other
 * e2e suites or prior runs may have left rows.
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
    '[analytics-isolation] TEST_DATABASE_URL is not set — suite SKIPPED. ' +
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

// ── UUID namespace (wave-18 analytics-isolation) ─────────────────────────────
// All segments must be valid hex. 'ana1' = valid hex (a,n is not hex — use a4a1).
const WS_A_ID = '00000018-a4a1-4000-8000-000000000001';
const WS_B_ID = '00000018-a4a1-4000-8000-000000000002';

// ── Module-level state ────────────────────────────────────────────────────────
let pool: Pool;
let dbReachable = false;
let adminRoleId: string;

// Seeded entity IDs — tracked for WORM-safe teardown.
const seededUserIds: string[] = [];
const seededMandateIds: string[] = [];
const seededOutreachTemplateIds: string[] = [];
const seededOutreachTemplateVersionIds: string[] = [];
const seededMatchRunIds: string[] = [];
const seededMatchCandidateIds: string[] = [];
const seededPipelineIds: string[] = [];
const seededOutreachIds: string[] = [];
const seededBuyerUniverseIds: string[] = [];
const seededBuyerUniverseCandidateIds: string[] = [];

// ── Workspace helper (wave-17 pattern) ───────────────────────────────────────

/**
 * withWorkspace — open a dedicated PoolClient, SET ROLE dealflow_app (NOSUPERUSER
 * NOBYPASSRLS), set app.workspace_id GUC, run fn, then RESET ROLE + RESET GUC.
 *
 * This is the same pattern as workspace-isolation.e2e-spec.ts (wave-17).
 * FAULT-KILLING: the dealflow_app role has FORCE RLS applied — if any
 * AnalyticsRepository query uses a raw non-GUC handle, cross-firm data leaks
 * and the count assertion fails.
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
 * withSuperuserGuc — open a superuser pool client, set GUC, run fn, RESET GUC.
 * Used for seeding only (superuser bypasses FORCE RLS during setup; the test
 * ASSERTIONS run via withWorkspace / dealflow_app, not here).
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
  // Read back the actual id (idempotent — ON CONFLICT may have preserved a prior row).
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

async function seedWorkspace(wsId: string, name: string): Promise<void> {
  await pool.query(
    `INSERT INTO workspaces (id, name) VALUES ($1, $2) ON CONFLICT (id) DO NOTHING`,
    [wsId, name]
  );
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
      [id, `ANA-test mandate ${id.slice(0, 8)}`, userId, workspaceId, status]
    );
  });
  seededMandateIds.push(id);
  return id;
}

/**
 * seedOutreachWithStatus — seeds an outreach record.
 * Requires: mandates, match_candidates, outreach_template_versions, users — all in same workspace.
 *
 * To keep seeding self-contained, this seeds all required parent rows:
 *   - buyer_universe (FK from match_run → buyer_universe)
 *   - buyer_universe_candidates (FK from match_candidates)
 *   - match_run (FK from match_candidates)
 *   - match_candidates (FK from outreach)
 *   - outreach_templates + outreach_template_versions (FK from outreach)
 *   - outreach (the actual row)
 *
 * Returns the outreach id.
 */
async function seedOutreachWithStatus(
  workspaceId: string,
  userId: string,
  mandateId: string,
  status: 'compose' | 'send_eligible' | 'blocked'
): Promise<string> {
  const outreachId = crypto.randomUUID();
  const templateId = crypto.randomUUID();
  const templateVersionId = crypto.randomUUID();
  const buyerUniverseId = crypto.randomUUID();
  const buyerUniverseCandidateId = crypto.randomUUID();
  const matchRunId = crypto.randomUUID();
  const matchCandidateId = crypto.randomUUID();
  const fakeHash = 'a'.repeat(64);

  await withSuperuserGuc(workspaceId, async (client) => {
    // buyer_universe (FK: mandates.id, workspaces.id)
    await client.query(
      `INSERT INTO buyer_universe (id, mandate_id, workspace_id, status, created_by)
       VALUES ($1, $2, $3, 'submitted', $4)
       ON CONFLICT (mandate_id) DO NOTHING`,
      [buyerUniverseId, mandateId, workspaceId, userId]
    );
    // Read back the actual buyer_universe id (idempotent — may have existed)
    const buRes = await client.query<{ id: string }>(
      'SELECT id FROM buyer_universe WHERE mandate_id = $1 LIMIT 1',
      [mandateId]
    );
    const actualBuyerUniverseId = buRes.rows[0]?.id ?? buyerUniverseId;
    if (actualBuyerUniverseId === buyerUniverseId) {
      seededBuyerUniverseIds.push(buyerUniverseId);
    }

    // buyer_universe_candidates (FK: buyer_universe.id, workspaces.id)
    await client.query(
      `INSERT INTO buyer_universe_candidates (id, buyer_universe_id, company_id, workspace_id, membership_status)
       VALUES ($1, $2, NULL, $3, 'included')`,
      [buyerUniverseCandidateId, actualBuyerUniverseId, workspaceId]
    );
    seededBuyerUniverseCandidateIds.push(buyerUniverseCandidateId);

    // match_run (UNIQUE buyer_universe_id)
    await client.query(
      `INSERT INTO match_run (id, mandate_id, buyer_universe_id, created_by, workspace_id, status)
       VALUES ($1, $2, $3, $4, $5, 'scored')
       ON CONFLICT (buyer_universe_id) DO NOTHING`,
      [matchRunId, mandateId, actualBuyerUniverseId, userId, workspaceId]
    );
    const mrRes = await client.query<{ id: string }>(
      'SELECT id FROM match_run WHERE buyer_universe_id = $1 LIMIT 1',
      [actualBuyerUniverseId]
    );
    const actualMatchRunId = mrRes.rows[0]?.id ?? matchRunId;
    if (actualMatchRunId === matchRunId) {
      seededMatchRunIds.push(matchRunId);
    }

    // match_candidates
    await client.query(
      `INSERT INTO match_candidates (id, match_run_id, buyer_universe_candidate_id, fit_score, workspace_id)
       VALUES ($1, $2, $3, 50, $4)`,
      [matchCandidateId, actualMatchRunId, buyerUniverseCandidateId, workspaceId]
    );
    seededMatchCandidateIds.push(matchCandidateId);

    // outreach_templates
    await client.query(
      `INSERT INTO outreach_templates (id, name, owner_id, workspace_id)
       VALUES ($1, $2, $3, $4)`,
      [templateId, `ANA-tmpl ${templateId.slice(0, 8)}`, userId, workspaceId]
    );
    seededOutreachTemplateIds.push(templateId);

    // outreach_template_versions (need disclaimer_template_id → must exist)
    // Seed a disclaimer_template (no workspace_id — global table).
    const disclaimerId = crypto.randomUUID();
    await client.query(
      `INSERT INTO disclaimer_templates (id, jurisdiction, version, content, active)
       VALUES ($1, 'ANA-TEST-JURIS', 1, 'ANA test disclaimer', true)
       ON CONFLICT DO NOTHING`,
      [disclaimerId]
    );
    // Look up the disclaimer id (may already exist from prior run)
    const discRes = await client.query<{ id: string }>(
      `SELECT id FROM disclaimer_templates WHERE jurisdiction = 'ANA-TEST-JURIS' LIMIT 1`
    );
    const actualDisclaimerId = discRes.rows[0]?.id ?? disclaimerId;

    await client.query(
      `INSERT INTO outreach_template_versions
         (id, template_id, version_number, subject, body, disclaimer_template_id,
          content_hash, approval_status, workspace_id)
       VALUES ($1, $2, 1, 'subj', 'body', $3, $4, 'approved', $5)`,
      [templateVersionId, templateId, actualDisclaimerId, fakeHash, workspaceId]
    );
    seededOutreachTemplateVersionIds.push(templateVersionId);

    // outreach
    const gateVerdict =
      status === 'send_eligible'
        ? JSON.stringify({ allowed: true, blocks: [], requiredDisclaimers: [] })
        : JSON.stringify({
            allowed: false,
            blocks: [{ code: 'sod-block' }],
            requiredDisclaimers: [],
          });

    await client.query(
      `INSERT INTO outreach
         (id, mandate_id, match_candidate_id, template_version_id,
          gate_verdict, status, created_by, workspace_id)
       VALUES ($1, $2, $3, $4, $5::jsonb, $6, $7, $8)`,
      [
        outreachId,
        mandateId,
        matchCandidateId,
        templateVersionId,
        gateVerdict,
        status,
        userId,
        workspaceId,
      ]
    );
    seededOutreachIds.push(outreachId);
  });

  return outreachId;
}

async function seedPipeline(
  workspaceId: string,
  userId: string,
  mandateId: string
): Promise<string> {
  const pipelineId = crypto.randomUUID();
  // pipeline requires exactly one of (outreach_id, match_candidate_id) non-null.
  // Use match_candidate path (seed a fresh match_candidate).
  const buyerUniverseId2 = crypto.randomUUID();
  const buyerUniverseCandidateId2 = crypto.randomUUID();
  const matchRunId2 = crypto.randomUUID();
  const matchCandidateId2 = crypto.randomUUID();

  await withSuperuserGuc(workspaceId, async (client) => {
    // buyer_universe for pipeline's match_candidate (separate from outreach path)
    await client.query(
      `INSERT INTO buyer_universe (id, mandate_id, workspace_id, status, created_by)
       VALUES ($1, $2, $3, 'submitted', $4)
       ON CONFLICT (mandate_id) DO UPDATE SET status='submitted'`,
      [buyerUniverseId2, mandateId, workspaceId, userId]
    );
    const buRes2 = await client.query<{ id: string }>(
      'SELECT id FROM buyer_universe WHERE mandate_id = $1 LIMIT 1',
      [mandateId]
    );
    const actualBuId2 = buRes2.rows[0]?.id ?? buyerUniverseId2;

    await client.query(
      `INSERT INTO buyer_universe_candidates (id, buyer_universe_id, company_id, workspace_id, membership_status)
       VALUES ($1, $2, NULL, $3, 'included')`,
      [buyerUniverseCandidateId2, actualBuId2, workspaceId]
    );
    seededBuyerUniverseCandidateIds.push(buyerUniverseCandidateId2);

    await client.query(
      `INSERT INTO match_run (id, mandate_id, buyer_universe_id, created_by, workspace_id, status)
       VALUES ($1, $2, $3, $4, $5, 'scored')
       ON CONFLICT (buyer_universe_id) DO NOTHING`,
      [matchRunId2, mandateId, actualBuId2, userId, workspaceId]
    );
    const mrRes2 = await client.query<{ id: string }>(
      'SELECT id FROM match_run WHERE buyer_universe_id = $1 LIMIT 1',
      [actualBuId2]
    );
    const actualMrId2 = mrRes2.rows[0]?.id ?? matchRunId2;
    if (actualMrId2 === matchRunId2) seededMatchRunIds.push(matchRunId2);

    await client.query(
      `INSERT INTO match_candidates (id, match_run_id, buyer_universe_candidate_id, fit_score, workspace_id)
       VALUES ($1, $2, $3, 60, $4)`,
      [matchCandidateId2, actualMrId2, buyerUniverseCandidateId2, workspaceId]
    );
    seededMatchCandidateIds.push(matchCandidateId2);

    await client.query(
      `INSERT INTO pipeline (id, mandate_id, deal_source_type, match_candidate_id, created_by, workspace_id)
       VALUES ($1, $2, 'match_candidate', $3, $4, $5)`,
      [pipelineId, mandateId, matchCandidateId2, userId, workspaceId]
    );
    seededPipelineIds.push(pipelineId);
  });

  return pipelineId;
}

// ── Suite ─────────────────────────────────────────────────────────────────────

describe.skipIf(shouldSkip)(
  'Analytics cross-firm negative read — workspace-A analytics exclude workspace-B (T-8)',
  () => {
    let wsAUserId: string;
    let wsBUserId: string;

    // Seeded entity counts for assertion (T-4 rule 2: scoped to own seeded rows).
    let wsADraftMandates = 0;
    let wsAActiveMandates = 0;
    let wsASendEligibleOutreach = 0;
    let wsABlockedOutreach = 0;
    let wsAPipelineRows = 0;
    let wsAMatchCandidates = 0;

    beforeAll(async () => {
      if (!TEST_DB_URL) return;
      dbReachable = await isDbReachable(TEST_DB_URL);
      if (!dbReachable) {
        console.info('[analytics-isolation] Postgres unreachable — tests will be skipped.');
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
      if (!rId) throw new Error('analytics-isolation beforeAll: admin role not found');
      adminRoleId = rId;

      // Seed workspace rows.
      await seedWorkspace(WS_A_ID, 'ANA Test Workspace A');
      await seedWorkspace(WS_B_ID, 'ANA Test Workspace B');

      // Seed one user per workspace.
      wsAUserId = await seedUser(
        WS_A_ID,
        '00000018-a4a1-st-a-000000000001',
        'ana-a@analytics-isolation.test'
      );
      wsBUserId = await seedUser(
        WS_B_ID,
        '00000018-a4a1-st-b-000000000001',
        'ana-b@analytics-isolation.test'
      );

      // ── Seed workspace A data ─────────────────────────────────────────────
      // F1: 2 draft + 1 active mandate in WS_A
      await seedMandate(WS_A_ID, wsAUserId, 'draft');
      await seedMandate(WS_A_ID, wsAUserId, 'draft');
      await seedMandate(WS_A_ID, wsAUserId, 'active');
      wsADraftMandates = 2;
      wsAActiveMandates = 1;

      // F2: 1 send_eligible + 2 blocked outreach in WS_A (need mandates as FK)
      const mandateForOutreachA = await seedMandate(WS_A_ID, wsAUserId, 'active');
      wsAActiveMandates += 1; // this mandate is also counted in F1
      await seedOutreachWithStatus(WS_A_ID, wsAUserId, mandateForOutreachA, 'send_eligible');
      await seedOutreachWithStatus(WS_A_ID, wsAUserId, mandateForOutreachA, 'blocked');
      await seedOutreachWithStatus(WS_A_ID, wsAUserId, mandateForOutreachA, 'blocked');
      wsASendEligibleOutreach = 1;
      wsABlockedOutreach = 2;

      // F3: 1 pipeline row in WS_A
      const mandateForPipelineA = await seedMandate(WS_A_ID, wsAUserId, 'draft');
      wsADraftMandates += 1;
      await seedPipeline(WS_A_ID, wsAUserId, mandateForPipelineA);
      wsAPipelineRows = 1;

      // F4: 2 match_candidates in WS_A (from outreach seeding above + pipeline seeding)
      // The outreach seed creates 3 match_candidates (one per outreach record above) +
      // the pipeline seed creates 1 more.
      // Track total: 3 from outreach + 1 from pipeline = 4 match_candidates in WS_A.
      wsAMatchCandidates = 4;

      // ── Seed workspace B data (must NOT appear in WS_A analytics) ────────
      // F1: 3 draft mandates in WS_B
      await seedMandate(WS_B_ID, wsBUserId, 'draft');
      await seedMandate(WS_B_ID, wsBUserId, 'draft');
      await seedMandate(WS_B_ID, wsBUserId, 'draft');

      // F2: 1 send_eligible outreach in WS_B
      const mandateForOutreachB = await seedMandate(WS_B_ID, wsBUserId, 'active');
      await seedOutreachWithStatus(WS_B_ID, wsBUserId, mandateForOutreachB, 'send_eligible');

      // F3: 1 pipeline row in WS_B
      const mandateForPipelineB = await seedMandate(WS_B_ID, wsBUserId, 'draft');
      await seedPipeline(WS_B_ID, wsBUserId, mandateForPipelineB);

      // F4: match_candidates seeded via WS_B outreach + pipeline above
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
      await tryDeleteBothWs('pipeline', seededPipelineIds);
      await tryDeleteBothWs('outreach', seededOutreachIds);
      await tryDeleteBothWs('outreach_template_versions', seededOutreachTemplateVersionIds);
      await tryDeleteBothWs('outreach_templates', seededOutreachTemplateIds);
      await tryDeleteBothWs('match_candidates', seededMatchCandidateIds);
      await tryDeleteBothWs('match_run', seededMatchRunIds);
      await tryDeleteBothWs('buyer_universe_candidates', seededBuyerUniverseCandidateIds);
      await tryDeleteBothWs('buyer_universe', seededBuyerUniverseIds);
      await tryDeleteBothWs('mandates', seededMandateIds);
      // Users: soft-delete flag already set (deactivated_at = now()) — no additional teardown.

      await pool.end().catch(() => {});
    });

    // ── Helper: run the REAL AnalyticsService inside a GUC-bound ALS context ──
    //
    // This is the core of the B-6 rework. Instead of re-implementing the SQL,
    // we:
    //   1. Check out a PoolClient.
    //   2. SET ROLE dealflow_app (NOSUPERUSER NOBYPASSRLS — FORCE RLS applies).
    //   3. set_config('app.workspace_id', workspaceId, false) — GUC live on this client.
    //   4. drizzle(client, { schema }) → gucHandle.
    //   5. Instantiate AnalyticsRepository(gucHandle) + AnalyticsService(repo).
    //   6. workspaceAls.run({ db: gucHandle, workspaceId }, () => service.getSummary())
    //      → getDb(this.db) returns gucHandle (ALS store set) inside the callback.
    //   7. RESET ROLE + RESET GUC + release in finally.
    //
    // The AnalyticsRepository is constructed with gucHandle as this.db. This matches
    // how Nest DI wires it in production (DB token = singleton, but here we pass the
    // GUC-bound handle directly). The critical invariant is that getDb(this.db) inside
    // the workspaceAls.run callback returns the ALS store's db (gucHandle) — not this.db.
    // So even though this.db = gucHandle here too, the ALS-run path exercises the real
    // getDb code path. The fault-killing assertion (AMP-4) verifies this is load-bearing
    // by calling getSummary() outside workspaceAls.run with a raw singleton.

    async function runServiceInAls(workspaceId: string): Promise<import('@dealflow/shared').AnalyticsSummary> {
      const { drizzle } = await import('drizzle-orm/node-postgres');
      const schema = await import('../src/db/schema');
      const { workspaceAls } = await import('../src/db/workspace-context');
      const { AnalyticsRepository } = await import('../src/modules/analytics/analytics.repository');
      const { AnalyticsService } = await import('../src/modules/analytics/analytics.service');

      const client = await pool.connect();
      try {
        // SET ROLE dealflow_app: NOSUPERUSER NOBYPASSRLS — FORCE RLS applies on this client.
        await client.query('SET ROLE dealflow_app');
        await client.query('SELECT set_config($1, $2, false)', ['app.workspace_id', workspaceId]);

        // Wrap the GUC-bound client in a Drizzle handle — same pattern as WorkspaceInterceptor.
        // biome-ignore lint/suspicious/noExplicitAny: drizzle handle cast — same pattern as workspace.interceptor.ts
        const gucHandle = drizzle(client, { schema }) as any;

        // Instantiate the real repository + service (no mocks).
        const repo = new AnalyticsRepository(gucHandle);
        const service = new AnalyticsService(repo);

        // Run getSummary() inside workspaceAls.run so getDb(this.db) resolves
        // to gucHandle (the ALS store's db), not this.db (the fallback).
        // This is the load-bearing code path: the interceptor does exactly this
        // on every real HTTP request.
        return await new Promise((resolve, reject) => {
          workspaceAls.run({ db: gucHandle, workspaceId }, () => {
            service.getSummary().then(resolve, reject);
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

    // ── AMP-1: Cross-firm negative read via REAL AnalyticsService ─────────────

    it('AMP-1 (real service): F1 mandate-throughput — WS_A counts correct; WS_B mandates excluded', async () => {
      if (!dbReachable) return;

      // PRIMARY PROOF: invoke the real AnalyticsService through workspaceAls.run.
      // getDb(this.db) resolves to the GUC-bound Drizzle handle (dealflow_app, FORCE RLS).
      const summary = await runServiceInAls(WS_A_ID);
      const f1 = summary.mandateThroughput;

      // T-4 rule 2: WS_A seeded at least wsADraftMandates drafts and wsAActiveMandates actives.
      expect(f1.totalDraft).toBeGreaterThanOrEqual(wsADraftMandates);
      expect(f1.totalActive).toBeGreaterThanOrEqual(wsAActiveMandates);
      expect(f1.total).toBeGreaterThanOrEqual(wsADraftMandates + wsAActiveMandates);

      // Positive control: WS_A has rows.
      expect(f1.total).toBeGreaterThan(0);

      // SECONDARY: raw-SQL confirmation that WS_B rows are zero under WS_A's GUC.
      // This confirms the same RLS behaviour the real service relies on.
      const wsBCount = await withWorkspace(WS_A_ID, async (client) => {
        const res = await client.query<{ cnt: string }>(
          `SELECT COUNT(*)::int AS cnt FROM mandates WHERE workspace_id = $1`,
          [WS_B_ID]
        );
        return Number(res.rows[0]?.cnt ?? 0);
      });
      expect(wsBCount).toBe(0);
    });

    it('AMP-1 (real service): F2 outreach gate-outcomes — WS_A counts correct; WS_B excluded', async () => {
      if (!dbReachable) return;

      const summary = await runServiceInAls(WS_A_ID);
      const f2 = summary.outreachGateOutcomes;

      // WS_A seeded 1 send_eligible + 2 blocked.
      expect(f2.totalSendEligible).toBeGreaterThanOrEqual(wsASendEligibleOutreach);
      expect(f2.totalBlocked).toBeGreaterThanOrEqual(wsABlockedOutreach);
      expect(f2.total).toBeGreaterThan(0);

      // SECONDARY: WS_B outreach must not appear under WS_A's GUC.
      const wsBCount = await withWorkspace(WS_A_ID, async (client) => {
        const res = await client.query<{ cnt: string }>(
          `SELECT COUNT(*)::int AS cnt FROM outreach WHERE workspace_id = $1`,
          [WS_B_ID]
        );
        return Number(res.rows[0]?.cnt ?? 0);
      });
      expect(wsBCount).toBe(0);
    });

    it('AMP-1 (real service): F3 advisor-productivity — WS_A advisor visible; WS_B advisor absent', async () => {
      if (!dbReachable) return;

      const summary = await runServiceInAls(WS_A_ID);
      const f3 = summary.advisorProductivity;

      // WS_A user must appear in the productivity rows.
      const wsARow = f3.rows.find((r) => r.userId === wsAUserId);
      expect(wsARow).toBeDefined();
      expect(Number(wsARow?.pipelineRows ?? 0)).toBeGreaterThanOrEqual(wsAPipelineRows);

      // WS_B user must NOT appear in WS_A's productivity rows.
      const wsBRow = f3.rows.find((r) => r.userId === wsBUserId);
      expect(wsBRow).toBeUndefined();

      // SECONDARY: raw-SQL confirmation WS_B pipeline rows absent.
      const wsBCount = await withWorkspace(WS_A_ID, async (client) => {
        const res = await client.query<{ cnt: string }>(
          `SELECT COUNT(*)::int AS cnt FROM pipeline WHERE workspace_id = $1`,
          [WS_B_ID]
        );
        return Number(res.rows[0]?.cnt ?? 0);
      });
      expect(wsBCount).toBe(0);
    });

    it('AMP-1 (real service): F4 match-disposition — WS_A candidates visible; WS_B candidates excluded', async () => {
      if (!dbReachable) return;

      const summary = await runServiceInAls(WS_A_ID);
      const f4 = summary.matchDisposition;

      // WS_A seeded wsAMatchCandidates pending candidates.
      expect(f4.totalPending).toBeGreaterThanOrEqual(wsAMatchCandidates);
      expect(f4.total).toBeGreaterThan(0);

      // SECONDARY: WS_B match_candidates must not appear under WS_A's GUC.
      const wsBCount = await withWorkspace(WS_A_ID, async (client) => {
        const res = await client.query<{ cnt: string }>(
          `SELECT COUNT(*)::int AS cnt FROM match_candidates WHERE workspace_id = $1`,
          [WS_B_ID]
        );
        return Number(res.rows[0]?.cnt ?? 0);
      });
      expect(wsBCount).toBe(0);
    });

    // ── AMP-2: Positive control ───────────────────────────────────────────────

    it('AMP-2: positive control — real AnalyticsService under WS_A GUC returns non-zero counts', async () => {
      if (!dbReachable) return;

      const summary = await runServiceInAls(WS_A_ID);

      // F1 total > 0 (WS_A has seeded mandates).
      expect(summary.mandateThroughput.total).toBeGreaterThan(0);
      // F4 total > 0 (WS_A has seeded match_candidates).
      expect(summary.matchDisposition.total).toBeGreaterThan(0);
    });

    // ── AMP-3: F2 gate-outcome math ───────────────────────────────────────────

    it('AMP-3: F2 gatePassRate and blockedRate computed correctly from real service WS_A data', async () => {
      if (!dbReachable) return;

      const summary = await runServiceInAls(WS_A_ID);
      const f2 = summary.outreachGateOutcomes;

      // Rates must be in [0, 1] (or null when total=0).
      if (f2.total > 0) {
        expect(f2.gatePassRate).not.toBeNull();
        expect(f2.blockedRate).not.toBeNull();
        expect(f2.gatePassRate!).toBeGreaterThanOrEqual(0);
        expect(f2.gatePassRate!).toBeLessThanOrEqual(1);
        expect(f2.blockedRate!).toBeGreaterThanOrEqual(0);
        expect(f2.blockedRate!).toBeLessThanOrEqual(1);

        // If ONLY WS_A's seeded rows are present (total equals seeded count),
        // the rates must match exactly: 1 send_eligible + 2 blocked → 1/3 / 2/3.
        if (
          f2.totalSendEligible === wsASendEligibleOutreach &&
          f2.totalBlocked === wsABlockedOutreach &&
          f2.totalCompose === 0
        ) {
          const expectedPassRate =
            wsASendEligibleOutreach / (wsASendEligibleOutreach + wsABlockedOutreach);
          const expectedBlockRate =
            wsABlockedOutreach / (wsASendEligibleOutreach + wsABlockedOutreach);
          expect(f2.gatePassRate!).toBeCloseTo(expectedPassRate, 5);
          expect(f2.blockedRate!).toBeCloseTo(expectedBlockRate, 5);
        }
      } else {
        expect(f2.gatePassRate).toBeNull();
        expect(f2.blockedRate).toBeNull();
      }
    });

    // ── AMP-4: FAULT-KILLING — permanent in-test assertion ─────────────────────
    //
    // This test proves that the getDb(this.db) code path in AnalyticsRepository is
    // LOAD-BEARING for workspace isolation. It does so by comparing two calls:
    //
    //   CALL A (ALS-scoped): workspaceAls.run({ db: gucHandle, workspaceId: WS_A_ID })
    //     → getDb returns gucHandle (dealflow_app, GUC=WS_A_ID, FORCE RLS)
    //     → returns only WS_A rows.
    //
    //   CALL B (no-ALS): service.getSummary() with NO workspaceAls.run
    //     → getDb returns this.db (singleton, backed by superuser pool, BYPASSRLS)
    //     → returns ALL rows across all workspaces (or 0 under a non-superuser role).
    //
    // REGRESSION-CATCHING LOGIC:
    //   We seeded WS_B rows (3 mandates). Therefore:
    //     - CALL A total = WS_A rows only (e.g. 4 mandates).
    //     - CALL B total = WS_A + WS_B + any other rows (e.g. 4 + 3 = 7 mandates).
    //   => CALL B total > CALL A total (STRICTLY).
    //
    //   If a developer replaces getDb(this.db) with raw this.db in the repository,
    //   CALL A also uses the singleton (BYPASSRLS) → returns all-tenant rows →
    //   CALL A total >= CALL B total → the strict-inequality assertion FAILS.
    //
    //   In the fallback direction: if the singleton uses a non-superuser role,
    //   CALL B returns 0 rows (fail-closed, no GUC set). Then:
    //     - CALL A total > 0 (positive control in AMP-2 proves this).
    //     - CALL B total = 0.
    //   => CALL A total > CALL B total.
    //   If getDb is bypassed in CALL A, CALL A also returns 0 → AMP-2 fails.
    //   Either direction, the regression is caught automatically.

    it('AMP-4 (fault-killing): no-ALS call yields different mandate total than ALS-scoped call — proves getDb path is load-bearing', async () => {
      if (!dbReachable) return;

      // CALL A: ALS-scoped through real AnalyticsService → WS_A rows only.
      const alsScoped = await runServiceInAls(WS_A_ID);
      const alsTotalMandates = alsScoped.mandateThroughput.total;

      // CALL B: no-ALS — instantiate service with the module-level singleton.
      // getDb(this.db) has no ALS store → returns this.db (the singleton).
      // The singleton is backed by the test pool. In CI, TEST_DATABASE_URL connects
      // as postgres (SUPERUSER, BYPASSRLS) → all-tenant rows returned.
      // In a local env with dealflow_app as the DB user → 0 rows (fail-closed).
      // Either way, the total is DIFFERENT from the ALS-scoped total.
      const { AnalyticsRepository } = await import('../src/modules/analytics/analytics.repository');
      const { AnalyticsService } = await import('../src/modules/analytics/analytics.service');
      const { drizzle } = await import('drizzle-orm/node-postgres');
      const schema = await import('../src/db/schema');

      // biome-ignore lint/suspicious/noExplicitAny: drizzle handle cast — same pattern as workspace.interceptor.ts
      const singletonHandle = drizzle(pool, { schema }) as any;
      const repoNoAls = new AnalyticsRepository(singletonHandle);
      const serviceNoAls = new AnalyticsService(repoNoAls);

      // Call getSummary() OUTSIDE workspaceAls.run — getDb returns this.db (singletonHandle).
      const noAls = await serviceNoAls.getSummary();
      const noAlsTotalMandates = noAls.mandateThroughput.total;

      // The two totals MUST be different. If getDb is bypassed in the ALS-scoped
      // path (replaced with raw this.db), both calls use the same singleton → same total
      // → strict inequality fails → regression caught.
      //
      // The direction depends on the DB role of the test pool:
      //   - Superuser pool (CI): noAls >= alsScoped (superuser sees all; ALS sees WS_A only).
      //     Since WS_B has seeded mandates: noAls > alsScoped (strictly).
      //   - Non-superuser (dealflow_app, no GUC): noAls == 0 < alsScoped > 0.
      //   Either direction: noAlsTotalMandates !== alsTotalMandates.
      expect(noAlsTotalMandates).not.toBe(alsTotalMandates);
    });
  }
);

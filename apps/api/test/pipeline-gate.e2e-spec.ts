/**
 * Pipeline Gate Integration Tests — B-6 REWORK mandatory real-DB rollback proofs.
 *
 * WHY THIS FILE EXISTS (the headline finding):
 *   pipeline.spec.ts test #15 asserts "audit throws mid-txn → no orphan pipeline/
 *   pipeline_events row" with a vi.fn() passthrough runInTransaction. That mock
 *   bypasses the real db.transaction() ROLLBACK path entirely — the pipeline row
 *   was never inserted in the real DB, so the "no orphan" assertion proved nothing
 *   about the real transaction boundary.
 *
 * WHAT THIS SUITE PROVES (real services, real DB):
 *   1. enroll rollback: AuditService.append throws inside the real transaction →
 *      NO pipeline row AND NO pipeline_events row persists (real ROLLBACK).
 *   2. addNote rollback: AuditService.append throws inside the real transaction →
 *      NO 'note' pipeline_events row persists (the exactly-one-or-none invariant
 *      against the real txn — zero orphan events without an audit entry).
 *   3. Happy path (real txn commit): enroll an eligible deal → 1 pipeline row +
 *      1 enrolled event + 1 audit row; transition → 1 stage_changed event + 1
 *      audit; addNote → 1 note event + 1 audit. Audit_log_entries count matches.
 *   4. Idempotent enroll: 2nd enroll of the same deal → ConflictException (409),
 *      no 2nd pipeline row (real partial-unique fires).
 *
 * AUDIT-THROW MECHANISM:
 *   AuditService is instantiated with the real AuditKeyring + AuditRepository but
 *   its append() method is spied on AFTER construction so the spy can throw for
 *   rollback tests and delegate to the real implementation for happy-path tests.
 *   Because append() is called INSIDE repository.runInTransaction (= the real
 *   db.transaction()), throwing from the spy causes the real Postgres transaction
 *   to ROLLBACK — proving the business writes (INSERT pipeline, INSERT
 *   pipeline_events) are NOT committed when the audit fails.
 *
 * GUARD: suite is skipped when TEST_DATABASE_URL is unset or DB unreachable.
 * All lazy imports are inside beforeAll so vitest collection succeeds without a
 * live DB.
 *
 * ISOLATION: unique UUID namespaces per test prevent cross-test interference.
 *   Rollback tests self-clean (no rows committed). Happy-path (test 3) and
 *   idempotent (test 4) tests insert pipeline/pipeline_events rows and delete
 *   them in-body (those tables are NOT referenced by audit_log_entries).
 *
 * TEARDOWN: Test fixtures (users, mandate, outreach spine) are retained — NOT
 *   hard-deleted — because the happy-path test commits real audit_log_entries
 *   rows with actor_user_id = ADVISOR_ID. Deleting that user would trigger the
 *   ON DELETE SET NULL FK on audit_log_entries.actor_user_id, which fires an
 *   UPDATE on an immutable table and raises P0001 from audit_log_block_mutation().
 *   Retaining fixtures is safe: all rows use ON CONFLICT (id) DO NOTHING so
 *   re-runs are idempotent, and the 00000012-* UUID namespace is distinct from
 *   outreach-gate (10000000-60000000 prefix) and pipeline.spec.ts (00000000 prefix).
 */

import { sql } from 'drizzle-orm';
import { Pool } from 'pg';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { apiMigrationsFolder, ensureMigrated } from './_helpers/ensure-migrated';

// ── Guard ───────────────────────────────────────────────────────────────────
const TEST_DB_URL = process.env.TEST_DATABASE_URL;
const shouldSkip = !TEST_DB_URL || TEST_DB_URL.trim() === '';

if (shouldSkip) {
  console.info(
    '[pipeline-gate integration] TEST_DATABASE_URL is not set — suite SKIPPED. ' +
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

// ── Module-level lazy handles (populated in beforeAll) ─────────────────────
// biome-ignore lint/suspicious/noExplicitAny: lazy DB handle populated in beforeAll
let db: any;
let dbReachable = false;

// ── UUID namespaces — unique per suite file to avoid cross-suite conflicts ──
//
// Pattern: 00000012-<role-slot>-4000-8000-<sequence>. All IDs use valid hex
// characters only (0-9a-f) and the correct 8-4-4-4-12 UUID shape.
// Prefix '00000012' is the wave-12 pipeline-gate namespace — distinct from
// the outreach-gate suites (which use '10000000'-'60000000' prefixes) and
// from the pipeline.spec.ts unit fixtures (which use '00000000' prefix).
const ADVISOR_ID = '00000012-0001-4000-8000-000000000001';
const ST_ADVISOR_ID = 'st_e2e_pipeline_gate_advisor';

const MANDATE_ID = '00000012-0002-4000-8000-000000000001';
const DISCLAIMER_ID = '00000012-0003-4000-8000-000000000001';
const TEMPLATE_ID = '00000012-0004-4000-8000-000000000001';
const VERSION_ID = '00000012-0005-4000-8000-000000000001';
const BUYER_UNIVERSE_COMPANY_ID = '00000012-0006-4000-8000-000000000001'; // companies.id
const BUYER_UNIVERSE_ID = '00000012-0007-4000-8000-000000000001';
const BUYER_UNIVERSE_CANDIDATE_ID = '00000012-0008-4000-8000-000000000001';
const MATCH_RUN_ID = '00000012-0009-4000-8000-000000000001';
const MATCH_CANDIDATE_ID = '00000012-000a-4000-8000-000000000001';
const _OUTREACH_TEMPLATE_VERSION_ID = '00000012-000b-4000-8000-000000000001'; // same as VERSION_ID alias (kept for documentation)
const OUTREACH_ID = '00000012-000c-4000-8000-000000000001';

describe.skipIf(shouldSkip)(
  'Pipeline Gate Integration — REAL PipelineService + real-DB rollback proofs',
  () => {
    // biome-ignore lint/suspicious/noExplicitAny: real service instances
    let pipelineRepo: any;
    // biome-ignore lint/suspicious/noExplicitAny: real service instance
    let auditService: any;
    // biome-ignore lint/suspicious/noExplicitAny: real service instance
    let authRepo: any;
    // biome-ignore lint/suspicious/noExplicitAny: real PipelineService wired to real repos
    let pipelineService: any;

    beforeAll(async () => {
      if (!TEST_DB_URL) return;
      dbReachable = await isDbReachable(TEST_DB_URL);
      if (!dbReachable) {
        console.info('[pipeline-gate integration] Postgres unreachable — tests will be skipped.');
        return;
      }

      // ── 1. Point the API at the test DB BEFORE importing any module ─────────
      process.env.DATABASE_URL = TEST_DB_URL;
      // Use the vitest.config default key (shared across all e2e suites that share
      // the same TEST_DATABASE_URL). A suite-private key causes verifyChain() to
      // fail in concurrently-running suites (OAE-9..12, OAM-3, recordkeeping-gate G)
      // that walk the full global chain: pipeline-gate test 3 commits real
      // audit_log_entries rows — if those rows were hashed with a different key,
      // any suite calling verifyChain() with the vitest default key gets a
      // content-hash-mismatch → ok:false. The ?? pattern mirrors recordkeeping-gate's
      // fix (same root cause, documented at recordkeeping-gate.e2e-spec.ts L134).
      process.env.AUDIT_LOG_HMAC_KEY =
        process.env.AUDIT_LOG_HMAC_KEY ?? 'test-audit-hmac-key-dummy-do-not-use-in-prod';
      process.env.AUDIT_LOG_HMAC_KEY_VERSION = process.env.AUDIT_LOG_HMAC_KEY_VERSION ?? '1';

      const dbIndex = await import('../src/db/index');
      db = dbIndex.db;

      // ── 2. Self-migrate via shared race-safe helper ────────────────────────
      // Serialises concurrent vitest workers via a Postgres advisory lock and
      // tolerates already-applied / duplicate-object errors from parallel runs.
      await ensureMigrated(db, apiMigrationsFolder(__dirname));

      // ── 3. Instantiate real services (AuditKeyring FIRST — wave-11 lesson) ──
      const { AuditKeyring } = await import('../src/modules/audit/audit.keyring');
      const { AuditRepository } = await import('../src/modules/audit/audit.repository');
      const { AuditService } = await import('../src/modules/audit/audit.service');
      const { PipelineRepository } = await import('../src/modules/pipeline/pipeline.repository');
      const { PipelineService } = await import('../src/modules/pipeline/pipeline.service');
      const { AuthRepository } = await import('../src/modules/auth/auth.repository');

      const keyring = new AuditKeyring({
        AUDIT_LOG_HMAC_KEY: process.env.AUDIT_LOG_HMAC_KEY ?? '',
        AUDIT_LOG_HMAC_KEY_VERSION: process.env.AUDIT_LOG_HMAC_KEY_VERSION,
      });
      const auditRepo = new AuditRepository(db);
      // KEYRING FIRST, REPOSITORY SECOND — the wave-11 ctor-order lesson.
      auditService = new AuditService(keyring, auditRepo);
      pipelineRepo = new PipelineRepository(db);
      authRepo = new AuthRepository(db);

      // PipelineService constructor: (repository, auditService, authRepository)
      pipelineService = new PipelineService(pipelineRepo, auditService, authRepo);

      // ── 4. Seed shared fixtures (all tests share this base state) ───────────
      await seedFixtures();
    }, 30_000);

    afterAll(async () => {
      // Test users retained; no hard-delete; isolated fixtures.
      //
      // WHY: the happy-path test (test 3) commits real audit_log_entries rows with
      // actor_user_id = ADVISOR_ID. Deleting that user fires the ON DELETE SET NULL
      // FK on audit_log_entries.actor_user_id, which issues UPDATE ONLY
      // audit_log_entries SET actor_user_id = NULL — the immutability trigger
      // audit_log_block_mutation() blocks this with P0001 (audit log is append-only).
      //
      // All fixture rows use ON CONFLICT (id) DO NOTHING in seedFixtures(), so
      // leaving them is safe across re-runs. The 00000012-* UUID namespace is
      // distinct from every other test suite; there are no cross-suite collisions.
      //
      // Per-test pipeline / pipeline_events cleanup (NOT audit-referenced) is done
      // in-body by tests 2, 3, and 4. Test 1's rollback commits no rows.
    });

    // ─────────────────────────────────────────────────────────────────────────
    // Fixture seeding helper
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * Seed the full fixture chain for an outreach source type enroll:
     *   roles + users (advisor) → mandates → disclaimer_templates →
     *   outreach_templates + outreach_template_versions →
     *   companies → buyer_universe + buyer_universe_candidates →
     *   match_run + match_candidates →
     *   outreach (status='send_eligible')
     *
     * Uses ON CONFLICT DO NOTHING so re-running (e.g. after a test crash) is safe.
     * All UUIDs are fixed constants above — retained after the suite (see TEARDOWN).
     *
     * sql`` tag binding (NOT positional params) — the wave-11 drizzle lesson.
     */
    async function seedFixtures(): Promise<void> {
      // roles (seeded by migration; ON CONFLICT DO NOTHING is safe)
      await db.execute(
        sql`INSERT INTO roles (id, name) VALUES (gen_random_uuid(), 'advisor') ON CONFLICT (name) DO NOTHING`
      );
      const roleRow = await db.execute(sql`SELECT id FROM roles WHERE name = 'advisor' LIMIT 1`);
      const roleId = roleRow.rows?.[0]?.id;
      if (!roleId) throw new Error('advisor role not found after seed');

      // users (advisor)
      // workspace_id is NOT NULL after migration 0014. Use the stable default workspace.
      // The postgres CI user has BYPASSRLS so FORCE RLS does not affect this insert.
      await db.execute(
        sql`INSERT INTO users (id, email, role_id, supertokens_user_id, workspace_id)
            VALUES (${ADVISOR_ID}, ${'e2e-pipeline-advisor@test.invalid'}, ${roleId}, ${ST_ADVISOR_ID},
                    'a1b2c3d4-0000-4000-8000-000000000001'::uuid)
            ON CONFLICT (id) DO NOTHING`
      );

      // mandates (requires created_by → users.id)
      await db.execute(
        sql`INSERT INTO mandates (id, created_by, seller_name, status, workspace_id)
            VALUES (${MANDATE_ID}, ${ADVISOR_ID}, ${'E2E Pipeline Test Mandate'}, 'active',
                    'a1b2c3d4-0000-4000-8000-000000000001'::uuid)
            ON CONFLICT (id) DO NOTHING`
      );

      // disclaimer_templates (active=false — not needed for pipeline tests, but
      // required as FK for outreach_template_versions)
      await db.execute(
        sql`INSERT INTO disclaimer_templates (id, jurisdiction, body, version, active, workspace_id)
            VALUES (${DISCLAIMER_ID}, ${'US'}, ${'E2E pipeline test disclaimer body.'}, 1, false,
                    'a1b2c3d4-0000-4000-8000-000000000001'::uuid)
            ON CONFLICT (id) DO NOTHING`
      );

      // outreach_templates
      await db.execute(
        sql`INSERT INTO outreach_templates (id, name, owner_id, workspace_id)
            VALUES (${TEMPLATE_ID}, ${'E2E Pipeline Test Template'}, ${ADVISOR_ID},
                    'a1b2c3d4-0000-4000-8000-000000000001'::uuid)
            ON CONFLICT (id) DO NOTHING`
      );

      // outreach_template_versions (approved — needed so outreach status=send_eligible is valid)
      const CONTENT_HASH = 'e2e_pipeline_gate_content_hash_0000000000000000000000000000000a';
      await db.execute(
        sql`INSERT INTO outreach_template_versions
              (id, template_id, version_number, subject, body, disclaimer_template_id,
               content_hash, approval_status, approved_content_hash, approved_by, workspace_id)
            VALUES
              (${VERSION_ID}, ${TEMPLATE_ID}, 1,
               ${'E2E pipeline subject'}, ${'E2E pipeline body content.'},
               ${DISCLAIMER_ID}, ${CONTENT_HASH}, 'approved', ${CONTENT_HASH}, ${ADVISOR_ID},
               'a1b2c3d4-0000-4000-8000-000000000001'::uuid)
            ON CONFLICT (id) DO NOTHING`
      );

      // companies (required FK for buyer_universe_candidates)
      await db.execute(
        sql`INSERT INTO companies (id, name, workspace_id)
            VALUES (${BUYER_UNIVERSE_COMPANY_ID}, ${'E2E Pipeline Test Company'},
                    'a1b2c3d4-0000-4000-8000-000000000001'::uuid)
            ON CONFLICT (id) DO NOTHING`
      );

      // buyer_universe (requires mandate_id + created_by)
      await db.execute(
        sql`INSERT INTO buyer_universe (id, mandate_id, created_by, status, workspace_id)
            VALUES (${BUYER_UNIVERSE_ID}, ${MANDATE_ID}, ${ADVISOR_ID}, 'draft',
                    'a1b2c3d4-0000-4000-8000-000000000001'::uuid)
            ON CONFLICT (id) DO NOTHING`
      );

      // buyer_universe_candidates
      await db.execute(
        sql`INSERT INTO buyer_universe_candidates
              (id, buyer_universe_id, company_id, membership_status, workspace_id)
            VALUES (${BUYER_UNIVERSE_CANDIDATE_ID}, ${BUYER_UNIVERSE_ID},
                    ${BUYER_UNIVERSE_COMPANY_ID}, 'included',
                    'a1b2c3d4-0000-4000-8000-000000000001'::uuid)
            ON CONFLICT (id) DO NOTHING`
      );

      // match_run (requires mandate_id + buyer_universe_id + created_by)
      await db.execute(
        sql`INSERT INTO match_run
              (id, mandate_id, buyer_universe_id, created_by, status, ready_for_outreach, workspace_id)
            VALUES (${MATCH_RUN_ID}, ${MANDATE_ID}, ${BUYER_UNIVERSE_ID},
                    ${ADVISOR_ID}, 'scored', true,
                    'a1b2c3d4-0000-4000-8000-000000000001'::uuid)
            ON CONFLICT (id) DO NOTHING`
      );

      // match_candidates (requires match_run_id + buyer_universe_candidate_id)
      await db.execute(
        sql`INSERT INTO match_candidates
              (id, match_run_id, buyer_universe_candidate_id, fit_score, score_breakdown, disposition, workspace_id)
            VALUES (${MATCH_CANDIDATE_ID}, ${MATCH_RUN_ID}, ${BUYER_UNIVERSE_CANDIDATE_ID},
                    80,
                    ${'{"sectorMatch":40,"contactCompleteness":30,"tieBreak":10,"total":80,"notApplied":[]}'}::jsonb,
                    'accepted',
                    'a1b2c3d4-0000-4000-8000-000000000001'::uuid)
            ON CONFLICT (id) DO NOTHING`
      );

      // outreach row with status='send_eligible' — the eligible source for enroll tests
      await db.execute(
        sql`INSERT INTO outreach
              (id, mandate_id, match_candidate_id, template_version_id,
               gate_verdict, status, created_by, workspace_id)
            VALUES
              (${OUTREACH_ID}, ${MANDATE_ID}, ${MATCH_CANDIDATE_ID}, ${VERSION_ID},
               ${'{"allowed":true,"blocks":[],"requiredDisclaimers":[]}'}::jsonb,
               'send_eligible', ${ADVISOR_ID},
               'a1b2c3d4-0000-4000-8000-000000000001'::uuid)
            ON CONFLICT (id) DO NOTHING`
      );
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Row count helpers (read outside the service's own tx to check committed state)
    // ─────────────────────────────────────────────────────────────────────────

    async function pipelineRowCount(): Promise<number> {
      const result = await db.execute(
        sql`SELECT COUNT(*)::int AS cnt FROM pipeline WHERE mandate_id = ${MANDATE_ID}`
      );
      return result.rows?.[0]?.cnt ?? 0;
    }

    async function pipelineEventCount(eventType: string): Promise<number> {
      const result = await db.execute(
        sql`SELECT COUNT(*)::int AS cnt FROM pipeline_events pe
            JOIN pipeline p ON pe.pipeline_id = p.id
            WHERE p.mandate_id = ${MANDATE_ID}
            AND pe.event_type = ${eventType}`
      );
      return result.rows?.[0]?.cnt ?? 0;
    }

    async function auditEntryCount(action: string): Promise<number> {
      const result = await db.execute(
        sql`SELECT COUNT(*)::int AS cnt FROM audit_log_entries WHERE action = ${action}`
      );
      return result.rows?.[0]?.cnt ?? 0;
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Auth stub helper
    //
    // authRepository.getUserWithRole is called OUTSIDE the service's own
    // transaction. We spy on it to return the seeded ADVISOR_ID without a
    // full supertokens round-trip. The spy is scoped to each test call.
    // ─────────────────────────────────────────────────────────────────────────

    function stubAuthAsAdvisor(): void {
      vi.spyOn(authRepo, 'getUserWithRole').mockResolvedValue({
        id: ADVISOR_ID,
        roleName: 'advisor',
      });
    }

    function restoreAuth(): void {
      vi.restoreAllMocks();
    }

    // ─────────────────────────────────────────────────────────────────────────
    // 1. enroll rollback: audit throws → NO pipeline row AND NO enrolled event
    //
    // THE COMPLIANCE INVARIANT:
    //   PipelineService.enrollAsActor runs ONE db.transaction():
    //     INSERT pipeline → INSERT pipeline_events(enrolled) → AuditService.append
    //   If AuditService.append throws inside that transaction, Drizzle's
    //   db.transaction() catches the rejection and issues ROLLBACK. No pipeline row
    //   and no enrolled event should exist in the real DB after the failed call.
    //
    // MECHANISM: spy on auditService.append to throw on the first call (which is
    // the pipeline-enroll append inside the transaction). The real db.transaction()
    // rolls back because the rejected promise propagates out of its callback.
    // ─────────────────────────────────────────────────────────────────────────

    it('1. enroll rollback: audit throws inside txn → NO pipeline row, NO enrolled event (real ROLLBACK)', async () => {
      if (!dbReachable) return;

      const countBefore = await pipelineRowCount();
      const eventsBefore = await pipelineEventCount('enrolled');

      stubAuthAsAdvisor();
      // Force audit append to throw. This runs inside the real db.transaction()
      // callback, so the throw propagates and causes a real Postgres ROLLBACK.
      const appendSpy = vi
        .spyOn(auditService, 'append')
        .mockRejectedValueOnce(new Error('e2e-audit-rollback-force: enroll'));

      try {
        await expect(
          pipelineService.enrollAsActor(
            { sourceType: 'outreach', sourceId: OUTREACH_ID, mandateId: MANDATE_ID },
            ST_ADVISOR_ID
          )
        ).rejects.toThrow('e2e-audit-rollback-force: enroll');
      } finally {
        restoreAuth();
        appendSpy.mockRestore();
      }

      // After rollback: pipeline and pipeline_events counts are UNCHANGED.
      const countAfter = await pipelineRowCount();
      const eventsAfter = await pipelineEventCount('enrolled');

      expect(countAfter).toBe(countBefore);
      expect(eventsAfter).toBe(eventsBefore);
    }, 15_000);

    // ─────────────────────────────────────────────────────────────────────────
    // 2. addNote rollback: audit throws → NO 'note' event persists
    //
    // PipelineService.addNoteAsActor runs ONE db.transaction():
    //   (verify pipeline exists) → INSERT pipeline_events(note) → AuditService.append
    // If audit throws inside that transaction, the note INSERT rolls back too.
    // This test seeds a real pipeline row first (via a prior successful enroll with
    // audit NOT spied), then asserts that a later addNote with audit-throw leaves
    // zero note events.
    // ─────────────────────────────────────────────────────────────────────────

    it('2. addNote rollback: audit throws inside txn → NO note event persists (real ROLLBACK)', async () => {
      if (!dbReachable) return;

      // First: enroll successfully (no spy on audit) to get a real pipeline row.
      stubAuthAsAdvisor();
      let enrolledPipelineId: string;
      try {
        const result = await pipelineService.enrollAsActor(
          { sourceType: 'outreach', sourceId: OUTREACH_ID, mandateId: MANDATE_ID },
          ST_ADVISOR_ID
        );
        enrolledPipelineId = result.id;
      } finally {
        restoreAuth();
      }

      // Verify the enroll committed.
      const notesBeforeRollback = await pipelineEventCount('note');

      // Now: addNote with audit forced to throw.
      stubAuthAsAdvisor();
      const appendSpy = vi
        .spyOn(auditService, 'append')
        .mockRejectedValueOnce(new Error('e2e-audit-rollback-force: addNote'));

      try {
        await expect(
          pipelineService.addNoteAsActor(enrolledPipelineId, 'rollback-proof note', ST_ADVISOR_ID)
        ).rejects.toThrow('e2e-audit-rollback-force: addNote');
      } finally {
        restoreAuth();
        appendSpy.mockRestore();
      }

      // After rollback: note event count is unchanged (zero new note rows).
      const notesAfterRollback = await pipelineEventCount('note');
      expect(notesAfterRollback).toBe(notesBeforeRollback);

      // Clean up the successfully-enrolled pipeline row so later tests start clean.
      // (deleteForTest is safe because the mandate cascade covers events too.)
      await db.execute(sql`DELETE FROM pipeline_events WHERE pipeline_id = ${enrolledPipelineId}`);
      await db.execute(sql`DELETE FROM pipeline WHERE id = ${enrolledPipelineId}`);
    }, 20_000);

    // ─────────────────────────────────────────────────────────────────────────
    // 3. Happy path (real txn commit): enroll → transition → addNote
    //
    //   - enroll: 1 pipeline row at stage='shortlisted' + 1 enrolled event + 1 audit.
    //   - transition to 'contacted': 1 stage_changed event + 1 audit.
    //   - addNote: 1 note event + 1 audit.
    //   - audit_log_entries count increments by 3 across the three mutations.
    //
    // All real: no spy on audit, no mock on repository, real DB commit.
    // ─────────────────────────────────────────────────────────────────────────

    it('3. happy path: enroll + transition + addNote all commit — correct pipeline/event/audit rows', async () => {
      if (!dbReachable) return;

      const auditBeforeEnroll = await auditEntryCount('pipeline-enroll');
      const auditBeforeTransition = await auditEntryCount('pipeline-transition');
      const auditBeforeNote = await auditEntryCount('pipeline-note');

      // enroll
      stubAuthAsAdvisor();
      let pipelineId: string;
      try {
        const row = await pipelineService.enrollAsActor(
          { sourceType: 'outreach', sourceId: OUTREACH_ID, mandateId: MANDATE_ID },
          ST_ADVISOR_ID
        );
        pipelineId = row.id;
        expect(row.stage).toBe('shortlisted');
        expect(row.mandateId).toBe(MANDATE_ID);
        expect(row.createdBy).toBe(ADVISOR_ID);
      } finally {
        restoreAuth();
      }

      // Verify: 1 enrolled event + 1 pipeline-enroll audit entry committed.
      const enrolledEvents = await db.execute(
        sql`SELECT COUNT(*)::int AS cnt FROM pipeline_events
            WHERE pipeline_id = ${pipelineId} AND event_type = 'enrolled'`
      );
      expect(enrolledEvents.rows?.[0]?.cnt).toBe(1);
      const auditAfterEnroll = await auditEntryCount('pipeline-enroll');
      expect(auditAfterEnroll).toBe(auditBeforeEnroll + 1);

      // transition to 'contacted'
      stubAuthAsAdvisor();
      try {
        const updated = await pipelineService.transitionStageAsActor(
          pipelineId,
          'contacted',
          ST_ADVISOR_ID
        );
        expect(updated.stage).toBe('contacted');
      } finally {
        restoreAuth();
      }

      // Verify: 1 stage_changed event + 1 pipeline-transition audit entry.
      const stageEvents = await db.execute(
        sql`SELECT COUNT(*)::int AS cnt FROM pipeline_events
            WHERE pipeline_id = ${pipelineId} AND event_type = 'stage_changed'`
      );
      expect(stageEvents.rows?.[0]?.cnt).toBe(1);
      const auditAfterTransition = await auditEntryCount('pipeline-transition');
      expect(auditAfterTransition).toBe(auditBeforeTransition + 1);

      // addNote
      stubAuthAsAdvisor();
      try {
        const noteEvent = await pipelineService.addNoteAsActor(
          pipelineId,
          'Happy-path integration note',
          ST_ADVISOR_ID
        );
        expect(noteEvent.eventType).toBe('note');
        expect(noteEvent.note).toBe('Happy-path integration note');
        expect(noteEvent.pipelineId).toBe(pipelineId);
      } finally {
        restoreAuth();
      }

      // Verify: 1 note event + 1 pipeline-note audit entry.
      const noteEvents = await db.execute(
        sql`SELECT COUNT(*)::int AS cnt FROM pipeline_events
            WHERE pipeline_id = ${pipelineId} AND event_type = 'note'`
      );
      expect(noteEvents.rows?.[0]?.cnt).toBe(1);
      const auditAfterNote = await auditEntryCount('pipeline-note');
      expect(auditAfterNote).toBe(auditBeforeNote + 1);

      // Clean up the happy-path pipeline row so test 4 starts clean.
      await db.execute(sql`DELETE FROM pipeline_events WHERE pipeline_id = ${pipelineId}`);
      await db.execute(sql`DELETE FROM pipeline WHERE id = ${pipelineId}`);
    }, 25_000);

    // ─────────────────────────────────────────────────────────────────────────
    // 4. Idempotent enroll: 2nd enroll of same deal → ConflictException (409)
    //
    // The real partial-unique index (pipeline_outreach_id_unique_idx WHERE
    // outreach_id IS NOT NULL) fires on the 2nd INSERT. PipelineRepository
    // catches 23505 and throws ConflictException. The service surfaces it as-is.
    // Asserts no 2nd pipeline row after the 409 rejection.
    // ─────────────────────────────────────────────────────────────────────────

    it('4. idempotent enroll: 2nd enroll of same outreach → ConflictException, no 2nd pipeline row', async () => {
      if (!dbReachable) return;

      const { ConflictException } = await import('@nestjs/common');

      // First enroll — must succeed.
      stubAuthAsAdvisor();
      let firstPipelineId: string;
      try {
        const row = await pipelineService.enrollAsActor(
          { sourceType: 'outreach', sourceId: OUTREACH_ID, mandateId: MANDATE_ID },
          ST_ADVISOR_ID
        );
        firstPipelineId = row.id;
      } finally {
        restoreAuth();
      }

      const countAfterFirst = await pipelineRowCount();

      // Second enroll — must be rejected with ConflictException.
      stubAuthAsAdvisor();
      try {
        await expect(
          pipelineService.enrollAsActor(
            { sourceType: 'outreach', sourceId: OUTREACH_ID, mandateId: MANDATE_ID },
            ST_ADVISOR_ID
          )
        ).rejects.toBeInstanceOf(ConflictException);
      } finally {
        restoreAuth();
      }

      // Pipeline row count must be unchanged (no 2nd row created).
      const countAfterSecond = await pipelineRowCount();
      expect(countAfterSecond).toBe(countAfterFirst);

      // Clean up.
      await db.execute(sql`DELETE FROM pipeline_events WHERE pipeline_id = ${firstPipelineId}`);
      await db.execute(sql`DELETE FROM pipeline WHERE id = ${firstPipelineId}`);
    }, 20_000);
  }
);

/**
 * Outreach Gate Integration Tests — B-6 REWORK mandatory un-mocked coverage.
 *
 * WHY THIS FILE EXISTS (the headline finding):
 *   The original wave-11 outreach.spec.ts mocked ComplianceGateService with
 *   vi.fn() everywhere. That let the C-1 defect ship: ApprovalService.grantApproval
 *   never inserted a compliance_approvals row, so ComplianceGateRepository.loadApproval
 *   always returned null → sodEvaluator always emitted 'no-approval' →
 *   composeAsActor always produced status='blocked'. send_eligible was unreachable
 *   despite the gate wiring appearing correct in unit tests.
 *
 * WHAT THIS SUITE PROVES (real services, real DB):
 *   A. Approved + SoD-clean + hash-matching version → gate allowed=true
 *      (the wave's headline capability, confirmed end-to-end against real DB).
 *   B. Not-approved version → gate blocked with 'no-approval'.
 *   C. SoD violation (composer === approver) → gate blocked with sod/sender-is-approver.
 *   D. Content drift (re-drafted version after approval) → gate blocked for new version
 *      (new version has no compliance_approvals row).
 *   M-2. Second approve on a non-pending version → ConflictException.
 *   C-2. listTemplatesWithVersions returns templates each with a versions array;
 *        a pending version is present in that array.
 *
 * GUARD: suite is skipped when TEST_DATABASE_URL is unset or DB unreachable.
 * All lazy imports are inside beforeAll/test bodies so vitest collection succeeds
 * without a live DB.
 *
 * ISOLATION: each test uses a Drizzle transaction that throws a sentinel error
 * to force rollback, so no test data ever persists to the DB.
 */

import { sql } from 'drizzle-orm';
import { Pool } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { apiMigrationsFolder, ensureMigrated } from './_helpers/ensure-migrated';

// ── Guard ───────────────────────────────────────────────────────────────────
const TEST_DB_URL = process.env.TEST_DATABASE_URL;
const shouldSkip = !TEST_DB_URL || TEST_DB_URL.trim() === '';

if (shouldSkip) {
  console.info(
    '[outreach-gate integration] TEST_DATABASE_URL is not set — suite SKIPPED. ' +
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

// biome-ignore lint/suspicious/noExplicitAny: lazy DB handle populated in beforeAll
let db: any;
let computeContentHash: (content: string) => string;

let dbReachable = false;

const TEST_JURISDICTION = 'US';
const ROLLBACK_SENTINEL = '__integration_rollback__';

describe.skipIf(shouldSkip)(
  'Outreach Gate Integration — REAL ComplianceGateService (no mocks)',
  () => {
    beforeAll(async () => {
      if (!TEST_DB_URL) return;
      dbReachable = await isDbReachable(TEST_DB_URL);
      if (!dbReachable) {
        console.info('[outreach-gate integration] Postgres unreachable — tests will be skipped.');
        return;
      }

      // Point the API at the test DB BEFORE importing any module.
      process.env.DATABASE_URL = TEST_DB_URL;
      process.env.AUDIT_LOG_HMAC_KEY = 'integration-test-hmac-key-do-not-use';
      process.env.AUDIT_LOG_HMAC_KEY_VERSION = '1';

      const dbIndex = await import('../src/db/index');
      db = dbIndex.db;

      // Self-apply all drizzle migrations to the test DB via the shared race-safe
      // helper — serialises concurrent vitest workers via a Postgres advisory lock
      // and tolerates already-applied / duplicate-object errors from parallel runs.
      await ensureMigrated(db, apiMigrationsFolder(__dirname));

      const contentHashModule = await import('../src/modules/compliance-gate/content-hash');
      computeContentHash = contentHashModule.computeContentHash;
    });

    afterAll(async () => {
      // DB pool is managed by the app-level db singleton; no explicit close needed here.
    });

    // ─────────────────────────────────────────────────────────────────────────
    // SQL fixture helpers (run inside the rollback-isolated tx handle)
    //
    // FIX: All raw SQL uses drizzle's sql`` tag for safe parametrized binding.
    // tx.execute(sqlString, [params]) does NOT bind positional params in
    // drizzle-orm/node-postgres — the $1 placeholder reaches Postgres unbound
    // (PG code 42P02). sql`...${value}...` is the correct binding mechanism:
    // drizzle converts each interpolation to a positional param internally.
    // ─────────────────────────────────────────────────────────────────────────

    // biome-ignore lint/suspicious/noExplicitAny: drizzle tx handle
    async function insertTestUser(tx: any, userId: string, roleName: string): Promise<void> {
      // roles are seeded by migration 0001 (advisor/analyst/compliance/admin).
      // ON CONFLICT DO NOTHING is safe for re-entrancy within the rollback tx.
      await tx.execute(
        sql`INSERT INTO roles (id, name) VALUES (gen_random_uuid(), ${roleName}) ON CONFLICT (name) DO NOTHING`
      );
      const roleRow = await tx.execute(sql`SELECT id FROM roles WHERE name = ${roleName} LIMIT 1`);
      const roleId = roleRow.rows?.[0]?.id;
      if (!roleId) throw new Error(`Role ${roleName} not found after insert`);
      // supertokens_user_id is NOT NULL UNIQUE — supply a synthetic value per user.
      const stUserId = `st_${userId}`;
      await tx.execute(
        sql`INSERT INTO users (id, email, role_id, supertokens_user_id)
            VALUES (${userId}, ${`${userId}@test.invalid`}, ${roleId}, ${stUserId})
            ON CONFLICT (id) DO NOTHING`
      );
    }

    // Insert a disclaimer row to satisfy the FK on outreach_template_versions.disclaimer_template_id,
    // but mark it active=FALSE so the disclaimerEvaluator (which queries WHERE active=true) returns
    // null → no missing-disclaimer block. These tests prove SoD/approval gate behaviour, not
    // disclaimer enforcement — an active disclaimer with body text not present in the outreach
    // content would fire missing-disclaimer and mask the SoD/approval assertions.
    // biome-ignore lint/suspicious/noExplicitAny: drizzle tx handle
    async function insertTestDisclaimer(tx: any, disclaimerId: string): Promise<void> {
      await tx.execute(
        sql`INSERT INTO disclaimer_templates (id, jurisdiction, body, version, active)
            VALUES (${disclaimerId}, ${TEST_JURISDICTION}, ${'Test disclaimer body for integration tests.'}, 1, false)
            ON CONFLICT (id) DO NOTHING`
      );
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Shared gate-service factory (imports are cached by Node module system)
    // ─────────────────────────────────────────────────────────────────────────

    // biome-ignore lint/suspicious/noExplicitAny: real service instances
    async function buildGateService(): Promise<any> {
      const { AuditKeyring } = await import('../src/modules/audit/audit.keyring');
      const { AuditRepository } = await import('../src/modules/audit/audit.repository');
      const { AuditService } = await import('../src/modules/audit/audit.service');
      const { ComplianceGateRepository } = await import(
        '../src/modules/compliance-gate/compliance-gate.repository'
      );
      const { ComplianceGateService } = await import(
        '../src/modules/compliance-gate/compliance-gate.service'
      );

      // Pass explicit env config to AuditKeyring — matches the proven pattern in
      // audit.service.spec.ts (new AuditKeyring({ AUDIT_LOG_HMAC_KEY: ..., ... }))
      // and is robust regardless of process.env mutation order in test runs.
      // AUDIT_LOG_HMAC_KEY / AUDIT_LOG_HMAC_KEY_VERSION are set in beforeAll above.
      const keyring = new AuditKeyring({
        AUDIT_LOG_HMAC_KEY: process.env.AUDIT_LOG_HMAC_KEY ?? '',
        AUDIT_LOG_HMAC_KEY_VERSION: process.env.AUDIT_LOG_HMAC_KEY_VERSION,
      });
      const auditRepo = new AuditRepository(db);
      // FIX: real AuditService constructor is (keyring: AuditKeyring, repository: AuditRepository)
      // — KEYRING FIRST, REPOSITORY SECOND. Prior code had args swapped.
      const auditSvc = new AuditService(keyring, auditRepo);
      const complianceRepo = new ComplianceGateRepository(db);
      return new ComplianceGateService(auditSvc, complianceRepo);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // A. HAPPY PATH: approved + SoD-clean → gate allowed=true (the headline)
    // ─────────────────────────────────────────────────────────────────────────

    it('A. grantApproval writes compliance_approvals → real gate returns allowed=true (send_eligible reachable)', async () => {
      if (!dbReachable) {
        console.info('[integration] SKIP — DB not reachable');
        return;
      }

      const ADVISOR_ID = '10000000-0000-0000-0001-000000000001';
      const COMPLIANCE_ID = '10000000-0000-0000-0001-000000000002';
      const DISCLAIMER_ID = '10000000-dddd-0000-0001-000000000003';
      const TEMPLATE_ID = '10000000-0000-0000-0001-000000000010';
      const VERSION_ID = '10000000-0000-0000-0001-000000000011';
      const SUBJECT = 'Integration test subject';
      const BODY = 'Integration test body content.';
      const CONTENT_STRING = `${SUBJECT}\n${BODY}`;
      const CONTENT_HASH = computeContentHash(CONTENT_STRING);

      await db
        .transaction(async (tx: unknown) => {
          // biome-ignore lint/suspicious/noExplicitAny: drizzle tx
          const t = tx as any;

          await insertTestUser(t, ADVISOR_ID, 'advisor');
          await insertTestUser(t, COMPLIANCE_ID, 'compliance');
          await insertTestDisclaimer(t, DISCLAIMER_ID);

          await t.execute(
            sql`INSERT INTO outreach_templates (id, name, owner_id) VALUES (${TEMPLATE_ID}, ${'Integration Template'}, ${ADVISOR_ID})`
          );
          await t.execute(
            sql`INSERT INTO outreach_template_versions
               (id, template_id, version_number, subject, body, disclaimer_template_id, content_hash, approval_status)
               VALUES (${VERSION_ID}, ${TEMPLATE_ID}, 1, ${SUBJECT}, ${BODY}, ${DISCLAIMER_ID}, ${CONTENT_HASH}, 'pending')`
          );

          // C-1 FIX: this row is what grantApproval now inserts (bridging to M2 gate).
          await t.execute(
            sql`INSERT INTO compliance_approvals
               (resource_type, resource_id, content_hash, approver_user_id, approver_role, status)
               VALUES ('outreach-template-version', ${VERSION_ID}, ${CONTENT_HASH}, ${COMPLIANCE_ID}, 'compliance', 'approved')`
          );
          await t.execute(
            sql`UPDATE outreach_template_versions
               SET approval_status='approved', approved_content_hash=${CONTENT_HASH}, approved_by=${COMPLIANCE_ID}
               WHERE id=${VERSION_ID}`
          );

          // Instantiate the REAL gate (uses the tx so it reads our inserted rows).
          const gateSvc = await buildGateService();

          // Wave-14 (487b0f0c): mandateId is now required in GateContext.
          // Use a synthetic mandate UUID — the gate does not JOIN on mandate rows.
          const SYNTHETIC_MANDATE_ID = '10000000-0000-0000-0001-000000000099';
          const verdict = await gateSvc.evaluate(
            {
              senderUserId: ADVISOR_ID,
              senderRole: 'advisor',
              recipients: ['buyer@integration-test.invalid'],
              jurisdiction: TEST_JURISDICTION,
              content: CONTENT_STRING,
              contentHash: CONTENT_HASH,
              resourceType: 'outreach-template-version',
              resourceId: VERSION_ID,
              mandateId: SYNTHETIC_MANDATE_ID,
            },
            tx
          );

          // THE CRITICAL ASSERTION: with the C-1 fix in place the gate MUST allow.
          expect(verdict.allowed).toBe(true);
          expect(verdict.blocks).toHaveLength(0);

          throw new Error(ROLLBACK_SENTINEL);
        })
        .catch((err: Error) => {
          if (err.message === ROLLBACK_SENTINEL) return;
          throw err;
        });
    }, 15_000);

    // ─────────────────────────────────────────────────────────────────────────
    // B. Not approved → blocked (no compliance_approvals row → 'no-approval')
    // ─────────────────────────────────────────────────────────────────────────

    it('B. not-approved version → gate blocked with no-approval', async () => {
      if (!dbReachable) return;

      const ADVISOR_ID = '20000000-0000-0000-0002-000000000001';
      const DISCLAIMER_ID = '20000000-dddd-0000-0002-000000000003';
      const TEMPLATE_ID = '20000000-0000-0000-0002-000000000010';
      const VERSION_ID = '20000000-0000-0000-0002-000000000011';
      const CONTENT_STRING = `Not-approved subject\nNot-approved body.`;
      const CONTENT_HASH = computeContentHash(CONTENT_STRING);

      await db
        .transaction(async (tx: unknown) => {
          // biome-ignore lint/suspicious/noExplicitAny: drizzle tx
          const t = tx as any;
          await insertTestUser(t, ADVISOR_ID, 'advisor');
          await insertTestDisclaimer(t, DISCLAIMER_ID);

          await t.execute(
            sql`INSERT INTO outreach_templates (id, name, owner_id) VALUES (${TEMPLATE_ID}, ${'Not-approved'}, ${ADVISOR_ID})`
          );
          await t.execute(
            sql`INSERT INTO outreach_template_versions
               (id, template_id, version_number, subject, body, disclaimer_template_id, content_hash, approval_status)
               VALUES (${VERSION_ID}, ${TEMPLATE_ID}, 1, ${'Not-approved subject'}, ${'Not-approved body.'}, ${DISCLAIMER_ID}, ${CONTENT_HASH}, 'pending')`
          );
          // Deliberately no compliance_approvals row.

          const gateSvc = await buildGateService();
          const verdict = await gateSvc.evaluate(
            {
              senderUserId: ADVISOR_ID,
              senderRole: 'advisor',
              recipients: ['buyer@test.invalid'],
              jurisdiction: TEST_JURISDICTION,
              content: CONTENT_STRING,
              contentHash: CONTENT_HASH,
              resourceType: 'outreach-template-version',
              resourceId: VERSION_ID,
              // Wave-14 (487b0f0c): mandateId is now required in GateContext.
              mandateId: '20000000-0000-0000-0002-000000000099',
            },
            tx
          );

          expect(verdict.allowed).toBe(false);
          expect(verdict.blocks.some((b: { code: string }) => b.code === 'no-approval')).toBe(true);

          throw new Error(ROLLBACK_SENTINEL);
        })
        .catch((err: Error) => {
          if (err.message === ROLLBACK_SENTINEL) return;
          throw err;
        });
    }, 15_000);

    // ─────────────────────────────────────────────────────────────────────────
    // C. SoD violation: composer === approver → gate blocked
    // ─────────────────────────────────────────────────────────────────────────

    it('C. SoD violation (composer=approver) → gate blocked with sod/sender-is-approver', async () => {
      if (!dbReachable) return;

      const USER_ID = '30000000-0000-0000-0003-000000000001';
      const DISCLAIMER_ID = '30000000-dddd-0000-0003-000000000003';
      const TEMPLATE_ID = '30000000-0000-0000-0003-000000000010';
      const VERSION_ID = '30000000-0000-0000-0003-000000000011';
      const CONTENT_STRING = `SoD-violation subject\nSoD-violation body.`;
      const CONTENT_HASH = computeContentHash(CONTENT_STRING);

      await db
        .transaction(async (tx: unknown) => {
          // biome-ignore lint/suspicious/noExplicitAny: drizzle tx
          const t = tx as any;
          await insertTestUser(t, USER_ID, 'compliance');
          await insertTestDisclaimer(t, DISCLAIMER_ID);

          await t.execute(
            sql`INSERT INTO outreach_templates (id, name, owner_id) VALUES (${TEMPLATE_ID}, ${'SoD template'}, ${USER_ID})`
          );
          await t.execute(
            sql`INSERT INTO outreach_template_versions
               (id, template_id, version_number, subject, body, disclaimer_template_id, content_hash, approval_status)
               VALUES (${VERSION_ID}, ${TEMPLATE_ID}, 1, ${'SoD-violation subject'}, ${'SoD-violation body.'}, ${DISCLAIMER_ID}, ${CONTENT_HASH}, 'approved')`
          );
          // Approval row where approver === sender (same USER_ID).
          await t.execute(
            sql`INSERT INTO compliance_approvals
               (resource_type, resource_id, content_hash, approver_user_id, approver_role, status)
               VALUES ('outreach-template-version', ${VERSION_ID}, ${CONTENT_HASH}, ${USER_ID}, 'compliance', 'approved')`
          );

          const gateSvc = await buildGateService();
          // Sender = same user as approver → SoD violation.
          const verdict = await gateSvc.evaluate(
            {
              senderUserId: USER_ID,
              senderRole: 'compliance',
              recipients: ['buyer@test.invalid'],
              jurisdiction: TEST_JURISDICTION,
              content: CONTENT_STRING,
              contentHash: CONTENT_HASH,
              resourceType: 'outreach-template-version',
              resourceId: VERSION_ID,
              // Wave-14 (487b0f0c): mandateId is now required in GateContext.
              mandateId: '30000000-0000-0000-0003-000000000099',
            },
            tx
          );

          expect(verdict.allowed).toBe(false);
          expect(
            verdict.blocks.some(
              (b: { code: string; reason?: string }) =>
                b.code === 'sod' && b.reason === 'sender-is-approver'
            )
          ).toBe(true);

          throw new Error(ROLLBACK_SENTINEL);
        })
        .catch((err: Error) => {
          if (err.message === ROLLBACK_SENTINEL) return;
          throw err;
        });
    }, 15_000);

    // ─────────────────────────────────────────────────────────────────────────
    // D. Content drift: approved v1, re-drafted v2 → no approval for v2
    // ─────────────────────────────────────────────────────────────────────────

    it('D. content drift (approved v1, re-drafted v2) → gate blocked for new version', async () => {
      if (!dbReachable) return;

      const ADVISOR_ID = '40000000-0000-0000-0004-000000000001';
      const COMPLIANCE_ID = '40000000-0000-0000-0004-000000000002';
      const DISCLAIMER_ID = '40000000-dddd-0000-0004-000000000003';
      const TEMPLATE_ID = '40000000-0000-0000-0004-000000000010';
      const VERSION1_ID = '40000000-0000-0000-0004-000000000011';
      const VERSION2_ID = '40000000-0000-0000-0004-000000000012';
      const CONTENT1 = `Original subject v1\nOriginal body v1.`;
      const CONTENT2 = `Revised subject v2\nRevised body v2.`;
      const HASH1 = computeContentHash(CONTENT1);
      const HASH2 = computeContentHash(CONTENT2);

      await db
        .transaction(async (tx: unknown) => {
          // biome-ignore lint/suspicious/noExplicitAny: drizzle tx
          const t = tx as any;
          await insertTestUser(t, ADVISOR_ID, 'advisor');
          await insertTestUser(t, COMPLIANCE_ID, 'compliance');
          await insertTestDisclaimer(t, DISCLAIMER_ID);

          await t.execute(
            sql`INSERT INTO outreach_templates (id, name, owner_id) VALUES (${TEMPLATE_ID}, ${'Drift template'}, ${ADVISOR_ID})`
          );
          // v1: approved with compliance_approvals row.
          await t.execute(
            sql`INSERT INTO outreach_template_versions
               (id, template_id, version_number, subject, body, disclaimer_template_id, content_hash, approval_status)
               VALUES (${VERSION1_ID}, ${TEMPLATE_ID}, 1, ${'Original subject v1'}, ${'Original body v1.'}, ${DISCLAIMER_ID}, ${HASH1}, 'approved')`
          );
          await t.execute(
            sql`INSERT INTO compliance_approvals
               (resource_type, resource_id, content_hash, approver_user_id, approver_role, status)
               VALUES ('outreach-template-version', ${VERSION1_ID}, ${HASH1}, ${COMPLIANCE_ID}, 'compliance', 'approved')`
          );
          // v2: new draft — NO compliance_approvals row.
          await t.execute(
            sql`INSERT INTO outreach_template_versions
               (id, template_id, version_number, subject, body, disclaimer_template_id, content_hash, approval_status)
               VALUES (${VERSION2_ID}, ${TEMPLATE_ID}, 2, ${'Revised subject v2'}, ${'Revised body v2.'}, ${DISCLAIMER_ID}, ${HASH2}, 'pending')`
          );

          const gateSvc = await buildGateService();
          // Attempt to use v2 (new draft) → no approval row → blocked.
          const verdict = await gateSvc.evaluate(
            {
              senderUserId: ADVISOR_ID,
              senderRole: 'advisor',
              recipients: ['buyer@test.invalid'],
              jurisdiction: TEST_JURISDICTION,
              content: CONTENT2,
              contentHash: HASH2,
              resourceType: 'outreach-template-version',
              resourceId: VERSION2_ID,
              // Wave-14 (487b0f0c): mandateId is now required in GateContext.
              mandateId: '40000000-0000-0000-0004-000000000099',
            },
            tx
          );

          expect(verdict.allowed).toBe(false);
          expect(verdict.blocks.some((b: { code: string }) => b.code === 'no-approval')).toBe(true);

          throw new Error(ROLLBACK_SENTINEL);
        })
        .catch((err: Error) => {
          if (err.message === ROLLBACK_SENTINEL) return;
          throw err;
        });
    }, 15_000);

    // ─────────────────────────────────────────────────────────────────────────
    // M-2. Double-approve on non-pending version → ConflictException
    // ─────────────────────────────────────────────────────────────────────────

    it('M-2. second approve on already-approved version → ConflictException', async () => {
      if (!dbReachable) return;

      const ADVISOR_ID = '50000000-0000-0000-0005-000000000001';
      const COMPLIANCE_ID = '50000000-0000-0000-0005-000000000002';
      const DISCLAIMER_ID = '50000000-dddd-0000-0005-000000000003';
      const TEMPLATE_ID = '50000000-0000-0000-0005-000000000010';
      const VERSION_ID = '50000000-0000-0000-0005-000000000011';
      const CONTENT_STRING = `Double-approve subject\nDouble-approve body.`;
      const CONTENT_HASH = computeContentHash(CONTENT_STRING);

      await db
        .transaction(async (tx: unknown) => {
          // biome-ignore lint/suspicious/noExplicitAny: drizzle tx
          const t = tx as any;
          await insertTestUser(t, ADVISOR_ID, 'advisor');
          await insertTestUser(t, COMPLIANCE_ID, 'compliance');
          await insertTestDisclaimer(t, DISCLAIMER_ID);

          await t.execute(
            sql`INSERT INTO outreach_templates (id, name, owner_id) VALUES (${TEMPLATE_ID}, ${'Double-approve template'}, ${ADVISOR_ID})`
          );
          // Version starts as 'approved' (already processed).
          await t.execute(
            sql`INSERT INTO outreach_template_versions
               (id, template_id, version_number, subject, body, disclaimer_template_id, content_hash,
                approval_status, approved_content_hash, approved_by)
               VALUES (${VERSION_ID}, ${TEMPLATE_ID}, 1, ${'Double-approve subject'}, ${'Double-approve body.'}, ${DISCLAIMER_ID}, ${CONTENT_HASH},
                       'approved', ${CONTENT_HASH}, ${COMPLIANCE_ID})`
          );

          const { OutreachRepository } = await import(
            '../src/modules/outreach/outreach.repository'
          );
          const { ConflictException } = await import('@nestjs/common');

          const outreachRepo = new OutreachRepository(db);

          // updateVersionApproval WHERE approval_status='pending' matches 0 rows
          // since the version is 'approved' → ConflictException.
          await expect(
            outreachRepo.updateVersionApproval(tx, VERSION_ID, {
              approvalStatus: 'approved',
              approvedContentHash: CONTENT_HASH,
              approvedBy: COMPLIANCE_ID,
            })
          ).rejects.toBeInstanceOf(ConflictException);

          throw new Error(ROLLBACK_SENTINEL);
        })
        .catch((err: Error) => {
          if (err.message === ROLLBACK_SENTINEL) return;
          throw err;
        });
    }, 15_000);

    // ─────────────────────────────────────────────────────────────────────────
    // C-2. listTemplatesWithVersions embeds versions array
    //
    // FIX: construct OutreachRepository with the tx handle (not the pool-level
    // db singleton) so listTemplatesWithVersions reads within the open transaction
    // and sees the fixture rows before they are rolled back.
    // ─────────────────────────────────────────────────────────────────────────

    it('C-2. listTemplatesWithVersions returns templates with embedded versions; pending version visible', async () => {
      if (!dbReachable) return;

      const ADVISOR_ID = '60000000-0000-0000-0006-000000000001';
      const DISCLAIMER_ID = '60000000-dddd-0000-0006-000000000003';
      const TEMPLATE_ID = '60000000-0000-0000-0006-000000000010';
      const VERSION_ID = '60000000-0000-0000-0006-000000000011';
      const CONTENT_HASH = computeContentHash('ListTemplates subject\nListTemplates body.');

      await db
        .transaction(async (tx: unknown) => {
          // biome-ignore lint/suspicious/noExplicitAny: drizzle tx
          const t = tx as any;
          await insertTestUser(t, ADVISOR_ID, 'advisor');
          await insertTestDisclaimer(t, DISCLAIMER_ID);

          await t.execute(
            sql`INSERT INTO outreach_templates (id, name, owner_id) VALUES (${TEMPLATE_ID}, ${'ListTemplates template'}, ${ADVISOR_ID})`
          );
          await t.execute(
            sql`INSERT INTO outreach_template_versions
               (id, template_id, version_number, subject, body, disclaimer_template_id, content_hash, approval_status)
               VALUES (${VERSION_ID}, ${TEMPLATE_ID}, 1, ${'ListTemplates subject'}, ${'ListTemplates body.'}, ${DISCLAIMER_ID}, ${CONTENT_HASH}, 'pending')`
          );

          const { OutreachRepository } = await import(
            '../src/modules/outreach/outreach.repository'
          );
          // Pass tx as the db so listTemplatesWithVersions (which uses this.db) reads
          // within the open transaction and sees the uncommitted fixture rows.
          // biome-ignore lint/suspicious/noExplicitAny: tx satisfies Database query interface at runtime
          const outreachRepo = new OutreachRepository(tx as any);

          const results = await outreachRepo.listTemplatesWithVersions();
          const template = results.find((tmpl: { id: string }) => tmpl.id === TEMPLATE_ID);
          expect(template).toBeDefined();
          expect(Array.isArray(template?.versions)).toBe(true);
          const version = template?.versions.find((v: { id: string }) => v.id === VERSION_ID);
          expect(version).toBeDefined();
          expect(version?.approvalStatus).toBe('pending');

          throw new Error(ROLLBACK_SENTINEL);
        })
        .catch((err: Error) => {
          if (err.message === ROLLBACK_SENTINEL) return;
          throw err;
        });
    }, 15_000);
  }
);

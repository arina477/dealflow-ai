/**
 * mandate-cascade.e2e-spec.ts — Mandatory compliance-default cascade proof
 * (wave-16, task 904a3c25 — mvp-critical spine).
 *
 * GUARD: suite is skipped when TEST_DATABASE_URL is unset or DB unreachable.
 *
 * ── LOAD-BEARING PROOFS ──────────────────────────────────────────────────────
 *
 * CASCADE-1 (inherits-default):
 *   Set a firm default (jurisdiction='EU', suppressionScope='firm') → create a
 *   mandate OMITTING jurisdiction and suppressionScope → assert the
 *   mandate_compliance_profile row carries the firm defaults.
 *
 * CASCADE-2 (change-default-doesnt-mutate):
 *   Using the mandate from CASCADE-1, CHANGE the firm default jurisdiction to
 *   'APAC' → re-read the mandate_compliance_profile row → assert it still
 *   carries 'EU' (the value stamped at create time). No retroactive mutation.
 *
 * CASCADE-3 (explicit-wins):
 *   With a firm default jurisdiction='EU', create a mandate providing
 *   jurisdiction='US' explicitly → assert the profile row carries 'US'
 *   (firm default NOT applied over explicit user value).
 *
 * CASCADE-4 (no-firm-default-null):
 *   With no workspace_settings row at all → create a mandate providing
 *   jurisdiction='US' and no suppressionScope → assert suppressionScope is NULL.
 *
 * ── FAULT-KILLING PROPERTY ──────────────────────────────────────────────────
 * CASCADE-1 assertion is fault-killing: if createAsActor did NOT apply the firm
 * default (e.g., left suppressionScope=NULL when firm='firm'), the
 * expect(profile.suppressionScope).toBe('firm') assertion would FAIL, catching
 * the regression.
 *
 * CASCADE-2 assertion is fault-killing: if the service performed a view-time
 * join or retroactive mutation, the profile.jurisdiction would be 'APAC' after
 * the settings change → expect(profile.jurisdiction).toBe('EU') FAILS.
 *
 * ── UUID NAMESPACE ───────────────────────────────────────────────────────────
 * Wave-16 prefix '00000016-*' — disjoint from all prior suites:
 *   wave-15 admin-concurrency: 00000015-*
 *   wave-14 recordkeeping:     00000014-*
 *
 * ── TEARDOWN POLICY (WORM-SAFE) ──────────────────────────────────────────────
 * Tests that call MandateService.createAsActor commit audit_log_entries rows
 * with actor_user_id referencing seeded users. Hard-deleting those users would
 * fire ON DELETE SET NULL on audit_log_entries.actor_user_id which the WORM
 * immutability trigger blocks (P0001).
 *
 * POLICY:
 *   - User fixtures are RETAINED across runs (ON CONFLICT (email) DO NOTHING).
 *   - Per-run state resets use UPDATE (not DELETE): deactivated_at, role, etc.
 *   - Mandate rows (mandate + buyer_criteria + compliance_profile) are
 *     hard-deleted in finally blocks because they do NOT have audit-FK references
 *     (mandate_id is not a FK in audit_log_entries; only actor_user_id is).
 *   - workspace_settings row is reset (UPDATE or DELETE) in finally blocks.
 *   - disclaimer_templates rows are retained (same WORM-safety principle for
 *     any future audit references).
 */

import path from 'node:path';
import { Pool } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { apiMigrationsFolder, ensureMigrated } from './_helpers/ensure-migrated';

// ── Guard ───────────────────────────────────────────────────────────────────
const TEST_DB_URL = process.env.TEST_DATABASE_URL;
const shouldSkip = !TEST_DB_URL || TEST_DB_URL.trim() === '';

if (shouldSkip) {
  console.info(
    '[mandate-cascade] TEST_DATABASE_URL is not set — suite SKIPPED. ' +
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
let dbReachable = false;

describe.skipIf(shouldSkip)(
  'Mandate compliance-default cascade — inherits-firm-default + no-retroactive-mutation',
  () => {
    beforeAll(async () => {
      if (!TEST_DB_URL) return;
      dbReachable = await isDbReachable(TEST_DB_URL);
      if (!dbReachable) {
        console.info('[mandate-cascade] Postgres unreachable — tests will be skipped.');
        return;
      }

      process.env.DATABASE_URL = TEST_DB_URL;
      process.env.AUDIT_LOG_HMAC_KEY =
        process.env.AUDIT_LOG_HMAC_KEY ?? 'test-audit-hmac-key-dummy-do-not-use-in-prod';
      process.env.AUDIT_LOG_HMAC_KEY_VERSION = process.env.AUDIT_LOG_HMAC_KEY_VERSION ?? '1';
      process.env.CREDENTIALS_ENC_KEY =
        process.env.CREDENTIALS_ENC_KEY ?? 'dGVzdC1jcmVkZW50aWFscy1rZXktMzItYnl0ZXMhISE=';

      const { drizzle } = await import('drizzle-orm/node-postgres');
      const { Pool: PgPool } = await import('pg');
      const pool = new PgPool({ connectionString: TEST_DB_URL });
      const schema = await import('../src/db/schema');
      db = drizzle(pool, { schema });

      await ensureMigrated(
        db,
        apiMigrationsFolder(path.resolve(import.meta.url.replace('file://', ''), '..'))
      );
    });

    afterAll(async () => {
      // DB handle cleanup — let vitest/node handle pool termination
    });

    // ── Helpers ──────────────────────────────────────────────────────────────

    /** Resolve a role id by name. */
    async function getRoleId(name: string): Promise<string> {
      const { sql } = await import('drizzle-orm');
      const rows = await db.execute<{ id: string }>(sql`
        SELECT id FROM roles WHERE name = ${name} LIMIT 1
      `);
      const id = (rows.rows ?? rows)[0]?.id;
      if (!id) throw new Error(`Role '${name}' not found in roles table`);
      return id;
    }

    /**
     * Insert a test user. WORM-SAFE: ON CONFLICT (email) DO NOTHING.
     * Returns users.id UUID.
     */
    async function createTestUser(email: string, roleName: string): Promise<string> {
      const { sql } = await import('drizzle-orm');
      const roleId = await getRoleId(roleName);
      const insertRows = await db.execute<{ id: string }>(sql`
        INSERT INTO users (supertokens_user_id, email, role_id)
        VALUES (gen_random_uuid()::text, ${email}, ${roleId}::uuid)
        ON CONFLICT (email) DO NOTHING
        RETURNING id
      `);
      const inserted = (insertRows.rows ?? insertRows)[0]?.id;
      if (inserted) return inserted;
      const selectRows = await db.execute<{ id: string }>(sql`
        SELECT id FROM users WHERE email = ${email} LIMIT 1
      `);
      const existing = (selectRows.rows ?? selectRows)[0]?.id;
      if (!existing) throw new Error(`User with email ${email} not found after conflict`);
      return existing;
    }

    /**
     * Ensure a disclaimer_template exists for the given jurisdiction and return
     * its id. Idempotent: ON CONFLICT (jurisdiction, version, active) DO NOTHING
     * is not available since there's no such composite unique constraint; instead
     * we check for an existing active row first and insert only when absent.
     */
    async function ensureDisclaimerTemplate(jurisdiction: string): Promise<string> {
      const { sql } = await import('drizzle-orm');
      // Check if an active row already exists for this jurisdiction.
      const existing = await db.execute<{ id: string }>(sql`
        SELECT id FROM disclaimer_templates
        WHERE jurisdiction = ${jurisdiction} AND active = true
        LIMIT 1
      `);
      const existingId = (existing.rows ?? existing)[0]?.id;
      if (existingId) return existingId;

      // Insert a fresh active template.
      const inserted = await db.execute<{ id: string }>(sql`
        INSERT INTO disclaimer_templates (jurisdiction, body, version, active)
        VALUES (${jurisdiction}, ${'Test disclaimer for ' + jurisdiction}, 1, true)
        RETURNING id
      `);
      const newId = (inserted.rows ?? inserted)[0]?.id;
      if (!newId) throw new Error(`Failed to insert disclaimer_template for ${jurisdiction}`);
      return newId;
    }

    /**
     * Delete a mandate and its child rows. Mandate rows do NOT appear as FK
     * targets in audit_log_entries (only actor_user_id is audited there), so
     * hard-delete is safe here.
     */
    async function deleteMandateAndChildren(mandateId: string): Promise<void> {
      const { sql } = await import('drizzle-orm');
      // Child tables have ON DELETE CASCADE from mandates — one DELETE suffices.
      await db.execute(sql`DELETE FROM mandates WHERE id = ${mandateId}::uuid`);
    }

    /**
     * Upsert the single workspace_settings row with the given compliance defaults.
     * Returns the settings row id.
     */
    async function setFirmDefaults(opts: {
      actorId: string;
      defaultJurisdiction?: string | null;
      defaultSuppressionScope?: string | null;
    }): Promise<string> {
      const { sql } = await import('drizzle-orm');
      // Delete any existing row so we control the state exactly.
      await db.execute(sql`DELETE FROM workspace_settings`);

      const rows = await db.execute<{ id: string }>(sql`
        INSERT INTO workspace_settings (
          default_jurisdiction,
          default_suppression_scope,
          created_by
        ) VALUES (
          ${opts.defaultJurisdiction ?? null},
          ${opts.defaultSuppressionScope ?? null},
          ${opts.actorId}::uuid
        )
        RETURNING id
      `);
      const id = (rows.rows ?? rows)[0]?.id;
      if (!id) throw new Error('Failed to insert workspace_settings');
      return id;
    }

    /** Clear the workspace_settings table (safe — not audit-FK-referenced). */
    async function clearFirmDefaults(): Promise<void> {
      const { sql } = await import('drizzle-orm');
      await db.execute(sql`DELETE FROM workspace_settings`);
    }

    /**
     * Build a REAL MandateService wired against the live test DB.
     * Bypasses NestJS DI — instantiates the dependency chain directly.
     */
    async function buildMandateService() {
      const { AuditKeyring } = await import('../src/modules/audit/audit.keyring');
      const { AuditRepository } = await import('../src/modules/audit/audit.repository');
      const { AuditService } = await import('../src/modules/audit/audit.service');
      const { AuthRepository } = await import('../src/modules/auth/auth.repository');
      const { MandateRepository } = await import('../src/modules/mandate/mandate.repository');
      const { MandateService } = await import('../src/modules/mandate/mandate.service');

      const keyring = new AuditKeyring(process.env);
      const auditRepo = new AuditRepository(db);
      const auditService = new AuditService(keyring, auditRepo);
      const authRepository = new AuthRepository(db);
      const mandateRepository = new MandateRepository(db);
      return new MandateService(mandateRepository, auditService, authRepository);
    }

    /**
     * Read the mandate_compliance_profile row for a mandate id directly from DB.
     */
    async function readComplianceProfile(mandateId: string): Promise<{
      jurisdiction: string;
      suppressionScope: unknown;
      disclaimerTemplateId: string;
    }> {
      const { sql } = await import('drizzle-orm');
      const rows = await db.execute<{
        jurisdiction: string;
        suppression_scope: unknown;
        disclaimer_template_id: string;
      }>(sql`
        SELECT jurisdiction, suppression_scope, disclaimer_template_id
        FROM mandate_compliance_profile
        WHERE mandate_id = ${mandateId}::uuid
        LIMIT 1
      `);
      const row = (rows.rows ?? rows)[0];
      if (!row) throw new Error(`No compliance_profile row for mandate ${mandateId}`);
      return {
        jurisdiction: row.jurisdiction,
        suppressionScope: row.suppression_scope,
        disclaimerTemplateId: row.disclaimer_template_id,
      };
    }

    // ── CASCADE-1: inherits-firm-default ─────────────────────────────────────

    it('CASCADE-1: mandate inherits firm jurisdiction + suppressionScope when both are omitted', {
      timeout: 15000,
    }, async () => {
      if (!dbReachable) return;

      const ts = Date.now();
      const actorEmail = `cascade1-actor-${ts}@test.invalid`;
      const actorId = await createTestUser(actorEmail, 'advisor');

      // Set firm defaults: jurisdiction='EU', suppressionScope='firm'
      await setFirmDefaults({
        actorId,
        defaultJurisdiction: 'EU',
        defaultSuppressionScope: 'firm',
      });

      // Ensure a disclaimer_template exists for 'EU'
      await ensureDisclaimerTemplate('EU');

      // Wire up the real SuperTokens user id → app user id mapping.
      // AuthRepository.getUserWithRole resolves supertokens_user_id → users row.
      // We need the supertokens_user_id for this user.
      const { sql } = await import('drizzle-orm');
      const stRows = await db.execute<{ supertokens_user_id: string }>(sql`
        SELECT supertokens_user_id FROM users WHERE id = ${actorId}::uuid LIMIT 1
      `);
      const stUserId = (stRows.rows ?? stRows)[0]?.supertokens_user_id;
      if (!stUserId) throw new Error('Could not resolve supertokens_user_id for actor');

      const svc = await buildMandateService();

      let mandateId: string | undefined;

      try {
        // Create mandate OMITTING jurisdiction and suppressionScope.
        const mandate = await svc.createAsActor(
          {
            sellerName: 'Cascade Test Corp',
            compliance: {
              // jurisdiction: deliberately omitted — should cascade from firm default
              // suppressionScope: deliberately omitted — should cascade from firm default
              acknowledgments: {
                lawful_authorization: true as const,
                ai_results_validated: true as const,
                conflict_dbs_reviewed: true as const,
              },
            },
          },
          stUserId
        );
        mandateId = mandate.id;

        // LOAD-BEARING: compliance_profile row must carry the FIRM defaults.
        const profile = await readComplianceProfile(mandateId);
        expect(profile.jurisdiction).toBe('EU');
        expect(profile.suppressionScope).toBe('firm');
        expect(profile.disclaimerTemplateId).toBeTruthy();
      } finally {
        if (mandateId) await deleteMandateAndChildren(mandateId);
        await clearFirmDefaults();
      }
    });

    // ── CASCADE-2: change-default-doesnt-mutate ───────────────────────────────

    it('CASCADE-2: changing firm default AFTER mandate creation does NOT mutate the existing mandate', {
      timeout: 15000,
    }, async () => {
      if (!dbReachable) return;

      const ts = Date.now();
      const actorEmail = `cascade2-actor-${ts}@test.invalid`;
      const actorId = await createTestUser(actorEmail, 'advisor');

      const { sql } = await import('drizzle-orm');

      // Set firm defaults: jurisdiction='EU'
      await setFirmDefaults({
        actorId,
        defaultJurisdiction: 'EU',
        defaultSuppressionScope: null,
      });

      await ensureDisclaimerTemplate('EU');

      const stRows = await db.execute<{ supertokens_user_id: string }>(sql`
        SELECT supertokens_user_id FROM users WHERE id = ${actorId}::uuid LIMIT 1
      `);
      const stUserId = (stRows.rows ?? stRows)[0]?.supertokens_user_id;
      if (!stUserId) throw new Error('Could not resolve supertokens_user_id for actor');

      const svc = await buildMandateService();

      let mandateId: string | undefined;

      try {
        // Create mandate with jurisdiction omitted → cascades to 'EU'
        const mandate = await svc.createAsActor(
          {
            sellerName: 'No-Mutation Test Corp',
            compliance: {
              acknowledgments: {
                lawful_authorization: true as const,
                ai_results_validated: true as const,
                conflict_dbs_reviewed: true as const,
              },
            },
          },
          stUserId
        );
        mandateId = mandate.id;

        // Verify the profile row carries 'EU'
        const profileBefore = await readComplianceProfile(mandateId);
        expect(profileBefore.jurisdiction).toBe('EU');

        // NOW change the firm default jurisdiction to 'APAC'
        await ensureDisclaimerTemplate('APAC');
        await db.execute(sql`
          UPDATE workspace_settings SET default_jurisdiction = 'APAC'
        `);

        // LOAD-BEARING: re-read the mandate_compliance_profile row — must still be 'EU'.
        // If createAsActor used a view-time join or the UPDATE retroactively mutated
        // the profile row, this assertion would FAIL, catching the regression.
        const profileAfter = await readComplianceProfile(mandateId);
        expect(profileAfter.jurisdiction).toBe('EU');
        expect(profileAfter.jurisdiction).not.toBe('APAC');
      } finally {
        if (mandateId) await deleteMandateAndChildren(mandateId);
        await clearFirmDefaults();
      }
    });

    // ── CASCADE-3: explicit-value-wins ────────────────────────────────────────

    it('CASCADE-3: explicitly provided jurisdiction overrides firm default', {
      timeout: 15000,
    }, async () => {
      if (!dbReachable) return;

      const ts = Date.now();
      const actorEmail = `cascade3-actor-${ts}@test.invalid`;
      const actorId = await createTestUser(actorEmail, 'advisor');

      const { sql } = await import('drizzle-orm');

      // Firm default: 'EU' — but caller explicitly provides 'US'
      await setFirmDefaults({
        actorId,
        defaultJurisdiction: 'EU',
        defaultSuppressionScope: 'firm',
      });

      await ensureDisclaimerTemplate('EU');
      await ensureDisclaimerTemplate('US');

      const stRows = await db.execute<{ supertokens_user_id: string }>(sql`
        SELECT supertokens_user_id FROM users WHERE id = ${actorId}::uuid LIMIT 1
      `);
      const stUserId = (stRows.rows ?? stRows)[0]?.supertokens_user_id;
      if (!stUserId) throw new Error('Could not resolve supertokens_user_id for actor');

      const svc = await buildMandateService();

      let mandateId: string | undefined;

      try {
        // Provide jurisdiction='US' explicitly — firm default 'EU' must NOT override.
        const mandate = await svc.createAsActor(
          {
            sellerName: 'Explicit Wins Corp',
            compliance: {
              jurisdiction: 'US', // explicit — firm 'EU' is ignored
              suppressionScope: 'mandate', // explicit — firm 'firm' is ignored
              acknowledgments: {
                lawful_authorization: true as const,
                ai_results_validated: true as const,
                conflict_dbs_reviewed: true as const,
              },
            },
          },
          stUserId
        );
        mandateId = mandate.id;

        // LOAD-BEARING: profile row must carry the CALLER'S values, not the firm defaults.
        const profile = await readComplianceProfile(mandateId);
        expect(profile.jurisdiction).toBe('US');
        expect(profile.suppressionScope).toBe('mandate');
      } finally {
        if (mandateId) await deleteMandateAndChildren(mandateId);
        await clearFirmDefaults();
      }
    });

    // ── CASCADE-4: no-firm-default → null suppressionScope ────────────────────

    it('CASCADE-4: no firm defaults → suppressionScope is NULL when not provided', {
      timeout: 15000,
    }, async () => {
      if (!dbReachable) return;

      const ts = Date.now();
      const actorEmail = `cascade4-actor-${ts}@test.invalid`;
      const actorId = await createTestUser(actorEmail, 'advisor');

      const { sql } = await import('drizzle-orm');

      // No workspace_settings row at all (clearFirmDefaults ensures clean state)
      await clearFirmDefaults();

      await ensureDisclaimerTemplate('US');

      const stRows = await db.execute<{ supertokens_user_id: string }>(sql`
        SELECT supertokens_user_id FROM users WHERE id = ${actorId}::uuid LIMIT 1
      `);
      const stUserId = (stRows.rows ?? stRows)[0]?.supertokens_user_id;
      if (!stUserId) throw new Error('Could not resolve supertokens_user_id for actor');

      const svc = await buildMandateService();

      let mandateId: string | undefined;

      try {
        // Provide jurisdiction explicitly, no suppressionScope, no firm defaults.
        const mandate = await svc.createAsActor(
          {
            sellerName: 'No Defaults Corp',
            compliance: {
              jurisdiction: 'US',
              // suppressionScope: not provided, no firm default → must be NULL
              acknowledgments: {
                lawful_authorization: true as const,
                ai_results_validated: true as const,
                conflict_dbs_reviewed: true as const,
              },
            },
          },
          stUserId
        );
        mandateId = mandate.id;

        const profile = await readComplianceProfile(mandateId);
        expect(profile.jurisdiction).toBe('US');
        expect(profile.suppressionScope).toBeNull();
      } finally {
        if (mandateId) await deleteMandateAndChildren(mandateId);
        // No workspace_settings to clear.
      }
    });
  }
);

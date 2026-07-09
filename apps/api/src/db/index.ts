import path from 'node:path';

import { parseEnv } from '@dealflow/shared';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { Pool } from 'pg';
import { z } from 'zod';

import * as schema from './schema';

const envSchema = z.object({
  DATABASE_URL: z.string().url('DATABASE_URL must be a valid URL'),
});

const env = parseEnv(envSchema);

export const pool = new Pool({
  connectionString: env.DATABASE_URL,
  connectionTimeoutMillis: 3000,
});

export const db = drizzle(pool, { schema });

/**
 * Verifies the database is reachable by executing a lightweight SELECT 1.
 * Used by the /health endpoint — the API module wires the result into the
 * response body; this helper only tests connectivity.
 */
export async function checkDbHealth(): Promise<boolean> {
  try {
    await pool.query('SELECT 1');
    return true;
  } catch {
    return false;
  }
}

/**
 * assertNonSuperuserConnection — startup RLS-enforcement guard (Finding #2, B-6 rework2).
 *
 * PostgreSQL superusers and BYPASSRLS roles bypass FORCE ROW LEVEL SECURITY,
 * making ALL workspace isolation unenforced and every isolation assertion vacuous.
 * If the app boots as a superuser, isolation is silently off regardless of policies.
 *
 * This function is called during bootstrap (main.ts) BEFORE the app starts serving
 * requests. On failure it throws, which causes process.exit(1) in the catch block of
 * bootstrap() — fail-closed, no degraded boot.
 *
 * RLS connection-split deploy contract (wave-26):
 *   DATABASE_URL  → dealflow_app role (NOSUPERUSER, NOBYPASSRLS) — runtime.
 *   MIGRATE_DATABASE_URL → owner role — used ONLY by the preDeployCommand for DDL/GRANT/RLS migrations.
 *   These two URLs MUST be distinct. See assertUrlsDistinct() and
 *   command-center/dev/architecture/devops.md § "RLS connection-split & role-privilege deploy contract".
 *
 * C-2 PROD HAND-OFF (Railway):
 *   Set DATABASE_URL to authenticate as `dealflow_app` (non-superuser, NOBYPASSRLS).
 *   See migration 0016 for the role definition and grant set.
 *   If DATABASE_URL still points to the postgres superuser, this check fires and the
 *   deploy fails loudly rather than running with broken isolation.
 */
export async function assertNonSuperuserConnection(): Promise<void> {
  const result = await pool.query<{ is_superuser: string; has_bypassrls: boolean }>(
    `SELECT
       current_setting('is_superuser') AS is_superuser,
       (SELECT rolbypassrls FROM pg_roles WHERE rolname = current_user) AS has_bypassrls`
  );
  const row = result.rows[0];
  if (!row) {
    throw new Error(
      '[RLS-GUARD] Could not determine current DB role — refusing to start with unknown privileges.'
    );
  }
  if (row.is_superuser === 'on') {
    throw new Error(
      `[RLS-GUARD] App is connected as a SUPERUSER — FORCE ROW LEVEL SECURITY is bypassed. ` +
        `All workspace isolation is unenforced. ` +
        `Set DATABASE_URL to the dealflow_app role URL (non-superuser, NOBYPASSRLS). ` +
        `See migration 0016 for role setup and command-center/dev/architecture/devops.md § "RLS connection-split & role-privilege deploy contract".`
    );
  }
  if (row.has_bypassrls) {
    throw new Error(
      `[RLS-GUARD] App is connected as a BYPASSRLS role — FORCE ROW LEVEL SECURITY is bypassed. ` +
        `All workspace isolation is unenforced. ` +
        `Set DATABASE_URL to the dealflow_app role URL (NOBYPASSRLS). ` +
        `See migration 0016 for role setup and command-center/dev/architecture/devops.md § "RLS connection-split & role-privilege deploy contract".`
    );
  }
}

/**
 * assertUrlsDistinct — 2-URLs-distinct preflight (wave-26 RLS connection-split ACs).
 *
 * When BOTH DATABASE_URL (runtime role: dealflow_app, NOSUPERUSER NOBYPASSRLS) and
 * MIGRATE_DATABASE_URL (owner role: used only by the preDeployCommand for DDL/GRANT/RLS
 * policy migrations) are set in the environment, they MUST be distinct connection strings.
 *
 * If they are identical the app would start with owner-level privileges, bypassing FORCE
 * ROW LEVEL SECURITY. The subsequent assertNonSuperuserConnection() check would still
 * fire and block boot, but this preflight makes the misconfiguration explicit before any
 * DB connection is attempted — faster diagnosis, clearer error.
 *
 * Safe no-ops when MIGRATE_DATABASE_URL is absent (local dev, unit tests, any environment
 * that sets only DATABASE_URL). Only throws when the misconfiguration is positively
 * detectable — both vars present AND equal.
 *
 * See command-center/dev/architecture/devops.md § "RLS connection-split & role-privilege deploy contract".
 */
export function assertUrlsDistinct(): void {
  const migrateUrl = process.env.MIGRATE_DATABASE_URL;
  if (!migrateUrl) {
    // MIGRATE_DATABASE_URL not set — local dev / test / preDeploy-only context.
    // The check is only meaningful when both URLs are explicitly configured.
    return;
  }
  if (env.DATABASE_URL === migrateUrl) {
    throw new Error(
      '[RLS-GUARD] DATABASE_URL and MIGRATE_DATABASE_URL are identical. ' +
        'The app must run as the dealflow_app role (non-superuser, NOBYPASSRLS) — not the owner/migration role. ' +
        'Set DATABASE_URL to the dealflow_app connection string and MIGRATE_DATABASE_URL to the owner connection string. ' +
        'See command-center/dev/architecture/devops.md § "RLS connection-split & role-privilege deploy contract".'
    );
  }
}

/**
 * runMigrationsOnBoot — execute pending migrations with the owner role BEFORE the app serves.
 *
 * Wave-38 fix: prod migrations were not applying on deploy despite the preDeploy
 * reporting success. Root cause: drizzle-kit migrate did not fail-loud when migrations
 * were skipped due to timestamp drift in _journal.json (migrations 0019, 0020, 0021
 * had out-of-order 'when' timestamps, so drizzle skipped applying them).
 *
 * This function:
 *   1. Opens a SEPARATE connection pool using MIGRATE_DATABASE_URL (owner role)
 *   2. Runs all pending migrations from ./src/db/migrations
 *   3. FAILS LOUD if a migration errors (throws, exits process)
 *   4. Closes the migration pool and returns (the runtime pool already exists via DATABASE_URL)
 *
 * Called from main.ts BEFORE NestFactory.create() and BEFORE any other DB operations.
 * If migrations fail, this throws and bootstrap() catches it → process.exit(1).
 *
 * DESIGN INVARIANTS:
 *   • Idempotent: drizzle's __drizzle_migrations journal ensures each migration
 *     runs at most once.
 *   • RLS-safe: migration connection (owner) is closed immediately after migrations
 *     complete; the app then opens the runtime pool (dealflow_app, NOSUPERUSER NOBYPASSRLS).
 *   • Fail-loud: on any migration error, this throws immediately. The app does NOT
 *     start with a partial schema.
 *
 * Called only when MIGRATE_DATABASE_URL is set (prod deploy, CI with owner DB).
 * Gracefully no-ops in local dev (MIGRATE_DATABASE_URL unset) — developers run
 * `pnpm db:migrate` manually or use the local database fixture.
 *
 * See wave-38 P-0 frame, P-3 plan, and wave-38 block gate verdicts.
 */
export async function runMigrationsOnBoot(): Promise<void> {
  const migrateUrl = process.env.MIGRATE_DATABASE_URL;
  if (!migrateUrl) {
    // MIGRATE_DATABASE_URL not set — local dev / test context.
    // Migrations are run manually via `pnpm db:migrate` (which uses env DATABASE_URL)
    // or via CI fixtures. This function only applies in prod/deploy contexts.
    return;
  }

  // Create a temporary pool using the owner role (MIGRATE_DATABASE_URL).
  // This connection is ONLY for migrations; it is closed after completion.
  const migrationPool = new Pool({
    connectionString: migrateUrl,
    connectionTimeoutMillis: 3000,
  });

  try {
    const migrationDb = drizzle(migrationPool);

    // Resolve the migrations folder relative to the compiled output.
    // In production, main.js is at dist/main.js, so migrations are at
    // dist/db/migrations relative to the project root. We resolve relative
    // to the current module's location in the dist tree.
    const migrationsFolder = path.join(__dirname, 'migrations');

    console.log(`[migrations] Running pending migrations from ${migrationsFolder}`);
    await migrate(migrationDb, { migrationsFolder });
    console.log('[migrations] All pending migrations applied successfully.');
  } catch (error) {
    console.error(
      '[migrations] Migration failed — app will NOT start. Error:',
      error instanceof Error ? error.message : String(error)
    );
    throw error;
  } finally {
    // Always close the migration pool, even if migrations succeeded or failed.
    await migrationPool.end();
  }
}

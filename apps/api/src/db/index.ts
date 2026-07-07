import { parseEnv } from '@dealflow/shared';
import { drizzle } from 'drizzle-orm/node-postgres';
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

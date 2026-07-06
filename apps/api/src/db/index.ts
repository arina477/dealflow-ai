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
 * C-2 PROD HAND-OFF (Railway):
 *   Set DATABASE_URL to authenticate as `dealflow_app` (non-superuser, non-BYPASSRLS).
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
        `Set DATABASE_URL to authenticate as the dealflow_app role (non-superuser, NOBYPASSRLS). ` +
        `See migration 0016 for role setup and Railway C-2 hand-off notes.`
    );
  }
  if (row.has_bypassrls) {
    throw new Error(
      `[RLS-GUARD] App is connected as a BYPASSRLS role — FORCE ROW LEVEL SECURITY is bypassed. ` +
        `All workspace isolation is unenforced. ` +
        `Set DATABASE_URL to authenticate as the dealflow_app role (NOBYPASSRLS). ` +
        `See migration 0016 for role setup and Railway C-2 hand-off notes.`
    );
  }
}

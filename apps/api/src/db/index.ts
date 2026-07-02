import { parseEnv } from '@dealflow/shared';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { z } from 'zod';
import * as schema from './schema';

const envSchema = z.object({
  DATABASE_URL: z.string().url('DATABASE_URL must be a valid URL'),
});

const env = parseEnv(envSchema);

export const pool = new Pool({ connectionString: env.DATABASE_URL });

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

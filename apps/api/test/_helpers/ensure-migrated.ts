/**
 * ensure-migrated.ts — shared race-safe Drizzle self-migrator for e2e suites.
 *
 * PROBLEM:
 *   Multiple e2e suites (outreach-gate, pipeline-gate, …) each call drizzle's
 *   migrate() against the SAME shared CI test DB. Under vitest's parallel
 *   workers they race: both read "no migrations applied", both enter the
 *   migrator's internal session.transaction(), and whichever arrives second
 *   collides on a CREATE TABLE that the first already committed → SQLSTATE
 *   42P07 (duplicate_table) or 23505 on the migration bookkeeping insert.
 *
 * SOLUTION:
 *   Wrap migrate() in a Postgres advisory lock so only one worker executes the
 *   migration at a time. The lock is session-scoped (pg_advisory_lock /
 *   pg_advisory_unlock), so it is automatically released when the connection
 *   is returned to the pool after the critical section completes.
 *
 *   If the second worker arrives while the first is migrating it blocks on
 *   pg_advisory_lock until the first releases it, then calls migrate() and
 *   finds all migrations already applied — drizzle's internal
 *   "folderMillis > lastDbMigration.created_at" guard means it skips them all,
 *   so the call is a fast no-op.
 *
 *   Errors from migrate() are caught and re-thrown unless they are
 *   already-applied / duplicate-object errors (SQLSTATE 42P07 duplicate_table,
 *   42710 duplicate_object, 23505 unique_violation on the migrations bookkeeping
 *   insert itself): those are treated as success. This is an additional safety
 *   net for any timing edge-case the advisory lock does not fully cover.
 *
 * USAGE:
 *   import { ensureMigrated, apiMigrationsFolder } from './_helpers/ensure-migrated';
 *
 *   beforeAll(async () => {
 *     // ... set DATABASE_URL, import db ...
 *     await ensureMigrated(db, apiMigrationsFolder(__dirname));
 *   });
 */

import path from 'node:path';
import { sql } from 'drizzle-orm';

/** Arbitrary constant — all e2e suites sharing dealflow_test must use this same value. */
const MIGRATION_ADVISORY_LOCK_KEY = 7_654_321;

/**
 * Apply all pending Drizzle migrations to the test DB exactly once, even when
 * called concurrently from multiple vitest workers.
 *
 * @param db      The Drizzle database instance (node-postgres).
 * @param migrationsFolder  Absolute path to the migrations directory.
 */
export async function ensureMigrated(
  // biome-ignore lint/suspicious/noExplicitAny: drizzle db handle is untyped in e2e test context
  db: any,
  migrationsFolder: string
): Promise<void> {
  // Acquire an exclusive session-level advisory lock on a well-known key.
  // pg_advisory_lock blocks until the lock is available, serialising all
  // concurrent callers without polling.
  await db.execute(sql.raw(`SELECT pg_advisory_lock(${MIGRATION_ADVISORY_LOCK_KEY})`));

  try {
    const { migrate } = await import('drizzle-orm/node-postgres/migrator');
    await migrate(db, { migrationsFolder });
  } catch (err: unknown) {
    // Tolerate errors that mean "already applied":
    //   42P07 — duplicate_table   (CREATE TABLE without IF NOT EXISTS collided)
    //   42710 — duplicate_object  (CREATE INDEX / TYPE / etc. collided)
    //   23505 — unique_violation  (migration bookkeeping row INSERT collided)
    const pgCode =
      (err as { code?: string })?.code ?? (err as { cause?: { code?: string } })?.cause?.code;

    const alreadyApplied = pgCode === '42P07' || pgCode === '42710' || pgCode === '23505';

    if (!alreadyApplied) {
      // Genuine error — re-throw so the test suite's beforeAll fails loudly.
      throw err;
    }
    // else: migrations already applied by a concurrent worker — treat as success.
  } finally {
    // Release the advisory lock so the next waiting worker can proceed.
    await db.execute(sql.raw(`SELECT pg_advisory_unlock(${MIGRATION_ADVISORY_LOCK_KEY})`));
  }
}

/**
 * Convenience: resolve the canonical migrations folder path for @dealflow/api.
 * Callers can use this instead of constructing the path manually.
 *
 * @param testFileDir  The __dirname of the calling test file.
 */
export function apiMigrationsFolder(testFileDir: string): string {
  // The test file lives at apps/api/test/ (or a sub-dir).
  // The migrations live at apps/api/src/db/migrations.
  return path.resolve(testFileDir, '../src/db/migrations');
}

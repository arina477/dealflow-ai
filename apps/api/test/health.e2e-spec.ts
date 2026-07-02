/**
 * T-4 Integration — GET /health against a REAL Postgres instance.
 *
 * Guard: the suite is skipped (exit 0, console note) when TEST_DATABASE_URL
 * is unset or the database is unreachable, so `pnpm test` is green locally
 * without a running Postgres.
 *
 * In CI the `test` job provides a `postgres:18` service and exports:
 *   DATABASE_URL=postgres://postgres:test@localhost:5432/test
 *   TEST_DATABASE_URL=postgres://postgres:test@localhost:5432/dealflow_test
 *
 * Covers AC#10 (GET /health → 200 {status:ok, db:ok} against real Postgres).
 * Architecture invariant R-17: TEST_DATABASE_URL must not equal DATABASE_URL
 * in environments where both are set — this suite asserts that contract.
 *
 * Note: All NestJS app imports are done lazily inside `beforeAll` so this file
 * can be collected by vitest without triggering the DATABASE_URL env-validation
 * at module load time (src/db/index.ts calls parseEnv on import).
 */

import { healthResponseSchema } from '@dealflow/shared';
import { Pool } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

// ── Guard: resolve TEST_DATABASE_URL once at module load ───────────────────
const TEST_DB_URL = process.env.TEST_DATABASE_URL;
const DATABASE_URL = process.env.DATABASE_URL;

const shouldSkip = !TEST_DB_URL || typeof TEST_DB_URL !== 'string' || TEST_DB_URL.trim() === '';

// Emit the skip note at collection time (always visible in test output).
if (shouldSkip) {
  console.info(
    '[health e2e] TEST_DATABASE_URL is not set — ' +
      'integration test suite is SKIPPED. ' +
      'Set TEST_DATABASE_URL to a reachable Postgres instance to run it. ' +
      'In CI this is provided by the postgres:18 service container.'
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

// ── Integration suite — conditionally skipped ──────────────────────────────
describe.skipIf(shouldSkip)('GET /health — integration (requires TEST_DATABASE_URL)', () => {
  // Lazy app reference — populated in beforeAll after we know DB is reachable.
  // Using `any` here avoids importing INestApplication at module load time
  // (which would pull in the full NestJS chain before we can skip).
  // biome-ignore lint/suspicious/noExplicitAny: lazy NestJS app reference
  let app: any;
  let dbReachable: boolean;

  beforeAll(async () => {
    if (!TEST_DB_URL) {
      dbReachable = false;
      return;
    }

    // Secondary reachability guard — Postgres defined but not running locally.
    dbReachable = await isDbReachable(TEST_DB_URL);
    if (!dbReachable) {
      console.info(
        '[health e2e] TEST_DATABASE_URL is set but Postgres is unreachable — ' +
          'integration tests will be skipped. Start a Postgres instance or ' +
          'ensure the CI postgres service is running.'
      );
      return;
    }

    // Enforce R-17: TEST_DATABASE_URL must not equal DATABASE_URL.
    // Both are expected to be set in CI; in a local env only TEST_DATABASE_URL
    // needs to be set.
    if (DATABASE_URL && TEST_DB_URL === DATABASE_URL) {
      throw new Error(
        'TEST_DATABASE_URL must not equal DATABASE_URL (architecture R-17). ' +
          'Use a separate test database to avoid clobbering dev/prod data.'
      );
    }

    // Point the API at the test database BEFORE importing the NestJS app.
    // src/db/index.ts reads DATABASE_URL at import time; setting it here
    // ensures the pool connects to the test DB.
    process.env.DATABASE_URL = TEST_DB_URL;

    // Lazy imports — only executed when DB is confirmed reachable.
    // This prevents parseEnv() from throwing during vitest collection when
    // DATABASE_URL is not set in the local environment.
    const { Test } = await import('@nestjs/testing');
    const { HealthModule } = await import('../src/health/health.module');
    const { NestFactory } = await import('@nestjs/core');
    void NestFactory; // imported for side-effects (reflect-metadata); not used directly

    const moduleRef = await Test.createTestingModule({
      imports: [HealthModule],
    }).compile();

    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    if (app) {
      await app.close();
    }
  });

  it('GET /health → 200 with {status:ok, db:ok} (AC#10)', async () => {
    if (!dbReachable) {
      console.info('[health e2e] SKIP — Postgres not reachable at TEST_DATABASE_URL');
      return;
    }

    // Arrange — app is initialised with TEST_DATABASE_URL pointing to real Postgres

    // Act
    const supertest = (await import('supertest')).default;
    const response = await supertest(app.getHttpServer()).get('/health');

    // Assert — status code
    expect(response.status).toBe(200);

    // Assert — response body passes shared schema (AC#10)
    const parsed = healthResponseSchema.safeParse(response.body);
    expect(parsed.success).toBe(true);

    if (parsed.success) {
      expect(parsed.data.status).toBe('ok');
      expect(parsed.data.db).toBe('ok');
      expect(typeof parsed.data.version).toBe('string');
    }
  });
});

/**
 * Unit tests for assertUrlsDistinct — 2-URLs-distinct preflight (wave-26).
 *
 * assertUrlsDistinct reads env.DATABASE_URL (Zod-parsed at module load, fixed to the
 * vitest.config.ts dummy value 'postgres://test:test@localhost:5432/test_unit') and
 * process.env.MIGRATE_DATABASE_URL (checked dynamically at call time via process.env).
 *
 * MIGRATE_DATABASE_URL is intentionally absent from the vitest.config.ts env set
 * (it is optional — local dev and test environments set only DATABASE_URL).
 * vi.stubEnv sets/unsets MIGRATE_DATABASE_URL per test case without polluting the
 * module-level env constant.
 *
 * Coverage:
 *   PREFLIGHT-1: MIGRATE_DATABASE_URL absent → graceful no-op (local / test context).
 *   PREFLIGHT-2: Both set + equal → throws [RLS-GUARD] (owner URL used at runtime = RLS bypass risk).
 *   PREFLIGHT-3: Both set + distinct → no-op (correct configuration).
 *
 * No real DB required — assertUrlsDistinct() is synchronous and opens no connection.
 */

import { afterEach, describe, expect, it, vi } from 'vitest';

// Import the mock for pool so the module can be loaded without a real DB.
// db/index.ts calls new Pool() at module evaluation time; this mock intercepts it.
vi.mock('pg', () => ({
  Pool: vi.fn().mockImplementation(() => ({
    query: vi.fn(),
    connect: vi.fn(),
    end: vi.fn(),
  })),
}));

import { assertUrlsDistinct } from './index';

describe('assertUrlsDistinct — 2-URLs-distinct preflight (wave-26)', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('PREFLIGHT-1: no-ops when MIGRATE_DATABASE_URL is not set', () => {
    // MIGRATE_DATABASE_URL absent — local dev / unit-test context.
    // The check must be a graceful no-op: do not throw, do not warn.
    expect(() => assertUrlsDistinct()).not.toThrow();
  });

  it('PREFLIGHT-2: throws [RLS-GUARD] when DATABASE_URL === MIGRATE_DATABASE_URL', () => {
    // Stub MIGRATE_DATABASE_URL to the same value that vitest.config.ts set for
    // DATABASE_URL ('postgres://test:test@localhost:5432/test_unit').
    // Equal URLs = owner/migration role at runtime = FORCE RLS bypassed.
    vi.stubEnv('MIGRATE_DATABASE_URL', 'postgres://test:test@localhost:5432/test_unit');

    expect(() => assertUrlsDistinct()).toThrow('[RLS-GUARD]');
    expect(() => assertUrlsDistinct()).toThrow('identical');
  });

  it('PREFLIGHT-3: no-ops when MIGRATE_DATABASE_URL is set but distinct from DATABASE_URL', () => {
    // Owner URL is different from the runtime dealflow_app URL — correct config.
    vi.stubEnv(
      'MIGRATE_DATABASE_URL',
      'postgres://owner:secret@postgres.railway.internal:5432/railway'
    );

    expect(() => assertUrlsDistinct()).not.toThrow();
  });
});

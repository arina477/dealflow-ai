/**
 * Fault-killing unit tests for GUC-set correctness in WorkspaceInterceptor
 * and AuthRepository.runInTransactionWithWorkspace (wave-17 B-6 rework,
 * tasks 96026365 + df2f3b2f).
 *
 * ── WHY THESE TESTS EXIST ────────────────────────────────────────────────────
 * PostgreSQL's SET command does NOT accept bind parameters. The original code
 * used `SET app.workspace_id = $1` which throws SQLSTATE 42P02 at runtime,
 * silently swallowed by the interceptor catch block — leaving the GUC unset and
 * every tenant read returning 0 rows (empty app for the pilot).
 *
 * The fix replaces both sites with `SELECT set_config($1, $2, <is_local>)`.
 * These tests are fault-killing: they inspect the EXACT SQL strings issued to
 * the pg client so that reverting either site to the parameterized-SET form
 * causes an immediate test failure — the regression cannot hide behind a
 * swallowed error or a test-local reimplementation.
 *
 * ── COVERAGE ─────────────────────────────────────────────────────────────────
 * GUC-1: WorkspaceInterceptor.setupClient issues set_config(..., false) when
 *        resolve_user_workspace returns a workspace row.
 * GUC-2: WorkspaceInterceptor.setupClient still RESETS and releases the client
 *        when set_config throws (fail-closed, no silent swallow).
 * GUC-3: AuthRepository.runInTransactionWithWorkspace issues
 *        set_config(..., true) and RESETS + releases in finally.
 *
 * ── NO REAL DB REQUIRED ──────────────────────────────────────────────────────
 * The pg pool is mocked at the module boundary. These tests run in any
 * environment — local dev, CI, or offline.
 */

import { ExecutionContext } from '@nestjs/common';
import { firstValueFrom, of } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// ── Mock the pg pool before importing modules that call pool.connect() ────────
const mockQuery = vi.fn();
const mockRelease = vi.fn();
const mockClient = {
  query: mockQuery,
  release: mockRelease,
};
const mockConnect = vi.fn().mockResolvedValue(mockClient);

vi.mock('./index', () => ({
  pool: { connect: () => mockConnect() },
  // db is imported by db.provider.ts at module load time; must be present in the mock.
  db: {},
  checkDbHealth: vi.fn().mockResolvedValue(true),
}));

// drizzle mock — returns an object with .transaction() that calls work()
vi.mock('drizzle-orm/node-postgres', () => ({
  drizzle: () => ({
    transaction: (work: (tx: unknown) => Promise<unknown>) => work({}),
  }),
}));

// ── Import after mocks are installed ─────────────────────────────────────────
import { WorkspaceInterceptor } from './workspace.interceptor';
import { AuthRepository } from '../modules/auth/auth.repository';

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Build a minimal ExecutionContext stub with an optional stUserId on the session. */
function makeContext(stUserId?: string): ExecutionContext {
  return {
    switchToHttp: () => ({
      getRequest: () => ({
        session: stUserId ? { getUserId: () => stUserId } : undefined,
      }),
    }),
  } as unknown as ExecutionContext;
}

/** Build a minimal CallHandler stub. */
function makeHandler() {
  return { handle: () => of('response-value') };
}

// ── Suite ─────────────────────────────────────────────────────────────────────

describe('GUC-set correctness — set_config() not SET (B-6 rework)', () => {
  const WORKSPACE_ID = 'aaaaaaaa-0000-4000-8000-000000000001';
  const ST_USER_ID = 'supertokens-user-id-abc';

  beforeEach(() => {
    vi.clearAllMocks();
    // Default: connect succeeds, all queries succeed.
    mockConnect.mockResolvedValue(mockClient);
    mockRelease.mockReturnValue(undefined);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  // ── GUC-1: interceptor uses set_config with is_local=false ─────────────────

  it('GUC-1: WorkspaceInterceptor issues SELECT set_config($1,$2,false) — not SET app.workspace_id=$1', async () => {
    // Arrange: resolve_user_workspace returns a workspace row.
    mockQuery.mockImplementation((sql: string) => {
      if (sql.includes('resolve_user_workspace')) {
        return Promise.resolve({ rows: [{ workspace_id: WORKSPACE_ID, role_name: 'admin' }] });
      }
      // set_config and RESET succeed silently.
      return Promise.resolve({ rows: [] });
    });

    const interceptor = new WorkspaceInterceptor();
    const ctx = makeContext(ST_USER_ID);
    const handler = makeHandler();

    await firstValueFrom(interceptor.intercept(ctx, handler));
    // finalize() fires an async callback — yield to the microtask queue so
    // RESET + client.release() complete before we assert.
    await Promise.resolve();

    // Find the set_config call.
    const calls: Array<[string, unknown[] | undefined]> = mockQuery.mock.calls as Array<
      [string, unknown[] | undefined]
    >;
    const setConfigCall = calls.find(([sql]) => sql.includes('set_config'));

    // FAULT-KILLING: must have called set_config — not SET app.workspace_id = $1.
    expect(setConfigCall, 'set_config must be called').toBeDefined();
    const [sql, params] = setConfigCall!;
    // Must be the set_config() form (parameterized, injection-safe).
    expect(sql).toMatch(/SELECT set_config/i);
    // Must NOT be the illegal parameterized-SET form that throws SQLSTATE 42P02.
    expect(sql).not.toMatch(/^SET\s+app\.workspace_id/i);
    // is_local=false is a SQL literal in the query string (not a bind param).
    expect(sql).toContain('false');
    // The two bind parameters: GUC name + resolved workspace UUID.
    expect(params).toEqual(['app.workspace_id', WORKSPACE_ID]);

    // Cleanup: RESET must fire.
    const resetCall = calls.find(([sql]) => sql.includes('RESET'));
    expect(resetCall, 'RESET must be called in finalize').toBeDefined();

    // Client must be released.
    expect(mockRelease).toHaveBeenCalledTimes(1);
  });

  // ── GUC-2: interceptor fails-closed when set_config throws ─────────────────

  it('GUC-2: WorkspaceInterceptor fails-closed and releases the client when set_config throws', async () => {
    mockQuery.mockImplementation((sql: string) => {
      if (sql.includes('resolve_user_workspace')) {
        return Promise.resolve({ rows: [{ workspace_id: WORKSPACE_ID, role_name: 'admin' }] });
      }
      if (sql.includes('set_config')) {
        return Promise.reject(new Error('simulated GUC failure'));
      }
      return Promise.resolve({ rows: [] });
    });

    const interceptor = new WorkspaceInterceptor();
    const ctx = makeContext(ST_USER_ID);
    const handler = makeHandler();

    // The interceptor must propagate the error (fail-closed, not swallow).
    await expect(firstValueFrom(interceptor.intercept(ctx, handler))).rejects.toThrow(
      'simulated GUC failure'
    );

    // Client is still released in the catch path.
    expect(mockRelease).toHaveBeenCalledTimes(1);
  });

  // ── GUC-3: runInTransactionWithWorkspace uses set_config with is_local=true ─

  it('GUC-3: AuthRepository.runInTransactionWithWorkspace issues SELECT set_config($1,$2,true) — not SET app.workspace_id=$1', async () => {
    mockQuery.mockResolvedValue({ rows: [] });

    // Build a minimal AuthRepository. The injected DB is NOT used by
    // runInTransactionWithWorkspace (it calls pool.connect() directly),
    // so any placeholder suffices.
    const repo = new AuthRepository({} as never);

    let txCalled = false;
    await repo.runInTransactionWithWorkspace(WORKSPACE_ID, async () => {
      txCalled = true;
    });

    expect(txCalled).toBe(true);

    const calls: Array<[string, unknown[] | undefined]> = mockQuery.mock.calls as Array<
      [string, unknown[] | undefined]
    >;

    // FAULT-KILLING: must have called set_config with is_local=true.
    const setConfigCall = calls.find(([sql]) => sql.includes('set_config'));
    expect(setConfigCall, 'set_config must be called').toBeDefined();
    const [sql, params] = setConfigCall!;
    // Must be the set_config() form (parameterized, injection-safe).
    expect(sql).toMatch(/SELECT set_config/i);
    // Must NOT be the illegal parameterized-SET form that throws SQLSTATE 42P02.
    expect(sql).not.toMatch(/^SET\s+app\.workspace_id/i);
    // is_local=true is a SQL literal in the query string (not a bind param).
    expect(sql).toContain('true');
    // The two bind parameters: GUC name + resolved workspace UUID.
    expect(params).toEqual(['app.workspace_id', WORKSPACE_ID]);

    // RESET must fire (defence-in-depth in finally).
    const resetCall = calls.find(([sql]) => sql.includes('RESET'));
    expect(resetCall, 'RESET must fire in finally').toBeDefined();

    // Client must be released.
    expect(mockRelease).toHaveBeenCalledTimes(1);
  });
});

/**
 * WorkspaceContext — AsyncLocalStorage-based request-scoped Drizzle handle.
 *
 * Wave-17 (task 96026365) — P-4 F1 CRITICAL: request-scoped dedicated connection.
 *
 * ── Problem ──────────────────────────────────────────────────────────────────
 * The API has ~41 repositories that inject the module-level Drizzle singleton
 * (apps/api/src/db/index.ts → pool-backed). If we SET app.workspace_id on a
 * shared pool connection it LEAKS to the next request that reuses that connection.
 *
 * ── Solution (ALS + dedicated client per request) ────────────────────────────
 * 1. WorkspaceInterceptor checks out ONE pg Client from the pool per request.
 * 2. It calls resolve_user_workspace($stUserId) (SECURITY DEFINER, RLS-exempt).
 * 3. It runs SET app.workspace_id = $wsId SESSION-LEVEL on that dedicated client.
 * 4. It wraps the client in a Drizzle instance and stores it in this ALS store.
 * 5. Repositories call getDb(this.db) at call-time — returns ALS handle in a
 *    request, else the injected singleton for bootstrap/background paths.
 * 6. In finally, the interceptor runs RESET app.workspace_id (surgical — CARRY [c]:
 *    NOT DISCARD ALL) then releases the client back to the pool.
 *
 * ── No-leak invariant ────────────────────────────────────────────────────────
 * RESET app.workspace_id in finally fires even on exception before client release.
 * Proven by the negative-read e2e (task df2f3b2f) no-GUC-leak assertion.
 */

import { AsyncLocalStorage } from 'node:async_hooks';
import type { Database } from './db.provider';

/** Per-request workspace context carried in ALS. */
export interface WorkspaceRequestContext {
  /** The Drizzle handle bound to the dedicated GUC-set pg Client for this request. */
  db: Database;
  /** The resolved workspace id (UUID string). */
  workspaceId: string;
}

/** Module-level ALS store — ONE instance, shared across all requests. */
export const workspaceAls = new AsyncLocalStorage<WorkspaceRequestContext>();

/**
 * getDb — resolve the correct Drizzle handle for the current execution context.
 *
 * In a request context (ALS store set by WorkspaceInterceptor): returns the
 * ALS-stored handle bound to the GUC-set dedicated client.
 *
 * Outside a request (bootstrap / health check / background jobs): returns the
 * caller-supplied fallback (the injected singleton). No GUC is set on the
 * singleton → RLS USING clause evaluates NULL = uuid → false → 0 tenant rows
 * returned (fail-closed). Health checks and bootstrap use non-tenant tables.
 *
 * Usage in repositories:
 *   private get _db(): Database { return getDb(this.db); }
 * or inline: `getDb(this.db).select()...`
 */
export function getDb(fallback: Database): Database {
  return workspaceAls.getStore()?.db ?? fallback;
}

/**
 * getWorkspaceId — returns the current request's workspace id from ALS.
 * Returns null when called outside a request context.
 * Used by INSERT sites to set workspaceId via ALS rather than current_setting.
 */
export function getWorkspaceId(): string | null {
  return workspaceAls.getStore()?.workspaceId ?? null;
}

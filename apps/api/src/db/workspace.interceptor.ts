/**
 * WorkspaceInterceptor — request-scoped workspace GUC propagation.
 *
 * Wave-17 (task 96026365) — P-4 F1 CRITICAL + P-4 F2 HIGH.
 * B-6 rework (df2f3b2f): replaced parameterized SET with SELECT set_config().
 *
 * For every request:
 *   1. Checks out ONE pg PoolClient from the shared pool (dedicated to this request).
 *   2. If a server-verified SuperTokens session exists, calls the SECURITY DEFINER
 *      fn resolve_user_workspace($stUserId) — RLS-exempt bootstrap; returns
 *      (workspace_id, role_name). stUserId is from the SERVER-VERIFIED session
 *      subject — NEVER client-supplied (CARRY [b]).
 *   3. Runs SELECT set_config('app.workspace_id', $1, false) SESSION-LEVEL on that
 *      dedicated client. is_local=false means session-scoped (persists for the
 *      request lifetime on this dedicated client).  PostgreSQL's SET command does
 *      NOT accept bind parameters ($1) — set_config() is the correct parameterized
 *      form and is injection-safe.
 *   4. Wraps the PoolClient in a Drizzle instance and stores it + workspaceId in ALS.
 *   5. next.handle() — the entire request handler runs within this ALS context.
 *   6. finalize: RESET app.workspace_id (CARRY [c]: surgical RESET, NOT DISCARD ALL)
 *      then releases the PoolClient back to the pool.
 *
 * Unauthenticated paths: no session → no GUC set → RLS denies tenant tables (fail-closed).
 *
 * No-leak invariant: RESET fires in finalize even if the handler throws or the
 * Observable completes with an error. Proven by the negative-read e2e F1 assertion.
 */

import {
  type CallHandler,
  type ExecutionContext,
  Injectable,
  type NestInterceptor,
} from '@nestjs/common';
import { drizzle } from 'drizzle-orm/node-postgres';
import type { PoolClient } from 'pg';
import { from, Observable } from 'rxjs';
import { finalize, switchMap } from 'rxjs/operators';
import type { RequestWithSession } from '../modules/auth/guards/session.guard';
import type { Database } from './db.provider';
import { pool } from './index';
import * as schema from './schema';
import { workspaceAls } from './workspace-context';

@Injectable()
export class WorkspaceInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const req = context.switchToHttp().getRequest<RequestWithSession>();

    // SERVER-VERIFIED session subject — set by SessionGuard via Session.getSession().
    // Undefined for unauthenticated routes (no SessionGuard applied).
    const stUserId: string | undefined = req.session?.getUserId();

    // Checkout + resolver as an Observable. Using from() converts the Promise.
    return from(this.setupClient(stUserId)).pipe(
      switchMap(({ client, clientDb, workspaceId }) => {
        const ctx = { db: clientDb, workspaceId: workspaceId ?? '' };

        // Wrap the handler Observable inside workspaceAls.run so that every
        // async continuation within the request sees the ALS context.
        const handlerInAls$ = new Observable<unknown>((subscriber) => {
          workspaceAls.run(ctx, () => {
            next.handle().subscribe(subscriber);
          });
        });

        return handlerInAls$.pipe(
          finalize(async () => {
            // CARRY [c]: surgical RESET, NOT DISCARD ALL.
            // Clears app.workspace_id before the client is returned to the pool.
            // DISCARD ALL is too broad — it resets all session state including
            // prepared statements, which breaks pooling semantics.
            try {
              await client.query('RESET app.workspace_id');
            } finally {
              client.release();
            }
          })
        );
      })
    );
  }

  private async setupClient(stUserId: string | undefined): Promise<{
    client: PoolClient;
    clientDb: Database;
    workspaceId: string | null;
  }> {
    const client = await pool.connect();
    const clientDb = drizzle(client, { schema }) as unknown as Database;

    let workspaceId: string | null = null;

    if (stUserId) {
      try {
        const result = await client.query<{ workspace_id: string; role_name: string }>(
          'SELECT workspace_id, role_name FROM resolve_user_workspace($1)',
          [stUserId]
        );
        const row = result.rows[0];
        if (row?.workspace_id) {
          workspaceId = row.workspace_id;
          // set_config() is the parameterized, injection-safe form of SET.
          // is_local=false → session-scoped on THIS dedicated client.
          // PostgreSQL's SET command does NOT accept bind parameters; this is
          // the correct form. If this throws, the request fails-closed (the
          // catch below re-throws so GUC failures are never silently swallowed).
          await client.query('SELECT set_config($1, $2, false)', [
            'app.workspace_id',
            workspaceId,
          ]);
        }
      } catch (err) {
        // Re-throw: resolver failure OR GUC-set failure → fail-closed loudly.
        // The caller releases the client in the finalize block; we must still
        // release here since the finally in intercept() only runs after
        // setupClient() resolves successfully.
        client.release();
        throw err;
      }
    }

    return { client, clientDb, workspaceId };
  }
}

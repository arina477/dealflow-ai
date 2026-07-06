/**
 * WorkspaceInterceptor — request-scoped workspace GUC propagation.
 *
 * Wave-17 (task 96026365) — P-4 F1 CRITICAL + P-4 F2 HIGH.
 *
 * For every request:
 *   1. Checks out ONE pg PoolClient from the shared pool (dedicated to this request).
 *   2. If a server-verified SuperTokens session exists, calls the SECURITY DEFINER
 *      fn resolve_user_workspace($stUserId) — RLS-exempt bootstrap; returns
 *      (workspace_id, role_name). stUserId is from the SERVER-VERIFIED session
 *      subject — NEVER client-supplied (CARRY [b]).
 *   3. Runs SET app.workspace_id = $wsId SESSION-LEVEL on that dedicated client.
 *      Session-level SET binds to THIS connection only; no other pooled connection is
 *      affected.
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
import { Observable, from } from 'rxjs';
import { finalize, switchMap } from 'rxjs/operators';

import type { Database } from './db.provider';
import { pool } from './index';
import * as schema from './schema';
import { workspaceAls } from './workspace-context';
import type { RequestWithSession } from '../modules/auth/guards/session.guard';

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
          // SET session-level on THIS dedicated client only.
          await client.query('SET app.workspace_id = $1', [workspaceId]);
        }
      } catch {
        // Resolver failed (function unavailable, user not found).
        // Proceed without GUC — RLS denies tenant reads (fail-closed).
      }
    }

    return { client, clientDb, workspaceId };
  }
}

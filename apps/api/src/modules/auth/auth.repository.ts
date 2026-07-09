/**
 * Auth repository (wave-2, task e15f71dd / e1c0e81e).
 *
 * All app-DB access for the auth module: invite create/validate/consume (with
 * the concurrent-consumption row lock), user create (1:1 supertokens_user_id
 * mapping), and role resolution for the session claim.
 *
 * No SuperTokens SDK calls live here — this is the app-DB boundary only. The
 * two-system write (Core signUp + these app-DB writes) is orchestrated in the
 * service; the repository exposes a transaction-scoped consume+create pair so
 * the service can run them atomically.
 *
 * Wave-17 DEV-1 fix: pre-auth invite bootstrap uses the SECURITY DEFINER
 * function resolve_invite(token_hash) to bypass FORCE RLS on the invites table.
 * consumeInviteAndCreateUser runs in runInTransactionWithWorkspace so the
 * transaction connection has the correct GUC set.
 */

import { Inject, Injectable } from '@nestjs/common';
import { and, eq, gt, isNull, sql } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/node-postgres';
import type { Database } from '../../db/db.provider';
import { DB } from '../../db/db.provider';
import { pool } from '../../db/index';
import * as schema from '../../db/schema';
import { invites, roles, users } from '../../db/schema/users-roles';
import { getDb, getWorkspaceId } from '../../db/workspace-context';
// DEFAULT_WORKSPACE_ID import removed (Finding #4, B-6 rework2): createInvite now
// fails-closed instead of falling back to a default workspace when the ALS context
// is missing. This prevents silent cross-workspace invite placement.

export interface InviteRow {
  id: string;
  token: string;
  email: string;
  roleId: string;
  expiry: string;
  consumedAt: string | null;
}

export interface CreatedUser {
  id: string;
  supertokensUserId: string;
  email: string;
  roleId: string;
  roleName: string;
}

/** Resolved invite bootstrap data returned by getInviteEmail (DEV-1 fix). */
export interface InviteBootstrap {
  email: string;
  workspaceId: string;
}

/** Transaction handle type accepted by the atomic consume+create path. */
type Tx = Parameters<Parameters<Database['transaction']>[0]>[0];

/**
 * Assert a single-row result set has its row. Used after INSERT ... RETURNING
 * and FK-guaranteed lookups where a missing row means a broken invariant, not a
 * normal outcome — throws rather than silently returning undefined.
 */
function expectOne<T>(rows: T[], what: string): T {
  const row = rows[0];
  if (row === undefined) {
    throw new Error(`Invariant violation: expected exactly one ${what} row`);
  }
  return row;
}

@Injectable()
export class AuthRepository {
  constructor(@Inject(DB) private readonly db: Database) {}

  /** Resolve the role id for a role name; null if the name is not in the table. */
  async findRoleIdByName(name: string): Promise<string | null> {
    // roles is excluded from RLS (global RBAC lookup, no workspace_id column).
    const rows = await this.db
      .select({ id: roles.id })
      .from(roles)
      .where(eq(roles.name, name))
      .limit(1);
    return rows[0]?.id ?? null;
  }

  /**
   * Create an invite row. `tokenHash` is the hashed-at-rest token (the caller
   * hashes the crypto-random plaintext; only the hash is stored).
   */
  async createInvite(input: {
    tokenHash: string;
    email: string;
    roleId: string;
    invitedBy: string | null;
    expiry: string;
  }): Promise<{ id: string }> {
    // Finding #4 (B-6 rework2): fail-closed — workspace MUST be resolved from the
    // authenticated admin's ALS context. getWorkspaceId() returns null for missing/empty
    // (unauthenticated path, or interceptor threw for authenticated-but-no-workspace).
    // Never fall back to DEFAULT_WORKSPACE_ID: an invite created with the wrong workspace
    // would place the new user in the default workspace regardless of which admin issued it,
    // silently defeating the per-workspace isolation. Throw so the caller gets a 500 that
    // surfaces the misconfiguration loudly instead of silently cross-placing data.
    const workspaceId = getWorkspaceId();
    if (!workspaceId) {
      throw new Error(
        '[createInvite] No workspace context in ALS — cannot create invite without a resolved workspace. ' +
          'Ensure the request is authenticated and the WorkspaceInterceptor has run.'
      );
    }
    const rows = await getDb(this.db)
      .insert(invites)
      .values({
        token: input.tokenHash,
        email: input.email.toLowerCase(),
        roleId: input.roleId,
        invitedBy: input.invitedBy,
        expiry: input.expiry,
        // workspaceId sourced from ALS (authenticated admin creating the invite).
        workspaceId,
      })
      .returning({ id: invites.id });
    return expectOne(rows, 'invite');
  }

  /**
   * Pre-check: email + workspace_id attached to a present, unexpired, unconsumed
   * invite for this token hash; null otherwise.
   *
   * Wave-17 DEV-1 fix: invites has FORCE RLS. This method runs during pre-auth
   * signup (no session → no GUC set). Instead of a Drizzle query through the
   * RLS-gated path (which returns 0 rows when the GUC is unset), we call the
   * SECURITY DEFINER function resolve_invite(token_hash) via raw SQL on the pool
   * singleton. The function runs as its DEFINER (table owner) → bypasses RLS →
   * returns the invite row regardless of the GUC state.
   *
   * The token_hash is the capability (unguessable SHA-256 of the plaintext token).
   * A caller cannot enumerate other invites — the function filters to the single
   * row matching the hash AND unconsumed AND unexpired.
   *
   * Returns { email, workspaceId } so the service can:
   *   (a) pass email to EmailPassword.signUp
   *   (b) pass workspaceId to runInTransactionWithWorkspace so the consume
   *       transaction has the correct GUC set (required for FORCE RLS on both
   *       invites UPDATE and users INSERT).
   */
  async getInviteEmail(tokenHash: string): Promise<InviteBootstrap | null> {
    const result = await pool.query<{ email: string; workspace_id: string }>(
      'SELECT email, workspace_id FROM resolve_invite($1)',
      [tokenHash]
    );
    const row = result.rows[0];
    if (!row) return null;
    return { email: row.email, workspaceId: row.workspace_id };
  }

  /**
   * Resolve the role NAME for a SuperTokens user id via the app-DB users row.
   * This is the authoritative source for the session `role` claim. Returns null
   * when no users row exists for the id (claim is then omitted).
   *
   * NOTE: uses getDb(this.db) — RLS-gated. Call this ONLY from within a request
   * context where the WorkspaceInterceptor has already set the ALS GUC. Calling
   * this pre-interceptor (e.g. from a guard or SuperTokens callback) returns 0
   * rows under dealflow_app (FORCE RLS, no GUC set) → null → 403-everything.
   * Use resolveRoleRlsExempt() instead for pre-interceptor callers.
   */
  async resolveRoleBySupertokensUserId(supertokensUserId: string): Promise<string | null> {
    const rows = await getDb(this.db)
      .select({ roleName: roles.name })
      .from(users)
      .innerJoin(roles, eq(users.roleId, roles.id))
      .where(eq(users.supertokensUserId, supertokensUserId))
      .limit(1);
    return rows[0]?.roleName ?? null;
  }

  /**
   * RLS-EXEMPT role resolver for PRE-INTERCEPTOR callers (B-6 rework3).
   *
   * Problem: RolesGuard.canActivate and the SuperTokens session-claim callback
   * (main.ts resolveRole) both run BEFORE the WorkspaceInterceptor sets the
   * app.workspace_id GUC on a dedicated ALS connection. Under dealflow_app
   * (NOSUPERUSER, FORCE RLS), a users SELECT with no GUC returns 0 rows →
   * null role → 403 for every @Roles()-guarded endpoint.
   *
   * Fix: call the SECURITY DEFINER function resolve_user_workspace(st_user_id)
   * (migration 0014 step 7) via pool.query — identical pattern to getInviteEmail.
   * The function runs as its DEFINER (table owner) → bypasses FORCE RLS → returns
   * the user's (workspace_id, role_name) regardless of GUC state.
   * EXECUTE is already granted to dealflow_app (migration 0016 step 5).
   *
   * SECURITY properties (same as resolve_user_workspace design):
   *   • Accepts only the SERVER-VERIFIED SuperTokens session subject (never
   *     client-supplied). The guard obtains it from session.getUserId() after
   *     Session.getSession() — server-verified on every guarded request.
   *   • Returns ONLY the caller's own role_name (minimal surface).
   *   • DB-authoritative: re-resolves per request, NOT from the stale JWT claim.
   *
   * Returns null when no users row exists for the id (guard then denies 403).
   */
  async resolveRoleRlsExempt(supertokensUserId: string): Promise<string | null> {
    const result = await pool.query<{ role_name: string }>(
      'SELECT role_name FROM resolve_user_workspace($1)',
      [supertokensUserId]
    );
    return result.rows[0]?.role_name ?? null;
  }

  /** Look up a user + role by SuperTokens user id (used by GET /auth/me). */
  async findUserBySupertokensUserId(
    supertokensUserId: string
  ): Promise<{ email: string; roleName: string } | null> {
    const rows = await getDb(this.db)
      .select({ email: users.email, roleName: roles.name })
      .from(users)
      .innerJoin(roles, eq(users.roleId, roles.id))
      .where(eq(users.supertokensUserId, supertokensUserId))
      .limit(1);
    return rows[0] ?? null;
  }

  /**
   * Translate a SuperTokens user id to the app-DB users row needed for FK-safe
   * writes (CRUD actor identity + DB-authoritative role).
   *
   * Returns `{ id, roleName }` where `id` is `users.id` (the UUID FK-safe for
   * `compliance_rules.created_by`, audit `actor_user_id`, etc.) and `roleName`
   * is the DB-authoritative role (replaces the stale JWT claim previously used
   * as audit `actorRole`).
   *
   * Returns `null` when no `users` row exists for the given SuperTokens id.
   * Callers MUST fail closed (throw / 401) on null — never INSERT a null actor.
   */
  async getUserWithRole(
    supertokensUserId: string
  ): Promise<{ id: string; roleName: string; workspaceId: string } | null> {
    const rows = await getDb(this.db)
      .select({ id: users.id, roleName: roles.name, workspaceId: users.workspaceId })
      .from(users)
      .innerJoin(roles, eq(users.roleId, roles.id))
      .where(eq(users.supertokensUserId, supertokensUserId))
      .limit(1);
    return rows[0] ?? null;
  }

  /**
   * Atomically consume a valid invite and create the mapped app-DB users row.
   *
   * Concurrency guard (security invariant: exactly one concurrent signup wins):
   *   - runs inside a transaction supplied by the caller;
   *   - `SELECT ... FOR UPDATE` row-locks the matching unconsumed, unexpired
   *     invite so a competing transaction blocks until this one commits/aborts;
   *   - the `consumed_at IS NULL` + `expiry > now()` predicate is evaluated
   *     UNDER the lock, so the loser re-reads a consumed row and gets null.
   *
   * Returns null when no valid invite matches (expired / consumed / unknown /
   * lost the race) — the caller maps null to a 4xx and creates NO account.
   *
   * NOTE: the caller must NOT have created the SuperTokens user before invite
   * validation succeeds here; ordering is enforced in the service.
   *
   * Wave-17 DEV-1 fix: this method is called via runInTransactionWithWorkspace
   * so the transaction connection has app.workspace_id set to the invite's
   * workspace_id. Both the SELECT/UPDATE on invites and the INSERT on users
   * are RLS-gated by FORCE RLS; the GUC must match workspace_id for them to
   * see/write rows.
   */
  async consumeInviteAndCreateUser(
    tx: Tx,
    input: {
      tokenHash: string;
      supertokensUserId: string;
    }
  ): Promise<CreatedUser | null> {
    // Row-lock the candidate invite. FOR UPDATE serialises concurrent
    // consumers of the same token; the predicate re-checks validity under lock.
    const locked = await tx
      .select({
        id: invites.id,
        email: invites.email,
        roleId: invites.roleId,
        workspaceId: invites.workspaceId,
      })
      .from(invites)
      .where(
        and(
          eq(invites.token, input.tokenHash),
          isNull(invites.consumedAt),
          gt(invites.expiry, sql`now()`)
        )
      )
      .for('update')
      .limit(1);

    const invite = locked[0];
    if (!invite) {
      return null;
    }

    // Mark consumed (still under lock). consumed_at IS NULL in the predicate
    // makes this a no-op if a racing tx already consumed it — defence in depth.
    const consumed = await tx
      .update(invites)
      .set({ consumedAt: sql`now()` })
      .where(and(eq(invites.id, invite.id), isNull(invites.consumedAt)))
      .returning({ id: invites.id });

    if (consumed.length === 0) {
      return null;
    }

    // Create the app-DB users row mapping supertokens_user_id 1:1.
    // workspaceId is inherited from the invite row (set when the invite was created).
    const inserted = await tx
      .insert(users)
      .values({
        supertokensUserId: input.supertokensUserId,
        email: invite.email.toLowerCase(),
        roleId: invite.roleId,
        workspaceId: invite.workspaceId,
      })
      .returning({
        id: users.id,
        supertokensUserId: users.supertokensUserId,
        email: users.email,
        roleId: users.roleId,
      });

    const roleRow = await tx
      .select({ name: roles.name })
      .from(roles)
      .where(eq(roles.id, invite.roleId))
      .limit(1);

    // INSERT ... RETURNING and the role FK lookup each yield exactly one row
    // (role_id is a non-null FK into roles, guaranteed present).
    return {
      ...expectOne(inserted, 'user'),
      roleName: expectOne(roleRow, 'role').name,
    };
  }

  /**
   * Run a transaction on a dedicated pool connection with app.workspace_id set
   * to workspaceId for the duration of the transaction.
   *
   * Wave-17 DEV-1 fix: the pre-auth signup path has no ALS context (no request
   * interceptor ran before signup). The invites UPDATE and users INSERT both
   * require the GUC to be set (FORCE RLS). This method:
   *   1. Checks out a dedicated pg PoolClient.
   *   2. Wraps the client in a Drizzle instance.
   *   3. Opens the Drizzle transaction. The FIRST statement INSIDE the transaction
   *      is SELECT set_config('app.workspace_id', $1, true) — is_local=true (SET LOCAL):
   *      the GUC is scoped to the transaction and automatically reset when the tx
   *      commits or rolls back. Critically, this runs WITHIN the BEGIN…COMMIT block,
   *      so it is in effect for all subsequent statements in the transaction.
   *   4. Calls the caller's work callback with the transaction handle.
   *   5. RESETS app.workspace_id and releases the client in finally (defence in
   *      depth — SET LOCAL auto-resets on tx end, but we still explicitly clean up
   *      in case future refactors extend the client lifetime beyond this call).
   *
   * B-6 rework2 (Finding #1 — GUC-inside-tx): previously set_config was called as a
   *   STANDALONE client.query() OUTSIDE the Drizzle transaction(). A standalone query
   *   runs in its own autocommit transaction. SET LOCAL (is_local=true) scopes the GUC
   *   to the current transaction — but the autocommit tx ends immediately after the
   *   query, so the GUC was reset before Drizzle's BEGIN. The fix: run set_config as the
   *   FIRST statement INSIDE clientDb.transaction(), where it is in the same BEGIN block
   *   as the invites UPDATE and users INSERT.
   *
   * The workspaceId is sourced from the invite row via resolve_invite() —
   * server-derived, never client-supplied. Cross-workspace placement is
   * structurally impossible: the invitee joins the INVITE'S workspace.
   */
  async runInTransactionWithWorkspace<T>(
    workspaceId: string,
    work: (tx: Tx) => Promise<T>
  ): Promise<T> {
    const client = await pool.connect();
    const clientDb = drizzle(client, { schema }) as unknown as Database;
    try {
      return await clientDb.transaction(async (tx) => {
        // SET LOCAL (is_local=true) scopes the GUC to THIS transaction.
        // This is now the FIRST statement in the BEGIN block, so it is in effect
        // for all subsequent statements (SELECT/UPDATE/INSERT) in this transaction.
        // Parameterized + injection-safe: PostgreSQL's SET command does NOT accept
        // bind parameters ($1); set_config() is the correct form.
        await client.query('SELECT set_config($1, $2, true)', ['app.workspace_id', workspaceId]);
        return work(tx);
      });
    } finally {
      // Surgical RESET — not DISCARD ALL (mirrors WorkspaceInterceptor CARRY [c]).
      // Defence-in-depth: SET LOCAL auto-resets on tx commit/rollback. We still
      // reset here in case future refactors extend the client lifetime beyond this tx.
      try {
        await client.query('RESET app.workspace_id');
      } finally {
        client.release();
      }
    }
  }

  /**
   * Create a brand-new firm workspace + first admin user atomically via the
   * create_firm_workspace SECURITY DEFINER function (migration 0021).
   *
   * WHY SECURITY DEFINER:
   *   A brand-new user has NO workspace context. app.workspace_id GUC is unset.
   *   workspaces INSERT: workspaces has no RLS, so direct INSERT would work, but
   *   users INSERT has FORCE RLS → NULL = uuid → false → INSERT blocked.
   *   The SECURITY DEFINER function runs as the table owner (DEFINER) and bypasses
   *   RLS for both INSERTs atomically, just like resolve_invite does for the
   *   invite-based signup bootstrap.
   *
   * SECURITY INVARIANTS (enforced in the function body, not here):
   *   • workspace_id is SERVER-MINTED (gen_random_uuid()) inside the DB function.
   *     This method accepts NO workspace_id from the caller — it is structurally
   *     impossible to steer the INSERT to an existing firm.
   *   • firmName is DATA (maps to workspace.name only).
   *   • role is always 'admin' (resolved from the roles table by name inside the function).
   *
   * Returns { workspaceId, userId, roleName } so the service can mint the session.
   * Returns null if the admin role is missing from the roles table (invariant violation
   * — the function raises; we surface it as null + the service compensates).
   */
  async createFirmWorkspace(input: {
    supertokensUserId: string;
    email: string;
    firmName: string;
  }): Promise<{ workspaceId: string; userId: string; roleName: string } | null> {
    const result = await pool.query<{
      workspace_id: string;
      user_id: string;
      role_name: string;
    }>('SELECT workspace_id, user_id, role_name FROM create_firm_workspace($1, $2, $3)', [
      input.supertokensUserId,
      input.email.toLowerCase(),
      input.firmName,
    ]);
    const row = result.rows[0];
    if (!row) return null;
    return {
      workspaceId: row.workspace_id,
      userId: row.user_id,
      roleName: row.role_name,
    };
  }

  /** Expose the underlying db handle so the service can open a transaction. */
  runInTransaction<T>(work: (tx: Tx) => Promise<T>): Promise<T> {
    return getDb(this.db).transaction(work);
  }
}

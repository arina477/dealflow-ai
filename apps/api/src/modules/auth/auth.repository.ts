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
 */

import { Inject, Injectable } from '@nestjs/common';
import { and, eq, gt, isNull, sql } from 'drizzle-orm';
import type { Database } from '../../db/db.provider';
import { DB } from '../../db/db.provider';
import { invites, roles, users } from '../../db/schema/users-roles';

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
    const rows = await this.db
      .insert(invites)
      .values({
        token: input.tokenHash,
        email: input.email.toLowerCase(),
        roleId: input.roleId,
        invitedBy: input.invitedBy,
        expiry: input.expiry,
      })
      .returning({ id: invites.id });
    return expectOne(rows, 'invite');
  }

  /**
   * Pre-check: email attached to a present, unexpired, unconsumed invite for
   * this token hash; null otherwise. Used BEFORE creating the Core user so the
   * invite-only invariant holds (invalid invite → no Core user created) AND to
   * supply the email for EmailPassword.signUp. This unlocked read is NOT a
   * substitute for the locked re-check in consumeInviteAndCreateUser — it only
   * rejects the obviously-invalid case early.
   */
  async getInviteEmail(tokenHash: string): Promise<string | null> {
    const rows = await this.db
      .select({ email: invites.email })
      .from(invites)
      .where(
        and(
          eq(invites.token, tokenHash),
          isNull(invites.consumedAt),
          gt(invites.expiry, sql`now()`)
        )
      )
      .limit(1);
    return rows[0]?.email ?? null;
  }

  /**
   * Resolve the role NAME for a SuperTokens user id via the app-DB users row.
   * This is the authoritative source for the session `role` claim. Returns null
   * when no users row exists for the id (claim is then omitted).
   */
  async resolveRoleBySupertokensUserId(supertokensUserId: string): Promise<string | null> {
    const rows = await this.db
      .select({ roleName: roles.name })
      .from(users)
      .innerJoin(roles, eq(users.roleId, roles.id))
      .where(eq(users.supertokensUserId, supertokensUserId))
      .limit(1);
    return rows[0]?.roleName ?? null;
  }

  /** Look up a user + role by SuperTokens user id (used by GET /auth/me). */
  async findUserBySupertokensUserId(
    supertokensUserId: string
  ): Promise<{ email: string; roleName: string } | null> {
    const rows = await this.db
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
  ): Promise<{ id: string; roleName: string } | null> {
    const rows = await this.db
      .select({ id: users.id, roleName: roles.name })
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
    const inserted = await tx
      .insert(users)
      .values({
        supertokensUserId: input.supertokensUserId,
        email: invite.email.toLowerCase(),
        roleId: invite.roleId,
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

  /** Expose the underlying db handle so the service can open a transaction. */
  runInTransaction<T>(work: (tx: Tx) => Promise<T>): Promise<T> {
    return this.db.transaction(work);
  }
}

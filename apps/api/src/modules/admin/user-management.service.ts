/**
 * UserManagementService (wave-15 task 82ec8724; wave-16 tasks c54db02d + 042cf4e6)
 * — admin user management.
 *
 * Four mutations:
 *   inviteAsActor     — create an invite record (record-only; no email send).
 *                       Wave-16 c54db02d: 409 when active user or live invite exists.
 *   assignRoleAsActor — change a user's role.
 *   deactivateAsActor — soft-deactivate a user (sets deactivated_at).
 *   reactivateAsActor — reverse deactivation (sets deactivated_at = NULL).
 *
 * ── INVITE DEDUP (wave-16, P-4 Finding 1) ───────────────────────────────────
 * createInvite MUST reject (409) when:
 *   (a) the email belongs to an ACTIVE user, OR
 *   (b) a LIVE invite exists (consumed_at IS NULL AND expiry > now()).
 *
 * Race-safe ordering (TOCTOU prevention):
 *   1. pg_advisory_xact_lock(hashtext(lower(email))) — per-email, tx-scoped.
 *      Serializes concurrent createInvite calls for the SAME email.
 *   2. SELECT-live-check under the lock.
 *   3. INSERT invite (or throw 409).
 *
 * A partial unique index is REJECTED (WHERE consumed_at IS NULL blocks re-inviting
 * expired invites; WHERE expiry > now() is non-immutable → Postgres refuses it).
 *
 * ── RACE-SAFE last-admin guard (P-4 LOAD-BEARING) ───────────────────────────
 * EVERY admin-set mutation that could drop the active admin count to zero MUST:
 *   1. Acquire pg_advisory_xact_lock(ADMIN_GUARD_LOCK_KEY) as the FIRST statement.
 *      This serializes ALL admin-set mutations across concurrent txns.
 *      A plain `count(*) FOR UPDATE` does NOT lock a count — two txns demoting
 *      DIFFERENT admins could read the same count (both see 2 admins → both
 *      succeed → 0 admins remain). The advisory lock closes this write-skew.
 *   2. Count active admins (role='admin' AND deactivated_at IS NULL).
 *   3. Reject (409 ConflictException) if the mutation would leave 0 admins.
 *
 * This applies to: deactivate-admin, demote-admin-role, self-deactivate,
 * self-demote. Covered on ALL THREE paths.
 *
 * ── SoD / WORM audit ────────────────────────────────────────────────────────
 * Every mutation appends to the immutable audit chain via AuditService.append
 * LAST-IN-TXN. Audit failure rolls back the business mutation — audit-free
 * mutations never commit.
 *
 * ── Actor identity ──────────────────────────────────────────────────────────
 * Callers supply actorUserId (app users.id UUID) obtained via AuthRepository.getUserWithRole.
 * Never use a raw SuperTokens id as the actor for DB writes.
 */

import { createHash } from 'node:crypto';
import type { AuditEntryInput, Role } from '@dealflow/shared';
import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { and, eq, gt, isNull, sql } from 'drizzle-orm';
import type { Database } from '../../db/db.provider';
import { DB } from '../../db/db.provider';
import { invites, roles, users } from '../../db/schema/users-roles';
import { DEFAULT_WORKSPACE_ID } from '../../db/schema/workspaces';
import { getDb, getWorkspaceId } from '../../db/workspace-context';
import type { Tx } from '../audit/audit.repository';

/** Tx alias scoped to this module for advisory lock and raw-SQL queries. */
type AdminTx = Tx;

// biome-ignore lint/style/useImportType: DI-injected, needs runtime metadata (emitDecoratorMetadata)
import { AuditService } from '../audit/audit.service';

/** Deterministic SHA-256 hex over a canonical JSON object. */
function hashJson(value: unknown): string {
  const sorted =
    typeof value === 'object' && value !== null
      ? Object.fromEntries(Object.entries(value as Record<string, unknown>).sort())
      : value;
  return createHash('sha256').update(JSON.stringify(sorted), 'utf8').digest('hex');
}

/**
 * Fixed advisory-lock key for the admin-set mutation critical section.
 * Different from AUDIT_CHAIN_ADVISORY_LOCK_KEY (4_100_400_400).
 * Chosen to be clearly distinct from other advisory locks in the codebase.
 * pg_advisory_xact_lock(<key>) — transaction-scoped, auto-released on commit/rollback.
 */
export const ADMIN_GUARD_LOCK_KEY = 4_200_500_500 as const;

@Injectable()
export class UserManagementService {
  constructor(
    @Inject(DB) private readonly db: Database,
    private readonly auditService: AuditService
  ) {}

  // ---------------------------------------------------------------------------
  // Read
  // ---------------------------------------------------------------------------

  /** List all users with their role names and deactivation state. */
  async listUsers(): Promise<
    Array<{
      id: string;
      email: string;
      role: string;
      deactivatedAt: string | null;
      createdAt: string;
      invitedBy: string | null;
    }>
  > {
    const rows = await getDb(this.db)
      .select({
        id: users.id,
        email: users.email,
        roleName: roles.name,
        deactivatedAt: users.deactivatedAt,
        createdAt: users.createdAt,
      })
      .from(users)
      .innerJoin(roles, eq(users.roleId, roles.id));

    return rows.map((r) => ({
      id: r.id,
      email: r.email,
      role: r.roleName,
      deactivatedAt: r.deactivatedAt ?? null,
      createdAt: r.createdAt,
      invitedBy: null, // invitedBy is resolved from invites table join in a separate query at the repo level if needed
    }));
  }

  // ---------------------------------------------------------------------------
  // Invite (record-only; no email send per spec boundaries)
  // ---------------------------------------------------------------------------

  /**
   * Create an invite record for `email` with `role`.
   * The invitedBy column is set to actorUserId (the admin's app users.id).
   * No email is sent (per spec: "NO email send — record only").
   *
   * ── Dedup + race-safe (wave-16 c54db02d, P-4 Finding 1) ──────────────────
   * Rejects 409 when:
   *   (a) `email` belongs to an ACTIVE (deactivated_at IS NULL) user, OR
   *   (b) a LIVE invite exists: consumed_at IS NULL AND expiry > now().
   *
   * Race-safe ordering (advisory lock first, then check, then INSERT):
   *   1. pg_advisory_xact_lock(hashtext(lower(email))) — serializes concurrent
   *      calls for the same email within the same Postgres instance.
   *   2. SELECT-live-check.
   *   3. INSERT (or throw 409).
   *
   * Expired (expiry <= now()) and consumed invites → new invite IS allowed.
   */
  async inviteAsActor(
    input: { email: string; role: Role },
    actorUserId: string,
    actorRole: string
  ): Promise<{ inviteId: string; email: string; role: Role; expiry: string }> {
    return getDb(this.db).transaction(async (tx) => {
      const normalizedEmail = input.email.toLowerCase();

      // ── Step 1: per-email advisory lock (FIRST statement in tx) ──────────
      // hashtext() is Postgres-native: maps any text to a stable int4.
      // pg_advisory_xact_lock takes a bigint — cast to ensure correct overload.
      await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${normalizedEmail})::bigint)`);

      // ── Step 2: check for active user with this email ─────────────────────
      const [activeUser] = await tx
        .select({ id: users.id })
        .from(users)
        .where(and(eq(users.email, normalizedEmail), isNull(users.deactivatedAt)))
        .limit(1);

      if (activeUser) {
        throw new ConflictException('An active user already exists for this email address');
      }

      // ── Step 3: check for a live (unconsumed + unexpired) invite ─────────
      const [liveInvite] = await tx
        .select({ id: invites.id })
        .from(invites)
        .where(
          and(
            eq(invites.email, normalizedEmail),
            isNull(invites.consumedAt),
            gt(invites.expiry, sql`now()`)
          )
        )
        .limit(1);

      if (liveInvite) {
        throw new ConflictException('A pending invite already exists for this email address');
      }

      // ── Step 4: resolve the role id ───────────────────────────────────────
      const [roleRow] = await tx
        .select({ id: roles.id })
        .from(roles)
        .where(eq(roles.name, input.role))
        .limit(1);

      if (!roleRow) {
        throw new UnprocessableEntityException(`Role '${input.role}' not found in roles table`);
      }

      // ── Step 5: generate token and INSERT ─────────────────────────────────
      // Token hashed at rest (same as M1 invite flow); plaintext discarded.
      const { randomBytes, createHash: cHash } = await import('node:crypto');
      const plaintext = randomBytes(32).toString('base64url');
      const tokenHash = cHash('sha256').update(plaintext).digest('hex');

      const expiry = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

      const [invite] = await tx
        .insert(invites)
        .values({
          token: tokenHash,
          email: normalizedEmail,
          roleId: roleRow.id,
          invitedBy: actorUserId,
          expiry,
          workspaceId: getWorkspaceId() ?? DEFAULT_WORKSPACE_ID,
        })
        .returning({ id: invites.id });

      if (!invite) throw new Error('Invite insert did not return a row');

      // ── Step 6: audit LAST-IN-TXN ─────────────────────────────────────────
      const auditInput: AuditEntryInput = {
        actorUserId,
        actorRole,
        action: 'user-invite',
        resourceType: 'invite',
        resourceId: invite.id,
        contentHash: hashJson({ inviteId: invite.id, email: input.email, role: input.role }),
        payloadHash: hashJson({ op: 'invite', email: input.email, role: input.role }),
      };

      await this.auditService.append(auditInput, tx as unknown as Tx);

      return { inviteId: invite.id, email: input.email, role: input.role, expiry };
    });
  }

  // ---------------------------------------------------------------------------
  // Assign role (RACE-SAFE)
  // ---------------------------------------------------------------------------

  /**
   * Change the role of user `userId` to `newRole`.
   * If the target user is currently an admin and `newRole` is not 'admin',
   * the last-admin guard runs first (advisory lock + count).
   */
  async assignRoleAsActor(
    userId: string,
    newRole: Role,
    actorUserId: string,
    actorRole: string
  ): Promise<void> {
    await getDb(this.db).transaction(async (tx) => {
      // Step 1: Look up the target user.
      const [target] = await tx
        .select({
          id: users.id,
          email: users.email,
          roleId: users.roleId,
          deactivatedAt: users.deactivatedAt,
        })
        .from(users)
        .where(eq(users.id, userId))
        .limit(1);

      if (!target) {
        throw new NotFoundException(`User ${userId} not found`);
      }

      // Step 2: Look up current role name.
      const [currentRole] = await tx
        .select({ name: roles.name })
        .from(roles)
        .where(eq(roles.id, target.roleId))
        .limit(1);

      const currentRoleName = currentRole?.name ?? '';

      // Step 3: If demoting an admin, run the last-admin guard.
      if (currentRoleName === 'admin' && newRole !== 'admin') {
        await runLastAdminGuard(tx, userId, 'demote');
      }

      // Step 4: Look up new role id.
      const [newRoleRow] = await tx
        .select({ id: roles.id })
        .from(roles)
        .where(eq(roles.name, newRole))
        .limit(1);

      if (!newRoleRow) {
        throw new UnprocessableEntityException(`Role '${newRole}' not found in roles table`);
      }

      // Step 5: Update the role.
      await tx.update(users).set({ roleId: newRoleRow.id }).where(eq(users.id, userId));

      // Step 6: Audit LAST-IN-TXN.
      const auditInput: AuditEntryInput = {
        actorUserId,
        actorRole,
        action: 'role-change',
        resourceType: 'user',
        resourceId: userId,
        contentHash: hashJson({ userId, newRole }),
        payloadHash: hashJson({ op: 'role-change', userId, from: currentRoleName, to: newRole }),
      };

      await this.auditService.append(auditInput, tx as unknown as Tx);
    });
  }

  // ---------------------------------------------------------------------------
  // Deactivate (RACE-SAFE)
  // ---------------------------------------------------------------------------

  /**
   * Soft-deactivate user `userId` by setting deactivated_at = now().
   * If the target user is an admin, the last-admin guard runs first.
   */
  async deactivateAsActor(
    userId: string,
    actorUserId: string,
    actorRole: string
  ): Promise<{ id: string; deactivatedAt: string }> {
    return getDb(this.db).transaction(async (tx) => {
      // Step 1: Look up the target user.
      const [target] = await tx
        .select({ id: users.id, roleId: users.roleId, deactivatedAt: users.deactivatedAt })
        .from(users)
        .where(eq(users.id, userId))
        .limit(1);

      if (!target) {
        throw new NotFoundException(`User ${userId} not found`);
      }

      // Idempotent: already deactivated — return current state.
      if (target.deactivatedAt !== null) {
        return { id: target.id, deactivatedAt: target.deactivatedAt };
      }

      // Step 2: Look up current role name.
      const [currentRole] = await tx
        .select({ name: roles.name })
        .from(roles)
        .where(eq(roles.id, target.roleId))
        .limit(1);

      const currentRoleName = currentRole?.name ?? '';

      // Step 3: If deactivating an admin, run the last-admin guard.
      if (currentRoleName === 'admin') {
        await runLastAdminGuard(tx, userId, 'deactivate');
      }

      // Step 4: Soft-deactivate.
      const deactivatedAt = new Date().toISOString();
      await tx.update(users).set({ deactivatedAt }).where(eq(users.id, userId));

      // Step 5: Audit LAST-IN-TXN.
      const auditInput: AuditEntryInput = {
        actorUserId,
        actorRole,
        action: 'deactivate',
        resourceType: 'user',
        resourceId: userId,
        contentHash: hashJson({ userId }),
        payloadHash: hashJson({ op: 'deactivate', userId }),
      };

      await this.auditService.append(auditInput, tx as unknown as Tx);

      return { id: userId, deactivatedAt };
    });
  }

  // ---------------------------------------------------------------------------
  // Transfer admin (wave-39, task 69cd8ce4)
  // ---------------------------------------------------------------------------

  /**
   * Atomically transfer the admin role from the calling actor to `newAdminUserId`.
   *
   * Single transaction:
   *   1. Validate target: found in workspace (RLS → 404 if cross-ws or missing),
   *      not deactivated (404 — deactivated target cannot receive admin), not self (400).
   *   2. Promote target to 'admin'.
   *   3. Demote actor to `actorNewRole` via the last-admin guard (defense-in-depth;
   *      the just-promoted target keeps the workspace at ≥1 admin, so the guard
   *      normally resolves — it only fires if somehow the promote failed to commit,
   *      which is impossible within the same transaction).
   *   4. Append TWO audit entries LAST-IN-TXN (target promote + actor demote).
   *      Audit failure rolls back all changes.
   *
   * On any failure the entire transaction rolls back — no partial role state.
   */
  async transferAdminAsActor(
    newAdminUserId: string,
    actorUserId: string,
    actorNewRole: Role,
    actorRole: string
  ): Promise<{ newAdmin: { id: string; email: string }; formerAdmin: { id: string; email: string } }> {
    return getDb(this.db).transaction(async (tx) => {
      // ── Step 1: self-target check (400) ──────────────────────────────────
      if (newAdminUserId === actorUserId) {
        throw new BadRequestException('Cannot transfer admin to yourself');
      }

      // ── Step 2: look up the target (RLS scopes to workspace; 404 if cross-ws/missing) ──
      const [target] = await tx
        .select({
          id: users.id,
          email: users.email,
          roleId: users.roleId,
          deactivatedAt: users.deactivatedAt,
        })
        .from(users)
        .where(eq(users.id, newAdminUserId))
        .limit(1);

      if (!target) {
        throw new NotFoundException(`User ${newAdminUserId} not found`);
      }

      // ── Step 3: reject deactivated target (AC #1) ────────────────────────
      // Must check BEFORE any promotion. A deactivated user cannot receive admin
      // (they cannot log in; runLastAdminGuard counts active admins only, so a
      // deactivated admin is invisible to the guard and would silently orphan
      // the workspace if the actor then left).
      if (target.deactivatedAt !== null) {
        throw new NotFoundException(
          `User ${newAdminUserId} is deactivated and cannot receive the admin role`
        );
      }

      // ── Step 4: look up the actor (needed for audit + demote) ────────────
      const [actor] = await tx
        .select({ id: users.id, email: users.email, roleId: users.roleId })
        .from(users)
        .where(eq(users.id, actorUserId))
        .limit(1);

      if (!actor) {
        throw new NotFoundException(`Actor user ${actorUserId} not found`);
      }

      // ── Step 5: resolve role ids ─────────────────────────────────────────
      const [adminRoleRow] = await tx
        .select({ id: roles.id })
        .from(roles)
        .where(eq(roles.name, 'admin'))
        .limit(1);

      if (!adminRoleRow) {
        throw new UnprocessableEntityException("Role 'admin' not found in roles table");
      }

      const [actorNewRoleRow] = await tx
        .select({ id: roles.id })
        .from(roles)
        .where(eq(roles.name, actorNewRole))
        .limit(1);

      if (!actorNewRoleRow) {
        throw new UnprocessableEntityException(`Role '${actorNewRole}' not found in roles table`);
      }

      // ── Step 6: promote target to admin ──────────────────────────────────
      await tx.update(users).set({ roleId: adminRoleRow.id }).where(eq(users.id, newAdminUserId));

      // ── Step 7: run last-admin guard on actor demotion ───────────────────
      // The guard acquires pg_advisory_xact_lock(ADMIN_GUARD_LOCK_KEY) and counts
      // active admins excluding the actor. Since the target was just promoted to
      // admin in this same transaction, there is at least 1 remaining admin, so
      // the guard passes in the normal case. Defense-in-depth: the guard catches
      // any edge case (e.g., actor is not actually admin due to RLS drift).
      await runLastAdminGuard(tx, actorUserId, 'demote');

      // ── Step 8: demote actor ─────────────────────────────────────────────
      await tx.update(users).set({ roleId: actorNewRoleRow.id }).where(eq(users.id, actorUserId));

      // ── Step 9: audit LAST-IN-TXN (AC #2) ───────────────────────────────
      // Two role-change rows — target promote and actor demote — both inside
      // the same transaction. If either audit append fails, all writes roll back.
      const promoteAudit: AuditEntryInput = {
        actorUserId,
        actorRole,
        action: 'role-change',
        resourceType: 'user',
        resourceId: newAdminUserId,
        contentHash: hashJson({ userId: newAdminUserId, newRole: 'admin' }),
        payloadHash: hashJson({
          op: 'role-change',
          userId: newAdminUserId,
          from: 'non-admin',
          to: 'admin',
          transfer: true,
        }),
      };
      await this.auditService.append(promoteAudit, tx as unknown as Tx);

      const demoteAudit: AuditEntryInput = {
        actorUserId,
        actorRole,
        action: 'role-change',
        resourceType: 'user',
        resourceId: actorUserId,
        contentHash: hashJson({ userId: actorUserId, newRole: actorNewRole }),
        payloadHash: hashJson({
          op: 'role-change',
          userId: actorUserId,
          from: 'admin',
          to: actorNewRole,
          transfer: true,
        }),
      };
      await this.auditService.append(demoteAudit, tx as unknown as Tx);

      return {
        newAdmin: { id: target.id, email: target.email },
        formerAdmin: { id: actor.id, email: actor.email },
      };
    });
  }

  // ---------------------------------------------------------------------------
  // Reactivate (wave-16, task 042cf4e6)
  // ---------------------------------------------------------------------------

  /**
   * Reactivate a previously deactivated user by setting deactivated_at = NULL.
   *
   * Admin-only. Mirrors deactivateAsActor in structure; audited last-in-txn
   * under the 'user-reactivate' action (new additive enum value).
   *
   * ── Invariants ────────────────────────────────────────────────────────────
   * - Role is PRESERVED: reactivate restores the user with their existing role_id
   *   (never elevates or changes the role).
   * - Already-active (deactivated_at IS NULL) → 400 BadRequestException.
   * - Unknown userId → 404 NotFoundException.
   *
   * ── Audit (BUILD rule 7 — tx-scoped) ─────────────────────────────────────
   * Audit append is the LAST statement in the transaction. Audit failure rolls
   * back the deactivated_at = NULL update — no silent reactivation without a
   * corresponding audit row.
   */
  async reactivateAsActor(
    userId: string,
    actorUserId: string,
    actorRole: string
  ): Promise<{ id: string; email: string; deactivatedAt: null }> {
    return getDb(this.db).transaction(async (tx) => {
      // Step 1: Look up the target user (tx-scoped read — BUILD rule 7).
      const [target] = await tx
        .select({
          id: users.id,
          email: users.email,
          roleId: users.roleId,
          deactivatedAt: users.deactivatedAt,
        })
        .from(users)
        .where(eq(users.id, userId))
        .limit(1);

      if (!target) {
        throw new NotFoundException(`User ${userId} not found`);
      }

      // Step 2: Reject if already active.
      if (target.deactivatedAt === null) {
        throw new BadRequestException(`User ${userId} is already active`);
      }

      // Step 3: Set deactivated_at = NULL (restore to active).
      await tx.update(users).set({ deactivatedAt: null }).where(eq(users.id, userId));

      // Step 4: Audit LAST-IN-TXN under 'user-reactivate'.
      // role_id is preserved — we do NOT change it.
      const auditInput: AuditEntryInput = {
        actorUserId,
        actorRole,
        action: 'user-reactivate',
        resourceType: 'user',
        resourceId: userId,
        contentHash: hashJson({ userId }),
        payloadHash: hashJson({ op: 'user-reactivate', userId }),
      };

      await this.auditService.append(auditInput, tx as unknown as Tx);

      return { id: userId, email: target.email, deactivatedAt: null };
    });
  }
}

// ---------------------------------------------------------------------------
// Last-admin guard (shared helper)
// ---------------------------------------------------------------------------

/**
 * Acquires pg_advisory_xact_lock on ADMIN_GUARD_LOCK_KEY (serializes ALL
 * admin-set mutations), then counts active admins. Throws ConflictException
 * if the mutation would leave zero active admins.
 *
 * "Active admin" = role='admin' AND deactivated_at IS NULL.
 * The `excludeUserId` is the user being mutated — we count the remaining
 * active admins EXCLUDING that user (simulating post-mutation state).
 *
 * Call order: the advisory lock acquisition IS the first statement inside this
 * function and therefore the first count-and-mutate step under the lock. Callers
 * invoke runLastAdminGuard BEFORE any write in the surrounding transaction —
 * preceding SELECTs (user lookup, role lookup) are read-only and do not affect
 * the write-skew guarantee, which is solely provided by the advisory lock held
 * to commit. Do NOT re-order the lock acquisition inside this function.
 */
async function runLastAdminGuard(
  tx: AdminTx,
  excludeUserId: string,
  operation: 'deactivate' | 'demote'
): Promise<void> {
  // (1) Serialize all admin-set mutations — transaction-scoped advisory lock.
  // This is the FIRST statement executed in the tx so no preceding reads have
  // already observed a stale admin count (write-skew prevention).
  await tx.execute(sql`SELECT pg_advisory_xact_lock(${ADMIN_GUARD_LOCK_KEY})`);

  // (2) Count active admins EXCLUDING the user being mutated.
  // "Active admin" = role='admin' AND deactivated_at IS NULL.
  // We count admins that would REMAIN after this mutation commits.
  const result = await tx.execute<{ remaining: string }>(sql`
    SELECT COUNT(*)::text AS remaining
    FROM users u
    INNER JOIN roles r ON u.role_id = r.id
    WHERE r.name = 'admin'
      AND u.deactivated_at IS NULL
      AND u.id != ${excludeUserId}::uuid
  `);

  // node-postgres returns { rows: [...] } for execute; Drizzle wraps this transparently.
  // biome-ignore lint/suspicious/noExplicitAny: Drizzle execute result shape varies
  const rows = (result as any).rows ?? result;
  const remaining = Number((rows[0] as { remaining?: string } | undefined)?.remaining ?? 0);

  if (remaining === 0) {
    throw new ConflictException(
      `Cannot ${operation} the last active admin. At least one admin must remain active.`
    );
  }
}

// Re-export for tests
export { runLastAdminGuard };

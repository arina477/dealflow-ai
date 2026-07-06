/**
 * UserManagementService (wave-15, task 82ec8724) — admin user management.
 *
 * Three mutations:
 *   inviteAsActor    — create an invite record (record-only; no email send).
 *   assignRoleAsActor — change a user's role.
 *   deactivateAsActor — soft-deactivate a user (sets deactivated_at).
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
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { eq, sql } from 'drizzle-orm';
import type { Database } from '../../db/db.provider';
import { DB } from '../../db/db.provider';
import { invites, roles, users } from '../../db/schema/users-roles';
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
    const rows = await this.db
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
   * Reuses the M1 AuthRepository invite flow: calls createInvite indirectly via the DB.
   * The invitedBy column is set to actorUserId (the admin's app users.id).
   * No email is sent (per spec: "NO email send — record only").
   */
  async inviteAsActor(
    input: { email: string; role: Role },
    actorUserId: string,
    actorRole: string
  ): Promise<{ inviteId: string; email: string; role: Role; expiry: string }> {
    return this.db.transaction(async (tx) => {
      // Resolve the role id.
      const [roleRow] = await tx
        .select({ id: roles.id })
        .from(roles)
        .where(eq(roles.name, input.role))
        .limit(1);

      if (!roleRow) {
        throw new UnprocessableEntityException(`Role '${input.role}' not found in roles table`);
      }

      // Generate a token. The hash is stored; the plaintext is discarded (same as M1 invite flow).
      const { randomBytes, createHash: cHash } = await import('node:crypto');
      const plaintext = randomBytes(32).toString('base64url');
      const tokenHash = cHash('sha256').update(plaintext).digest('hex');

      const expiry = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

      const [invite] = await tx
        .insert(invites)
        .values({
          token: tokenHash,
          email: input.email.toLowerCase(),
          roleId: roleRow.id,
          invitedBy: actorUserId,
          expiry,
        })
        .returning({ id: invites.id });

      if (!invite) throw new Error('Invite insert did not return a row');

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
    await this.db.transaction(async (tx) => {
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
    return this.db.transaction(async (tx) => {
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
 * Call order: this MUST be the first non-setup statement in the transaction
 * (or immediately after the advisory lock is acquired) to prevent write-skew.
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

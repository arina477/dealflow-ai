/**
 * AdminActivityService (wave-16, task 8bb0a22f — P-4 Finding 3)
 *
 * Provides the read-only /admin/activity-data surface: fetches immutable
 * audit_log_entries filtered to the 7 admin actions, maps to the safe B-1
 * row shape, and resolves actor/target display identities.
 *
 * ── SECURITY INVARIANTS (load-bearing) ──────────────────────────────────────
 * 1. READ-ONLY: this service NEVER writes to audit_log_entries. Calling
 *    getActivity() appends ZERO audit rows.
 * 2. No-hash/credential projection: the response shape is constructed by an
 *    EXPLICIT whitelist at the map step. The following fields are NEVER
 *    included in any returned row:
 *      payloadHash, contentHash, entryHash, prevHash, chainVersion,
 *      encryptedCredentials, credential, actorRole, resourceType,
 *      resourceId, mandateId.
 *    Enforcement: the map function is exhaustive and typed against
 *    AdminActivityRow — adding a hash/credential field fails to typecheck.
 * 3. Single-tenant: no firm_id/firm-scope filter (the system has no firm_id
 *    column — P-4 Finding 3 drops the vacuous firm-scope).
 *
 * ── Actor/target identity resolution ────────────────────────────────────────
 * audit_log_entries stores actor_user_id (UUID FK → users.id) and resource_id
 * (text — the target user's app users.id for user-management actions). This
 * service resolves email for both. Since users has no separate displayName
 * column, email is used as displayName (per adminActivityRowSchema comment:
 * "may be derived from email if no separate name").
 *
 * Actions with no user target (workspace-settings-update): target = null.
 * Actions with a user target (user-invite, role-change, deactivate,
 * data-source-conn-upsert, data-source-conn-toggle, user-reactivate):
 * target resolved from resource_id if it parses as a UUID in the users table.
 * If the user was deleted (FK SET NULL) or resource_id is not a UUID (e.g.
 * data-source actions use connection id), target = null gracefully.
 *
 * ── Reuses AuditRepository read path ────────────────────────────────────────
 * Calls AuditRepository.findAdminActivity and countAdminActivity — the
 * EXISTING audit.repository read path (mirroring recordkeeping.repository
 * .findFiltered). Does NOT fork a second audit reader.
 */

import type { AdminActivityQuery, AdminActivityResponse, AdminActivityRow } from '@dealflow/shared';
import { adminActivityActionEnum } from '@dealflow/shared';
import { Inject, Injectable } from '@nestjs/common';
import { eq, inArray, sql } from 'drizzle-orm';
import type { Database } from '../../db/db.provider';
import { DB } from '../../db/db.provider';
import { users } from '../../db/schema/users-roles';

// biome-ignore lint/style/useImportType: value import required for emitDecoratorMetadata DI resolution
import { AuditRepository } from '../audit/audit.repository';

/** The closed set of 7 admin-activity action values. */
const ADMIN_ACTIONS = adminActivityActionEnum.options;

/**
 * Actions for which the resource_id is an app users.id UUID pointing to a
 * target user. Other actions (data-source-conn-*, workspace-settings-update)
 * use connection ids or have no resource_id target user.
 */
const USER_TARGET_ACTIONS = new Set([
  'user-invite',
  'role-change',
  'deactivate',
  'user-reactivate',
]);

/** UUID v4 regex for safe resource_id → users.id coercion. */
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

@Injectable()
export class AdminActivityService {
  constructor(
    @Inject(DB) private readonly db: Database,
    private readonly auditRepository: AuditRepository
  ) {}

  /**
   * Fetch a paginated, filtered page of admin-activity rows.
   *
   * SECURITY: this method is READ-ONLY. It appends ZERO rows to audit_log_entries.
   * The returned rows contain ONLY sequenceNumber/actor/target/action/timestamp —
   * never a hash preimage, credential, or raw payload field.
   */
  async getActivity(query: AdminActivityQuery): Promise<AdminActivityResponse> {
    const filter = {
      actions: ADMIN_ACTIONS as unknown as string[],
      ...(query.action !== undefined ? { action: query.action } : {}),
      ...(query.since !== undefined ? { since: query.since } : {}),
      ...(query.until !== undefined ? { until: query.until } : {}),
      ...(query.cursor !== undefined ? { cursor: query.cursor } : {}),
      ...(query.limit !== undefined ? { limit: query.limit } : {}),
    };

    // Fetch entries from the existing audit.repository read path.
    const entries = await this.auditRepository.findAdminActivity(filter);

    // Count total matching entries (for pagination metadata) — same filter minus cursor.
    const total = await this.auditRepository.countAdminActivity({
      actions: filter.actions,
      ...(filter.action !== undefined ? { action: filter.action } : {}),
      ...(filter.since !== undefined ? { since: filter.since } : {}),
      ...(filter.until !== undefined ? { until: filter.until } : {}),
    });

    // Collect all unique user UUIDs that need resolution:
    //   - actorUserId (always present for admin-initiated entries)
    //   - resource_id for user-target actions (UUID typed as text in the schema)
    const userIds = new Set<string>();
    for (const entry of entries) {
      if (entry.actorUserId) {
        userIds.add(entry.actorUserId);
      }
      if (
        entry.resourceId &&
        USER_TARGET_ACTIONS.has(entry.action) &&
        UUID_RE.test(entry.resourceId)
      ) {
        userIds.add(entry.resourceId);
      }
    }

    // Batch-resolve all user emails in a single query.
    const emailMap = new Map<string, string>();
    if (userIds.size > 0) {
      const userRows = await this.db
        .select({ id: users.id, email: users.email })
        .from(users)
        .where(inArray(users.id, [...userIds]));
      for (const row of userRows) {
        emailMap.set(row.id, row.email);
      }
    }

    // Map audit entries to the safe AdminActivityRow shape.
    // EXPLICIT WHITELIST: only sequenceNumber, actor, target, action, timestamp.
    // Hash fields (payloadHash, contentHash, entryHash, prevHash, chainVersion),
    // actorRole, resourceType, resourceId, and mandateId are intentionally OMITTED.
    const rows: AdminActivityRow[] = entries.map((entry) => {
      const actorEmail = entry.actorUserId ? (emailMap.get(entry.actorUserId) ?? null) : null;
      const actor = actorEmail
        ? { displayName: actorEmail, email: actorEmail }
        : // Fallback: actor deleted (FK SET NULL) — should not occur in practice.
          { displayName: 'unknown', email: 'unknown@deleted' };

      let target: AdminActivityRow['target'] = null;
      if (
        entry.resourceId &&
        USER_TARGET_ACTIONS.has(entry.action) &&
        UUID_RE.test(entry.resourceId)
      ) {
        const targetEmail = emailMap.get(entry.resourceId);
        if (targetEmail) {
          target = { displayName: targetEmail, email: targetEmail };
        }
        // If user was deleted (ON DELETE SET NULL cascade removed the users row),
        // target stays null — graceful degradation.
      }

      return {
        sequenceNumber: entry.sequenceNumber,
        actor,
        target,
        action: entry.action as AdminActivityRow['action'],
        timestamp: entry.createdAt,
      };
    });

    // nextCursor: the sequence_number of the last row returned (oldest on this page).
    // The caller passes this as `cursor` to fetch the next (older) page.
    // null when there are no more pages (returned rows < limit, or no rows).
    const pageLimit = filter.limit ?? 50;
    const nextCursor =
      rows.length > 0 && rows.length >= pageLimit
        ? (rows[rows.length - 1]?.sequenceNumber ?? null)
        : null;

    return { rows, nextCursor, total };
  }
}

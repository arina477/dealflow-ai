/**
 * RetentionPolicyRepository (wave-28, task d3cc1337) — RLS-scoped persistence
 * for the workspace_retention_policy table.
 *
 * All reads and writes go through getDb(this.db), which returns the ALS-stored
 * GUC-bound Drizzle handle for the current request. The RLS policy on
 * workspace_retention_policy enforces that every query only touches the current
 * workspace's row — the application never reads or writes another firm's policy.
 *
 * SEC-A enforcement at the DB layer:
 *   UPSERT uses ON CONFLICT (workspace_id) DO UPDATE. workspace_id is ALWAYS
 *   resolved from getWorkspaceId() (ALS/GUC) — never from client input.
 *   The RLS WITH-CHECK (auto-derived from USING) rejects any write whose
 *   workspace_id does not match the GUC → a foreign-workspace_id write is
 *   blocked at the policy layer, not just the application layer.
 *
 * NO deletion path: no DELETE method exists on this repository.
 */

import { Inject, Injectable } from '@nestjs/common';
import { type SQL, sql } from 'drizzle-orm';
import type { Database } from '../../db/db.provider';
import { DB } from '../../db/db.provider';
import { workspaceRetentionPolicy } from '../../db/schema/retention-policy';
import { getDb } from '../../db/workspace-context';

export type RetentionPolicyRow = typeof workspaceRetentionPolicy.$inferSelect;

@Injectable()
export class RetentionPolicyRepository {
  constructor(@Inject(DB) private readonly db: Database) {}

  private get _db(): Database {
    return getDb(this.db);
  }

  /**
   * Get the current workspace's retention policy row.
   * Returns null if no row exists yet (the service returns the default in that case).
   */
  async findOne(): Promise<RetentionPolicyRow | null> {
    const rows = await this._db.select().from(workspaceRetentionPolicy).limit(1);
    return rows[0] ?? null;
  }

  /**
   * SEC-A: Upsert the retention policy for the current workspace.
   *
   * workspace_id is injected from the ALS-resolved workspaceId (not from client input).
   * ON CONFLICT (workspace_id) DO UPDATE — one row per workspace.
   * The RLS WITH-CHECK derived from the USING policy rejects a write whose
   * workspace_id differs from the GUC → foreign-workspace write is rejected.
   *
   * @param workspaceId  - ALS-resolved workspace UUID (server-side, not client-supplied).
   * @param days         - The new retention_period_days value (validated before this call).
   * @param updatedByUserId - App users.id of the actor (null if not yet set).
   */
  async upsert(
    workspaceId: string,
    days: number,
    updatedByUserId: string | null
  ): Promise<RetentionPolicyRow> {
    const result = await this._db
      .insert(workspaceRetentionPolicy)
      .values({
        workspaceId,
        retentionPeriodDays: days,
        updatedBy: updatedByUserId ?? undefined,
      })
      .onConflictDoUpdate({
        target: workspaceRetentionPolicy.workspaceId,
        set: {
          retentionPeriodDays: days,
          updatedBy: updatedByUserId ?? undefined,
          updatedAt: sql`now()` as SQL<string>,
        },
      })
      .returning();

    const row = result[0];
    if (!row) {
      throw new Error(
        'RetentionPolicyRepository.upsert: no row returned from INSERT...ON CONFLICT DO UPDATE'
      );
    }
    return row;
  }
}

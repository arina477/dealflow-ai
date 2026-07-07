import { sql } from 'drizzle-orm';
import { foreignKey, index, integer, pgTable, timestamp, unique, uuid } from 'drizzle-orm/pg-core';

import { users } from './users-roles';
import { workspaces } from './workspaces';

/**
 * Wave-28 retention policy data model (B-0, task d3cc1337).
 *
 * workspace_retention_policy — one mutable row per workspace recording the
 * firm's configured retention window (in days).
 *
 * Design constraints:
 *   - One row per workspace (UNIQUE workspace_id). Application uses an ON CONFLICT
 *     upsert — workspace_id is the conflict target (SEC-A).
 *   - MUTABLE (not WORM): the config value may be updated by an admin/compliance
 *     user. Config changes are audit-logged (action = 'retention.policy.updated').
 *   - NO deletion path: the row is permanent once created. Deleting the policy row
 *     would lose the firm's retention configuration — no DELETE on this table.
 *   - retention_period_days: bounded 30..10950 (30 days .. 30 years).
 *     DEFAULT 2555 (~7 years — a common FINRA/SEC recordkeeping baseline).
 *   - RLS: the migration MUST explicitly ENABLE + FORCE RLS + CREATE POLICY
 *     "workspace_isolation" (USING-only, NULLIF empty-string shape). A new table
 *     does NOT inherit RLS from other tenant tables.
 *   - updated_by: nullable FK — row survives if the user is deleted (set null).
 *   - Index on workspace_id: the primary tenant filter for every RLS-scoped query.
 */

export const workspaceRetentionPolicy = pgTable(
  'workspace_retention_policy',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),

    /**
     * FK → workspaces.id. NOT NULL. The RLS policy enforces that only the
     * workspace owner can read/write this row. UNIQUE enforces one row per firm.
     */
    workspaceId: uuid('workspace_id').notNull(),

    /**
     * The configured retention window in days.
     * Bounds: 30 (minimum meaningful window) .. 10950 (30 years).
     * DEFAULT 2555 ≈ 7 years (common FINRA/SEC baseline).
     * Checked at the Zod contract layer before any DB write.
     */
    retentionPeriodDays: integer('retention_period_days').notNull().default(2555),

    /**
     * The app users.id of the last admin/compliance user who changed the policy.
     * Nullable: unset when the row is first auto-created (no explicit actor at
     * workspace bootstrap); set on every subsequent PUT.
     */
    updatedBy: uuid('updated_by'),

    createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' })
      .notNull()
      .default(sql`now()`),

    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' }).$onUpdateFn(() =>
      new Date().toISOString()
    ),
  },
  (table) => [
    // SEC-A: one row per workspace — the UPSERT conflict target.
    unique('workspace_retention_policy_workspace_id_key').on(table.workspaceId),

    foreignKey({
      name: 'workspace_retention_policy_workspace_id_fk',
      columns: [table.workspaceId],
      foreignColumns: [workspaces.id],
    }).onDelete('restrict'),

    foreignKey({
      name: 'workspace_retention_policy_updated_by_fk',
      columns: [table.updatedBy],
      foreignColumns: [users.id],
    }).onDelete('set null'),

    // workspace_id is the primary tenant filter under RLS — index is load-bearing.
    index('workspace_retention_policy_workspace_id_idx').on(table.workspaceId),
  ]
);

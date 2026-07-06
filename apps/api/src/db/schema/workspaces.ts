import { sql } from 'drizzle-orm';
import { pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';

/**
 * Wave-17 workspace isolation (B-0, task 0db154ff).
 *
 * workspaces — the top-level tenant boundary table.
 *
 * ONE workspace per pilot firm. All tenant tables carry a workspace_id FK
 * that RLS policies enforce via app.workspace_id GUC.
 *
 * DEFAULT WORKSPACE:
 *   id = 'a1b2c3d4-0000-4000-8000-000000000001'
 *   name = 'Default Workspace'
 *   Inserted by migration 0014. Stable across environments (backfill target).
 *
 * Additive-only — no existing table is altered in this file.
 */
export const workspaces = pgTable('workspaces', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),

  /** Human-readable workspace name (e.g. 'Acme Capital'). */
  name: text('name').notNull(),

  createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' })
    .notNull()
    .default(sql`now()`),
});

/**
 * The STABLE default workspace UUID seeded by migration 0014.
 * Referenced by backfill logic, seeds, and test fixtures.
 * This UUID is a FIXED constant — do not change without a new migration.
 */
export const DEFAULT_WORKSPACE_ID = 'a1b2c3d4-0000-4000-8000-000000000001' as const;

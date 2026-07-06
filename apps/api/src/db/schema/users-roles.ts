import { sql } from 'drizzle-orm';
import {
  foreignKey,
  index,
  pgTable,
  text,
  timestamp,
  unique,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';

import { workspaces } from './workspaces';

/**
 * Wave-2 auth data model (B-0, task e15f71dd).
 *
 * roles   — source of truth for the four RBAC roles.
 * users   — app-DB mirror of a SuperTokens identity; role_id is the
 *            authoritative RBAC source (claim is derived from this column).
 * invites — invite-only signup tokens; consumed exactly once.
 *
 * All PKs: UUID DEFAULT gen_random_uuid().
 * All tables: created_at TIMESTAMPTZ NOT NULL DEFAULT now().
 * Additive only — app_meta is untouched.
 */

// ---------------------------------------------------------------------------
// roles
// ---------------------------------------------------------------------------
export const roles = pgTable(
  'roles',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    name: text('name').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' })
      .notNull()
      .default(sql`now()`),
  },
  (table) => [unique('roles_name_unique').on(table.name)]
);

// ---------------------------------------------------------------------------
// users
// ---------------------------------------------------------------------------
export const users = pgTable(
  'users',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    supertokensUserId: text('supertokens_user_id').notNull(),
    email: text('email').notNull(),
    roleId: uuid('role_id').notNull(),
    /**
     * Wave-15 (task 82ec8724) — soft-deactivation timestamp.
     * NULL = active user. Non-null = deactivated at this instant.
     * The UserManagementService sets this column via deactivateAsActor.
     * A deactivated user's session is NOT auto-revoked at the SuperTokens
     * layer (out of scope); RBAC is enforced at each guarded request via
     * the DB-authoritative RolesGuard re-verify.
     */
    deactivatedAt: timestamp('deactivated_at', { withTimezone: true, mode: 'string' }),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' })
      .notNull()
      .default(sql`now()`),
    /**
     * Wave-17 (task 0db154ff) — tenant boundary FK.
     * RLS policy: USING (workspace_id = current_setting('app.workspace_id', true)::uuid).
     * FORCE ROW LEVEL SECURITY is set on this table (mandatory — API runs as owner).
     * The pre-GUC bootstrap path uses resolve_user_workspace() SECURITY DEFINER
     * to read this column before the GUC is set (chicken-and-egg break).
     */
    workspaceId: uuid('workspace_id').notNull(),
  },
  (table) => [
    unique('users_supertokens_user_id_unique').on(table.supertokensUserId),
    // case-insensitive email uniqueness: store lowercased at the API layer;
    // unique constraint on the column enforces it at the DB layer.
    unique('users_email_unique').on(table.email),
    foreignKey({
      name: 'users_role_id_fk',
      columns: [table.roleId],
      foreignColumns: [roles.id],
    }).onDelete('restrict'),
    foreignKey({
      name: 'users_workspace_id_fk',
      columns: [table.workspaceId],
      foreignColumns: [workspaces.id],
    }).onDelete('restrict'),
    // dedicated index on supertokens_user_id: the createNewSession override
    // resolves role by this column on every session creation + refresh.
    index('users_supertokens_user_id_idx').on(table.supertokensUserId),
    index('users_workspace_id_idx').on(table.workspaceId),
  ]
);

// ---------------------------------------------------------------------------
// invites
// ---------------------------------------------------------------------------
export const invites = pgTable(
  'invites',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    // token is stored hashed at rest (security.md); uniqueness is on the hash.
    token: text('token').notNull(),
    email: text('email').notNull(),
    // nullable: the bootstrap/first-admin invite may pre-date any users row.
    invitedBy: uuid('invited_by'),
    roleId: uuid('role_id').notNull(),
    expiry: timestamp('expiry', { withTimezone: true, mode: 'string' }).notNull(),
    consumedAt: timestamp('consumed_at', { withTimezone: true, mode: 'string' }),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' })
      .notNull()
      .default(sql`now()`),
    /** Wave-17 (task 0db154ff) — tenant boundary FK. RLS-enforced. */
    workspaceId: uuid('workspace_id').notNull(),
  },
  (table) => [
    unique('invites_token_unique').on(table.token),
    foreignKey({
      name: 'invites_invited_by_fk',
      columns: [table.invitedBy],
      foreignColumns: [users.id],
    }).onDelete('set null'),
    foreignKey({
      name: 'invites_role_id_fk',
      columns: [table.roleId],
      foreignColumns: [roles.id],
    }).onDelete('restrict'),
    foreignKey({
      name: 'invites_workspace_id_fk',
      columns: [table.workspaceId],
      foreignColumns: [workspaces.id],
    }).onDelete('restrict'),
    // partial unique index: supports the concurrent-consumption guard
    // (SELECT FOR UPDATE + consumed_at IS NULL guard in the repository).
    // Drizzle does not natively emit partial indexes via the table builder;
    // the raw SQL is emitted directly in the migration instead (see
    // 0001_*.sql). This index declaration is a no-op in drizzle-kit output
    // and is replaced by the raw SQL in the migration.
    uniqueIndex('invites_token_unconsumed_idx').on(table.token).where(sql`consumed_at IS NULL`),
    index('invites_workspace_id_idx').on(table.workspaceId),
  ]
);

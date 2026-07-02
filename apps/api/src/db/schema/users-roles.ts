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
import { sql } from 'drizzle-orm';

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
  (table) => [
    unique('roles_name_unique').on(table.name),
  ],
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
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' })
      .notNull()
      .default(sql`now()`),
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
    // dedicated index on supertokens_user_id: the createNewSession override
    // resolves role by this column on every session creation + refresh.
    index('users_supertokens_user_id_idx').on(table.supertokensUserId),
  ],
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
    // partial unique index: supports the concurrent-consumption guard
    // (SELECT FOR UPDATE + consumed_at IS NULL guard in the repository).
    // Drizzle does not natively emit partial indexes via the table builder;
    // the raw SQL is emitted directly in the migration instead (see
    // 0001_*.sql). This index declaration is a no-op in drizzle-kit output
    // and is replaced by the raw SQL in the migration.
    uniqueIndex('invites_token_unconsumed_idx')
      .on(table.token)
      .where(sql`consumed_at IS NULL`),
  ],
);

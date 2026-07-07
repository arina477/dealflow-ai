import { bigint, index, integer, pgTable, primaryKey, text, timestamp } from 'drizzle-orm/pg-core';

/**
 * Wave-25 rate_limit_hits — shared Postgres-backed counter store for the auth
 * rate-limiter (task 6fe232e3, M10 auth-hardening).
 *
 * PRE-AUTH, GLOBAL — no workspace_id, no RLS. All Railway replicas share this
 * table so a bucket keyed here is a true global limit, not per-instance.
 *
 * DESIGN INVARIANTS (SEC-1/SEC-2):
 *   key = '<scope>:<identifier_normalized>:<window_seconds>:<window_index>'
 *   window_index = floor(epoch_seconds / window_seconds)
 *   PRIMARY KEY (key, window_start) enforces uniqueness for the atomic UPSERT:
 *     INSERT INTO rate_limit_hits (key, window_start, count, expires_at)
 *     VALUES ($1, $2, 1, $3)
 *     ON CONFLICT (key, window_start) DO UPDATE
 *       SET count = rate_limit_hits.count + 1
 *     RETURNING count
 *
 * NOT WORM — rows expire and are periodically deleted. Not an audit table.
 * NOT tenant-scoped — pre-auth path has no workspace context.
 *
 * See migration 0019 for grants and index definitions.
 */
export const rateLimitHits = pgTable(
  'rate_limit_hits',
  {
    key: text('key').notNull(),
    windowStart: bigint('window_start', { mode: 'bigint' }).notNull(),
    count: integer('count').notNull().default(1),
    firstHitAt: timestamp('first_hit_at', { withTimezone: true }).notNull().defaultNow(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.key, table.windowStart] }),
    index('rate_limit_hits_expires_at_idx').on(table.expiresAt),
  ]
);

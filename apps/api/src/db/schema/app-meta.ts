import { pgTable, text } from 'drizzle-orm/pg-core';

/**
 * Baseline bootstrap table (wave-1).
 * Exercises the migrate + query path; real domain tables land in M2+.
 * Moved here from the flat src/db/schema.ts at the Δ5 per-module layout
 * transition (wave-2); the underlying table name is unchanged.
 */
export const appMeta = pgTable('app_meta', {
  key: text('key').primaryKey(),
  value: text('value').notNull(),
});

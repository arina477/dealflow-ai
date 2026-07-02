import { pgTable, text } from 'drizzle-orm/pg-core';

/**
 * Baseline bootstrap table.
 * Exercises the migrate + query path; real domain tables land in M2+
 * per apps/api/src/db/schema/ (one file per module).
 */
export const appMeta = pgTable('app_meta', {
  key: text('key').primaryKey(),
  value: text('value').notNull(),
});

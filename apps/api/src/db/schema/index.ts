/**
 * Schema barrel — re-exports every per-module schema file.
 * drizzle.config.ts points here so drizzle-kit sees all tables.
 *
 * Import order:
 *   1. app-meta  (wave-1 bootstrap table)
 *   2. users-roles (wave-2 auth data model)
 */
export * from './app-meta';
export * from './users-roles';

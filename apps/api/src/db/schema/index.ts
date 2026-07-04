/**
 * Schema barrel — re-exports every per-module schema file.
 * drizzle.config.ts points here so drizzle-kit sees all tables.
 *
 * Import order (alphabetical per biome organizeImports):
 *   1. app-meta          (wave-1 bootstrap table)
 *   2. audit-log         (wave-4 tamper-evident audit store — task ec1f279d)
 *   3. compliance-rules  (wave-5 compliance rules engine — task 0595a835)
 *   4. mandate           (wave-8 mandate spine — task ba0edebf)
 *   5. sourcing          (wave-6 deal-sourcing data spine — tasks ff378a95 + db274731)
 *   6. users-roles       (wave-2 auth data model)
 *
 * Note: audit-log.ts, compliance-rules.ts, mandate.ts, and sourcing.ts all import
 * directly from './users-roles' for FK references, not via this barrel — alphabetical
 * order here is safe (no circular dependency).
 * mandate.ts also imports from './compliance-rules' for the disclaimer_templates FK.
 */
export * from './app-meta';
export * from './audit-log';
export * from './compliance-rules';
export * from './mandate';
export * from './sourcing';
export * from './users-roles';

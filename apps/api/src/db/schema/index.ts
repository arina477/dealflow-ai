/**
 * Schema barrel — re-exports every per-module schema file.
 * drizzle.config.ts points here so drizzle-kit sees all tables.
 *
 * Import order (alphabetical per biome organizeImports):
 *   1. app-meta          (wave-1 bootstrap table)
 *   2. audit-log         (wave-4 tamper-evident audit store — task ec1f279d)
 *   3. buyer-universe    (wave-9 buyer-universe spine — task 92a8ff3f)
 *   4. compliance-rules  (wave-5 compliance rules engine — task 0595a835)
 *   5. mandate           (wave-8 mandate spine — task ba0edebf)
 *   6. matching          (wave-10 match spine — task 47ed7ddd)
 *   7. outreach          (wave-11 outreach spine — task 102a2f00)
 *   8. pipeline          (wave-12 pipeline spine — task 07989285)
 *   9. sourcing          (wave-6 deal-sourcing data spine — tasks ff378a95 + db274731)
 *  10. users-roles       (wave-2 auth data model)
 *
 * Note: audit-log.ts, compliance-rules.ts, mandate.ts, sourcing.ts, and
 * buyer-universe.ts all import directly from './users-roles' for FK references,
 * not via this barrel — alphabetical order here is safe (no circular dependency).
 * mandate.ts also imports from './compliance-rules' for the disclaimer_templates FK.
 * buyer-universe.ts imports from './mandate' (mandates FK) and './sourcing' (companies FK).
 * matching.ts imports from './mandate', './buyer-universe', and './users-roles'.
 * pipeline.ts imports from './mandate', './matching', './outreach', and './users-roles'.
 */
export * from './app-meta';
export * from './audit-log';
export * from './buyer-universe';
export * from './compliance-rules';
export * from './mandate';
export * from './matching';
export * from './outreach';
export * from './pipeline';
export * from './sourcing';
export * from './users-roles';

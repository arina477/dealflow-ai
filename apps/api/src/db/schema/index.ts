/**
 * Schema barrel — re-exports every per-module schema file.
 * drizzle.config.ts points here so drizzle-kit sees all tables.
 *
 * Import order (alphabetical per biome organizeImports):
 *   0. workspaces        (wave-17 tenant boundary — task 0db154ff) — MUST be first
 *   1. admin-settings    (wave-15 workspace_settings — tasks 648a86a6 + 41c017f7)
 *   2. app-meta          (wave-1 bootstrap table)
 *   3. audit-log         (wave-4 tamper-evident audit store — task ec1f279d)
 *   4. buyer-universe    (wave-9 buyer-universe spine — task 92a8ff3f)
 *   5. compliance-rules  (wave-5 compliance rules engine — task 0595a835)
 *   6. mandate           (wave-8 mandate spine — task ba0edebf)
 *   7. matching          (wave-10 match spine — task 47ed7ddd)
 *   8. outreach          (wave-11 outreach spine — task 102a2f00)
 *   9. pipeline          (wave-12 pipeline spine — task 07989285)
 *  10. outreach-activity (wave-20 M9 outreach-activity tracker — task d45c73b5)
 *  11. sourcing          (wave-6 deal-sourcing data spine — tasks ff378a95 + db274731)
 *  12. users-roles       (wave-2 auth data model)
 *
 * workspaces is exported first so all other tenant-table files can import it
 * without circular dependency. All tenant tables import ./workspaces directly.
 *
 * Note: admin-settings.ts imports from './compliance-rules' (disclaimer_templates FK)
 * and './users-roles' (users FK) directly — no circular dep via this barrel.
 * audit-log.ts, compliance-rules.ts, mandate.ts, sourcing.ts, and
 * buyer-universe.ts all import directly from './users-roles' for FK references,
 * not via this barrel — alphabetical order here is safe (no circular dependency).
 * mandate.ts also imports from './compliance-rules' for the disclaimer_templates FK.
 * buyer-universe.ts imports from './mandate' (mandates FK) and './sourcing' (companies FK).
 * matching.ts imports from './mandate', './buyer-universe', and './users-roles'.
 * pipeline.ts imports from './mandate', './matching', './outreach', and './users-roles'.
 * outreach-activity.ts imports from './mandate', './matching', './outreach',
 *   './pipeline', './users-roles', and './workspaces' — no circular dependency
 *   (it is a leaf: nothing imports from outreach-activity.ts).
 */

export * from './admin-settings';
export * from './app-meta';
export * from './audit-log';
export * from './buyer-universe';
export * from './compliance-rules';
export * from './mandate';
export * from './matching';
export * from './outreach';
export * from './outreach-activity';
export * from './pipeline';
export * from './rate-limit-hits';
export * from './sourcing';
export * from './users-roles';
export * from './workspaces';

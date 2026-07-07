/**
 * worm-migration-coverage-registry.ts
 *
 * Deterministic registry: maps each WORM-touching forward migration filename to
 * the test file that covers it with a populated-DB migration test.
 *
 * ── HOW THE CI CHECK USES THIS ────────────────────────────────────────────────
 * apps/api/scripts/check-worm-migration-tests.ts:
 *   1. Scans migration SQL files for actual DML/DDL touching WORM tables.
 *   2. For each detected migration, looks it up in this registry.
 *   3. Verifies the registered test file exists on disk.
 *   4. Exits 1 if any WORM-touching migration is missing from the registry OR if
 *      the registered test file does not exist.
 *
 * ── HOW TO ADD A NEW ENTRY ────────────────────────────────────────────────────
 * When you add a migration that touches audit_log_entries (or any future WORM table),
 * add a new entry here BEFORE the PR is merged. The CI check will fail otherwise.
 *
 * Key:   the migration filename WITHOUT path (e.g. '0014_workspace_isolation.sql').
 *        Must be the forward migration (not .down.sql).
 * Value: the path to the test file, relative to apps/api/ (e.g. 'test/foo.e2e-spec.ts').
 *
 * ── WORM TABLE SCOPE ─────────────────────────────────────────────────────────
 * See command-center/testing/worm-migration-testing-policy.md for the in-scope
 * WORM tables and the full policy. Currently: audit_log_entries only.
 * pipeline_events is app-level append-only (no DB trigger) — documented out of scope.
 *
 * ── COVERAGE NOTES ───────────────────────────────────────────────────────────
 * The AMP suite (audit-migration-populated-db.e2e-spec.ts) covers the original
 * wave-17 HOLD locus (0014) with full assertions (AMP-1..5). It also exercises the
 * DB state established by 0002/0012/0016/0017 as infrastructure (migrations run before
 * the test seeds rows and asserts chain integrity). All five migrations are therefore
 * covered by the AMP suite and registered here.
 */

export interface WormCoverageEntry {
  /** The migration filename (without path). Must be a forward migration (.sql, not .down.sql). */
  migrationFile: string;
  /** Path to the test file, relative to apps/api/. */
  testFile: string;
  /** Human-readable note on what the test covers. */
  note: string;
}

/**
 * WORM_MIGRATION_COVERAGE_REGISTRY — the canonical map of WORM-touching migrations
 * to their populated-DB test files.
 *
 * Maintained by the team: add a new entry whenever a new migration touching an
 * in-scope WORM table is added. The CI check enforces completeness.
 */
export const WORM_MIGRATION_COVERAGE_REGISTRY: WormCoverageEntry[] = [
  {
    migrationFile: '0002_steep_boom_boom.sql',
    testFile: 'test/audit-migration-populated-db.e2e-spec.ts',
    note:
      'Creates audit_log_entries table + audit_log_no_mutate trigger. ' +
      'AMP suite seeds real rows and asserts the trigger is active (AMP-5).',
  },
  {
    migrationFile: '0012_audit_mandate_id.sql',
    testFile: 'test/audit-migration-populated-db.e2e-spec.ts',
    note:
      'Adds nullable mandate_id column to audit_log_entries. ' +
      'AMP suite verifies chain integrity with mandate_id excluded from HMAC preimage (AMP-4).',
  },
  {
    migrationFile: '0014_workspace_isolation.sql',
    testFile: 'test/audit-migration-populated-db.e2e-spec.ts',
    note:
      'Wave-17 C-2 HOLD locus: UPDATE backfill of workspace_id on audit_log_entries wrapped ' +
      'in DISABLE/ENABLE TRIGGER. AMP suite is the direct proof of the fix (AMP-1..5).',
  },
  {
    migrationFile: '0016_dealflow_app_role.sql',
    testFile: 'test/audit-migration-populated-db.e2e-spec.ts',
    note:
      'GRANTs SELECT/INSERT/UPDATE/DELETE on audit_log_entries to dealflow_app. ' +
      'AMP suite runs as the migration role against populated rows confirming the grant works.',
  },
  {
    migrationFile: '0017_rls_policy_empty_string_fix.sql',
    testFile: 'test/audit-migration-populated-db.e2e-spec.ts',
    note:
      'Replaces workspace_isolation RLS policy on audit_log_entries with NULLIF fix. ' +
      'AMP suite asserts chain integrity and WORM trigger state post-migration.',
  },
];

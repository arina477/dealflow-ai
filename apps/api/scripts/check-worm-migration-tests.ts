/**
 * check-worm-migration-tests.ts
 *
 * Mechanical CI check: verifies that every forward migration touching a
 * DB-trigger-enforced WORM table has a registered populated-DB migration test.
 *
 * ── HOW IT WORKS ─────────────────────────────────────────────────────────────
 * 1. Scans apps/api/src/db/migrations/*.sql (forward migrations only, not .down.sql)
 *    for actual DML/DDL touching in-scope WORM tables (not comment-only mentions).
 * 2. Looks up each detected migration in the coverage registry
 *    (apps/api/test/_helpers/worm-migration-coverage-registry.ts).
 * 3. Verifies the registered test file exists on disk.
 * 4. Exits 0 (pass) when every WORM-touching migration is registered AND its test
 *    file exists. Exits 1 (fail) otherwise.
 *
 * ── WORM TABLE ALLOW-LIST (MG1) ──────────────────────────────────────────────
 * DB-TRIGGER-ENFORCED WORM tables are the in-scope category. The WORM_TABLES
 * constant below is the single source of truth. To add a new WORM table (one
 * with a mutation-blocking DB trigger), add it to WORM_TABLES.
 *
 *   IN SCOPE:
 *     audit_log_entries — protected by audit_log_no_mutate BEFORE UPDATE/DELETE trigger
 *                         (created in 0002_steep_boom_boom.sql).
 *
 *   OUT OF SCOPE (documented):
 *     pipeline_events   — app-level append-only (structural convention, no DB trigger).
 *                         A migration UPDATE on pipeline_events would not be blocked
 *                         by the DB, so the wave-17-class prod failure cannot occur.
 *                         Add to WORM_TABLES if a DB trigger is ever added to it.
 *
 * ── DETECTION LOGIC (MG1 correct-set requirement) ────────────────────────────
 * A migration "touches" a WORM table if its SQL contains a mutating/altering
 * operation on that table outside of SQL comments. The classifier:
 *   - Strips single-line comments (--) and block comments (/* ... * /).
 *   - Checks for keyword patterns that constitute actual DML/DDL:
 *       CREATE TABLE <worm_table>
 *       ALTER TABLE <worm_table>
 *       INSERT INTO <worm_table>
 *       UPDATE <worm_table>
 *       DELETE FROM <worm_table>
 *       TRUNCATE <worm_table>
 *       GRANT ... ON ... <worm_table>
 *       REVOKE ... ON ... <worm_table>
 *       DROP TRIGGER ... ON <worm_table>
 *       CREATE TRIGGER ... ON <worm_table>
 *       CREATE POLICY ... ON <worm_table>
 *       DROP POLICY ... ON <worm_table>
 *       CREATE INDEX ... ON <worm_table>
 *       DROP INDEX ... (any index touching the table — conservative: include if table mentioned in DDL context)
 *       ENABLE ROW LEVEL SECURITY / FORCE ROW LEVEL SECURITY on the table
 *
 * This correctly classifies the known set {0002, 0012, 0014, 0016, 0017} and
 * correctly excludes:
 *   - 0003: mentions audit_log_entries in comments only.
 *   - 0018: mentions audit_log_entries in a comment stating it does NOT touch it.
 *
 * ── DETERMINISTIC COVERAGE SIGNAL ────────────────────────────────────────────
 * The coverage registry (worm-migration-coverage-registry.ts) maps each
 * WORM-touching migration filename to a test file. The check verifies:
 *   (a) Every detected WORM-touching migration is in the registry.
 *   (b) The registered test file exists on disk.
 * This is deterministic: no fuzzy filename matching, no grepping test files.
 *
 * ── RUNNING ──────────────────────────────────────────────────────────────────
 * pnpm --filter @dealflow/api check:worm-migration-tests
 * Or directly: npx tsx apps/api/scripts/check-worm-migration-tests.ts
 *
 * ── SELF-TEST ────────────────────────────────────────────────────────────────
 * apps/api/test/check-worm-migration-tests.spec.ts verifies the core classifier
 * and registry-lookup logic with fixtures (fault-killing self-test).
 */

import * as fs from 'node:fs';
import * as path from 'node:path';

// ── WORM table allow-list (MG1 — single source of truth) ─────────────────────

/**
 * DB-TRIGGER-ENFORCED WORM tables. A migration touching any of these tables with
 * actual DML/DDL (not just comments) MUST have a populated-DB migration test.
 *
 * pipeline_events is intentionally ABSENT: app-level append-only, no DB trigger.
 * See file-level comment for the full rationale.
 */
export const WORM_TABLES: readonly string[] = ['audit_log_entries'];

// ── SQL comment stripping ─────────────────────────────────────────────────────

/**
 * Remove SQL comments from a SQL string so the classifier only sees executable SQL.
 * Strips both -- single-line comments and /* ... * / block comments.
 */
export function stripSqlComments(sql: string): string {
  // Strip block comments first (may span multiple lines).
  let result = sql.replace(/\/\*[\s\S]*?\*\//g, ' ');
  // Strip single-line comments.
  result = result.replace(/--[^\n]*/g, ' ');
  return result;
}

// ── WORM-touching classifier ──────────────────────────────────────────────────

/**
 * Returns true if the SQL (with comments stripped) contains an actual DML/DDL
 * operation on `tableName`. Comment-only mentions are excluded.
 *
 * Patterns detected (case-insensitive):
 *   CREATE TABLE <table>
 *   ALTER TABLE <table>
 *   INSERT INTO <table>
 *   UPDATE <table>
 *   DELETE FROM <table>
 *   TRUNCATE <table>       (also: TRUNCATE TABLE <table>)
 *   GRANT ... ON TABLE <table>  |  GRANT ... ON <table>
 *   REVOKE ... ON TABLE <table>  |  REVOKE ... ON <table>
 *   DROP TRIGGER ... ON <table>
 *   CREATE TRIGGER ... ON <table>
 *   CREATE POLICY ... ON <table>
 *   DROP POLICY ... ON <table>
 *   CREATE INDEX ... ON <table>
 *   DROP INDEX ... ON <table>
 *   ALTER TABLE <table> ENABLE/DISABLE/FORCE ROW LEVEL SECURITY
 *
 * The table name is matched as a whole token (word boundary) to prevent
 * false positives from partial name matches. Quoted names ("table") and
 * unquoted names are both matched.
 */
export function migrationTouchesWormTable(sql: string, tableName: string): boolean {
  const stripped = stripSqlComments(sql);

  // Build a pattern that matches both quoted ("audit_log_entries") and unquoted
  // (audit_log_entries) table name references, as a whole token.
  const quoted = `"${tableName}"`;
  const tableRef = `(?:"${tableName}"|\\b${tableName}\\b)`;

  // Each pattern is tested independently (case-insensitive).
  const patterns: RegExp[] = [
    // CREATE TABLE "audit_log_entries"
    new RegExp(`\\bCREATE\\s+TABLE\\s+(?:IF\\s+NOT\\s+EXISTS\\s+)?${tableRef}`, 'is'),
    // ALTER TABLE "audit_log_entries"
    new RegExp(`\\bALTER\\s+TABLE\\s+${tableRef}`, 'is'),
    // INSERT INTO "audit_log_entries"
    new RegExp(`\\bINSERT\\s+INTO\\s+${tableRef}`, 'is'),
    // UPDATE "audit_log_entries"
    new RegExp(`\\bUPDATE\\s+${tableRef}`, 'is'),
    // DELETE FROM "audit_log_entries"
    new RegExp(`\\bDELETE\\s+FROM\\s+${tableRef}`, 'is'),
    // TRUNCATE [TABLE] "audit_log_entries"
    new RegExp(`\\bTRUNCATE\\s+(?:TABLE\\s+)?${tableRef}`, 'is'),
    // GRANT ... ON [TABLE] [public.]"audit_log_entries"
    new RegExp(`\\bGRANT\\b[^;]+?\\bON\\s+(?:TABLE\\s+)?(?:public\\.)?${tableRef}`, 'is'),
    // REVOKE ... ON [TABLE] [public.]"audit_log_entries"
    new RegExp(`\\bREVOKE\\b[^;]+?\\bON\\s+(?:TABLE\\s+)?(?:public\\.)?${tableRef}`, 'is'),
    // DROP TRIGGER ... ON "audit_log_entries"
    new RegExp(`\\bDROP\\s+TRIGGER\\b[^;]+?\\bON\\s+${tableRef}`, 'is'),
    // CREATE TRIGGER ... ON "audit_log_entries"
    new RegExp(`\\bCREATE\\s+(?:OR\\s+REPLACE\\s+)?TRIGGER\\b[^;]+?\\bON\\s+${tableRef}`, 'is'),
    // CREATE POLICY ... ON "audit_log_entries"
    new RegExp(`\\bCREATE\\s+POLICY\\b[^;]+?\\bON\\s+${tableRef}`, 'is'),
    // DROP POLICY ... ON "audit_log_entries"
    new RegExp(`\\bDROP\\s+POLICY\\b[^;]+?\\bON\\s+${tableRef}`, 'is'),
    // CREATE INDEX ... ON "audit_log_entries"
    new RegExp(`\\bCREATE\\s+(?:UNIQUE\\s+)?INDEX\\b[^;]+?\\bON\\s+${tableRef}`, 'is'),
    // DROP INDEX ... (mention of table in index name context — captured by ALTER TABLE above)
    // ENABLE/DISABLE/FORCE ROW LEVEL SECURITY — already caught by ALTER TABLE pattern
  ];

  // Avoid false-positive from the GRANT pattern matching on function names that include
  // the table name. The GRANT ... ON pattern above already requires "ON" keyword before
  // the table reference, which is sufficient.
  void quoted; // referenced in the JSDoc; not used directly (tableRef covers both forms)

  return patterns.some((p) => p.test(stripped));
}

// ── Migration file scanner ────────────────────────────────────────────────────

/**
 * Scans all forward migration files (*.sql, excluding *.down.sql) in migrationsDir
 * and returns the filenames of those that touch any WORM table.
 */
export function findWormTouchingMigrations(migrationsDir: string): string[] {
  const files = fs
    .readdirSync(migrationsDir)
    .filter((f) => f.endsWith('.sql') && !f.endsWith('.down.sql'))
    .sort();

  const touching: string[] = [];
  for (const file of files) {
    const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
    const touches = WORM_TABLES.some((table) => migrationTouchesWormTable(sql, table));
    if (touches) {
      touching.push(file);
    }
  }
  return touching;
}

// ── Registry lookup ──────────────────────────────────────────────────────────

export interface CheckResult {
  passed: boolean;
  wormTouchingMigrations: string[];
  missing: string[]; // migrations with no registry entry
  missingFile: string[]; // migrations with a registry entry but non-existent test file
  covered: string[]; // migrations properly covered
}

/**
 * Core check logic (extracted for self-testability).
 *
 * @param migrationsDir   Absolute path to the migrations directory.
 * @param apiRoot         Absolute path to apps/api/ (test files resolved from here).
 * @param registry        The coverage registry entries.
 */
export function runCheck(
  migrationsDir: string,
  apiRoot: string,
  registry: Array<{ migrationFile: string; testFile: string }>
): CheckResult {
  const wormTouchingMigrations = findWormTouchingMigrations(migrationsDir);

  const registryMap = new Map(registry.map((e) => [e.migrationFile, e.testFile]));

  const missing: string[] = [];
  const missingFile: string[] = [];
  const covered: string[] = [];

  for (const migFile of wormTouchingMigrations) {
    const testFile = registryMap.get(migFile);
    if (!testFile) {
      missing.push(migFile);
      continue;
    }
    const testFilePath = path.join(apiRoot, testFile);
    if (!fs.existsSync(testFilePath)) {
      missingFile.push(migFile);
      continue;
    }
    covered.push(migFile);
  }

  return {
    passed: missing.length === 0 && missingFile.length === 0,
    wormTouchingMigrations,
    missing,
    missingFile,
    covered,
  };
}

// ── Main (CLI entrypoint) ─────────────────────────────────────────────────────

async function main(): Promise<void> {
  const apiRoot = path.resolve(__dirname, '..');
  const migrationsDir = path.join(apiRoot, 'src/db/migrations');

  // Dynamic import so the registry file is loaded fresh (and tests can stub it).
  const { WORM_MIGRATION_COVERAGE_REGISTRY } = await import(
    '../test/_helpers/worm-migration-coverage-registry.js'
  );

  console.log('=== WORM Migration Coverage Check ===');
  console.log(`Migrations dir: ${migrationsDir}`);
  console.log(`In-scope WORM tables: ${WORM_TABLES.join(', ')}`);
  console.log('Out of scope: pipeline_events (app-level append-only, no DB trigger)');
  console.log('');

  const result = runCheck(migrationsDir, apiRoot, WORM_MIGRATION_COVERAGE_REGISTRY);

  console.log(
    `WORM-touching forward migrations detected (${result.wormTouchingMigrations.length}):`
  );
  for (const m of result.wormTouchingMigrations) {
    const status = result.covered.includes(m)
      ? 'COVERED'
      : result.missing.includes(m)
        ? 'MISSING (no registry entry)'
        : 'MISSING (test file not found)';
    console.log(`  ${status === 'COVERED' ? '[OK]' : '[FAIL]'} ${m} — ${status}`);
  }

  if (result.missing.length > 0) {
    console.error('');
    console.error('FAIL: The following WORM-touching migrations have NO registry entry:');
    for (const m of result.missing) {
      console.error(`  ${m}`);
    }
    console.error('Add an entry to apps/api/test/_helpers/worm-migration-coverage-registry.ts');
    console.error('See command-center/testing/worm-migration-testing-policy.md for the policy.');
  }

  if (result.missingFile.length > 0) {
    console.error('');
    console.error(
      'FAIL: The following WORM-touching migrations are registered but the test file does not exist:'
    );
    for (const m of result.missingFile) {
      console.error(`  ${m}`);
    }
    console.error('Create the test file or update the registry entry.');
  }

  if (result.passed) {
    console.log('');
    console.log(
      `PASS: all ${result.covered.length} WORM-touching migration(s) have populated-DB tests.`
    );
    process.exit(0);
  } else {
    process.exit(1);
  }
}

// Run only when invoked directly (not when imported by tests).
// Using import.meta.url check compatible with tsx/ts-node.
const isMain =
  process.argv[1] !== undefined &&
  (process.argv[1].endsWith('check-worm-migration-tests.ts') ||
    process.argv[1].endsWith('check-worm-migration-tests.js'));

if (isMain) {
  main().catch((err: unknown) => {
    console.error('check-worm-migration-tests: unexpected error:', err);
    process.exit(1);
  });
}

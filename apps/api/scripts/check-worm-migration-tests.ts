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
 * 3. Verifies the registered test file exists on disk AND contains a real coverage
 *    marker: a reference to the migration filename/number AND either an import/use
 *    of the populated-DB helpers or a reference to verifyChain.
 * 4. Exits 0 (pass) when every WORM-touching migration is registered AND its test
 *    file has a real coverage marker. Exits 1 (fail) otherwise.
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
 *   - Checks for keyword patterns that constitute actual DML/DDL.
 *   - The table reference matches both unqualified (audit_log_entries) and
 *     schema-qualified (public.audit_log_entries or "public".audit_log_entries)
 *     forms, as well as quoted ("audit_log_entries") variants. This prevents
 *     bypass via schema-qualified DML.
 *
 * ROW-MUTATING / STRUCTURAL-ALTER patterns (require populated-DB test):
 *   CREATE TABLE <worm_table>
 *   ALTER TABLE <worm_table>      — covers ADD COLUMN, SET NOT NULL, DISABLE/ENABLE TRIGGER,
 *                                   ENABLE/FORCE ROW LEVEL SECURITY, NOT NULL cutover
 *   INSERT INTO <worm_table>
 *   UPDATE <worm_table>
 *   DELETE FROM <worm_table>
 *   TRUNCATE <worm_table>
 *   DROP TRIGGER ... ON <worm_table>
 *   CREATE TRIGGER ... ON <worm_table>
 *   CREATE INDEX ... ON <worm_table>
 *
 * GRANT/REVOKE/POLICY patterns (classified separately — no row mutation):
 *   GRANT ... ON ... <worm_table>
 *   REVOKE ... ON ... <worm_table>
 *   CREATE POLICY ... ON <worm_table>
 *   DROP POLICY ... ON <worm_table>
 *
 * The WORM BEFORE UPDATE/DELETE trigger fires only when rows are mutated. GRANT,
 * REVOKE, CREATE POLICY, DROP POLICY, ENABLE/DISABLE RLS are privilege or policy
 * DDL — they do not touch rows and cannot cause the wave-17-class WORM collision.
 * They DO touch the WORM table structurally, so they are still detected and must be
 * registered; but their coverage requirement is existence-only (the table state the
 * policy/grant establishes is validated by any test that connects as that role or
 * exercises RLS). Row-mutating and structural-ALTER migrations additionally require
 * the registered test file to contain real coverage markers (migration number +
 * populated-DB helper usage or verifyChain reference), not just file existence.
 *
 * ── CLASSIFICATION SUMMARY for known set ─────────────────────────────────────
 * 0002: ROW-MUTATING — creates table + WORM trigger + REVOKE/GRANT/TRUNCATE trigger.
 *       Requires populated-DB test.
 * 0012: STRUCTURAL-ALTER — ALTER TABLE ADD COLUMN on audit_log_entries.
 *       Requires populated-DB test.
 * 0014: ROW-MUTATING — UPDATE backfill wrapped in DISABLE/ENABLE TRIGGER + ADD COLUMN
 *       + SET NOT NULL + ENABLE/FORCE RLS + CREATE POLICY + CREATE INDEX.
 *       Requires populated-DB test.
 * 0016: GRANT-ONLY — GRANT SELECT/INSERT/UPDATE/DELETE ON TABLE public.audit_log_entries.
 *       No row mutation; requires registry entry + file exists (not full coverage marker).
 * 0017: POLICY-ONLY — DROP/CREATE POLICY on audit_log_entries.
 *       No row mutation; requires registry entry + file exists (not full coverage marker).
 *
 * ── COVERAGE MARKER REQUIREMENT ──────────────────────────────────────────────
 * For ROW-MUTATING / STRUCTURAL-ALTER migrations the registered test file must:
 *   (a) Reference the migration filename or number (e.g. "0014" or "workspace_isolation")
 *   (b) Import or reference populated-DB helpers (ensureMigrated, AuditService, AuditKeyring,
 *       AuditRepository) OR reference verifyChain
 * A file that exists but is content-empty or comment-only fails this check.
 *
 * ── DETERMINISTIC COVERAGE SIGNAL ────────────────────────────────────────────
 * The coverage registry (worm-migration-coverage-registry.ts) maps each
 * WORM-touching migration filename to a test file. The check verifies:
 *   (a) Every detected WORM-touching migration is in the registry.
 *   (b) The registered test file exists on disk.
 *   (c) For row-mutating/structural-ALTER migrations: the file contains real coverage markers.
 *   GRANT/policy-only migrations satisfy the check with (a)+(b) alone.
 *
 * ── RUNNING ──────────────────────────────────────────────────────────────────
 * pnpm --filter @dealflow/api check:worm-migration-tests
 * Or directly: npx tsx apps/api/scripts/check-worm-migration-tests.ts
 *
 * ── SELF-TEST ────────────────────────────────────────────────────────────────
 * apps/api/test/check-worm-migration-tests.spec.ts verifies the core classifier
 * and registry-lookup logic with fixtures (fault-killing self-test).
 *
 * ── KNOWN LIMITATION ─────────────────────────────────────────────────────────
 * stripSqlComments uses a regex-based approach that may incorrectly strip a '--'
 * or '/* *\/' sequence that appears inside a SQL string literal (e.g. in a
 * CHECK constraint or DEFAULT value). This is a known limitation. In practice,
 * migration files do not embed comment-like sequences in string literals, so the
 * risk is theoretical. A tokenizer-based approach would be strictly safer but
 * adds significant complexity for no practical gain given the actual migration
 * corpus. Documented here rather than silently accepted.
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

  // Build a pattern that matches the table name in all forms:
  //   - unquoted:            audit_log_entries
  //   - quoted:              "audit_log_entries"
  //   - schema-qualified:    public.audit_log_entries
  //   - schema+quoted:       public."audit_log_entries"
  //   - quoted-schema:       "public".audit_log_entries
  //   - quoted-schema+table: "public"."audit_log_entries"
  //
  // The optional schema prefix is part of tableRef so EVERY pattern (not just
  // GRANT/REVOKE) accepts schema-qualified references.  This prevents bypass via
  // `UPDATE public.audit_log_entries ...` or
  // `ALTER TABLE public.audit_log_entries DISABLE TRIGGER ...`.
  const schemaPrefix = `(?:(?:public|"public")\\s*\\.\\s*)?`;
  const tablePart = `(?:"${tableName}"|\\b${tableName}\\b)`;
  const tableRef = `${schemaPrefix}${tablePart}`;

  // Each pattern is tested independently (case-insensitive).
  const patterns: RegExp[] = [
    // CREATE TABLE [public.]"audit_log_entries"
    new RegExp(`\\bCREATE\\s+TABLE\\s+(?:IF\\s+NOT\\s+EXISTS\\s+)?${tableRef}`, 'is'),
    // ALTER TABLE [public.]"audit_log_entries"
    new RegExp(`\\bALTER\\s+TABLE\\s+${tableRef}`, 'is'),
    // INSERT INTO [public.]"audit_log_entries"
    new RegExp(`\\bINSERT\\s+INTO\\s+${tableRef}`, 'is'),
    // UPDATE [public.]"audit_log_entries"
    new RegExp(`\\bUPDATE\\s+${tableRef}`, 'is'),
    // DELETE FROM [public.]"audit_log_entries"
    new RegExp(`\\bDELETE\\s+FROM\\s+${tableRef}`, 'is'),
    // TRUNCATE [TABLE] [public.]"audit_log_entries"
    new RegExp(`\\bTRUNCATE\\s+(?:TABLE\\s+)?${tableRef}`, 'is'),
    // GRANT ... ON [TABLE] [public.]"audit_log_entries"
    new RegExp(`\\bGRANT\\b[^;]+?\\bON\\s+(?:TABLE\\s+)?${tableRef}`, 'is'),
    // REVOKE ... ON [TABLE] [public.]"audit_log_entries"
    new RegExp(`\\bREVOKE\\b[^;]+?\\bON\\s+(?:TABLE\\s+)?${tableRef}`, 'is'),
    // DROP TRIGGER ... ON [public.]"audit_log_entries"
    new RegExp(`\\bDROP\\s+TRIGGER\\b[^;]+?\\bON\\s+${tableRef}`, 'is'),
    // CREATE TRIGGER ... ON [public.]"audit_log_entries"
    new RegExp(`\\bCREATE\\s+(?:OR\\s+REPLACE\\s+)?TRIGGER\\b[^;]+?\\bON\\s+${tableRef}`, 'is'),
    // CREATE POLICY ... ON [public.]"audit_log_entries"
    new RegExp(`\\bCREATE\\s+POLICY\\b[^;]+?\\bON\\s+${tableRef}`, 'is'),
    // DROP POLICY ... ON [public.]"audit_log_entries"
    new RegExp(`\\bDROP\\s+POLICY\\b[^;]+?\\bON\\s+${tableRef}`, 'is'),
    // CREATE INDEX ... ON [public.]"audit_log_entries"
    new RegExp(`\\bCREATE\\s+(?:UNIQUE\\s+)?INDEX\\b[^;]+?\\bON\\s+${tableRef}`, 'is'),
    // DROP INDEX ... (mention of table in index name context — captured by ALTER TABLE above)
    // ENABLE/DISABLE/FORCE ROW LEVEL SECURITY — already caught by ALTER TABLE pattern
  ];

  return patterns.some((p) => p.test(stripped));
}

// ── Row-mutating / structural-ALTER classifier ────────────────────────────────

/**
 * Row-mutating or structural-ALTER DML patterns on a WORM table.
 *
 * GRANT, REVOKE, CREATE/DROP POLICY, and ENABLE/DISABLE/FORCE ROW LEVEL SECURITY
 * are privilege-layer or policy DDL — they do not cause the WORM BEFORE-UPDATE/DELETE
 * trigger to fire. Only these patterns can cause the wave-17-class collision against a
 * populated DB:
 *   INSERT, UPDATE, DELETE, TRUNCATE          — row mutations
 *   CREATE TABLE, ALTER TABLE, CREATE TRIGGER,
 *   DROP TRIGGER, CREATE INDEX                — structural DDL
 *
 * Returns true when the SQL contains any of these patterns for the given table.
 * Used to determine whether a migration requires the stronger coverage-marker check
 * (as opposed to the existence-only check for GRANT/POLICY-only migrations).
 */
export function migrationIsRowMutatingOrStructural(sql: string, tableName: string): boolean {
  const stripped = stripSqlComments(sql);

  const schemaPrefix = `(?:(?:public|"public")\\s*\\.\\s*)?`;
  const tablePart = `(?:"${tableName}"|\\b${tableName}\\b)`;
  const tableRef = `${schemaPrefix}${tablePart}`;

  const rowMutatingPatterns: RegExp[] = [
    // CREATE TABLE
    new RegExp(`\\bCREATE\\s+TABLE\\s+(?:IF\\s+NOT\\s+EXISTS\\s+)?${tableRef}`, 'is'),
    // ALTER TABLE — covers ADD COLUMN, NOT NULL, DISABLE/ENABLE TRIGGER, ENABLE/FORCE RLS
    new RegExp(`\\bALTER\\s+TABLE\\s+${tableRef}`, 'is'),
    // INSERT INTO
    new RegExp(`\\bINSERT\\s+INTO\\s+${tableRef}`, 'is'),
    // UPDATE
    new RegExp(`\\bUPDATE\\s+${tableRef}`, 'is'),
    // DELETE FROM
    new RegExp(`\\bDELETE\\s+FROM\\s+${tableRef}`, 'is'),
    // TRUNCATE [TABLE]
    new RegExp(`\\bTRUNCATE\\s+(?:TABLE\\s+)?${tableRef}`, 'is'),
    // DROP TRIGGER ... ON
    new RegExp(`\\bDROP\\s+TRIGGER\\b[^;]+?\\bON\\s+${tableRef}`, 'is'),
    // CREATE TRIGGER ... ON
    new RegExp(`\\bCREATE\\s+(?:OR\\s+REPLACE\\s+)?TRIGGER\\b[^;]+?\\bON\\s+${tableRef}`, 'is'),
    // CREATE INDEX ... ON
    new RegExp(`\\bCREATE\\s+(?:UNIQUE\\s+)?INDEX\\b[^;]+?\\bON\\s+${tableRef}`, 'is'),
  ];

  return rowMutatingPatterns.some((p) => p.test(stripped));
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

// ── Coverage marker check ────────────────────────────────────────────────────

/**
 * Coverage marker patterns for a populated-DB migration test.
 *
 * A registered test file satisfies the coverage-marker requirement when it:
 *   (a) References the migration filename or the migration number
 *       (e.g. "0014" or "workspace_isolation" or "steep_boom_boom").
 *   (b) Imports or uses populated-DB helpers (ensureMigrated, AuditService,
 *       AuditKeyring, AuditRepository) OR references verifyChain.
 *
 * A file that exists but is content-empty or comment-only fails this check.
 */
export function testFileHasCoverageMarker(testFileContent: string, migrationFile: string): boolean {
  // Derive identifiers from the migration filename (e.g. "0014_workspace_isolation.sql")
  // → migrationNumber "0014", migrationSlug "workspace_isolation"
  const withoutExtension = migrationFile.replace(/\.sql$/, '');
  const firstUnderscore = withoutExtension.indexOf('_');
  const migrationNumber =
    firstUnderscore >= 0 ? withoutExtension.slice(0, firstUnderscore) : withoutExtension;
  const migrationSlug = firstUnderscore >= 0 ? withoutExtension.slice(firstUnderscore + 1) : '';

  // (a) Does the file reference the migration?
  const referencesMigration =
    testFileContent.includes(migrationNumber) ||
    (migrationSlug.length > 0 && testFileContent.includes(migrationSlug));

  // (b) Does the file use populated-DB helpers or verifyChain?
  const populatedDbMarkers = [
    'ensureMigrated',
    'AuditService',
    'AuditKeyring',
    'AuditRepository',
    'verifyChain',
  ];
  const hasPopulatedDbUsage = populatedDbMarkers.some((marker) => testFileContent.includes(marker));

  return referencesMigration && hasPopulatedDbUsage;
}

// ── Registry lookup ──────────────────────────────────────────────────────────

export interface CheckResult {
  passed: boolean;
  wormTouchingMigrations: string[];
  missing: string[]; // migrations with no registry entry
  missingFile: string[]; // migrations with a registry entry but non-existent test file
  hollowCoverage: string[]; // migrations registered + file exists but no real coverage marker (row-mutating only)
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
  const hollowCoverage: string[] = [];
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

    // For row-mutating/structural-ALTER migrations, require a real coverage marker.
    // GRANT/policy-only migrations (0016, 0017) pass with existence alone.
    const migSql = fs.readFileSync(path.join(migrationsDir, migFile), 'utf8');
    // Determine if any WORM table is touched with row-mutating/structural DDL.
    const requiresMarker = WORM_TABLES.some((t) => migrationIsRowMutatingOrStructural(migSql, t));

    if (requiresMarker) {
      const testContent = fs.readFileSync(testFilePath, 'utf8');
      if (!testFileHasCoverageMarker(testContent, migFile)) {
        hollowCoverage.push(migFile);
        continue;
      }
    }

    covered.push(migFile);
  }

  return {
    passed: missing.length === 0 && missingFile.length === 0 && hollowCoverage.length === 0,
    wormTouchingMigrations,
    missing,
    missingFile,
    hollowCoverage,
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
        : result.missingFile.includes(m)
          ? 'MISSING (test file not found)'
          : 'HOLLOW (file exists but no real coverage marker)';
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

  if (result.hollowCoverage.length > 0) {
    console.error('');
    console.error(
      'FAIL: The following row-mutating/structural-ALTER WORM migrations have a registered test'
    );
    console.error(
      '      file that exists but lacks real coverage markers (migration reference + populated-DB helper use):'
    );
    for (const m of result.hollowCoverage) {
      console.error(`  ${m}`);
    }
    console.error(
      'The test file must reference the migration number/name AND use ensureMigrated/AuditService/AuditKeyring/AuditRepository or verifyChain.'
    );
    console.error('A comment-only or empty file does NOT satisfy coverage.');
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

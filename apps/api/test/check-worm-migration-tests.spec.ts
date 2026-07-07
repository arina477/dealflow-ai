/**
 * check-worm-migration-tests.spec.ts — self-test for the WORM migration CI check.
 *
 * FAULT-KILLING REQUIREMENT (MG1):
 *   This spec proves the check actually catches the gap. It must demonstrate:
 *     (a) A WORM-touching migration WITHOUT a registered test → check FAILS (exit 1).
 *     (b) A WORM-touching migration WITH a registered test that exists → check PASSES.
 *
 * It also tests the classifier directly with fixture SQL to prove comment-only
 * mentions are excluded and real DML/DDL operations are detected.
 *
 * ── HOW IT WORKS ─────────────────────────────────────────────────────────────
 * Tests use in-memory fixture data (SQL strings, registry arrays, temp dirs) so
 * they run without a real DB or filesystem side-effects beyond a temp dir.
 *
 * The `runCheck` function is imported directly from the check script and exercised
 * with controlled inputs. This is the deterministic, fault-killing self-test the
 * standing AC requires.
 *
 * ── GREEN ON CURRENT TREE ────────────────────────────────────────────────────
 * The "real tree integration" test at the bottom runs `runCheck` against the actual
 * migrations directory and registry to confirm the check passes on the current tree.
 * This test is the Green-on-current-tree guarantee.
 */

import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  findWormTouchingMigrations,
  migrationTouchesWormTable,
  runCheck,
  stripSqlComments,
  WORM_TABLES,
} from '../scripts/check-worm-migration-tests';

// ── SQL comment stripping ─────────────────────────────────────────────────────

describe('stripSqlComments', () => {
  it('strips single-line comments', () => {
    const sql = `
      -- This is a comment about audit_log_entries
      CREATE TABLE foo (id int);
    `;
    const result = stripSqlComments(sql);
    expect(result).not.toContain('-- This is a comment');
    expect(result).toContain('CREATE TABLE foo');
  });

  it('strips block comments', () => {
    const sql = `
      /* Wave-17: audit_log_entries backfill */
      ALTER TABLE bar ADD COLUMN x int;
    `;
    const result = stripSqlComments(sql);
    expect(result).not.toContain('Wave-17');
    expect(result).toContain('ALTER TABLE bar');
  });

  it('strips nested -- comments inside block context', () => {
    const sql = `/* -- still a block comment */ SELECT 1;`;
    const result = stripSqlComments(sql);
    expect(result).not.toContain('--');
    expect(result).toContain('SELECT 1');
  });
});

// ── migrationTouchesWormTable classifier ─────────────────────────────────────

describe('migrationTouchesWormTable', () => {
  const TABLE = 'audit_log_entries';

  // ── SHOULD DETECT (real DML/DDL) ──────────────────────────────────────────

  it('detects CREATE TABLE', () => {
    expect(migrationTouchesWormTable(`CREATE TABLE "audit_log_entries" (id bigint);`, TABLE)).toBe(
      true
    );
  });

  it('detects ALTER TABLE ADD COLUMN', () => {
    expect(
      migrationTouchesWormTable(
        `ALTER TABLE "audit_log_entries" ADD COLUMN workspace_id uuid;`,
        TABLE
      )
    ).toBe(true);
  });

  it('detects ALTER TABLE DISABLE TRIGGER (0014 pattern)', () => {
    expect(
      migrationTouchesWormTable(
        `ALTER TABLE "audit_log_entries" DISABLE TRIGGER audit_log_no_mutate;`,
        TABLE
      )
    ).toBe(true);
  });

  it('detects UPDATE ... SET (0014 backfill pattern)', () => {
    expect(
      migrationTouchesWormTable(
        `UPDATE "audit_log_entries" SET workspace_id = 'abc' WHERE workspace_id IS NULL;`,
        TABLE
      )
    ).toBe(true);
  });

  it('detects GRANT ON TABLE (0016 pattern)', () => {
    expect(
      migrationTouchesWormTable(
        `GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.audit_log_entries TO dealflow_app;`,
        TABLE
      )
    ).toBe(true);
  });

  it('detects REVOKE ON TABLE (0002 pattern)', () => {
    expect(
      migrationTouchesWormTable(
        `REVOKE UPDATE, DELETE, TRUNCATE ON audit_log_entries FROM CURRENT_USER;`,
        TABLE
      )
    ).toBe(true);
  });

  it('detects CREATE TRIGGER ON (0002 pattern)', () => {
    expect(
      migrationTouchesWormTable(
        `CREATE TRIGGER audit_log_no_mutate\n  BEFORE UPDATE OR DELETE ON audit_log_entries\n  FOR EACH ROW EXECUTE FUNCTION audit_log_block_mutation();`,
        TABLE
      )
    ).toBe(true);
  });

  it('detects DROP TRIGGER ON (0002 pattern)', () => {
    expect(
      migrationTouchesWormTable(
        `DROP TRIGGER IF EXISTS audit_log_no_mutate ON audit_log_entries;`,
        TABLE
      )
    ).toBe(true);
  });

  it('detects CREATE POLICY ON (0014/0017 patterns)', () => {
    expect(
      migrationTouchesWormTable(
        `CREATE POLICY "workspace_isolation" ON "audit_log_entries"\n  USING (workspace_id = $1);`,
        TABLE
      )
    ).toBe(true);
  });

  it('detects DROP POLICY ON (0017 pattern)', () => {
    expect(
      migrationTouchesWormTable(
        `DROP POLICY IF EXISTS "workspace_isolation" ON "audit_log_entries";`,
        TABLE
      )
    ).toBe(true);
  });

  it('detects CREATE INDEX ON (0014 pattern)', () => {
    expect(
      migrationTouchesWormTable(
        `CREATE INDEX "audit_log_entries_workspace_id_idx" ON "audit_log_entries" ("workspace_id");`,
        TABLE
      )
    ).toBe(true);
  });

  it('detects ENABLE ROW LEVEL SECURITY via ALTER TABLE', () => {
    expect(
      migrationTouchesWormTable(`ALTER TABLE "audit_log_entries" ENABLE ROW LEVEL SECURITY;`, TABLE)
    ).toBe(true);
  });

  it('detects INSERT INTO', () => {
    expect(
      migrationTouchesWormTable(
        `INSERT INTO audit_log_entries (actor_role, action) VALUES ('admin', 'test');`,
        TABLE
      )
    ).toBe(true);
  });

  // ── SHOULD NOT DETECT (comment-only mentions) ────────────────────────────

  it('does NOT detect comment-only mention (-- line comment)', () => {
    const sql = `
      -- This migration does NOT alter audit_log_entries.
      -- It creates outreach_activity instead.
      CREATE TABLE outreach_activity (id uuid);
    `;
    expect(migrationTouchesWormTable(sql, TABLE)).toBe(false);
  });

  it('does NOT detect comment-only mention (/* block comment */)', () => {
    const sql = `
      /* Existing tables (users/roles/invites/app_meta/audit_log_entries) are NOT touched */
      CREATE TABLE compliance_rules (id uuid);
    `;
    expect(migrationTouchesWormTable(sql, TABLE)).toBe(false);
  });

  it('does NOT detect 0018-style comment-only mention', () => {
    // 0018 explicitly comments it does NOT touch audit_log_entries.
    const sql = `
      -- It does NOT alter audit_log_entries, so there is zero risk of WORM-trigger
      -- collision on populated rows.
      CREATE TABLE outreach_activity (id uuid PRIMARY KEY);
    `;
    expect(migrationTouchesWormTable(sql, TABLE)).toBe(false);
  });

  it('does NOT produce false positive for partial table name match', () => {
    const sql = `CREATE TABLE audit_log_entries_archive (id bigint);`;
    // The classifier should NOT match a different table that starts with the same prefix.
    // The word-boundary check ensures audit_log_entries\b does not match audit_log_entries_archive.
    // However, "audit_log_entries_archive" IS a superset — the \b anchor after "audit_log_entries"
    // means it only matches when the next char is not a word char. "_" IS a word char in \b.
    // So audit_log_entries_archive should NOT match.
    expect(migrationTouchesWormTable(sql, TABLE)).toBe(false);
  });
});

// ── WORM_TABLES allow-list ─────────────────────────────────────────────────────

describe('WORM_TABLES allow-list', () => {
  it('includes audit_log_entries', () => {
    expect(WORM_TABLES).toContain('audit_log_entries');
  });

  it('does NOT include pipeline_events (app-level only, no DB trigger)', () => {
    expect(WORM_TABLES).not.toContain('pipeline_events');
  });
});

// ── findWormTouchingMigrations (with temp dir fixture) ──────────────────────

describe('findWormTouchingMigrations', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'worm-check-test-'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('returns the WORM-touching migration and excludes comment-only and non-touching', () => {
    // Fixture: one WORM-touching, one comment-only, one unrelated, one .down.sql.
    fs.writeFileSync(
      path.join(tmpDir, '0002_worm_create.sql'),
      `CREATE TABLE "audit_log_entries" (sequence_number bigint PRIMARY KEY);`
    );
    fs.writeFileSync(
      path.join(tmpDir, '0003_comment_only.sql'),
      `-- audit_log_entries is NOT touched here.\nCREATE TABLE other_table (id uuid);`
    );
    fs.writeFileSync(path.join(tmpDir, '0004_unrelated.sql'), `CREATE TABLE mandates (id uuid);`);
    fs.writeFileSync(
      path.join(tmpDir, '0002_worm_create.down.sql'),
      `DROP TABLE "audit_log_entries";`
    );

    const result = findWormTouchingMigrations(tmpDir);
    expect(result).toEqual(['0002_worm_create.sql']);
  });

  it('returns empty array when no migrations touch WORM tables', () => {
    fs.writeFileSync(path.join(tmpDir, '0001_unrelated.sql'), `CREATE TABLE workspaces (id uuid);`);
    const result = findWormTouchingMigrations(tmpDir);
    expect(result).toEqual([]);
  });
});

// ── runCheck — FAULT-KILLING SELF-TEST ────────────────────────────────────────

describe('runCheck — fault-killing self-test', () => {
  let tmpDir: string;
  let apiRoot: string;
  let migrationsDir: string;
  let testDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'worm-runcheck-test-'));
    apiRoot = tmpDir;
    migrationsDir = path.join(tmpDir, 'migrations');
    testDir = path.join(tmpDir, 'test');
    fs.mkdirSync(migrationsDir, { recursive: true });
    fs.mkdirSync(testDir, { recursive: true });
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  /**
   * FAULT-KILLING (a): a WORM-touching migration WITHOUT a registered test → FAILS.
   *
   * This is the primary fault-killing assertion. It proves the check is not toothless:
   * when a developer adds a WORM-touching migration without updating the registry,
   * the check exits 1 (CI fails).
   */
  it('FAULT-KILLING (a): WORM-touching migration with no registry entry → check FAILS', () => {
    // Arrange: one WORM-touching migration, empty registry.
    fs.writeFileSync(
      path.join(migrationsDir, '0099_worm_touching.sql'),
      `ALTER TABLE "audit_log_entries" ADD COLUMN new_col text;`
    );

    // Act: registry is empty — no entry for 0099_worm_touching.sql.
    const result = runCheck(migrationsDir, apiRoot, []);

    // Assert: check FAILS.
    expect(result.passed).toBe(false);
    expect(result.missing).toContain('0099_worm_touching.sql');
    expect(result.covered).toHaveLength(0);
  });

  /**
   * FAULT-KILLING (b): a WORM-touching migration WITH a registered test that exists → PASSES.
   *
   * Proves that when the registry is properly populated and the test file exists,
   * the check exits 0.
   */
  it('FAULT-KILLING (b): WORM-touching migration with registered + existing test → check PASSES', () => {
    // Arrange: one WORM-touching migration, a registry entry, and the test file.
    fs.writeFileSync(
      path.join(migrationsDir, '0099_worm_touching.sql'),
      `ALTER TABLE "audit_log_entries" ADD COLUMN new_col text;`
    );
    const testFilePath = path.join(testDir, 'my-migration.e2e-spec.ts');
    fs.writeFileSync(testFilePath, `// populated-DB migration test for 0099`);

    const registry = [
      {
        migrationFile: '0099_worm_touching.sql',
        testFile: 'test/my-migration.e2e-spec.ts',
      },
    ];

    // Act.
    const result = runCheck(migrationsDir, apiRoot, registry);

    // Assert: check PASSES.
    expect(result.passed).toBe(true);
    expect(result.covered).toContain('0099_worm_touching.sql');
    expect(result.missing).toHaveLength(0);
    expect(result.missingFile).toHaveLength(0);
  });

  it('FAULT-KILLING (c): registry entry exists but test file is missing → check FAILS', () => {
    // Arrange: migration + registry entry, but the test file is NOT created.
    fs.writeFileSync(
      path.join(migrationsDir, '0099_worm_touching.sql'),
      `UPDATE "audit_log_entries" SET workspace_id = 'x' WHERE workspace_id IS NULL;`
    );

    const registry = [
      {
        migrationFile: '0099_worm_touching.sql',
        testFile: 'test/non-existent.e2e-spec.ts', // file does not exist
      },
    ];

    // Act.
    const result = runCheck(migrationsDir, apiRoot, registry);

    // Assert: check FAILS because the test file is absent.
    expect(result.passed).toBe(false);
    expect(result.missingFile).toContain('0099_worm_touching.sql');
    expect(result.covered).toHaveLength(0);
  });

  it('FAULT-KILLING (d): non-WORM migration has no registry entry → check PASSES (not required)', () => {
    // A migration that only touches non-WORM tables needs no populated-DB test.
    fs.writeFileSync(
      path.join(migrationsDir, '0050_non_worm.sql'),
      `CREATE TABLE workspaces (id uuid PRIMARY KEY);`
    );

    // Act: empty registry is fine for non-WORM migrations.
    const result = runCheck(migrationsDir, apiRoot, []);

    // Assert: check PASSES (no WORM-touching migrations found).
    expect(result.passed).toBe(true);
    expect(result.wormTouchingMigrations).toHaveLength(0);
  });

  it('FAULT-KILLING (e): comment-only mention of WORM table does NOT trigger the check', () => {
    // 0018-style: migration only mentions audit_log_entries in comments.
    fs.writeFileSync(
      path.join(migrationsDir, '0018_comment_only.sql'),
      [
        '-- It does NOT alter audit_log_entries, so there is zero risk of WORM-trigger',
        'CREATE TABLE outreach_activity (id uuid);',
      ].join('\n')
    );

    const result = runCheck(migrationsDir, apiRoot, []);

    // Assert: comment-only mention does NOT trigger a failure.
    expect(result.passed).toBe(true);
    expect(result.wormTouchingMigrations).toHaveLength(0);
  });
});

// ── Real-tree integration — GREEN ON CURRENT TREE ────────────────────────────

describe('real-tree integration — GREEN on current tree', () => {
  it('check passes on the actual migrations directory with the actual registry', async () => {
    // Resolve paths relative to this test file's location (apps/api/test/).
    const apiRoot = path.resolve(__dirname, '..');
    const migrationsDir = path.join(apiRoot, 'src/db/migrations');

    // Dynamic import of the real registry.
    const { WORM_MIGRATION_COVERAGE_REGISTRY } = await import(
      './_helpers/worm-migration-coverage-registry'
    );

    const result = runCheck(migrationsDir, apiRoot, WORM_MIGRATION_COVERAGE_REGISTRY);

    // If this fails, a WORM-touching migration is missing from the registry.
    // See command-center/testing/worm-migration-testing-policy.md.
    if (!result.passed) {
      const details = [
        ...result.missing.map((m) => `  MISSING REGISTRY ENTRY: ${m}`),
        ...result.missingFile.map((m) => `  TEST FILE NOT FOUND: ${m}`),
      ].join('\n');
      throw new Error(
        `WORM migration coverage check FAILED on current tree:\n${details}\n` +
          'Add entries to apps/api/test/_helpers/worm-migration-coverage-registry.ts'
      );
    }

    expect(result.passed).toBe(true);

    // Confirm the expected set {0002, 0012, 0014, 0016, 0017} is detected.
    // (0003 is comment-only and correctly excluded; 0018 is comment-only and excluded.)
    const detected = result.wormTouchingMigrations;
    expect(detected).toContain('0002_steep_boom_boom.sql');
    expect(detected).toContain('0012_audit_mandate_id.sql');
    expect(detected).toContain('0014_workspace_isolation.sql');
    expect(detected).toContain('0016_dealflow_app_role.sql');
    expect(detected).toContain('0017_rls_policy_empty_string_fix.sql');

    // 0003 and 0018: comment-only mentions — must NOT be in the detected set.
    expect(detected).not.toContain('0003_giant_outlaw_kid.sql');
    expect(detected).not.toContain('0018_outreach_activity.sql');

    // All detected migrations are covered.
    expect(result.covered).toHaveLength(result.wormTouchingMigrations.length);
    expect(result.missing).toHaveLength(0);
    expect(result.missingFile).toHaveLength(0);
  });
});

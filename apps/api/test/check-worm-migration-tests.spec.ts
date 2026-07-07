/**
 * check-worm-migration-tests.spec.ts — self-test for the WORM migration CI check.
 *
 * FAULT-KILLING REQUIREMENT (MG1):
 *   This spec proves the check actually catches the gap. It must demonstrate:
 *     (a) A WORM-touching migration WITHOUT a registered test → check FAILS (exit 1).
 *     (b) A WORM-touching migration WITH a registered test that exists AND has real
 *         coverage markers → check PASSES.
 *     (c) A registered test file that EXISTS but is content-empty or comment-only →
 *         check FAILS for row-mutating migrations (hollow coverage).
 *     (d) Schema-qualified DML (public.audit_log_entries) IS detected by the classifier.
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
  migrationIsRowMutatingOrStructural,
  migrationTouchesWormTable,
  runCheck,
  stripSqlComments,
  testFileHasCoverageMarker,
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

  // ── FAULT-KILLING: schema-qualified DML must NOT escape (P1 #1) ──────────

  it('FAULT-KILLING (schema-qualified): detects UPDATE public.audit_log_entries', () => {
    // This is the EXACT wave-17 backfill escape pattern that was bypassable before the fix.
    expect(
      migrationTouchesWormTable(
        `UPDATE public.audit_log_entries SET workspace_id = 'a1b2c3d4-0000-4000-8000-000000000001' WHERE workspace_id IS NULL;`,
        TABLE
      )
    ).toBe(true);
  });

  it('FAULT-KILLING (schema-qualified): detects DELETE FROM public.audit_log_entries', () => {
    expect(
      migrationTouchesWormTable(
        `DELETE FROM public.audit_log_entries WHERE sequence_number < 100;`,
        TABLE
      )
    ).toBe(true);
  });

  it('FAULT-KILLING (schema-qualified): detects ALTER TABLE public.audit_log_entries DISABLE TRIGGER', () => {
    // Exactly the wave-17 trigger-disable bypass pattern.
    expect(
      migrationTouchesWormTable(
        `ALTER TABLE public.audit_log_entries DISABLE TRIGGER audit_log_no_mutate;`,
        TABLE
      )
    ).toBe(true);
  });

  it('FAULT-KILLING (schema-qualified): detects ALTER TABLE public.audit_log_entries ENABLE TRIGGER', () => {
    expect(
      migrationTouchesWormTable(
        `ALTER TABLE public.audit_log_entries ENABLE TRIGGER audit_log_no_mutate;`,
        TABLE
      )
    ).toBe(true);
  });

  it('FAULT-KILLING (schema-qualified): detects INSERT INTO public.audit_log_entries', () => {
    expect(
      migrationTouchesWormTable(
        `INSERT INTO public.audit_log_entries (actor_role, action) VALUES ('admin', 'test');`,
        TABLE
      )
    ).toBe(true);
  });

  it('FAULT-KILLING (schema-qualified): detects TRUNCATE public.audit_log_entries', () => {
    expect(migrationTouchesWormTable(`TRUNCATE public.audit_log_entries;`, TABLE)).toBe(true);
  });

  it('FAULT-KILLING (schema-qualified): detects CREATE INDEX ON public.audit_log_entries', () => {
    expect(
      migrationTouchesWormTable(
        `CREATE INDEX audit_log_entries_workspace_id_idx ON public.audit_log_entries (workspace_id);`,
        TABLE
      )
    ).toBe(true);
  });

  it('FAULT-KILLING (schema-qualified): detects "public"."audit_log_entries" (double-quoted schema)', () => {
    expect(
      migrationTouchesWormTable(
        `UPDATE "public"."audit_log_entries" SET workspace_id = 'x' WHERE workspace_id IS NULL;`,
        TABLE
      )
    ).toBe(true);
  });
});

// ── migrationIsRowMutatingOrStructural classifier ─────────────────────────────

describe('migrationIsRowMutatingOrStructural', () => {
  const TABLE = 'audit_log_entries';

  it('returns true for UPDATE (row mutation)', () => {
    expect(
      migrationIsRowMutatingOrStructural(
        `UPDATE audit_log_entries SET workspace_id = 'x' WHERE workspace_id IS NULL;`,
        TABLE
      )
    ).toBe(true);
  });

  it('returns true for UPDATE public.audit_log_entries (schema-qualified)', () => {
    expect(
      migrationIsRowMutatingOrStructural(
        `UPDATE public.audit_log_entries SET workspace_id = 'x' WHERE workspace_id IS NULL;`,
        TABLE
      )
    ).toBe(true);
  });

  it('returns true for ALTER TABLE (structural)', () => {
    expect(
      migrationIsRowMutatingOrStructural(
        `ALTER TABLE "audit_log_entries" ADD COLUMN workspace_id uuid;`,
        TABLE
      )
    ).toBe(true);
  });

  it('returns true for CREATE TABLE (structural)', () => {
    expect(
      migrationIsRowMutatingOrStructural(
        `CREATE TABLE "audit_log_entries" (id bigint PRIMARY KEY);`,
        TABLE
      )
    ).toBe(true);
  });

  it('returns true for CREATE TRIGGER ON (structural)', () => {
    expect(
      migrationIsRowMutatingOrStructural(
        `CREATE TRIGGER audit_log_no_mutate\n  BEFORE UPDATE OR DELETE ON audit_log_entries\n  FOR EACH ROW EXECUTE FUNCTION f();`,
        TABLE
      )
    ).toBe(true);
  });

  it('returns true for CREATE INDEX ON (structural)', () => {
    expect(
      migrationIsRowMutatingOrStructural(
        `CREATE INDEX idx ON audit_log_entries (workspace_id);`,
        TABLE
      )
    ).toBe(true);
  });

  it('returns FALSE for GRANT-only (privilege DDL, no row mutation)', () => {
    // GRANT does not touch rows — should NOT require coverage marker.
    expect(
      migrationIsRowMutatingOrStructural(
        `GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.audit_log_entries TO dealflow_app;`,
        TABLE
      )
    ).toBe(false);
  });

  it('returns FALSE for REVOKE-only (privilege DDL, no row mutation)', () => {
    expect(
      migrationIsRowMutatingOrStructural(
        `REVOKE UPDATE, DELETE, TRUNCATE ON audit_log_entries FROM CURRENT_USER;`,
        TABLE
      )
    ).toBe(false);
  });

  it('returns FALSE for CREATE POLICY-only (no row mutation)', () => {
    expect(
      migrationIsRowMutatingOrStructural(
        `CREATE POLICY "workspace_isolation" ON "audit_log_entries"\n  USING (workspace_id = current_setting('app.workspace_id', true)::uuid);`,
        TABLE
      )
    ).toBe(false);
  });

  it('returns FALSE for DROP POLICY-only (no row mutation)', () => {
    expect(
      migrationIsRowMutatingOrStructural(
        `DROP POLICY IF EXISTS "workspace_isolation" ON "audit_log_entries";`,
        TABLE
      )
    ).toBe(false);
  });
});

// ── testFileHasCoverageMarker ─────────────────────────────────────────────────

describe('testFileHasCoverageMarker', () => {
  const MIG_FILE = '0014_workspace_isolation.sql';

  it('returns true when file references migration number and uses ensureMigrated', () => {
    const content = `
      import { ensureMigrated } from './_helpers/ensure-migrated';
      // covers 0014
      it('test', async () => { await ensureMigrated(db, dir); });
    `;
    expect(testFileHasCoverageMarker(content, MIG_FILE)).toBe(true);
  });

  it('returns true when file references migration slug and uses AuditService', () => {
    const content = `
      import { AuditService } from '../src/modules/audit/audit.service';
      // workspace_isolation migration coverage
      it('test', () => {});
    `;
    expect(testFileHasCoverageMarker(content, MIG_FILE)).toBe(true);
  });

  it('FAULT-KILLING: returns false for content-empty file (hollow stub)', () => {
    // A file that exists but has no content — the hollow-coverage bypass that previously
    // passed (the old code only checked existsSync, not content). Must now FAIL.
    expect(testFileHasCoverageMarker('', MIG_FILE)).toBe(false);
  });

  it('FAULT-KILLING: returns false for comment-only file (hollow stub)', () => {
    // Spec.ts:336 previously codified this case as passed=true. This is the reversal.
    const content = `// populated-DB migration test for 0014`;
    expect(testFileHasCoverageMarker(content, MIG_FILE)).toBe(false);
  });

  it('returns false when migration reference is present but no populated-DB helper', () => {
    const content = `
      // covers migration 0014
      it('dummy', () => { expect(true).toBe(true); });
    `;
    expect(testFileHasCoverageMarker(content, MIG_FILE)).toBe(false);
  });

  it('returns false when populated-DB helper is present but no migration reference', () => {
    const content = `
      import { ensureMigrated } from './_helpers/ensure-migrated';
      // covers some migration (no number here)
      it('test', async () => { await ensureMigrated(db, dir); });
    `;
    // "0014" and "workspace_isolation" not present — fails condition (a).
    expect(testFileHasCoverageMarker(content, '0014_workspace_isolation.sql')).toBe(false);
  });

  it('returns true for AuditKeyring marker', () => {
    const content = `import { AuditKeyring } from '../audit.keyring'; // 0002 coverage`;
    expect(testFileHasCoverageMarker(content, '0002_steep_boom_boom.sql')).toBe(true);
  });

  it('returns true for AuditRepository marker', () => {
    const content = `import { AuditRepository } from '../audit.repository'; // 0012 coverage`;
    expect(testFileHasCoverageMarker(content, '0012_audit_mandate_id.sql')).toBe(true);
  });

  it('returns true for verifyChain marker', () => {
    const content = `const ok = verifyChain(rows); // 0002 test`;
    expect(testFileHasCoverageMarker(content, '0002_steep_boom_boom.sql')).toBe(true);
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
   * FAULT-KILLING (b): a WORM-touching migration WITH a registered test that exists
   * AND has real coverage markers → PASSES.
   *
   * Proves that when the registry is properly populated and the test file has real
   * content (migration reference + populated-DB helper use), the check exits 0.
   */
  it('FAULT-KILLING (b): WORM-touching migration with registered + existing test with coverage markers → check PASSES', () => {
    // Arrange: one WORM-touching migration, a registry entry, and the test file with real content.
    fs.writeFileSync(
      path.join(migrationsDir, '0099_worm_touching.sql'),
      `ALTER TABLE "audit_log_entries" ADD COLUMN new_col text;`
    );
    const testFilePath = path.join(testDir, 'my-migration.e2e-spec.ts');
    // Real content: references the migration number and uses ensureMigrated.
    fs.writeFileSync(
      testFilePath,
      [
        `import { ensureMigrated } from './_helpers/ensure-migrated';`,
        `// Covers migration 0099_worm_touching — populated-DB test.`,
        `it('test', async () => { await ensureMigrated(db, dir); });`,
      ].join('\n')
    );

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
    expect(result.hollowCoverage).toHaveLength(0);
  });

  /**
   * FAULT-KILLING (b2): GRANT-only migration with registered + existing test → PASSES
   * WITHOUT needing coverage markers (existence-only is sufficient for GRANT/policy-only).
   *
   * This captures the 0016/0017 classification: they are WORM-touching (GRANT/POLICY on
   * audit_log_entries) but not row-mutating, so a registered file that exists is sufficient.
   */
  it('FAULT-KILLING (b2): GRANT-only WORM migration with registered + existing file → PASSES (no marker needed)', () => {
    fs.writeFileSync(
      path.join(migrationsDir, '0099_grant_only.sql'),
      `GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.audit_log_entries TO dealflow_app;`
    );
    const testFilePath = path.join(testDir, 'any-test.e2e-spec.ts');
    // Comment-only file: for GRANT-only migration, existence is enough (no marker required).
    fs.writeFileSync(
      testFilePath,
      `// placeholder — existence-only is sufficient for grant-only migration`
    );

    const registry = [
      {
        migrationFile: '0099_grant_only.sql',
        testFile: 'test/any-test.e2e-spec.ts',
      },
    ];

    const result = runCheck(migrationsDir, apiRoot, registry);

    expect(result.passed).toBe(true);
    expect(result.covered).toContain('0099_grant_only.sql');
    expect(result.hollowCoverage).toHaveLength(0);
  });

  /**
   * FAULT-KILLING (b3): HOLLOW COVERAGE — a row-mutating migration registered to a file
   * that EXISTS but has no real coverage markers → check FAILS.
   *
   * This is the inversion of the old spec.ts:336 case which wrongly asserted passed=true
   * for a comment-only file. A comment-only or content-empty file for a row-mutating
   * migration is NOT acceptable — the check must fail.
   */
  it('FAULT-KILLING (b3): row-mutating migration registered to comment-only test file → check FAILS (hollow coverage)', () => {
    fs.writeFileSync(
      path.join(migrationsDir, '0099_worm_touching.sql'),
      `ALTER TABLE "audit_log_entries" ADD COLUMN new_col text;`
    );
    const testFilePath = path.join(testDir, 'hollow.e2e-spec.ts');
    // Comment-only file — previously this would have passed. Now it must FAIL.
    fs.writeFileSync(testFilePath, `// populated-DB migration test for 0099`);

    const registry = [
      {
        migrationFile: '0099_worm_touching.sql',
        testFile: 'test/hollow.e2e-spec.ts',
      },
    ];

    const result = runCheck(migrationsDir, apiRoot, registry);

    // Must FAIL — hollow coverage is not acceptable for row-mutating migrations.
    expect(result.passed).toBe(false);
    expect(result.hollowCoverage).toContain('0099_worm_touching.sql');
    expect(result.covered).toHaveLength(0);
  });

  /**
   * FAULT-KILLING (b4): HOLLOW COVERAGE — content-empty file for row-mutating migration
   * → check FAILS.
   */
  it('FAULT-KILLING (b4): row-mutating migration registered to content-empty test file → check FAILS (hollow coverage)', () => {
    fs.writeFileSync(
      path.join(migrationsDir, '0099_worm_touching.sql'),
      `UPDATE "audit_log_entries" SET workspace_id = 'x' WHERE workspace_id IS NULL;`
    );
    const testFilePath = path.join(testDir, 'empty.e2e-spec.ts');
    fs.writeFileSync(testFilePath, ''); // empty file

    const registry = [
      {
        migrationFile: '0099_worm_touching.sql',
        testFile: 'test/empty.e2e-spec.ts',
      },
    ];

    const result = runCheck(migrationsDir, apiRoot, registry);

    expect(result.passed).toBe(false);
    expect(result.hollowCoverage).toContain('0099_worm_touching.sql');
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
    expect(result.hollowCoverage).toHaveLength(0);
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
  it('check passes on the actual migrations directory with the actual registry (honest classification)', async () => {
    // Resolve paths relative to this test file's location (apps/api/test/).
    const apiRoot = path.resolve(__dirname, '..');
    const migrationsDir = path.join(apiRoot, 'src/db/migrations');

    // Dynamic import of the real registry.
    const { WORM_MIGRATION_COVERAGE_REGISTRY } = await import(
      './_helpers/worm-migration-coverage-registry'
    );

    const result = runCheck(migrationsDir, apiRoot, WORM_MIGRATION_COVERAGE_REGISTRY);

    // If this fails, a WORM-touching migration is missing from the registry,
    // or a row-mutating migration's registered test file lacks real coverage markers.
    // See command-center/testing/worm-migration-testing-policy.md.
    if (!result.passed) {
      const details = [
        ...result.missing.map((m) => `  MISSING REGISTRY ENTRY: ${m}`),
        ...result.missingFile.map((m) => `  TEST FILE NOT FOUND: ${m}`),
        ...result.hollowCoverage.map((m) => `  HOLLOW COVERAGE (no real markers): ${m}`),
      ].join('\n');
      throw new Error(
        `WORM migration coverage check FAILED on current tree:\n${details}\n` +
          'Add/fix entries in apps/api/test/_helpers/worm-migration-coverage-registry.ts\n' +
          'For hollow coverage: ensure the test file references the migration number AND uses\n' +
          'ensureMigrated/AuditService/AuditKeyring/AuditRepository or verifyChain.'
      );
    }

    expect(result.passed).toBe(true);
    expect(result.hollowCoverage).toHaveLength(0);

    // ── Classification assertions ──────────────────────────────────────────────
    //
    // HONEST CLASSIFICATION:
    //   0002: ROW-MUTATING (CREATE TABLE + REVOKE + CREATE TRIGGER) → required, covered
    //   0012: STRUCTURAL-ALTER (ALTER TABLE ADD COLUMN) → required, covered
    //   0014: ROW-MUTATING (UPDATE backfill + ALTER TABLE + DISABLE/ENABLE TRIGGER +
    //          CREATE INDEX + CREATE POLICY + ENABLE/FORCE RLS) → required, covered
    //   0016: GRANT-ONLY (GRANT ON TABLE public.audit_log_entries) → detected, existence-only
    //   0017: POLICY-ONLY (DROP/CREATE POLICY ON audit_log_entries) → detected, existence-only
    //
    //   0003: comment-only → NOT detected
    //   0018: comment-only → NOT detected
    //
    // The check is HONESTLY GREEN: the 3 row-mutating migrations (0002, 0012, 0014)
    // have real coverage from the AMP suite; the 2 GRANT/policy-only migrations
    // (0016, 0017) are detected and registered but require only file existence
    // (no row-mutation risk — the WORM trigger never fires for GRANT/POLICY DDL).

    const detected = result.wormTouchingMigrations;
    expect(detected).toContain('0002_steep_boom_boom.sql');
    expect(detected).toContain('0012_audit_mandate_id.sql');
    expect(detected).toContain('0014_workspace_isolation.sql');
    expect(detected).toContain('0016_dealflow_app_role.sql');
    expect(detected).toContain('0017_rls_policy_empty_string_fix.sql');

    // 0003 and 0018: comment-only mentions — must NOT be in the detected set.
    expect(detected).not.toContain('0003_giant_outlaw_kid.sql');
    expect(detected).not.toContain('0018_outreach_activity.sql');

    // All detected migrations are in covered (no missing, no missingFile, no hollowCoverage).
    expect(result.covered).toHaveLength(result.wormTouchingMigrations.length);
    expect(result.missing).toHaveLength(0);
    expect(result.missingFile).toHaveLength(0);
  });

  // ── Future WORM table guard (P2) ────────────────────────────────────────────

  it('P2 future-WORM-table guard: any forward migration with BEFORE UPDATE OR DELETE trigger on a non-WORM table should be surfaced', () => {
    // This test verifies the WORM_TABLES allow-list maintenance requirement.
    // If a migration introduces a NEW BEFORE UPDATE OR DELETE trigger on a table
    // that is NOT in WORM_TABLES, it means a new WORM table was created without
    // being added to the allow-list. The check cannot enforce this mechanically
    // (it would require static analysis), but this test documents the requirement
    // and confirms WORM_TABLES is the single source of truth.
    //
    // The actual migration corpus is scanned here. A new BEFORE UPDATE OR DELETE
    // trigger on a table not in WORM_TABLES would indicate the allow-list is stale.
    const apiRoot = path.resolve(__dirname, '..');
    const migrationsDir = path.join(apiRoot, 'src/db/migrations');

    const allSqlFiles = fs
      .readdirSync(migrationsDir)
      .filter((f) => f.endsWith('.sql') && !f.endsWith('.down.sql'))
      .sort();

    // Pattern: CREATE TRIGGER ... BEFORE UPDATE OR DELETE ON <table>
    // We extract the table name and check if it's in WORM_TABLES.
    const wormTriggerPattern =
      /\bCREATE\s+(?:OR\s+REPLACE\s+)?TRIGGER\b[^;]+?\bBEFORE\s+(?:UPDATE\s+OR\s+DELETE|DELETE\s+OR\s+UPDATE)\s+ON\s+(?:(?:public|"public")\s*\.\s*)?(?:"([^"]+)"|(\w+))/gi;

    const unknownWormTables: string[] = [];

    for (const file of allSqlFiles) {
      const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
      const stripped = sql.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/--[^\n]*/g, ' ');

      wormTriggerPattern.lastIndex = 0;
      let match: RegExpExecArray | null = wormTriggerPattern.exec(stripped);
      while (match !== null) {
        const tableName = match[1] ?? match[2];
        if (tableName && !WORM_TABLES.includes(tableName)) {
          unknownWormTables.push(
            `${file}: BEFORE UPDATE OR DELETE trigger on '${tableName}' (not in WORM_TABLES)`
          );
        }
        match = wormTriggerPattern.exec(stripped);
      }
    }

    // If this fails, a new DB-trigger-enforced WORM table was created without
    // being added to WORM_TABLES in check-worm-migration-tests.ts.
    // Add the table to WORM_TABLES and add a coverage registry entry.
    expect(unknownWormTables).toHaveLength(0);
    if (unknownWormTables.length > 0) {
      throw new Error(
        'P2 future-WORM-table guard: found BEFORE UPDATE OR DELETE triggers on tables not in WORM_TABLES:\n' +
          unknownWormTables.join('\n') +
          '\nAdd these tables to WORM_TABLES in apps/api/scripts/check-worm-migration-tests.ts'
      );
    }
  });
});

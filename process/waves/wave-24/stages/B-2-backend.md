# Wave 24 — B-2 Backend

**Task:** fd8f2860 | **Branch:** wave-24-populated-migration-ac | **Specialist:** backend-developer

## Deliverables

### Part 1 — Standing AC (documented)

**File:** `command-center/testing/worm-migration-testing-policy.md`

Standing acceptance criterion: any migration that INSERTs, UPDATEs, backfills, or ALTERs a
DB-trigger-enforced WORM table MUST ship a populated-DB migration test (seed real chained rows
→ apply migration → assert: (a) applies without error, (b) verifyChain ok:true or per-row HMAC
recompute confirms hash-exclusion, (c) row-count/content invariants hold).

The doc states WHY empty-CI-DB testing is insufficient (the wave-17 C-2 prod HOLD: 0014's
audit backfill collided with the WORM BEFORE-UPDATE trigger on 328 populated prod rows;
CI was green because zero rows matched on the empty DB). States WHERE it is enforced (the
mechanical check + B-0 migration stage gate). Defines the in-scope WORM tables (audit_log_entries,
enforced by `audit_log_no_mutate`) and the documented out-of-scope table (pipeline_events —
app-level append-only, no DB trigger).

### Part 2 — Reusable template / helper

**Shared helper:** `apps/api/test/_helpers/worm-migration-test-utils.ts`

Two thin functions extracted from the AMP suite pattern:
- `seedChainedAuditRows(db, opts)` — seeds N real HMAC-chained entries via AuditService.appendStandalone
- `assertVerifyChainOkForRows(pool, sequenceNumbers, expect)` — per-row HMAC recompute
  (immune to parallel-suite interleaving; does not require global chain contiguity)

**Copy-able skeleton:** `apps/api/test/_helpers/worm-migration-template.ts`

A complete copy-able test skeleton with marked ADAPT sections, UUID namespace rule,
and all five WMT-1..5 assertions. Future migration authors: copy to `test/<name>.e2e-spec.ts`,
adapt UUID namespace and migration-specific assertions, add registry entry. NOT a framework.

Reference implementation: `apps/api/test/audit-migration-populated-db.e2e-spec.ts` (AMP-1..5).

### Part 3 — Mechanical CI check (load-bearing)

#### MG1 — Correct WORM set {0002, 0012, 0014, 0016, 0017}

**Scanner:** `apps/api/scripts/check-worm-migration-tests.ts`

Scans forward migration SQL files (`*.sql`, excludes `*.down.sql`) for actual DML/DDL touching
in-scope WORM tables (not comment-only mentions). The `stripSqlComments` function removes both
`--` and `/* */` comments before pattern matching.

Detected set on current tree:
- `0002_steep_boom_boom.sql` — CREATE TABLE + REVOKE/GRANT + CREATE TRIGGER (audit_log_no_mutate)
- `0012_audit_mandate_id.sql` — ALTER TABLE ADD COLUMN mandate_id
- `0014_workspace_isolation.sql` — ALTER TABLE ADD COLUMN workspace_id + DISABLE/UPDATE/ENABLE TRIGGER + ALTER TABLE NOT NULL + ENABLE/FORCE ROW LEVEL SECURITY + CREATE POLICY + CREATE INDEX
- `0016_dealflow_app_role.sql` — GRANT SELECT/INSERT/UPDATE/DELETE ON TABLE public.audit_log_entries
- `0017_rls_policy_empty_string_fix.sql` — DROP POLICY + CREATE POLICY on audit_log_entries

Correctly excluded:
- `0003_giant_outlaw_kid.sql` — mentions audit_log_entries in comments only (no DML/DDL)
- `0018_outreach_activity.sql` — mentions audit_log_entries in a comment stating it does NOT touch it

Note: the B-block review-artifacts listed {0002,0003,0012,0014,0016,0017} — 0003 is comment-only
and correctly excluded by the check. This is the accurate set, not a deviation.

#### WORM allow-list (MG1 explicit, checked-in)

`WORM_TABLES: readonly string[] = ['audit_log_entries']` — single source of truth in
`apps/api/scripts/check-worm-migration-tests.ts`. `pipeline_events` explicitly absent with
inline comment stating the rationale (no DB trigger).

#### Deterministic coverage signal

**Registry:** `apps/api/test/_helpers/worm-migration-coverage-registry.ts`

Each entry maps `migrationFile` (forward migration filename) → `testFile` (path relative to
`apps/api/`). The check's `runCheck()` function verifies: (a) every detected WORM-touching
migration is in the registry; (b) the registered test file exists on disk. Deterministic —
no fuzzy filename matching.

#### Self-test (fault-killing)

**Spec:** `apps/api/test/check-worm-migration-tests.spec.ts` — 30 tests, all passing.

Fault-killing assertions (in `runCheck — fault-killing self-test` describe block):
- FAULT-KILLING (a): WORM-touching migration with NO registry entry → `result.passed === false`
  (the primary case: proves the check catches the wave-17-class gap).
- FAULT-KILLING (b): WORM-touching migration WITH registered + existing test → `result.passed === true`
  (proves the check passes when properly covered).
- FAULT-KILLING (c): registry entry exists but test file missing → `result.passed === false`
- FAULT-KILLING (d): non-WORM migration, empty registry → `result.passed === true` (not over-firing)
- FAULT-KILLING (e): comment-only mention of WORM table → not triggered (0018-style exclusion)

Also tests the SQL classifier directly (14 classifier tests) and `stripSqlComments` (3 tests).

#### Green on current tree

The `real-tree integration — GREEN on current tree` describe block in the spec confirms
`runCheck` passes against the actual migrations directory + actual registry. It also
explicitly asserts the correct detected set and that 0003/0018 are NOT in it.

Standalone CLI also passes:
```
PASS: all 5 WORM-touching migration(s) have populated-DB tests.
```

#### Wired into CI

Two enforcement points in `.github/workflows/ci.yml` (test job):
1. `pnpm test` — runs `check-worm-migration-tests.spec.ts` (vitest, includes the real-tree
   integration test that calls `runCheck` and asserts it passes).
2. Explicit CI step: `pnpm --filter @dealflow/api check:worm-migration-tests` (standalone
   tsx invocation, exits 1 on failure).

Package.json script: `"check:worm-migration-tests": "tsx scripts/check-worm-migration-tests.ts"`

## Typecheck

`pnpm -w typecheck` clean (4/4 tasks successful).

## AMP suite

Not modified. AMP-1..5 continue passing (887 unit/spec tests pass; DB-gated suites skip when
TEST_DATABASE_URL is unset, as designed).

## Deviations

1. **Correct set is {0002, 0012, 0014, 0016, 0017} not {0002, 0003, 0012, 0014, 0016, 0017}.**
   The B-block review-artifacts.md listed 0003 in the set. On reading 0003's SQL,
   `audit_log_entries` appears only in comments ("Existing tables (...audit_log_entries) are NOT
   touched"). The check correctly excludes it. The registry and check are authoritative.

2. **Template file is in `test/_helpers/worm-migration-template.ts`, not a separate `templates/`
   dir.** Keeps all test helpers co-located. The file is a documentation artifact — not imported
   at runtime (the file header states "Do NOT import from this file").

3. **`worm-migration-test-utils.ts` uses `expect` as a parameter typed `any`** because the
   function is called from e2e test contexts where the vitest `expect` instance differs from a
   typed import. This matches the `// biome-ignore` pattern already used in the codebase for
   drizzle handles.

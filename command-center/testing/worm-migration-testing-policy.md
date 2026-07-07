# WORM Migration Testing Policy

## Standing Acceptance Criterion

Any migration that INSERTs, UPDATEs, backfills, or ALTERs a DB-trigger-enforced WORM /
hash-chained table **MUST** ship a populated-DB migration test.

### What "populated-DB migration test" means

A test that:

1. Seeds representative real chained rows into the WORM table (via the application's
   service layer, not raw SQL — to produce structurally identical rows to production).
2. Applies the migration via `ensureMigrated` (advisory-lock-serialized, idempotent).
3. Asserts **(a)** the migration applies without error, **(b)** `verifyChain` returns
   `ok: true` (or equivalent per-row HMAC recomputation), **(c)** row-count and
   content invariants hold (e.g. backfill columns populated correctly, no rows deleted).

### Why empty-CI-DB testing is insufficient

The wave-17 C-2 production HOLD was caused exactly by this gap:

- Migration `0014_workspace_isolation.sql` Step-3 performs an
  `UPDATE audit_log_entries SET workspace_id = ... WHERE workspace_id IS NULL`.
- `audit_log_entries` has a `BEFORE UPDATE` trigger (`audit_log_no_mutate`) that
  unconditionally rejects ALL UPDATE/DELETE with `SQLSTATE P0001`.
- CI migrated an empty database: zero rows match `WHERE workspace_id IS NULL`, the
  trigger never fired, and CI stayed green.
- In production with 328 existing audit rows, every row matched — the migration aborted
  with "audit_log_entries is append-only: UPDATE blocked".

An empty-CI-DB test **cannot exercise this failure class**. Only a test that seeds real
rows before applying the migration can detect it.

---

## In-scope WORM tables (DB-trigger-enforced)

The mechanical CI check (`apps/api/scripts/check-worm-migration-tests.ts`) maintains a
checked-in allow-list constant — `WORM_TABLES` — that names every table whose
DB-trigger-enforced WORM invariant creates this obligation. The current set:

| Table | Enforcement mechanism | In scope |
|---|---|---|
| `audit_log_entries` | `audit_log_no_mutate` BEFORE UPDATE OR DELETE trigger (created in `0002_steep_boom_boom.sql`) | **YES** |
| `pipeline_events` | App-level append-only (structural convention, no DB trigger) | NO — see below |

### Why `pipeline_events` is out of scope for now

`pipeline_events` is append-only by application convention (the service never issues
UPDATE/DELETE), but there is **no DB-trigger-enforced WORM constraint** on it. A
migration that UPDATEs `pipeline_events` rows would not be blocked by the DB — only by
code review. DB-trigger-enforced WORM tables are the load-bearing category for this
policy because they are the tables where a migration silently working on an empty DB
masks a guaranteed prod failure.

If a WORM trigger is added to `pipeline_events` in a future migration, add it to the
`WORM_TABLES` allow-list in `apps/api/scripts/check-worm-migration-tests.ts`.

---

## Enforcement points

This policy is enforced at two levels:

### 1. Mechanical CI check (load-bearing)

`apps/api/scripts/check-worm-migration-tests.ts` runs as part of the CI `test` job via
the `check:worm-migration-tests` package.json script.

It scans every forward migration (`apps/api/src/db/migrations/*.sql`, excluding `.down.sql`)
for actual DML/DDL touching in-scope WORM tables (not comment-only mentions), then
consults a deterministic coverage registry
(`apps/api/test/_helpers/worm-migration-coverage-registry.ts`) to verify that every
such migration has a populated-DB test registered. The check exits 1 if any
audit/WORM-touching migration lacks coverage.

The check includes a self-test (fault-killing): a vitest spec
(`apps/api/test/check-worm-migration-tests.spec.ts`) feeds the classifier a fixture
migration that touches a WORM table but has no registered test and asserts the check
function returns a failure, then feeds a fixture with a registered test and asserts it
passes. This proves the check is not toothless.

### 2. B-0 migration stage gate

At B-block migration stage (B-0), the authoring agent must consult this policy document
before marking a migration complete. Any migration touching an in-scope WORM table
must have a populated-DB test registered in the coverage registry before B-6 approval.

---

## Coverage registry location

`apps/api/test/_helpers/worm-migration-coverage-registry.ts`

Each entry maps one WORM-touching migration filename to the test file that covers it.
Adding a new audit/WORM-touching migration without a corresponding registry entry will
cause the CI check to fail.

---

## Template / helper for new tests

`apps/api/test/_helpers/worm-migration-test-utils.ts` — thin helpers (`seedChainedAuditRows`,
`assertVerifyChainOkForRows`) extracted from the AMP suite pattern.

`apps/api/test/_helpers/worm-migration-template.ts` — copy-able skeleton: copy to
`apps/api/test/<name>.e2e-spec.ts`, adapt the UUID namespace, seed shape, and migration
step being tested. See inline comments for each adaptation point.

The reference implementation (the AMP suite) lives at:
`apps/api/test/audit-migration-populated-db.e2e-spec.ts`

# B-6 Review — Gate Verdict (Wave 24)

**Wave topic:** M10 standing populated-migration AC — standing AC + reusable AMP template + MECHANICAL CI check (with self-test)
**Branch:** wave-24-populated-migration-ac
**Seed:** fd8f2860 (M10)
**Stage:** B-6 Review — **Attempt 1**
**Gate:** head-builder
**Load-bearing requirement:** the standing AC is MECHANICALLY enforced (a real fault-killing exit-1 check), not prose.

---

## Verdict: **APPROVED**

The standing populated-migration AC is enforced by a genuinely mechanical, fault-killing CI check — not a prose note. The self-test proves the check catches the gap (an unregistered WORM-touching migration flips `result.passed` to `false`); the classifier honestly reflects the real DML/DDL in the migration SQL; the check greens on the current tree against a real (non-rubber-stamp) test suite; and it is wired into CI as an explicit exit-1 step. This clears the wave-21 theater trap.

---

## Stage-exit checklist

### 1. Check is GENUINELY MECHANICAL + FAULT-KILLING — PASS
`check-worm-migration-tests.spec.ts` runs **30 tests green** and proves gap-detection, not syntax execution:
- **(a) gap → FAIL**: WORM-touching migration with empty registry → `result.passed === false`, `missing` contains the file, `covered` length 0 (lines 307-321). This is the primary fault-killing assertion.
- **(b) covered → PASS**: registered + existing test file → `result.passed === true` (lines 329-353).
- **(c) missing-file → FAIL**: registry entry present but test file absent → `result.passed === false`, `missingFile` populated (lines 355-376).
- **(d) non-WORM → no over-fire**: non-WORM migration with empty registry → PASS, zero detected (lines 378-391).
- **(e) comment-only → not-triggered**: 0018-style comment-only mention → PASS, zero detected (lines 393-408).

The CLI `main()` calls `process.exit(1)` on any `missing`/`missingFile` (script lines 304-312). This is a real exit-1-on-gap check, not a toothless note.

### 2. [MG1] Correct migration set — PASS (honest, sharper-than-obligation deviation confirmed)
Classifier scans REAL DML/DDL after `stripSqlComments`. Verified against the actual migration SQL:
- **0002** — CREATE TABLE + REVOKE/GRANT ON + DROP/CREATE TRIGGER ON audit_log_entries → real DDL → **INCLUDED** ✓
- **0012** — `ALTER TABLE "audit_log_entries"` at line 20 (line 1 is a comment) → **INCLUDED** ✓
- **0014** — ALTER / UPDATE (backfill) / CREATE POLICY / CREATE INDEX / RLS → **INCLUDED** ✓
- **0016** — `GRANT ... ON TABLE public.audit_log_entries TO dealflow_app` → **INCLUDED** ✓
- **0017** — DROP POLICY / CREATE POLICY ON audit_log_entries → **INCLUDED** ✓
- **0003** — `grep` returns **zero** audit_log_entries references (not even a comment) → correctly **EXCLUDED** ✓
- **0018** — only a comment "It does NOT alter audit_log_entries" → correctly **EXCLUDED** ✓

Detected set on the live tree = `{0002, 0012, 0014, 0016, 0017}` — exactly correct.
**B-2 deviation adjudication:** the seed's MG1 list named `{0002,0003,0012,0014,0016,0017}` (with 0003). The shipped check EXCLUDES 0003. This is an HONEST correct classification: 0003 (`0003_giant_outlaw_kid.sql`) creates compliance tables and does not reference audit_log_entries at all — not in DML, not even in a comment. Excluding it is sharper and more correct than the obligation's list. Accepted.

### 3. WORM allow-list explicit — PASS
`WORM_TABLES = ['audit_log_entries']` is the single checked-in source of truth (DB-trigger-enforced by `audit_log_no_mutate`, created in 0002). `pipeline_events` is documented OUT of scope with a concrete rationale (app-level append-only, no DB trigger → a migration UPDATE would not be blocked, so the wave-17-class prod failure cannot occur). Extension path is documented ("add to WORM_TABLES if a DB trigger is ever added"). Maintainable + explicit, and mirrored in the policy doc's in-scope table.

### 4. GREEN on the current tree — honest, not faked — PASS
`check:worm-migration-tests` PASSES: all 5 audit-touching migrations report `[OK] COVERED`. Coverage is honest, not a rubber-stamp: the registry maps every migration to `test/audit-migration-populated-db.e2e-spec.ts`, a **real 22 KB e2e suite** with genuine AMP-1..5 assertions — seeds real HMAC-chained rows via `AuditService.appendStandalone` (production code path, not raw SQL), applies the migration on a populated DB, per-row HMAC-recomputes hash-exclusion, and asserts the WORM trigger is re-armed post-migration (AMP-5 fault-killing: UPDATE without DISABLE TRIGGER throws P0001). The check verifies both registry presence AND on-disk test-file existence, so a registered-but-missing test cannot false-green.

### 5. Template copy-able, not a framework — PASS
`worm-migration-test-utils.ts` is two small functions (`seedChainedAuditRows`, `assertVerifyChainOkForRows`) extracted from the AMP pattern. `worm-migration-template.ts` is an explicitly copy-able skeleton with ADAPT markers, stated "NOT a framework or DSL … Do NOT import from this file." No premature abstraction, no DSL, no generic factory. Clears the code-quality-pragmatist over-engineering bar.

### 6. CI-wired + build health — PASS
- CI: `.github/workflows/ci.yml` line 67-68 — dedicated "WORM migration coverage check" step running `pnpm --filter @dealflow/api check:worm-migration-tests` (explicit exit-1 in CI output), in addition to the real-tree integration test inside the vitest suite (run via `pnpm test`).
- `package.json` script `check:worm-migration-tests` present.
- `tsc --noEmit`: no worm-related type errors.
- Self-test spec: 30/30 green.

---

## Failed checks
None.

## Compliance note (load-bearing)
This wave hardens the audit-log compliance trail rather than mutating deal/user state or calling external providers — no audit-log-bypass or unadaptered-SDK risk introduced. The deliverable directly strengthens the load-bearing WORM invariant on `audit_log_entries` by making a whole class of prod-breaking migrations (empty-CI-DB false-greens, per wave-17 C-2 HOLD) mechanically detectable at CI time.

---

```yaml
head_signoff:
  verdict: APPROVED
  stage: B-6
  attempt: 1
  reviewers: {}
  failed_checks: []
  rationale: >
    The standing populated-migration AC is mechanically enforced by a real exit-1
    fault-killing check, not prose. The self-test (30/30 green) proves gap-detection:
    a WORM-touching migration with no registered/existing test flips result.passed to
    false (cases a/c), covered greens (b), non-WORM does not over-fire (d), and
    comment-only mentions do not trigger (e). MG1 is honestly classified against the
    real migration SQL — detected set {0002,0012,0014,0016,0017}, with 0003 (zero
    audit refs) and 0018 (comment-only) correctly excluded; the B-2 exclusion of 0003
    is sharper and more correct than the seed's obligation list. The WORM allow-list
    is explicit and checked in (audit_log_entries in, pipeline_events documented out).
    The check greens on the current tree against a real 22KB AMP e2e suite (not a
    rubber-stamp), verifying both registry presence and on-disk test existence. The
    template is a copy-able skeleton plus two small utils, not a DSL/framework. The
    check is CI-wired as an explicit step and typecheck is clean.
  next_action: PROCEED_TO_C-1
```

# T-9 Journey — Gate Verdict (Wave 24)

**Wave topic:** M10 standing populated-migration AC — a MECHANICAL CI check enforcing that any WORM/audit-table migration must ship a populated-DB test.
**Wave type:** tooling / testing / compliance-hardening — no product surface; the deliverable IS a CI-enforced guard.
**Block:** T (Test) · **Stage:** T-9 Journey (block-exit gate) · **Gate:** head-tester · **Mode:** automatic
**CI evidence:** run 28863313439 @03a710b (final_commit / origin lineage → HEAD 5a72904, identical tree; 03a710b is the CI-fired tip)
**Prior signoffs:** B-6 APPROVED (2 P1 check-bypasses fixed) · C-1 APPROVED (5/5 jobs green, standing-AC enforcer RAN)

---

## Verdict: **APPROVED**

The standing populated-migration AC is genuinely, mechanically CI-enforced by a fault-killing guard — not prose, not coverage theater. The two P1 bypasses `/review` caught (schema-qualified DML escape, hollow-coverage) are closed with directly-verified fault-killing self-tests; classification on the live tree is honest; and a tooling/test wave carries no product-test-coverage obligation. Every T-9 checkbox ticks from concrete artifacts I inspected directly (source + CI log), not from claimed greens.

---

## Gate questions (all directly verified)

### 1. Is the standing AC genuinely MECHANICALLY CI-enforced? — PASS
- The enforcement rides the vitest `test` job (`pnpm test`, `ci.yml` line 57), NOT a bespoke optional `ci.yml` step. Confirmed the bespoke step was reverted at 1d61949 (PAT workflow-scope constraint): `grep -niE 'worm|check:worm' .github/workflows/ci.yml` returns ZERO hits. No orphaned/reverted step present.
- The self-test imports `runCheck` directly from the script and exercises it against the **actual migrations directory + actual registry** (`check-worm-migration-tests.spec.ts` "real-tree integration" describe, line 757-768; `runCheck(migrationsDir, apiRoot, WORM_MIGRATION_COVERAGE_REGISTRY)`). A future WORM migration lacking a populated-DB test flips `result.passed` → false → this vitest assertion fails → `pnpm test` fails → CI reds. This is functionally equivalent to a dedicated exit-1 step.
- CI-run 28863313439 @03a710b: `test` job log shows `✓ test/check-worm-migration-tests.spec.ts (61 tests)` **RAN (not skipped) and PASSED** + `audit-migration-populated-db.e2e-spec.ts (3 tests)` passed; vitest zero-skip/zero-fail. Not a silent-skip false-PASS.
- The CLI path also has real teeth: `passed = missing===0 && missingFile===0 && hollowCoverage===0` → `process.exit(1)` on any gap (script lines 406, 492).

### 2. Are the 2 P1 bypasses genuinely closed (coverage-theater check)? — PASS
Verified the fault-killing self-tests directly in source:
- **P1 #1 — schema-qualified DML escape:** a battery of `FAULT-KILLING (schema-qualified)` tests (lines 232-301) assert the classifier detects `UPDATE/DELETE/INSERT/TRUNCATE/ALTER…DISABLE TRIGGER/CREATE INDEX` on `public.audit_log_entries` AND double-quoted `"public"."audit_log_entries"`. A gap here → the assertion fails. Genuinely fault-killing, not tautological.
- **P1 #2 — hollow coverage:** `testFileHasCoverageMarker` fault-kills on content-empty stub (line 424, `''` → false) and comment-only file (line 430 → false); `hollowCoverage` is a first-class result field wired into `passed` (script line 397, 406) and surfaced in output (line 469). A registered-but-hollow test for a row-mutating migration now FAILS the check.
- 65 `it/test` blocks in the self-test (matches the CI-reported 61 executed after describe expansion). These are behavioral assertions on classifier output and `runCheck` result state — not `expect(mock).toHaveBeenCalled()`.

### 3. Honest classification + green-on-tree (not rubber-stamped)? — PASS
- Real-tree integration test (line 758) runs the check against the live corpus with the real registry and asserts it passes — honest, not a hard-coded PASS. Detected set `{0002,0012,0014,0016,0017}`.
- Classification is DML/DDL-driven after `stripSqlComments`: row-mutating 0002/0012/0014 require a genuine coverage marker (AuditKeyring/AuditRepository/verifyChain markers verified, lines 454-466); GRANT/policy-only 0016/0017 correctly existence-only (WORM trigger never fires on GRANT — line 364-367). 0003 (zero audit refs) and 0018 (comment-only) correctly EXCLUDED. B-6 adjudicated the 0003 exclusion as sharper-than-obligation and correct.
- P2 future-WORM-table guard (line 827) scans the actual corpus for `BEFORE UPDATE OR DELETE` triggers on non-WORM tables — surfaces a future WORM table someone forgets to add to `WORM_TABLES`. Real forward-looking teeth.

### 4. No coverage gap for a tooling wave? — PASS
This wave adds a check + two small helper utils + a policy doc — **zero product code** (no new API/UI/perf/contract surface). T-3..T-7 (contract/e2e/layout/perf) are correctly N/A. The wave's "coverage" IS its own 61-test fault-killing self-test + the standing AC it installs. A tooling/test/docs wave carries no product-test-coverage obligation, and none is manufactured here (no coverage-theater to inflate a number).

**Playwright-binary ESCALATE trap does NOT apply:** zero UI surface, no T-5 E2E / T-6 layout claim exists to be a silent false-PASS. The infra-readiness hard-stop is not triggered.

### 5. The 2 P2s (accepted-debt) + M10-recordkeeping-decomposition flag (→N)? — PASS (acceptable)
- **P2 #1** (non-public-schema qualifier not matched): theoretical only — the WORM trigger + table are public-scoped; a non-public `audit_log_entries` cannot be the WORM-protected table. Accepted-debt is correct.
- **P2 #2** (`stripSqlComments` naive on string-literal comment markers): documented known-limitation, no such literals in the corpus. Accepted-debt is correct.
- **INFO→N** (M10 recordkeeping-decomposition ritual due in 1-2 waves + M10 _TBD metric poll): correctly routed to N-block, not a T-block blocker.
None of these gate a compliance invariant open. Handling is acceptable.

---

## Anti-pattern sweep (compliance-first lens)
- **Coverage Theater** — cleared. Assertions kill injected faults (schema-qualified DML, hollow stubs); real-tree runCheck is not a rubber-stamp.
- **Tautological / over-mocking** — cleared. Behavioral assertions on classifier output + result state; no mock-invocation-only assertions.
- **CI Blindness / silently-skipped** — cleared. Executed-test count verified non-zero (61 RAN) against the CI test-job log at the exact headSha; not `exit 0`-inferred.
- **Untested compliance invariant** — the WORM `audit_log_entries` invariant is HARDENED by this wave: a whole class of empty-CI-DB false-green migrations (the wave-17-class prod failure) is now mechanically detectable at CI time.

## Failed checks
None.

---

```yaml
head_signoff:
  verdict: APPROVED
  stage: T-9
  reviewers: {}
  failed_checks: []
  rationale: >
    The M10 standing populated-migration AC is genuinely mechanically CI-enforced,
    not prose or coverage theater. Enforcement rides the vitest test job (pnpm test,
    ci.yml line 57) via a real-tree runCheck integration test that exercises the check
    against the actual migrations dir + registry — the reverted bespoke ci.yml step is
    confirmed absent (zero worm hits in ci.yml), and the vitest path is equivalent: a
    future WORM migration lacking a populated-DB test reds pnpm test → CI. CI-run
    28863313439 @03a710b proves check-worm-migration-tests.spec (61 tests) RAN (not
    skipped) + PASSED plus the AMP e2e (3 tests), zero-skip/zero-fail — verified against
    the test-job log, not inferred from a green badge. The two P1 bypasses are closed
    with directly-verified fault-killing self-tests: schema-qualified DML detection
    (public.audit_log_entries and double-quoted variants) and hollow-coverage rejection
    (empty/comment-only stub → false; hollowCoverage wired into passed). Classification
    on the live tree is honest — row-mutating 0002/0012/0014 require real coverage
    markers, GRANT/policy-only 0016/0017 existence-only, 0003/0018 correctly excluded.
    A tooling/test/compliance-hardening wave with no product code carries no product-
    test-coverage obligation; T-3..T-7 are correctly N/A and the Playwright-binary
    ESCALATE trap does not apply (zero UI surface). The 2 P2s are correctly accepted-
    debt (theoretical, out-of-corpus) and the M10 recordkeeping-decomposition + _TBD
    metric flag is correctly routed to N-block.
  next_action: PROCEED_TO_V-block
```

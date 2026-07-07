# Wave 24 — B-6 Review
## Phase 1 head-builder: APPROVED (Attempt 1)
The standing AC is mechanically fault-killing (self-test proves gap→passed=false, CLI exit-1), MG1-correct-set {0002,0012,0014,0016,0017} (0003 comment-only honestly excluded), WORM-allow-list explicit, green-on-tree honest (registry→real AMP suite + file-existence), copy-able template, CI-wired. NOT wave-21 theater.
## Phase 2 /review (adversarial): found 2 P1 BYPASSES → FIXED → re-review CLOSED
- **P1 #1 (schema-qualified DML escape):** UPDATE/ALTER/DELETE `public.audit_log_entries` (the exact wave-17 pattern; repo already uses public.) ESCAPED the DML regexes → the check was bypassable TODAY. FIXED (3e4e087): schemaPrefix folded into tableRef for EVERY pattern; 8 escape fixtures now detected.
- **P1 #2 (hollow-coverage bypass + rubber-stamped green):** the check only existsSync'd the registered test (a comment-only file passed); all 5 registry entries pointed at one file scoped to 0014 → 0012/0016/0017 coverage was fake. FIXED (3e4e087): runCheck reads the file + requires a real coverage MARKER (migration-ref + populated-DB-helper/verifyChain); hollow-file self-test INVERTED to assert FAIL; classification HONESTLY reconciled via migrationIsRowMutatingOrStructural (0002/0012/0014 row-mutating→marker-required + genuinely covered [added 0012 marker to the AMP suite]; 0016 GRANT-only/0017 policy-only→WORM-trigger-never-fires→existence-only correct). Future-WORM-table guard added (CREATE TRIGGER BEFORE UPDATE/DELETE on non-allow-list → fails).
- **Re-review: P1s CLOSED, no new bypass** (confidence 9/10 each); self-test 61/61 (31 new). 2 P2 accepted-debt (non-public-schema theoretical [WORM trigger public-scoped]; stripSqlComments documented known-limitation).
## Commit-discipline: N/A (single-spec).
```yaml
phase1_head_builder_verdict: APPROVED
phase2_review_invocations: 2
findings_critical: []
findings_high: []
findings_p1_fixed: [schema-qualified-DML-escape, hollow-coverage-bypass+honest-classification]
findings_p2_accepted: [non-public-schema-qualifier-theoretical, stripSqlComments-known-limitation]
fix_up_commits: [3e4e087, c965401]
final_verdict: APPROVE
```

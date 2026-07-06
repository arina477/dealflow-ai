# C-1 — Integrate + CI Verify (wave-14 M6 compliance hardening)

```yaml
stage: C-1
ci_stage_verdict: PASS
verdict_source: gh
mechanism: direct-push-to-main   # THIS PROJECT (waves 3-13): PAT lacks Pull-requests:write; main not PR-protected; CI via push→branches:[main]; red fixed-forward
merge_commit_sha: 0488cd70a98e77003723494460ae7479902d1427
main_sha_before: bfe686aa37b749679991fd6617ed7185c608969f
main_sha_after: 0488cd70a98e77003723494460ae7479902d1427
fix_up_cycles: 0

ff_push_range: bfe686a..0488cd7   # 7 commits, fast-forward (origin/main was ancestor of wave-14; ff-clean confirmed pre-push)
workflow_files_touched: 0         # git log origin/main..wave-14 -- .github/workflows/ was EMPTY (wave-14 touches no workflow)

ci_run:
  run_id: 28784535052
  url: https://github.com/arina477/dealflow-ai/actions/runs/28784535052
  event: push
  head_sha: 0488cd70a98e77003723494460ae7479902d1427   # SHA-provenance verified: run headSha === new main SHA (no Ghost Green, no stale-cache false green)
  status: completed
  conclusion: success

required_checks:            # per-job conclusions (all GREEN)
  lint: success
  typecheck: success
  test: success
  build: success
  audit: success

test_job_detail:
  job_id: 85347877957
  create_test_database: "CREATE DATABASE dealflow_test"        # real Postgres provisioned
  test_db_url: "***localhost:5432/dealflow_test"
  migration_0012: applied                                       # journal idx 12; ADD COLUMN mandate_id uuid (nullable) — verified live via Drizzle-generated INSERT echoing "mandate_id" column against dealflow_test
  vitest_projects:
    shared: "5 files / 486 tests passed"
    api:    "37 files / 727 tests passed"
    web:    "21 files passed"
  skipped_or_pending: 0
  failed: 0

# === WAVE END-TO-END PROOF (DEV-2 lift) ===
recordkeeping_gate_e2e:
  spec: test/recordkeeping-gate.e2e-spec.ts
  result: PASS
  tests: 9
  duration_ms: 1760
  ran: REAL   # against migrated dealflow_test (mandate_id column present) — NOT mocked, NOT skipped
  proves:
    - hash-safe gate mandate-attribution end-to-end
    - mandate_id-column isolation (incl SHARED-template-version case)
  dev2_hard_gate: LIFTED   # wave-13 DEV-2 hard-gate lifted by this green real-DB e2e

gate_regression_specs:      # CRITICAL — must stay green; both PASS (no gate regression)
  compliance-gate.service.spec.ts: "30 tests passed"
  outreach-gate.e2e-spec.ts: "6 tests passed (REAL ComplianceGateService, no mocks)"
  pipeline-gate.e2e-spec.ts: "4 tests passed"
  audit.mandate-hash-safety.spec.ts: "5 tests passed"   # HMAC hash-chain unaffected by additive mandate_id

migration_safety:
  file: apps/api/src/db/migrations/0012_audit_mandate_id.sql
  additive_only: PASS       # single ADD COLUMN "mandate_id" uuid (nullable); zero DROP/ALTER-TYPE/TRUNCATE in forward SQL
  hash_chain_safe: PASS     # mandate_id EXCLUDED from HMAC preimage (canonicalSerialization v1) → verifyChain byte-identical over mixed old/new chain
  rollback_present: apps/api/src/db/migrations/0012_audit_mandate_id.down.sql   # DROP COLUMN IF EXISTS (rollback file only — not forward)

audit_gate:
  command: "pnpm audit --audit-level=high"
  result: "3 vulnerabilities found / Severity: 3 moderate"
  high_or_critical: 0       # exit 0 — gate passed legitimately, NOT bypassed
  note: "the '1 high severity' earlier in the audit job log belongs to pnpm/action-setup@v6's own installer tarball (npm auditing its 2-pkg install), NOT the project audit"

local_sync:
  branch: main
  head: 0488cd70a98e77003723494460ae7479902d1427   # git checkout main && git pull --rebase → ff bfe686a..0488cd7

head_signoff:
  verdict: APPROVED
  stage: C-1
  reviewers: {}
  failed_checks: []
  rationale: >
    Fast-forward integration of wave-14 (7 commits, no workflow files touched) into main via the
    project's established direct-push-to-main mechanism. The push-triggered CI run 28784535052 ran
    against the EXACT new main HEAD SHA (headSha === 0488cd7 — provenance verified, no Ghost Green /
    stale-cache false green). All five required jobs GREEN. The load-bearing signal — the
    recordkeeping-gate e2e (9 tests) — ran REAL against a freshly created + migration-0012-applied
    dealflow_test Postgres (mandate_id column confirmed live via the Drizzle-generated INSERT in the
    job log), proving hash-safe gate mandate-attribution end-to-end and mandate_id-column isolation
    including the SHARED-template-version case. Gate-regression specs (compliance-gate, outreach-gate,
    pipeline-gate, mandate-hash-safety) all stayed green — no gate regression. Migration 0012 is
    additive-only and HMAC-hash-chain-safe. pnpm audit gate passed with zero high/critical (3 moderate).
    Zero fix-forward cycles. The wave-13 DEV-2 hard-gate is LIFTED by this green real-DB e2e.
  next_action: PROCEED_TO_C-2
```

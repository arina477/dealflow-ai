# Wave 12 — C-1 PR/CI/Merge
## Mechanism: DIRECT-PUSH-TO-MAIN (project's established C-1 since wave 3; PAT lacks PR:write). Wave 12 touched NO workflow file → no workflow-scope issue.
## Fix-forward cycles (2) — all TEST-INFRA (never a compliance-assertion failure):
1. pipeline-gate.e2e: (a) self-migrator collision 23505 (two self-migrating suites racing the shared dealflow_test) → shared race-safe helper (pg_advisory_lock + tolerate-already-applied); (b) invalid-UUID fixtures (22P02) → valid hex UUIDs, distinct wave-12 namespace; (c) pipeline.spec test-26 imported @dealflow/shared/dist directly → use the aliased package import. (d77ec03)
2. pipeline-gate.e2e teardown deleted users → FK ON DELETE SET NULL on the IMMUTABLE audit_log_entries → audit_log_block_mutation() P0001. Fix: retain users/mandate (mirror wave-11 outreach-gate), per-test pipeline/pipeline_events cleanup in-body only. (6b62762)
## FINAL: main GREEN at 6b62762 — ALL 5 CI jobs pass
- CI run 28749395849 (event=push, main, headSha=6b62762): lint/typecheck/**test**/build/audit ALL success.
- **The pipeline-gate.e2e (4 un-mocked real-Postgres tests) PASSED — the audit-rollback compliance proof: audit-throw → real db.transaction() ROLLBACK → zero orphan pipeline/pipeline_events rows (enroll + addNote); happy-path exactly-one-event+one-audit per action; idempotent-409 (real partial-unique).** Co-exists with the wave-11 outreach-gate e2e on the shared CI DB (disjoint namespaces + race-safe migrate).
```yaml
ci_stage_verdict: PASS
verdict_source: gh
verdict_evidence:
  - "direct-push-to-main ff 99c1dc1..6b62762 (11 wave commits + 2 fix-forward)"
  - "CI run 28749395849 main headSha=6b62762: all 5 jobs success"
  - "pipeline-gate e2e 4/4 GREEN vs real Postgres — audit-rollback proof executed"
merge_mechanism: direct-push-to-main
required_checks: [lint, typecheck, test, build, audit]
fix_up_cycles: 2
merge_commit_sha: 6b62762

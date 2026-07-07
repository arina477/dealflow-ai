# Wave 22 — P-3 Plan (single-spec: scope the audit assertions)
## Approach
- **The ONLY change:** apps/api/test/outreach-activity-rls.e2e-spec.ts — scope each of the ~12 shared-DB audit reads by workspace_id:
  - 8 `COUNT(*) FROM audit_log_entries` → `... WHERE workspace_id = <the-suite's-seeded-workspace>` (+ optionally action). Assert the workspace-scoped count (immune to concurrent-suite rows), keeping the exactly-+1-per-mutation fault-killing power.
  - 4 `SELECT action ... ORDER BY sequence_number DESC LIMIT 1` → `... WHERE workspace_id = <this-workspace> ORDER BY sequence_number DESC LIMIT 1` (the this-workspace latest action, not the global latest).
- audit_log_entries.workspace_id is an indexed column (wave-17); it is HASH-EXCLUDED from the HMAC but still present for scoping — WHERE workspace_id=X is valid + does NOT affect verifyChain.
- Keep every assertion FAULT-KILLING: a workspace-scoped count still proves the mutation appended exactly one entry for THIS workspace; the workspace-scoped latest-action still proves the correct verb. Do NOT weaken to a vacuous/tautological assertion.
- NO retry, NO serialize-the-suite, NO change to other suites (ceo HOLD-SCOPE). NO product code, NO migration, NO UI.
## Plan (by B-stage — tiny test wave)
B-0 SKIP (no schema). B-1 SKIP (no contract). B-2 (backend-developer): scope the ~12 assertions + run the suite (real-DB) to confirm green + still fault-killing. B-3 SKIP (no UI). B-4/B-5 typecheck/lint/build (trivially green). B-6 head-builder gates: all ~12 sites scoped, assertions stay fault-killing, one-suite-only, T-4 rule 2 satisfied.
### Specialist: backend-developer. Parallelization: single file.
```yaml
deps_new: []
schema_change: false
new_secret: false
new_sdk: false
specialists: [backend-developer]
compliance_invariants: [audit-assertions-workspace-scoped-per-T-4-rule-2, assertions-stay-fault-killing]
hard_boundaries: "test-only ONE file (outreach-activity-rls.e2e-spec.ts); scope ~12 audit assertions by workspace_id; NO retry/serialize (symptom-patch), NO other-suite sweep (HOLD-SCOPE), NO product code/migration/UI; assertions MUST stay fault-killing"
design_gap_flag: false
d_block: skip
self_consistency: clean
```

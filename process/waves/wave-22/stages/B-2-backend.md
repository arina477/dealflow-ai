# Wave 22 — B-2 (test-hygiene)
Scoped all 12 shared-DB audit assertions in outreach-activity-rls.e2e-spec.ts by workspace_id ($1=OAE_WS_A) — 8 COUNT (exact before+1 scoped delta) + 4 latest-action (exact verb, this-workspace latest). grep audit_log_entries → 12 lines, all now WHERE workspace_id=$1. verifyChain unchanged (workspace_id HASH-EXCLUDED, wave-17). Fault-killing PRESERVED (exact +1 / exact verb, not >= / vacuous). 1 file (27+/15-), no product/other-suite change. typecheck clean. Suite skips locally (no TEST_DATABASE_URL) → CI real-DB authoritative. Commit 128ede8.
```yaml
skipped: false
sites_scoped: 12
fault_killing_preserved: true
one_file_only: true
deviations: []
```

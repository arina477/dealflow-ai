# Wave 10 — T-3 Contract (Pattern A, CI-verified)
Contract: matching.ts (matchRun/matchCandidate + create/disposition/handoff inputs + MatchRankedList/Shortlist; read passthrough + z.string timestamps; INPUT strict) + rbac (/matches advisor/admin create-mutate + analyst read + NAV_MATCHES) + audit (match-run-create/disposition/handoff). API↔web share types (mutations return the ranked run — BUILD rule 5). nav⊆RBAC. No drift.
```yaml
test_pattern: ci-verified
skipped: false
findings: []

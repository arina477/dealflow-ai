# Wave 12 — T-block review artifacts
**Wave topic:** M6 pipeline/deal-stage tracking (spine + board + timeline)
**wave_type:** [ui, backend, auth(RBAC/audit)]
**Block exit gate:** T-9
| Stage | Layer | Pattern | Status | Notes |
|---|---|---|---|---|
| T-1 | static | A (CI) | done | CI 28749460752 lint+typecheck green |
| T-2 | unit | A (CI) | done | 637 api + 463 shared + 453 web |
| T-3 | contract | A (CI) | done | pipeline.spec (44) gate/RBAC/enum + shared zod |
| T-4 | integration | A (CI) | done | pipeline-gate.e2e 4/4 vs real Postgres (audit-rollback + happy + idempotent-409) |
| T-5 | e2e | B (active) | done | deployed pipeline journey |
| T-6 | layout | B (active) | done | board 7 columns |
| T-7 | perf | — | skipped | not heavy; additive 2-table module |
| T-8 | security | B (active) | done | RBAC + audit + secret-grep |
| T-9 | journey | B (active) | done — head-tester APPROVED | journey regen + head-tester gate |


```yaml
test_block_status: complete
stages_run: [T-1,T-2,T-3,T-4,T-5,T-6,T-8,T-9]
stages_skipped: [T-7 (not heavy)]
findings_total: 4
findings_critical: 0
ready_for_verify: true
```

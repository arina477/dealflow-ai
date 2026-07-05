# Wave 11 — T-block review artifacts
**Wave topic:** M6 compliant-outreach foundation (versioned templates + non-bypassable pre-send gate + SoD + approval queue)
**wave_type:** [ui, backend, auth]  (auth ← compliance/RBAC/SoD/audit — security-scope-tightened)
**Block exit gate:** T-9
| Stage | Layer | Pattern | Status | Notes |
|---|---|---|---|---|
| T-1 | static | A (CI) | done | CI run 28740703914 lint+typecheck green |
| T-2 | unit | A (CI) | done | test job green: 593 api + 458 shared + 431 web |
| T-3 | contract | A (CI) | done | shared zod + outreach.spec contract (gate-called structural, SoD, RBAC) green |
| T-4 | integration | A (CI) | done | outreach-gate.e2e 6/6 vs real Postgres (gate→send_eligible; SoD/no-approval/content-drift block) |
| T-5 | e2e | B (active) | done | Playwright journey on deployed prod |
| T-6 | layout | B (active) | done | 3 new pages visual |
| T-7 | perf | — | skipped | not wave_type=heavy; additive 3-table module, no perf budget risk |
| T-8 | security | B (active) | done | RBAC matrix + SoD + non-bypassable gate + audit chain on deployed prod (CRITICAL) |
| T-9 | journey | B (active) | done — head-tester APPROVED | journey-map regen + head-tester gate |


```yaml
test_block_status: complete
stages_run: [T-1,T-2,T-3,T-4,T-5,T-6,T-8,T-9]
stages_skipped: [T-7 (not heavy)]
findings_total: 6
findings_critical: 0
ready_for_verify: true
```

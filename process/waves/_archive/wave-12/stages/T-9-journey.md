# Wave 12 — T-9 Journey
## Phase 1: head-tester gate = APPROVED (independently confirmed pipeline-gate.e2e ran GREEN 4/4 real Postgres @ 989fae9; 5 compliance invariants non-hollow; residual gaps non-blocking → V)
## Phase 2: journey-map regen (UI wave)
- /pipeline (board + per-deal timeline) DELIVERED + LIVE @ 989fae9. Added F17 (track-a-deal-through-pipeline) + wave-12 LIVE section.
- Crawl basis: C-2 deployed-authed (authed board HTML, 7 columns, RBAC, no send/AI) + code; interactive-journey crawl blocked by no-eligible-source-in-prod (finding #1, LOW).
- Cross-wave regression: no existing journey broken (additive module; no ALTER; auth backbone unchanged). Wave-1..11 flows intact.
```yaml
phase1_head_tester_verdict: APPROVED
test_pattern: active
journey_regen_skipped: false
crawl_routes_visited: 1
regen_diff: {routes_added: [/pipeline(live)], routes_removed: [], coverage_gaps: [interactive-enroll-journey(LOW, no-eligible-source-in-prod, deferred-to-V)]}
scenarios_run: 0
regressions_critical: 0
findings: [{severity: MEDIUM, journey: infra, description: "test-cred registry + no eligible source in prod → deployed-authed smokes rely on invite→signup + CI proofs (carry-forward)"}]
```

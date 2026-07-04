# Wave 7 — T-9 Journey (Test block-exit gate)
## Phase 1 — head-tester: APPROVED (fresh spawn a921bc7606030b508). M3 metric (search across ≥2 sources) delivered LIVE (workspace + canonical search + ≥2-source real badges on ≥2 fixture connections); all fix-cycles closed (B-6 badges+providerKey; C-2 0005-journal + DrizzleQueryError-409); S2 clarification sound (409≠401 = auth worked, create live-verified C-2); dup-409 regression hardened (DrizzleQueryError-cause.code shape); connection-create RBAC+audit+actor-id+providerKey-400 real; T-7 skip legit; 2 findings (S2 test-data, TopBar polish) non-blocking. Verdict: process/waves/wave-7/blocks/T/gate-verdict.md.
## Phase 2 — journey (UI wave → regen)
Row 12 (Sourcing workspace, /sourcing) → LIVE: workspace (search + facet + results matrix + sync trigger + connection-create) replacing the redirect stub; M3 ≥2-source metric verifiable on ≥2 fixture connections. Deferred (documented): real provider adapter (founder vendor+key), in-page dedupe-modal, advanced facets. Cross-wave regression: wave-1..6 unaffected (login + compliance + companies still work — regression 4/5, S2 test-data only).
```yaml
phase1_head_tester_verdict: APPROVED
test_pattern: active
journey_regen_skipped: false
regen_diff: {routes_live: ["/sourcing workspace (search + ≥2-source + connection-create)"], replaced: "redirect stub"}
scenarios_run: 5  # 4 PASS + 1 test-data (S2)
regressions_critical: 0
findings: [{severity: low, item: "TopBar title recurring → polish"}, {severity: test-bug, item: "S2 unique-displayName (create live-proven C-2)"}]
```

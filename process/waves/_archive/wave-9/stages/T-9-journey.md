# Wave 9 — T-9 Journey (Test block-exit gate)
## Phase 1 — head-tester: APPROVED (fresh spawn aa534ea4). M4 FINAL metric delivered LIVE (assemble+filter+enrich+submit ready-to-rank); M4/M5 boundary tested+live-proven (no rank/score — byte-scan); compliance/integrity invariants (one-txn+audit; actor-id; idempotent re-assemble [mandate_id UNIQUE]; submit-guard [included+un-triaged→400]; honest partial-filter [unsupported dims recorded]); W9-2 clearance sound (401≠404 + C-2-DOM-verified + S1-b PASS = harness/deploy-timing artifact); B-6 7 CRIT closed + C-2-confirmed first-try; T-7 skip legit (unbounded-assemble→backlog); findings dispositioned. Verdict: blocks/T/gate-verdict.md.
## Phase 2 — journey (UI wave → regen)
/buyer-universe LIVE (assemble/filter/enrich/submit ready-to-rank); row-8 route reconciled (/mandates/:id/buyers → /buyer-universe — the jenny LOW fix). M4 metric COMPLETE (assemble+enrich ready-to-rank). Cross-wave regression: wave-1..8 unaffected (login+mandates+sourcing+compliance green; 1 pre-existing sourcing-companies e2e failure, not wave-9).
```yaml
phase1_head_tester_verdict: APPROVED
test_pattern: active
journey_regen_skipped: false
regen_diff: {routes_live: ["/buyer-universe (assemble/filter/enrich/submit)"], route_reconciled: "row-8 → /buyer-universe"}
scenarios_run: 14  # 14/14 PASS
regressions_critical: 0
findings: [{severity: false-positive, item: "W9-2 /buyer-universe-data 404 cleared"}, {severity: low, item: "TopBar title recurring → polish"}, {severity: info, item: "unbounded-assemble → backlog"}]
```

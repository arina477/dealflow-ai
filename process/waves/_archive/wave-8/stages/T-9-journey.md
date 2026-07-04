# Wave 8 — T-9 Journey (Test block-exit gate)
## Phase 1 — head-tester: APPROVED (fresh spawn aa7bfd50). M4 first-bundle metric delivered LIVE (create-via-UI→redirect→detail; derived disclaimer; 3-acks; audited); compliance invariants tested+live-proven (one-txn atomicity + audit-rollback; actor-id; derive [valid/no-match-400/ambiguous-409 + 0007 index]; 3-acks hardened both layers [12 bypass tests]; active-lock 409; RBAC); W8-2 hardening sound (service !== true strict-identity + both-boundary tests; screenshot=timing artifact, server always schema-guarded + C-2 acks→400); C-2 fix-cycles closed live; T-7 skip legit; findings dispositioned (W8-2 hardened, W8-3 fixed, W8-4 polish); acks-hardening-on-next-deploy acceptable (normal path schema-guarded + C-2-verified). Verdict: blocks/T/gate-verdict.md.
## Phase 2 — journey (UI wave → regen)
Mandate pages LIVE: /mandates (list+filter), /mandates/new (create, 3 sections, derive-disclaimer, 3-acks, captured-not-enforced), /mandates/:id (SSR-hydrate detail + deferred placeholders). M4 first-half metric (create a configured mandate) delivered; buyer-universe builder = next M4 bundle. Cross-wave regression: wave-1..7 unaffected (login+sourcing+compliance green; 1 pre-existing sourcing-companies data-dependent e2e failure, not wave-8).
```yaml
phase1_head_tester_verdict: APPROVED
test_pattern: active
journey_regen_skipped: false
regen_diff: {routes_live: ["/mandates (list)", "/mandates/new (create)", "/mandates/:id (detail SSR-hydrate)"]}
scenarios_run: 5  # S1-S5 all PASS
regressions_critical: 0
findings: [{severity: med-compliance, item: "W8-2 3-acks service-guard hardened !== true + 12 bypass tests"}, {severity: low, item: "W8-3 hide new-mandate button read-only"}, {severity: low, item: "W8-4 TopBar title recurring → polish"}]
```

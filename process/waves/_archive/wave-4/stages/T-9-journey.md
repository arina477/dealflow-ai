# Wave 4 — T-9 Journey (Test block-exit gate)
## Phase 1 — head-tester: APPROVED (fresh spawn aeede26bd49926f40). Compliance invariants genuinely tested + LIVE-verified: immutability triggers reject U/D/T on real DB; tamper-detection asserts exact firstBreakAt/reason on real HMAC chains; /review CRITICAL closed (pg-roundtrip regression + live ok:true entriesChecked:3); keyring fail-fast + no-leak; DB-authoritative RBAC + stale-claim hardening; real-browser 7/7 with data-attribute assertions. 1 low (TopBar title) non-blocking; T-7 skip legit. Verdict: process/waves/wave-4/blocks/T/gate-verdict.md.
## Phase 2 — journey (UI wave → regen)
Crawl via T-5 Playwright (7/7) against live. Journey map row 16 (/compliance/audit-log) → LIVE:
- Audit-log SERVICE live (append-only table + DB-immutability triggers + HMAC hash-chain + verifier + GET /compliance/audit-log/verify RBAC compliance/admin).
- Integrity VIEW at /compliance/audit-log (compliance persona) per audit-log-export.html §Integrity Validation.
- LIVE proofs noted (chain ok:true, immutability U/D/T rejected, tamper-detect ok:false at break).
- Deferred (documented): recordkeeping export + real audited-action call-sites → M6+; rules engine (/compliance/settings row 17) → later M2 bundle.
- Cross-wave regression: wave-1/2/3 auth+RBAC+AppShell unaffected (login + role-nav still work — regression-tested).
```yaml
phase1_head_tester_verdict: APPROVED
test_pattern: active
journey_regen_skipped: false
crawl_routes_visited: 3   # /compliance/audit-log (integrity view), /login, / (dashboard) via E2E + C-2
regen_diff: {routes_live: ["/compliance/audit-log integrity view", "GET /compliance/audit-log/verify"], audit_backbone: live}
scenarios_run: 7   # T-5 all PASS
regressions_critical: 0
findings: []
```

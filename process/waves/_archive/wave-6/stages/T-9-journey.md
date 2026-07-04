# Wave 6 — T-9 Journey (Test block-exit gate)
## Phase 1 — head-tester: APPROVED (fresh spawn a3433c97c3eee0bc4). Dedupe-correctness invariants LIVE-verified vs 918dbf0 (cross-source 1-canonical+provenance, NO false-positive merge, contact_provenance principle-3, idempotent, resolve audited+atomic); all 4 fix-cycles closed; T-8-LITE scope correct; real-browser 8/8 non-zero-execution; no false-green (di-boot regression guards the DI class); 1 low TopBar non-blocking. Verdict: process/waves/wave-6/blocks/T/gate-verdict.md.
## Phase 2 — journey (UI wave → regen)
Crawl via T-5 Playwright (8/8) against live. Journey map row 13 (Companies & contacts) → LIVE at /sourcing/companies:
- Companies screen (view/filter/dedupe-review) live; route repointed /companies→/sourcing/companies.
- Data spine live: DataSourceAdapter (fixture) → idempotent ETL → deterministic dedupe → canonical companies+contacts + company/contact provenance.
- LIVE proofs noted (cross-source→1 canonical + provenance both; NO false-positive; idempotent; resolve audited).
- Deferred (documented): real provider adapters + scheduled/incremental sync + enrichment + sourcing-workspace page (row 12).
- Cross-wave regression: wave-1..5 auth/RBAC/AppShell/audit/compliance-gate unaffected (login + compliance surfaces still work — regression 8/8).
```yaml
phase1_head_tester_verdict: APPROVED
test_pattern: active
journey_regen_skipped: false
crawl_routes_visited: 4   # /sourcing/companies, /login, /, compliance surfaces via E2E + C-2
regen_diff: {routes_live: ["/sourcing/companies (deal-sourcing data spine + companies screen)"], repoint: "/companies->/sourcing/companies"}
scenarios_run: 8   # T-5 all PASS
regressions_critical: 0
findings: [{severity: low, item: "TopBar title recurring → polish task"}]
```

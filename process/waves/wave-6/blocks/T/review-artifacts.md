# Wave 6 — T-block review artifacts
**Block:** T · **Wave topic:** deal-sourcing data spine (ingest→dedupe→canonical + companies screen) · **Gate:** T-9 · **Status:** gate-passed
| Stage | Deliverable | Pattern | Status | Notes |
|---|---|---|---|---|
| T-1 | stages/T-1-static.md | ci-verified | done | typecheck+lint green |
| T-2 | stages/T-2-unit.md | ci-verified | done | 829 tests: dedupe cross-source/idempotent/no-false-positive/contact-provenance, ETL, di-boot, actor-id |
| T-3 | stages/T-3-contract.md | ci-verified | done | DataSourceAdapter + entity Zod + roleRoutes; nav⊆RBAC |
| T-4 | stages/T-4-integration.md | ci-verified | done | adapter→ETL→dedupe→canonical; migration 0004; live C-2 |
| T-5 | stages/T-5-e2e.md | active | done | 8/8 PASS (analyst screen + RBAC; empty-state, pipeline live C-2) |
| T-6 | stages/T-6-layout.md | active | done | companies screen §10-conformant (TopBar→polish) |
| T-7 | stages/T-7-perf.md | active | skipped | not heavy |
| T-8 | stages/T-8-security.md | active | done | T-8-LITE: secret-handling (provider_key env-only, no secret col) + dedupe correctness live (C-2) |
| T-9 | stages/T-9-journey.md | active | gate-passed | head-tester APPROVED; journey regen (data spine + companies LIVE row 13) |
- **wave_type:** backend + ui + data-pipeline. T-8-LITE (NOT full security-scope — external-party data, not user auth/PII). T-7 skip.

```yaml
test_block_status: complete
stages_run: [T-1,T-2,T-3,T-4,T-5,T-6,T-8,T-9]
stages_skipped: [T-7]
findings_critical: 0
fix_cycles: [candidate-idempotency, 4-dedupe-CRIT, import-type-DI, fixture-asset]
ready_for_verify: true
note: dedupe correctness (cross-source/no-false-positive/provenance/idempotent) LIVE-proven + real-browser 8/8
```

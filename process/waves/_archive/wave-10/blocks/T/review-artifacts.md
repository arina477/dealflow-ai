# Wave 10 — T-block review artifacts
**Block:** T · **Wave topic:** deterministic match spine + shortlist (M5 first bundle) · **Gate:** T-9 · **Status:** gate-passed
| Stage | Deliverable | Pattern | Status | Notes |
|---|---|---|---|---|
| T-1 | stages/T-1-static.md | ci-verified | done | typecheck+lint green |
| T-2 | stages/T-2-unit.md | ci-verified | done | 1380 tests: scorer-discriminates/one-txn/audit/actor-id/idempotent/disposition-preserve/submit+handoff-guards/no-LLM-boundary/no-AI-framing; di-boot |
| T-3 | stages/T-3-contract.md | ci-verified | done | matching Zod + rbac /matches + audit actions; nav⊆RBAC |
| T-4 | stages/T-4-integration.md | ci-verified | done | matching CRUD→DB (one-txn, audited, idempotent, disposition-preserve); migration 0009; reuse M4 buyer_universe + M3 + M4 criteria; live C-2 first-try |
| T-5 | stages/T-5-e2e.md | active | done | 12/12 PASS; S2 NO-AI-framing live; W10-1=test-setup (matching C-2-verified); TopBar→polish |
| T-6 | stages/T-6-layout.md | active | done | §10-conformant; AI-framing STRIPPED live-confirmed; TopBar→polish |
| T-7 | stages/T-7-perf.md | active | skipped | pilot scale |
| T-8 | stages/T-8-security.md | active | done | FULL: RBAC + audit + actor-id + one-txn + idempotency + guards + BOTH boundaries (no-LLM + M5/M6) + AI-framing-strip + secret-grep |
| T-9 | stages/T-9-journey.md | active | gate-passed | head-tester APPROVED; journey regen (matching LIVE, rule-based) |
- **wave_type:** multi-spec. T-8 FULL. T-7 skip.

```yaml
test_block_status: complete
stages_run: [T-1,T-2,T-3,T-4,T-5,T-6,T-8,T-9]
stages_skipped: [T-7]
findings_critical: 0
ready_for_verify: true
```

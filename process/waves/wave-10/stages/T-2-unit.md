# Wave 10 — T-2 Unit (Pattern A, CI-verified)
CI test green. 1380 tests: shared 458 (matching Zod passthrough/strict; rbac /matches + NAV; audit actions), api 549(+1 skip) (matching.spec + scorer + di-boot: **PURE scorer DISCRIMINATES [≥80pt gap strong-vs-weak, deterministic tie-break, unsupported-dim graceful, 0-100 clamp]**; create-run one-txn + submit-guard[400 if not submitted] + idempotent[buyer_universe_id UNIQUE] + DISPOSITION-PRESERVE on re-run[B-6 CRIT-1] + audit-last-in-txn + actor-id; disposition cross-run-scoped[404]; handoff accepted-count-guard-InTx[400 else — BUILD rule 6] + idempotent-re-handoff; isNew-xmax audit-accuracy; DrizzleError-unwrap; **BOUNDARY: no anthropic/llm/bullmq import**), web 373 (ranked page + create-run CTA + RBAC + /matches-data-proxy + disposition-optimistic-revert + createRun-no-blind-cast + handoff + **no-AI-framing assertion** + D6-link). Real assertions.
```yaml
test_pattern: ci-verified
skipped: false
findings: []

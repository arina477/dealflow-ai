# Wave 10 — T-4 Integration (Pattern A, CI-verified + LIVE C-2 first-try)
Integration: matching create-run/disposition/handoff→DB (one-txn + audit-last-in-txn + idempotent [buyer_universe_id UNIQUE] + disposition-preserve); reads M4 buyer_universe[submitted]/candidates[included] + M3 companies.sector/contacts + M4 mandateBuyerCriteria (deterministic score inputs); migration 0009. **LIVE C-2 first-try (0075a20):** create-run 201 + 4 ranked candidates; scorer DISCRIMINATES (spread [37,33,32,30]); submit-guard 400; idempotent + disposition-PRESERVE (accepted survives re-run); handoff-guard (0→400, ≥1→2xx, re-handoff idempotent); NO AI-framing on deployed page; no-LLM (0.13s sync); RBAC; audited(206→207); SSR + D6.
```yaml
test_pattern: ci-verified
skipped: false
live_c2_evidence: ["create-run 201+ranked+discriminates[37,33,32,30]", "submit-guard 400", "idempotent+disposition-preserve", "handoff-guard 400/2xx+idempotent", "NO-AI-framing-live", "no-LLM 0.13s", "RBAC", "audited", "migration 0009"]
findings: []

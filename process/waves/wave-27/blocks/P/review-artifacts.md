# Wave 27 — P-block review artifacts
**Block:** P (Product) | **Wave topic:** M10 recordkeeping EXPORTS (FIRST real M10 recordkeeping vertical, LIGHT posture) — a firm-admin RBAC-gated, workspace-RLS-scoped endpoint exporting the firm audit-log + deal/pipeline activity as CSV/JSON, HMAC-chain integrity-verifiable, the export itself audit-logged + a firm-admin export UI page. | **Block exit gate:** P-4
| Stage | Deliverable | Status |
|---|---|---|
| P-0 | stages/P-0-frame.md | done |
| P-1 | done |
| P-2 | done |
| P-3 | done |
## Block-specific context
- **claimed_task_ids:** [0d2c5f08 (seed: export endpoint), f331a51c (sibling: export page)]
- **Founder steer:** compliance posture = LIGHT (2026-07-07) — a sensible, well-built export (standard format, integrity-verifiable, audit-logged, RBAC+RLS scoped), NOT a formal regulator-certified attestation package. No named-regime certification.
- **Backbone (live):** M2 HMAC audit-chain (audit_log_entries WORM, verifyChain, audit.service/verifier) + M8 workspace RLS (dealflow_app runtime, getDb, workspace_id scoping). The export builds on these.
- **LOAD-BEARING (SECURITY-SENSITIVE — touches data export + RBAC + RLS + audit):** the export is WORKSPACE-SCOPED (a firm exports ONLY its own records — M8 RLS enforced, no cross-workspace leak); RBAC-gated (firm-admin only — RolesGuard fail-closed); the export ACTION is itself audit-logged; HMAC-chain integrity-verifiable (the exported audit records carry/verify their chain); NO unbounded-export DoS (large exports streamed/paginated/bounded); PII-awareness (the export contains firm data the firm owns — fine, but no OTHER firm's data). → likely P-4 security-scope-tightened (touches export of sensitive records + RBAC/RLS) + T-8 Security.
- **design_gap_flag:** TRUE (new firm-admin export UI page — no existing compliance/export page in apps/web). → D-block runs.
- Autonomous mode: automatic.
## Gate verdict log
<appended by head-product at P-4>

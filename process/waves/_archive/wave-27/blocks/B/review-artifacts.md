# Wave 27 — B-block review artifacts
**Wave topic:** M10 recordkeeping EXPORTS — EXTEND the existing recordkeeping export (CSV + deal/pipeline scope + cap+truncation + firm-admin UI page). SECURITY-SCOPE-TIGHTENED. | **Block exit gate:** B-6 | **Status:** gate-passed
| Stage | Deliverable | Status | Notes |
|---|---|---|---|
| B-0 | (claim+branch) | done | schema SKIP; branch wave-27-recordkeeping-export |
| B-1 | stages/B-1-contracts.md | pending | extend exportScopeSchema (.strict, format/scope/range/cap) |
| B-2 | stages/B-2-backend.md | pending | extend RecordkeepingService/Repo (CSV + deal/pipeline via getDb/RLS + cap+truncation + firm-local ordinal) + SEC-8 isolation e2e + export-audit-log |
| B-3 | stages/B-3-frontend.md | pending | firm-admin export page (adopted design; reuse ExportPanel/IntegrityBadge) |
| B-4/B-5/B-6 | ... | pending | |
## SEC-1..10 (BINDING — from P-4 Phase-2; head-builder + T-8 police):
SEC-1 audit-export via getDb/RLS, FORBID read_audit_chain_rls_exempt in payload (verify=boolean). SEC-2 .strict no-client-workspace-id + negative test. SEC-3 EXTEND existing export (reuse RLS-scoped Repo). SEC-4 bounded (date-range default + max-row cap) + EXPLICIT truncation warning (truncated:true/rowsReturned/rowsAvailable) — no silent short "complete". SEC-5 CSV-injection escape (=+-@/tab/CR/LF + RFC-4180). SEC-6 firm-local ordinal, MASK global sequence_number (side-channel). SEC-7 RBAC compliance+admin fail-closed. SEC-8 fault-killing export-isolation e2e as dealflow_app (firm A export=0 firm B rows, no rls-exempt in payload; reuse analytics-isolation harness). SEC-9 export-audit-log scope/count-only. SEC-10 no cross-firm joins.
## LOAD-BEARING: SEC-1 (getDb-not-exempt) + SEC-4 (explicit truncation) + SEC-8 (real isolation test as dealflow_app) are the crux. Adopted D-3 design for B-3.

## Block exit handoff
```yaml
build_block_status: complete
branch: wave-27-recordkeeping-export
review_verdict: APPROVE (head-builder Attempt-2 + /review — 1 P1 SEC-4 fixed; cross-tenant isolation solid)
deliverable: [extended recordkeeping export (CSV+deal/pipeline+cap/truncation+firm-local-ordinal, getDb/RLS), /compliance/export firm-admin page (adopted design), SEC-8 isolation e2e, SEC-4 X-Export-Manifest contract]
sec_all_honored: true (SEC-1..10; SEC-4 closed in rework)
app_bundle_changed: true (new export controller behavior + startup unaffected; web new page → C-2 real deploy)
db_gated_tests: [recordkeeping-export-isolation.e2e (SEC-8)]
ci_yml_change: false
ready_for_ci: true
security_scope_tightened: true
```

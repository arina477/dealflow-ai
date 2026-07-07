# Wave 27 — P-0 Frame
## Discover
- wave_number 27, M10 (in_progress, LIGHT posture). Seed 0d2c5f08 (export endpoint) + sibling f331a51c (export page). FIRST real M10 recordkeeping vertical.
## Reframe
### problem-framer — PROCEED (with 3 load-bearing security constraints)
**THE CRUX (cross-tenant leak):** audit_log_entries has NO RLS (0 policies) — verifyChain→readChainAscending reads via read_audit_chain_rls_exempt over the SINGLE GLOBAL cross-workspace chain (correct for integrity, but a FULL cross-tenant LEAK if the export payload serializes that global walk). SPEC MUST SPLIT: export DATA = workspace-scoped ONLY (deal/pipeline via getDb/RLS; audit rows via an EXPLICIT workspace_id filter since audit_log_entries has no RLS policy); integrity-VERIFY = may walk the global chain but returns ONLY a boolean/verify-result, NEVER other firms' rows in the payload. + unbounded-export DoS (readChainAscending unbounded → streaming/pagination/date-range bound); CSV-injection (prefix-escape =+-@); RBAC = admin-only (RolesGuard fail-closed, not the broader compliance set). design_gap TRUE → D-block. LIGHT posture aligned.
### ceo-reviewer — PROCEED (HOLD-SCOPE)
Recordkeeping-exports is the right foundational light vertical at ~6/10 (integrity-verifiable/audit-logged, NOT certification, NOT raw dump). Traced to the compliance-first bet + M10. The airtight M8-RLS workspace-scoping is THE load-bearing risk (a cross-firm leak here = catastrophic for a compliance-first product) — flagged for execution.
### mvp-thinner — OK
Already the minimum coherent vertical slice. The metric names "audit log + deal activity" VERBATIM (deal/pipeline NOT thinnable); CSV+JSON is one serializer branch (not peelable). floor_constraint_active. The RBAC+RLS+audit-log-of-export+integrity are the floor.
### Disposition: PROCEED (with the security constraints as HARD ACs)
Final framing → P-1/P-2/P-3 + the D-block:
1. **Endpoint (0d2c5f08):** firm-ADMIN-only (RolesGuard fail-closed), workspace-scoped export of the firm's audit-log + deal/pipeline activity as CSV/JSON. **Export DATA is WORKSPACE-SCOPED** (deal/pipeline via getDb/RLS; audit rows via an EXPLICIT `WHERE workspace_id = <caller>` filter — audit_log_entries has NO RLS policy, so the filter is MANDATORY + is THE cross-tenant-leak guard). **Integrity-verify** returns ONLY a boolean/summary (verifyChain over the RLS-exempt chain is fine, but the payload NEVER includes other firms' rows). The export ACTION is itself audit-logged (who/what/when). **Unbounded-export guard** (streaming OR pagination OR a required/default date-range bound). **CSV-injection guard** (escape cells starting with =+-@).
2. **Page (f331a51c):** a firm-admin export UI (format picker CSV/JSON, optional date-range, download, an integrity-result indicator). Design-system compliant; RBAC-gated route.
## LOAD-BEARING (SECURITY-SCOPE-TIGHTENED — data export of sensitive records + RBAC + RLS + cross-tenant):
- **cross-tenant-leak guard: the export DATA returns ONLY the caller's workspace records** (audit rows explicitly workspace_id-filtered; deal/pipeline via getDb/RLS) — a test proves firm A's export contains ZERO firm B rows (the fault-killing isolation test).
- integrity-verify returns a boolean/summary, NOT other firms' rows.
- RBAC admin-only (fail-closed); the export is audit-logged; unbounded-export bounded; CSV-injection escaped.
## design_gap_flag: TRUE (new firm-admin export page — no existing compliance/export page). → D-block runs.
## FLAGS: SECURITY-SCOPE-TIGHTENED (security-auditor Phase-2 + T-8 Security). Founder-reserved M10 later verticals (retention, records-view) NOT in scope. M9 _TBD + pile-up in digest.
claimed_task_ids: [0d2c5f08-81e7-421c-ac69-cfedea2cc8a8, f331a51c-aa4f-464a-a0a6-c470f4f297a6]

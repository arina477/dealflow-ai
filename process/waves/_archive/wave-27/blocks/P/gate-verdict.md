# Wave 27 — P-4 Verdict

**Reviewer:** head-product (fresh spawn)
**Reviewed against:** process/waves/wave-27/blocks/P/review-artifacts.md
**Attempt:** 1  (1 = first gate)
**Phase:** 1 (head-product)

## Verdict
APPROVED

## Rationale
The M10 recordkeeping-exports frame, decomposition, spec, and plan are internally consistent, trace cleanly back to the P-0 bet (M10 LIGHT compliance vertical 1 of 3, under the live compliance-first-wedge founder bet), and — decisively for a SECURITY-SCOPE-TIGHTENED data-export wave — the crown-jewel cross-tenant-isolation guard is specified as a binary, observable, FALSIFIABLE acceptance criterion rather than aspirational prose. The problem-framer's #1 catch is fully absorbed: the spec explicitly splits the two data sources with opposite scoping — export DATA is workspace-scoped (deal/pipeline via getDb/RLS; audit rows via a MANDATORY explicit `WHERE workspace_id=<caller>` filter, since audit_log_entries carries NO RLS policy and the global HMAC chain is read RLS-exempt for integrity only), while integrity-verify returns ONLY a boolean/summary and NEVER serializes other firms' rows. The naive "export the verified global chain" full-leak vector is named and banned. RBAC is admin-only fail-closed with a full 401/403/200 matrix, the export action is itself HMAC-audit-logged, unbounded-export DoS and CSV-injection are both bounded/escaped, the posture is correctly LIGHT (integrity-verifiable, not certification / not gold-plated), the design gap is TRUE so the D-block runs before Build, and the security-scope-tightened flag routes a security-auditor into Phase 2 plus T-8 Security. The DB source-of-truth spec (seed 0d2c5f08 tasks.description) matches the P-2 pointer. All P-4 exit checks tick.

## Security-scope tightened gate — CONFIRMED
- `security_scope_tightened: true` — wave touches data-export of sensitive records + RBAC + RLS + cross-tenant isolation + the M2 audit chain. TIGHTENED gate applies.
- Phase 2 MUST route a **security-auditor** (in addition to karen + jenny + Gemini) and the wave MUST run **T-8 Security**. On any first Phase-2 BLOCK with >2 medium-or-higher findings, a mandatory second Phase-2 iteration fires (cap 3 attempts total).

## Checklist — P-4 (all PASS)
- **Cross-tenant-leak guard — FALSIFIABLE:** PASS. Audit rows explicit `workspace_id` filter (identified as THE load-bearing guard; a naive global-chain-walk export = full cross-tenant leak, and that vector is explicitly banned) + deal via getDb/RLS. Fault-killing isolation test proves firm A's export contains ZERO firm B rows via the REAL service as dealflow_app in workspaceAls — NOT re-implemented SQL (the wave-18 hollow-test lesson is respected). Integrity-verify returns boolean/summary only.
- **RBAC admin-only fail-closed:** PASS. Role pinned to admin (NOT the broader compliance set — export of the full firm record is strictly more sensitive than the compliance summary; analyst/advisor CANNOT export). RolesGuard boot-fail-closed like AnalyticsController. Binary matrix: admin→200, analyst/advisor→403, anon→401.
- **Export is audit-logged:** PASS. Normal HMAC append via audit.service (actor/action/format/range/count); a plain chain extension, does not break the chain.
- **Unbounded-export DoS + CSV-injection:** PASS. Date-range default / max-row cap (no OOM on a huge log) + CSV prefix-escape of `= + - @` (and tab/CR) at the serializer boundary; JSON via native stringify.
- **LIGHT posture:** PASS. Well-built, integrity-verifiable, audit-logged export — NOT a regulator-certified attestation package. Not gold-plated; the security items are baseline hygiene, not scope inflation.
- **design_gap TRUE → D-block runs:** PASS. New firm-admin export page (no existing compliance/export page) — D-1 → D-2 → D-3 before B.
- **security_scope_tightened → CONFIRM:** PASS. Routing security-auditor into Phase 2 + T-8 Security.
- **M10 later-verticals-deferred + M9 _TBD flags recorded:** PASS. Retention (vertical 2) + records-view (vertical 3) correctly deferred; M9 _TBD + pile-up flagged for digest.
- **Traceability:** PASS. Both claimed_task_ids (0d2c5f08 endpoint, f331a51c page) resolve to the M10 milestone + the live compliance-first bet. No orphan tasks, no scope smuggle.
- **INVEST / binary ACs / observable behaviors:** PASS. ACs are HTTP-code + observable-DB-state + machine-checkable; unhappy paths (RBAC reject, empty/zero-activity, error, tamper-fail, unbounded, injection) written in.

## Escalation
n/a

## Footer
- verdict_complete: true
- rework_attempt_cap_remaining: 3
- next_action: PROCEED_TO_PHASE_2 (karen + jenny + Gemini + security-auditor [tightened]) then D-1 Brief (design_gap_flag=true)

---
## P-4 Phase 2 (karen + jenny + security-auditor) — REWORK → CORRECTED → APPROVED
- **karen REJECT + jenny REJECT + security-auditor REWORK** — all on the SAME crux: the spec's premise "audit_log_entries has NO RLS" was FACTUALLY INVERTED. It HAS FORCE RLS (workspace_isolation policy, 0014:279/380 + 0017:57) → audit rows export via getDb/RLS (same as deal/pipeline); read_audit_chain_rls_exempt is ONLY the global integrity walk (payload-forbidden). Coding to the false premise was the actual leak vector. PLUS: an existing recordkeeping export SHIPS (POST /compliance/audit-log/export, RBAC compliance+admin) → EXTEND it, not rebuild. + unbounded/silent-truncation (F4), global-seq side-channel (F6), missing export-isolation test (F8).
- **CORRECTED (P-3 reworked + SEC-1..10 folded):** premise fixed (getDb/RLS, no-rls-exempt-in-payload); extend-not-rebuild; bounded+explicit-truncation; .strict-no-client-workspace-id; firm-local-ordinal; RBAC compliance+admin; fault-killing export-isolation e2e as dealflow_app; CSV-injection; export-audit-scope-only; no-cross-firm-joins.
- **security-auditor RE-VERIFY: RESOLVED** — all F1-F10 closed, source-verified; spec safe for B-block (P-3-plan.md is sole source).
## MERGED P-4 VERDICT: APPROVED (after REWORK) — security-scope-tightened satisfied. → D-block (design_gap TRUE) then B (with SEC-1..10) + T-8 Security. Gemini UNAVAILABLE.
**Status:** gate-passed (reworked)

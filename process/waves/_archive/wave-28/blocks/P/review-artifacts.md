# Wave 28 — P-block review artifacts
**Block:** P (Product) | **Wave topic:** M10 RETENTION policy (2nd M10 light recordkeeping vertical) — a MUTABLE workspace-scoped workspace_retention_policy table (retention_period_days config, ~7yr light default, provenance) + shared-Zod contracts + RBAC-scoped RLS service/API + a settings/cutoff-surfacing UI. WORM-PRESERVING (config + read-only surfacing; NOT audit-row deletion). | **Block exit gate:** P-4
| Stage | Deliverable | Status |
|---|---|---|
| P-0 | stages/P-0-frame.md | done |
| P-1 | done |
| P-2 | done |
| P-3 | done |
## Block-specific context
- **claimed_task_ids:** [d3cc1337 (seed: retention table+migration), b7786c5b (contracts), ed4945e0 (service+RBAC API), ce75c6c6 (settings UI)]
- **Founder steer:** compliance posture = LIGHT — a sensible retention config (an admin-set window + surfacing), NOT a formal regime. ~7yr default (defensible M&A/deal-recordkeeping standard).
- **LOAD-BEARING compliance invariants:** (a) **WORM-PRESERVATION** — the retention POLICY is config + read-only surfacing (a "records older than X will be eligible for deletion" cutoff DISPLAY); it does NOT delete/mutate audit_log_entries (the audit_log_no_mutate WORM trigger + HMAC chain stay intact). Genuine retention-DELETE over WORM data = DEFERRED (founder/compliance). (b) **RLS-scoped** — the retention config is per-workspace (a firm sets/reads ONLY its own; M8 pattern via getDb). (c) **RBAC** — setting retention is admin/compliance (RolesGuard fail-closed). (d) **audit-logged** — a retention-config CHANGE is a sensitive action → append to the M2 chain (who/old/new).
- **Schema:** ONE additive migration (workspace_retention_policy — MUTABLE, RLS-scoped, NOT WORM). Journaled (BUILD #4/wave-25). The wave-24 populated-migration AC applies ONLY to WORM/audit-table migrations — this new non-WORM table is out of that AC's scope (but the migration must journal + apply cleanly).
- **design_gap_flag:** TRUE (new retention settings UI — no existing one). → D-block runs.
- Autonomous mode: automatic.
## Gate verdict log
<appended by head-product at P-4>

## P-4 Phase 2: karen APPROVE (5/5 VERIFIED — RLS pattern real+per-table-not-inherited [0014/0017], WORM trigger real [0002 audit_log_no_mutate], verifyChain, RolesGuard fail-closed + admin/compliance roles, getDb/workspaceAls/AuditService.append) + jenny APPROVE (6/6 MATCHES, 0 DRIFTS — WORM-preservation, RLS-on-new-table, RBAC, light-posture, 2nd-vertical-no-creep, ~7yr-firm-changeable) + security-auditor SPEC SOUND (both bounded questions: RLS-on-new-table-required + WORM-preserved-no-purge; NO crit/high; 3 reinforcing obligations SEC-A/B/C + test-integrity-guard folded). Gemini N/A.
## MERGED P-4 VERDICT: APPROVED (tightened-light satisfied). → D-block (design_gap TRUE) then B (SEC-A/B/C + WORM-preservation + RLS-on-new-table) + T-8.
## B-BLOCK OBLIGATIONS: WORM-preserved-no-purge (verifyChain-ok-after-change) + RLS-on-new-table (USING-only auto-WITH-CHECK + server-resolved upsert + foreign-write-rejected test) + explicit-dealflow_app-GRANT + retention.policy.updated-audit-enum + isolation-e2e-as-dealflow_app.
**Status:** gate-passed

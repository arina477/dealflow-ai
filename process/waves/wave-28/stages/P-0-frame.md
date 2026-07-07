# Wave 28 — P-0 Frame
## Discover
- wave_number 28, M10 (in_progress, LIGHT posture). Retention bundle: seed d3cc1337 (table+migration) + b7786c5b (contracts) + ed4945e0 (service+RBAC-API) + ce75c6c6 (settings UI). 2nd M10 light recordkeeping vertical.
## Reframe
### problem-framer — PROCEED
Framing genuinely CONFIG + read-only cutoff surfacing (NOT audit-row deletion), verified vs the real WORM trigger. Load-bearing (→ P-2/T-8 non-negotiable): (a) **WORM-PRESERVATION** — audit_log_no_mutate (migration 0002) UNCONDITIONALLY blocks all UPDATE/DELETE on audit_log_entries; the seed stores POLICY + DEFERS genuine purge; (b) **RLS-on-the-new-config-table** — the migration MUST EXPLICITLY replicate the 0014 workspace_isolation policy + FORCE ROW LEVEL SECURITY (wave-27 lesson: a new table does NOT inherit RLS — a config table without RLS leaks cross-firm retention config).
### ceo-reviewer — PROCEED (HOLD-SCOPE)
Correctly-sequenced 2nd M10 light vertical (exports→retention→records-view). config+surfacing-only, WORM boundary explicitly held (no purge over the immutable chain). ~7yr default covered by the standing light-posture decision. Scope not expandable (records-view breaks cadence) nor reducible (raw field under-builds the metric). **The WORM-preservation boundary is the single load-bearing gate item — the UI carries NO purge control; config-change events APPENDED to the M2 chain, NOT deletion — hold it hard.**
### mvp-thinner — OK
Every AC traces to the metric ("retained records bounded by a configurable retention window"). Cutoff-surfacing is a cheap (<100 LOC) derived display completing the surfacing value; floor_constraint_active. RLS-scoping + RBAC + config-change-audit-append + WORM-preservation = the compliance floor (no OVER-CUT).
### Disposition: PROCEED (WORM-preservation + RLS-on-new-table as HARD ACs)
Final framing → P-1/P-2/P-3 + D-block:
1. **Table+migration (d3cc1337):** workspace_retention_policy (MUTABLE, one row/workspace, retention_period_days int, ~7yr light default, provenance updatedBy FK + timestamps). ONE additive Drizzle migration — **MUST explicitly add the workspace_isolation RLS policy + ENABLE+FORCE ROW LEVEL SECURITY** (the 0014 pattern; a new table does NOT inherit RLS) + the dealflow_app GRANT. Journaled (BUILD #4/#11).
2. **Contracts (b7786c5b):** shared-Zod (retention_period_days with sane min/max bounds, the policy read/write shapes) .strict.
3. **Service+API (ed4945e0):** RBAC (admin/compliance, RolesGuard boot-fail-closed) + RLS-scoped (getDb — a firm reads/writes ONLY its own policy) get/set retention. **A config CHANGE is audit-logged** (append to the M2 chain: actor/old→new window — a normal HMAC append, WORM-preserving). NO deletion path.
4. **Settings UI (ce75c6c6):** set the retention window + a cutoff-surfacing DISPLAY ("records older than <cutoff> are eligible for deletion under your policy" — read-only, informational). **NO purge/delete control.** Adopted D-block design, RBAC-gated route.
## LOAD-BEARING (compliance-sensitive):
- **WORM-PRESERVATION:** NO deletion/mutation of audit_log_entries (the audit_log_no_mutate trigger + HMAC chain stay intact + verifyChain still ok); the UI has NO purge control; config changes are APPENDED to the chain. Genuine retention-DELETE over WORM data = DEFERRED (founder/compliance/legal). A test proves verifyChain still ok after a retention-config change.
- **RLS-on-the-new-table:** the migration adds workspace_isolation + FORCE RLS; a test proves firm A can't read/write firm B's retention policy (isolation).
- RBAC admin/compliance fail-closed; config-change audit-logged.
## design_gap_flag: TRUE (new retention settings UI). → D-block runs.
## FLAGS: security-scope — touches a new RLS config table + the WORM/audit backbone → P-4 assess tightened (RLS-on-new-table + WORM-preservation warrant a security check; likely a security-auditor pass). M10 records-view = vertical 3 (later). M9 _TBD + pile-up in digest.
claimed_task_ids: [d3cc1337-c7a4-4a89-9857-02ba99e1292d, b7786c5b, ed4945e0, ce75c6c6]

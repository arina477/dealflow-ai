# Wave 28 — P-2 Spec (pointer)
**Source of truth:** the retention bundle tasks.description (d3cc1337 + siblings) + this contract. design_gap TRUE → D-block.
**claimed_task_ids:** [d3cc1337, b7786c5b, ed4945e0, ce75c6c6]
## AC (M10 RETENTION policy — light, WORM-preserving):
1. **Table+migration:** workspace_retention_policy (mutable, one-row/workspace, retention_period_days ~7yr default, provenance). ONE additive migration that EXPLICITLY adds ENABLE+FORCE RLS + the workspace_isolation policy + dealflow_app GRANT (a new table does NOT inherit RLS — wave-27). Journaled.
2. **RLS isolation (crux):** a firm reads/writes ONLY its own retention policy — a test proves firm A can't read/write firm B's policy (REAL service as dealflow_app in workspaceAls).
3. **WORM-PRESERVATION (crux):** NO deletion/mutation of audit_log_entries; NO purge control in UI/API; a retention-config CHANGE is APPENDED to the M2 chain (actor/old→new); a test proves verifyChain still ok:true after a config change. Genuine retention-DELETE = DEFERRED.
4. **RBAC:** admin/compliance→200, advisor/analyst→403, anon→401 (RolesGuard fail-closed). Bounds-validation (out-of-range days → 400).
5. **Settings UI:** set the window + a read-only cutoff-surfacing display ("records older than <cutoff> eligible") — NO purge control. Adopted design, RBAC-gated, a11y.
## Load-bearing: WORM-preserved (verifyChain-ok-after-change + no-purge) + RLS-on-new-table (isolation test) + RBAC-fail-closed + config-change-audit-logged. → D-block then P-4 (security assess tightened) + T-8. LIGHT posture. FLAGS: records-view = vertical 3; M9 _TBD.

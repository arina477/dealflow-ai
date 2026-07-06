# Wave 17 — P-2 Spec (pointer)
**Source of truth:** seed task tasks.description (id 0db154ff). wave_type multi-spec (4 blocks). design_gap_flag false. security_scope_tightened true.
**claimed_task_ids:** [0db154ff seed, e45ba68c, 96026365, df2f3b2f]
## AC summary (M8 pilot-partner data-isolation)
1. **0db154ff workspaces+scoping:** workspaces table + workspace_id FK on all tenant tables; backfill existing rows to default workspace BEFORE NOT NULL; audit_log_entries.workspace_id HASH-EXCLUDED (wave-14 precedent) → verifyChain ok:true; migration 0014 additive+journaled.
2. **e45ba68c RLS:** ENABLE + **FORCE ROW LEVEL SECURITY** per tenant table (owner subject to RLS — else false-green); deny-by-default USING workspace_id=current_setting('app.workspace_id'); unset→deny-all (fail-closed); **audit_log + recordkeeping-export READ workspace-scoped** (ceo-reviewer — WORM≠read-isolation); verifyChain stays ok:true within a workspace.
3. **96026365 propagation:** every authed request SET LOCAL app.workspace_id (tx-scoped, no pool leak) from the user's workspace BEFORE tenant queries; missing workspace→deny-all (no workspace-1 default leak); tx-scoped handle (BUILD rule 7).
4. **df2f3b2f negative-read test:** 2 workspaces; workspace-A user reads workspace-B → EMPTY across primary+audit+export; runs over the OWNER connection (false-green guard); FAULT-KILLING (removing FORCE/policy/propagation → cross-read → fail); same-tenant read non-empty (positive control); WORM-safe teardown.
## Load-bearing: FORCE-RLS+owner-connection-test | audit_log-hash-exclude+verifyChain-ok | backfill-before-cutover | deny-by-default-fail-closed | GUC-SET-LOCAL-no-leak | audit/export-in-boundary.

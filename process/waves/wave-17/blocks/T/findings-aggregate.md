# Wave 17 — T-block findings aggregate (V-2 input)
| # | Severity | Stage | Description |
|---|---|---|---|
| 1 | INFO | C-2 | prod runtime DATABASE_URL=dealflow_app + preDeploy MIGRATE_DATABASE_URL=owner (connection split); [RLS-GUARD] fails-closed if runtime ever reverts to superuser |
| 2 | INFO | ops | dealflow_app password is Railway-env-only (never committed); key-loss = re-ALTER ROLE |
## Security substance — PROVEN (the isolation is REAL, not vacuous):
- FORCE RLS enforced under the NON-SUPERUSER dealflow_app role (superuser bypass eliminated): CI ISO-1..5 as dealflow_app (cross-tenant=0 + same-tenant>0) — the /review-caught crux, now proven.
- Request-scoped GUC connection (set_config not param-SET, tx/session correct, RESET-in-finally no-leak): CI GUC-1/2/3 fault-killing.
- Pre-interceptor RLS-exempt bootstrap (resolve_user_workspace for RolesGuard+session-claim, resolve_invite for signup): CI RBAC CRITICAL-1b (not 403-for-all) + INV-1..5.
- audit_log workspace_id hash-excluded + WORM trigger blocks re-attribution + populated-DB migration WORM-safe: CI ISO-5 + AMP-1..5 + C-2 verifyChain ok:true (328 rows).
- deny-by-default fail-closed (NULLIF empty-string cast); backfill-before-NOT-NULL.
- C-2 LIVE: [RLS-GUARD] boot-assertion passed (runtime non-superuser); reads work (not bricked); RBAC works; audit ok:true.
findings_total: 2 (0 crit/high/med, 0 low, 2 info)

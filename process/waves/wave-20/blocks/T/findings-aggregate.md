# Wave 20 — T-block findings aggregate (V-2 input)
| # | Severity | Stage | Description |
|---|---|---|---|
| 1 | P2 (B-6 accepted) | service | updateStatus completed→planned/cancelled leaves stale completedAt (data hygiene, no cross-firm impact) |
| 2 | P2 (B-6 accepted) | controller | unknown ?status= silently ignored not 400 (cosmetic, still workspace-scoped) |
| 3 | INFO | C-2 | live authed create/list deferred (no prod advisor fixtures) — CI outreach-activity-rls/migration e2e authoritative |
| 4 | INFO→L-2 | C-1 fix-forward #2 | REAL prod bug caught: audit readTail was RLS-filtered under dealflow_app → genesis seq=1 collision per workspace; fixed to RLS-exempt read_audit_chain_rls_exempt (global tail). Load-bearing for M11 multi-tenant. → L-2 observation candidate. |
## Security substance — PROVEN (CI real-DB as dealflow_app + C-2 live):
- Write-path isolation: R1 own-row-re-home UPDATE→42501 (non-vacuous) + SF1 no-DEFAULT_WORKSPACE_ID-leak (empty-ALS reject, 3-layer) + R2 FORCE positive-control — all as dealflow_app.
- Cross-firm FK tenancy (R3): all 4 deal-target FKs resolve under getDb → firm-B reject; createdBy server-derived (not client).
- Audit-logged mutations (R4): every verb appends last-in-txn + rollback-on-fail + verifyChain ok; chain NOT corrupted (table not WORM, not wired into audit_log).
- Additive migration (GAP-4 populated-safe, SF6 verifyChain-post). Credential-free (channel = pure labels, no send).
findings_total: 4 (0 crit/high, 2 P2-accepted, 2 info)

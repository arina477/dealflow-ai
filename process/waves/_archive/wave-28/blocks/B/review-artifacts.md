# Wave 28 — B-block review artifacts
**Wave topic:** M10 RETENTION policy — table+migration (RLS) + contracts + RBAC/RLS service+API (audit-logged) + settings UI. WORM-PRESERVING. | **Block exit gate:** B-6 | **Status:** gate-passed
| Stage | Deliverable | Status | Notes |
|---|---|---|---|
| B-0 | (claim+branch) | done | branch wave-28-retention-policy; migration w/ explicit RLS |
| B-1 | stages/B-1-contracts.md | pending | shared-Zod retention + retention.policy.updated audit-action enum |
| B-2 | stages/B-2-backend.md | pending | service + RBAC/RLS API (audit-logged upsert, NO deletion) + isolation/WORM/RBAC/bounds tests |
| B-3 | stages/B-3-frontend.md | pending | retention settings UI (adopted design, NO purge control) |
| B-4/B-5/B-6 | ... | pending | |
## BINDING (from P-4 Phase-2; head-builder + T-8 police):
- WORM-PRESERVED: NO deletion/mutation of audit_log_entries; NO purge control in UI/API; config-change APPENDED to M2 chain; a test proves verifyChain ok:true AFTER a config change.
- RLS-on-new-table: migration EXPLICITLY adds ENABLE+FORCE RLS + workspace_isolation policy (USING-only → PG auto-derives WITH CHECK; NULLIF empty-string shape) + [SEC-B] explicit GRANT to dealflow_app. [SEC-A] one-row-per-workspace UPSERT: UNIQUE(workspace_id) conflict-target + workspace_id=getWorkspaceId() SERVER-side (never client); test: foreign-workspace_id write → REJECTED (WITH-CHECK).
- ISOLATION TEST as dealflow_app (NOT postgres — superuser BYPASSRLS false-green trap): firm A can't read/write firm B's retention policy (REAL service in workspaceAls).
- RBAC admin/compliance fail-closed (advisor/analyst→403, anon→401); bounds-validation (out-of-range→400).
- [SEC-C] retention.policy.updated added to the shared audit-action enum; append actor from session with old_days→new_days HASHED.
- Migration JOURNALED (BUILD #4/#11 + wave-25 lesson: schema def + drizzle-kit generate → _journal.json + snapshot).
## LOAD-BEARING: WORM-preserved (verifyChain-ok-after-change) + RLS-on-new-table (foreign-write-rejected + isolation-as-dealflow_app) are the crux. Adopted D-3 design.

## Block exit handoff
```yaml
build_block_status: complete
branch: wave-28-retention-policy
review_verdict: APPROVE (head-builder + /review ship — RLS-on-new-table + WORM-preservation solid)
deliverable: [0020_retention_policy migration (explicit RLS+FORCE+GRANT+UNIQUE, journaled idx 20), retention.ts contracts + retention.policy.updated audit-enum, retention-policy module (RBAC/RLS API, audit-logged, no-deletion), /compliance/retention settings UI (no purge control), retention-policy-isolation.e2e (as dealflow_app)]
sec_obligations: all honored (WORM-preserved, RLS-on-new-table, SEC-A/B/C, isolation-as-dealflow_app)
app_bundle_changed: true (api retention module + migration 0020 + web page → C-2 real deploy WITH migration)
db_gated_tests: [retention-policy-isolation.e2e (RET-ISO/RET-WORM)]
migration: 0020_retention_policy (journaled)
ready_for_ci: true
security_scope_tightened: true (tightened-light)
```

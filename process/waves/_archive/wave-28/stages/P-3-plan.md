# Wave 28 — P-3 Plan (M10 RETENTION policy)
## Approach — a per-workspace retention-window CONFIG (WORM-preserving; NO purge)
### Action 1 — Deliverables
1. **[d3cc1337] Table + migration:** workspace_retention_policy (id, workspace_id FK NOT NULL, retention_period_days int [sane bounds, ~7yr=2555d light DEFAULT], updated_by FK users, created_at/updated_at). ONE additive Drizzle migration. **MUST explicitly: ENABLE + FORCE ROW LEVEL SECURITY + CREATE POLICY workspace_isolation USING (workspace_id = NULLIF(current_setting('app.workspace_id',true),'')::uuid)** (the 0014/0017 pattern — a NEW table does NOT inherit RLS; wave-27 lesson) + GRANT to dealflow_app. Journaled (BUILD #4 + the wave-25 unjournaled lesson: schema def + drizzle-kit generate → _journal.json entry + snapshot). NOT WORM (mutable config) → the wave-24 populated-migration AC does NOT apply, but the migration must journal + apply cleanly + carry its RLS policy.
2. **[b7786c5b] Contracts:** packages/shared/src/retention.ts (.strict) — retention_period_days with min/max bounds (e.g. 1..~10yr), the policy read shape (period + cutoff-date derived + provenance), the set-request shape.
3. **[ed4945e0] Service + RBAC/RLS API:** GET + PUT (or POST) /compliance/retention (or /settings/retention) — RBAC admin/compliance (RolesGuard boot-fail-closed, rolesForRoute non-empty). RLS-scoped via getDb (a firm reads/writes ONLY its own row — the workspace_isolation policy enforces; upsert one-row-per-workspace). **A config CHANGE is audit-logged** — append to the M2 chain (actor.id, action=retention.policy.updated, old_days→new_days) via AuditService (a normal HMAC append — WORM-preserving). **NO deletion path anywhere.** The GET derives the cutoff date (now - retention_period_days) for surfacing.
4. **[ce75c6c6] Settings UI:** a retention settings page/section (set the window via a bounded input/select + save) + a cutoff-surfacing DISPLAY ("Under your <N>-year policy, records dated before <cutoff> are eligible for deletion" — read-only, informational). **NO purge/delete control/button.** Adopted D-block design, RBAC-gated route, a11y.
### Action 2 — Data model: ONE new table (workspace_retention_policy — mutable, RLS-scoped, NOT WORM). Migration additive + journaled.
### Action 3 — API: GET + PUT /compliance/retention (RBAC admin/compliance). Shared Zod.
### Action 4 — Deps: none. No LLM/SDK/secret.
## D-BLOCK (design_gap TRUE): D-1 brief (retention settings + cutoff surfacing, NO purge control) → D-2 variants → D-3 review. THEN B.
## Plan (by B-stage)
**B-0 Schema** (backend-developer): the migration (table + RLS policy + FORCE RLS + GRANT + journal). db-migration-expert-adjacent care.
**B-1 Contracts** (backend-developer): shared-Zod retention.
**B-2 Backend** (backend-developer): the service + RBAC/RLS API (get/set upsert, audit-logged config-change, NO deletion) + tests: **RLS-isolation (firm A can't read/write firm B's policy — REAL service as dealflow_app in workspaceAls); RBAC (admin/compliance→200, advisor/analyst→403, anon→401); the config-change is audit-logged; WORM-PRESERVED (verifyChain still ok:true after a retention-config change — the audit chain untouched); bounds-validation (out-of-range days → 400).**
**B-3 Frontend** (nextjs-developer): the settings UI + cutoff-surfacing (NO purge control), adopted design, RBAC-gated. Tests.
**B-4/B-5/B-6:** head-builder polices RLS-on-new-table (the migration adds the policy) + WORM-preservation (no deletion; verifyChain-ok-after-change test) + RBAC + audit-logged + no-purge-control-in-UI + the migration journaled.
### Action 6 — Specialists: backend-developer (migration + contracts + service) + nextjs-developer (UI). Serial.
### Action 8 — Self-consistency CLEAN. security-scope: assess tightened at P-4.
```yaml
deps_new: []
schema_change: true   # workspace_retention_policy — additive, RLS-scoped, journaled, NOT WORM
new_secret: false
specialists: [backend-developer, nextjs-developer]
compliance_invariants: [WORM-preserved-no-audit-deletion (verifyChain-ok-after-config-change), new-table-has-explicit-RLS-policy+FORCE-RLS (isolation-tested-as-dealflow_app), RBAC-admin-compliance-fail-closed, retention-config-change-audit-logged, no-purge-control, migration-journaled]
hard_boundaries: "retention POLICY config only — a new MUTABLE RLS-scoped workspace_retention_policy table (migration MUST add workspace_isolation+FORCE RLS explicitly) + RBAC/RLS get/set (audit-logged config change) + settings UI with a read-only cutoff DISPLAY. WORM-PRESERVED: NO deletion/mutation of audit_log_entries, NO purge control in the UI/API, verifyChain stays ok. NO records-view (vertical 3). NO actual retention-purge (founder/compliance-deferred). Migration journaled."
design_gap_flag: true
self_consistency: clean
```

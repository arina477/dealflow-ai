# V-1 jenny — Spec-vs-Deliverable Verification (wave-28, M10 RETENTION policy — light)

**Verdict: APPROVE** · **MATCHES 6 / 6 · DRIFTS 0**
**Reviewer:** jenny (fresh spawn) · **Stage:** V-1 · **Wave:** 28
**Spec basis:** seed d3cc1337 DB spec-contract (P-2 SCOPE + SEC-A/B/C) + P-3-plan.md + product-decisions.md (LIGHT posture 2026-07-07 + WORM guardrail + bundle order). Traced to actual shipped code, not inferred from the B-6 gate.

---

## Check-by-check (each traced to shipped code)

### 1. WORM-preservation delivered — MATCH
- Retention = config + read-only surfacing only. Service (`retention-policy.service.ts`) has NO deletion/mutation of `audit_log_entries`; repository (`retention-policy.repository.ts`) has NO DELETE method (verified: no `.delete(`/`deleteFrom` in module). A config change fires `AuditService.appendStandalone({ action: 'retention.policy.updated', ... })` — a normal HMAC append — and ONLY when `newDays !== oldDays` (service:117), so no spurious entries.
- verifyChain-ok-after-change TESTED: `retention-policy-isolation.e2e-spec.ts` RET-WORM-1 asserts `verifyChain().ok === true` after `setPolicy()` AND audit count `=== before+1`; RET-WORM-2 asserts count never decreases.
- NO purge control in API (no DELETE handler — controller:24) and NO purge control in UI (`RetentionPolicyForm.tsx`: read-only cutoff panel, "Records are preserved. Deletion is not performed automatically"; `page.test.tsx` asserts no button/aria-label matching `/purge|delete|clean/i`).
- Consistent with the WORM guardrail (product-decisions L458) + M2 audit-chain posture. **No drift into a purge.**

### 2. RLS-on-new-table delivered — MATCH
- `0020_retention_policy.sql` explicitly: `ENABLE ROW LEVEL SECURITY` + `FORCE ROW LEVEL SECURITY` + `CREATE POLICY "workspace_isolation" USING (workspace_id = NULLIF(current_setting('app.workspace_id', true), '')::uuid)` (USING-only, RESET-safe NULLIF shape — 0017 pattern) + per-table `GRANT ... TO dealflow_app`. Directly executes the wave-27 "new table does NOT inherit RLS" lesson + M8 pattern.
- Isolation TESTED as dealflow_app: `withWorkspace()` runs `SET ROLE dealflow_app` (line 115), NOT postgres — the 0016 false-green superuser-BYPASSRLS trap explicitly avoided. RET-ISO-1 proves firm A reads 2000 / firm B reads 365 (`not.toBe(2000)`); RET-ISO-2 proves foreign-workspace write (WS_B while GUC=WS_A) `rejects.toThrow()` via WITH-CHECK. **No drift.**

### 3. SEC-A/B/C — MATCH (all delivered)
- **SEC-A** server-resolved upsert: `workspaceId = getWorkspaceId()` (service:103), never client-sourced; controller passes no workspace id; repo `ON CONFLICT (workspace_id) DO UPDATE`. `setRetentionPolicySchema.strict()` rejects client `workspace_id`/`firmId` → 400 (controller safeParse:102-106; RET-BOUNDS-1 tests).
- **SEC-B** explicit per-table GRANT (migration STEP 4), no wildcard.
- **SEC-C** `retention.policy.updated` present in `auditActionEnum` (`audit.ts:268`); append carries `actorUserId`/`actorRole` from session + hashed `old_days→new_days` contentHash. RET-AUDIT-ENUM test confirms.

### 4. RBAC admin/compliance — MATCH
- `rbac.ts:510` pattern `/compliance/retention` → `allowedRoles: ['compliance','admin']`, no navItem (API-only). Controller boot-fail-closed: `rolesForRoute(...)` throws on empty (controller:60-65) — mirrors the export-vertical precedent + boot-fail-closed model. advisor/analyst excluded (RET-RBAC-3/4), anon 401 via SessionGuard. Consistent with the export-vertical precedent.

### 5. LIGHT posture + ~7yr default — MATCH
- Config + read-only surfacing; NO certification/attestation, NO purge engine. Default `RETENTION_PERIOD_DAYS_DEFAULT = 2555` (~7yr) in shared contract + migration DEFAULT 2555; firm-changeable via bounded input (30..10950d / 1..30yr). Consistent with founder 2026-07-07 decision (product-decisions L443/L449/L458).

### 6. 2nd M10 recordkeeping vertical (retention) — MATCH
- Exports SHIPPED → retention THIS bundle → records-view LATER (product-decisions L457). No records-view files, no actual-purge code (grep: only guardrail assertions + comments confirming NO purge). Migration additive/journaled (idx 20). **No scope-creep into records-view or an actual purge.**

---

## Conclusion
Every load-bearing spec obligation is delivered in shipped code with no drift: WORM-preserved (verifyChain-ok-after-change + no-purge + no audit-deletion), RLS-on-new-table (ENABLE+FORCE+workspace_isolation+GRANT, isolation-tested-as-dealflow_app), SEC-A/B/C, RBAC fail-closed compliance/admin, LIGHT posture with firm-changeable ~7yr default, correct bundle order. The deliverable matches spec intent.

**APPROVE — MATCHES 6/6 · DRIFTS 0 · no conflicting prior decision.**

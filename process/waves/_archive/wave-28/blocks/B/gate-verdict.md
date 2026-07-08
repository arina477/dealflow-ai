# B-6 Review — Gate Verdict (wave-28, M10 RETENTION policy)

**Block:** B (Build) · **Stage:** B-6 Review · **Wave:** 28 · **Branch:** `wave-28-retention-policy`
**Task:** d3cc1337 (migration + contracts + service + API) + ce75c6c6 (settings UI)
**Gate agent:** head-builder (fresh spawn) · **Phase:** 1
**Verdict:** **APPROVED**

---

## Binding-obligation verification (each traced to actual shipped code)

### 1. RLS-on-the-NEW-table (CRUX — cross-firm config leak) — PASS
`apps/api/src/db/migrations/0020_retention_policy.sql` explicitly carries **all** required clauses on the brand-new `workspace_retention_policy` table (a new table inherits nothing):
- `ALTER TABLE ... ENABLE ROW LEVEL SECURITY;` (line 79)
- `ALTER TABLE ... FORCE ROW LEVEL SECURITY;` (line 80) — MANDATORY: the API runs as the table-owning role; without FORCE the owner bypasses RLS and every isolation test is a silent false-green.
- `CREATE POLICY "workspace_isolation" ... USING (workspace_id = NULLIF(current_setting('app.workspace_id', true), '')::uuid);` (lines 101-102) — USING-only (PG auto-derives WITH CHECK = USING; no separate weaker WITH CHECK), NULLIF empty-string shape → RESET-safe fail-closed (0017 pattern).
- **[SEC-B]** `GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "public"."workspace_retention_policy" TO dealflow_app;` (line 114) — per-table explicit grant, no wildcard; omission would be a runtime 42501.

No RLS clause is missing. No cross-firm leak vector.

### 2. Isolation test is REAL (SEC test-integrity) — PASS
`apps/api/test/retention-policy-isolation.e2e-spec.ts`:
- `withWorkspace()` runs `SET ROLE dealflow_app` (lines 113-115) — **NOT postgres**; the false-green superuser-BYPASSRLS trap is explicitly avoided and documented.
- RET-ISO-1: firm A `getPolicy()` under WS_A GUC returns **2000** (A's value), the negative case returns **365** (B's) and asserts `not.toBe(2000)` — genuine cross-firm read isolation via the REAL service in `workspaceAls.run`.
- **[SEC-A]** RET-ISO-2: as `dealflow_app` with GUC=WS_A, a direct `repo.upsert(WS_B_ID, ...)` write → `rejects.toThrow()` — the RLS WITH-CHECK (auto-derived from USING) fault-kills a foreign-workspace write. Not tautological; the fault (WITH-CHECK) is what throws.

### 3. WORM-PRESERVATION (CRUX) — PASS
End-to-end boundary holds:
- **Service** (`retention-policy.service.ts`): NO deletion/mutation of `audit_log_entries` anywhere; a config change is an `AuditService.appendStandalone({ action: 'retention.policy.updated', ... })` (append-only, HMAC-chained), fired only when `newDays !== oldDays` (no spurious entries). No DELETE path on repo or service.
- **DB backstop**: the `audit_log_no_mutate` trigger (BEFORE UPDATE OR DELETE, migration 0002) still guards `audit_log_entries` — deletion is impossible even if attempted.
- **Test**: RET-WORM-1 asserts `verifyChain().ok === true` AFTER `setPolicy()` and audit count `=== before+1`; RET-WORM-2 asserts count never decreases.
- **UI**: `RetentionPolicyForm.tsx` has NO purge/delete/clean control; the cutoff panel is read-only/informational ("Records are preserved. Deletion is not performed automatically"). `page.test.tsx` asserts no button OR aria-label matching `/purge|delete|clean/i` in idle + loading states.

### 4. SEC-A server-resolved upsert — PASS
`workspace_id = getWorkspaceId()` (ALS/GUC) in `setPolicy` (service line 103) — never client-sourced; controller passes no workspace id. Repo upsert `ON CONFLICT (workspace_id) DO UPDATE`. `setRetentionPolicySchema.strict()` rejects a client-supplied `workspace_id`/`firmId` → 400 (controller `safeParse`, lines 102-106; unit tests RET-BOUNDS-1 confirm).

### 5. SEC-C + RBAC — PASS
- **[SEC-C]** `retention.policy.updated` present in `auditActionEnum` (`packages/shared/src/audit.ts:268`); append carries actor (`actorUserId`/`actorRole` from session) + `contentHash(old_days→new_days)` hashed.
- **RBAC**: `/compliance/retention` → `['compliance','admin']` (`rbac.ts:510-511`), no navItem. Controller boot-fail-closed: `rolesForRoute(...)` throws on empty (controller lines 59-65). advisor/analyst excluded (RET-RBAC-3/4); bounds out-of-range → schema reject → 400 (RET-BOUNDS-1).

### 6. Migration journaled + no regression — PASS
`_journal.json` idx 20, tag `0020_retention_policy`; `0020_snapshot.json` present (drizzle-kit consistent). `pnpm typecheck` 4/4 green (FULL TURBO). Schema def in `retention-policy.ts` with UNIQUE(workspace_id), FK ON DELETE RESTRICT (workspaces) / SET NULL (users), workspace_id index.

### 7. Frontend — PASS
`page.tsx` RBAC-gated server-side (`assertRole('/compliance/retention', me.role)`, redirect to `/` for advisor/analyst, `/login` for anon); form additionally client-gates. NO purge control; audit-recorded ShieldCheck note always rendered (non-loading); read-only cutoff panel; a11y (label/for, aria-describedby, aria-invalid, role=alert live regions, focus-visible, prefers-reduced-motion, one primary CTA). BFF proxy `/compliance/retention-data → /compliance/retention` exists in `next.config.ts` (lines 567-568), avoiding page-route collision — wiring is end-to-end intact.

---

## head_signoff

```yaml
head_signoff:
  verdict: APPROVED
  stage: B-6
  reviewers: {}
  failed_checks: []
  rationale: >
    Every binding obligation is verified against actual shipped code, not inferred.
    The two crux items hold: (a) RLS-on-the-new-table is explicit and complete —
    ENABLE + FORCE + workspace_isolation USING-only NULLIF policy + SEC-B GRANT to
    dealflow_app, with a genuinely fault-killing isolation e2e that runs as
    dealflow_app (not postgres) proving cross-firm read isolation AND foreign-
    workspace-write rejection via the WITH-CHECK; (b) WORM is preserved end-to-end —
    the service only appends (retention.policy.updated) and never deletes/mutates
    audit_log_entries, the 0002 audit_log_no_mutate trigger backstops it, verifyChain
    stays ok:true after a config change with audit count monotonic non-decreasing, and
    the UI ships no purge/delete affordance (asserted by test). SEC-A (server-resolved
    ALS upsert + strict schema), SEC-C (audit enum + hashed old→new actor append),
    RBAC fail-closed boot + compliance/admin-only, bounds 400, migration journaled at
    idx 20, and typecheck green all confirmed. No cross-firm leak, no audit-deletion
    path, no compliance-audit bypass.
  next_action: PROCEED_TO_C_BLOCK
```

**Verdict: APPROVED** — explicit-RLS-on-new-table (ENABLE+FORCE+USING-only NULLIF policy+SEC-B GRANT) + isolation-as-dealflow_app + foreign-write-rejected (WITH-CHECK) + WORM-preserved-no-purge (verifyChain ok:true after change, audit count monotonic, no UI purge control, 0002 trigger backstop) + SEC-A/B/C + journaled idx 20 + typecheck 4/4, no regression.

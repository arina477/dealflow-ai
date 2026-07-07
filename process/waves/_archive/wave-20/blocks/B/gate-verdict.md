# B-6 Review — Gate Verdict (Attempt 1)

**Block:** B (Build) | **Wave:** 20 — M9 outreach-activity tracker | **Branch:** wave-20-outreach-activity
**Gate:** B-6 Technical Review | **Reviewer:** head-builder (fresh spawn) | **Phase:** 1
**FIRST MUTABLE M9 WRITE SURFACE** — write-path RLS isolation is load-bearing.

---

## Verdict

```yaml
head_signoff:
  verdict: APPROVED
  stage: B-6
  attempt: 1
  reviewers:
    head-builder: APPROVED
  failed_checks: []
  advisories:
    - "Stale e2e header: outreach-activity-rls.e2e-spec.ts documents OAE-4..8 (FK-tenancy + createdBy) but does NOT implement them at the e2e layer. Coverage is real — it ships as unit tests OA-R3-1..5 in outreach-activity.spec.ts (genuine per-FK repo-null mocks + createdBy-from-ALS assertion). The comment is stale, not the coverage. Log for L-2 (doc/test-marker drift), non-blocking."
  rationale: >
    Every one of the 11 P-4 binding obligations (R1-R4 + SF1-SF7) landed in shipped code and is
    backed by a genuine, real-DB or genuine-mock test — verified by reading the code, not the prose.
    No DEFAULT_WORKSPACE_ID fallback exists on the INSERT path; the SF1 leak is closed at three
    layers (service throw, repo GUC-expression, column DEFAULT + NOT NULL). The R1 own-row re-home
    test is the correct NON-vacuous variant (seeds firm-A's OWN visible row, then UPDATE SET
    workspace_id=firm-B → asserts 42501). All four FK-tenancy guards + createdBy-from-ALS are proven.
    Per-verb audit is last-in-txn for all four verbs with a real rollback-on-audit-fail test. Policy
    shape is FOR ALL / USING-only, no literal WITH CHECK, no FOR SELECT — matched to the 28 tenant
    tables. No external send, no LLM/ESP SDK, additive-only migration. No hollow tests detected.
  next_action: PROCEED_TO_C
```

---

## Obligation-by-obligation (read against shipped code)

### SF1 [HIGH — the leak] — NO DEFAULT_WORKSPACE_ID fallback — PASS
- `grep DEFAULT_WORKSPACE_ID` across the module: only in comments asserting its ABSENCE. No `?? DEFAULT_WORKSPACE_ID` on the workspace_id path (the `??` hits are all field defaults: `status`, `notes`, FK nulls).
- **Three-layer fail-closed:** (1) `service.create()` calls `getWorkspaceId()` and `throw new ForbiddenException` if null — BEFORE any DB write (`service.ts:78-84`). (2) `repository.insertActivity()` passes `workspaceId: sql\`NULLIF(current_setting('app.workspace_id', true),'')::uuid\`` — the DB computes from GUC, never a hardcoded value (`repository.ts:129`); on `23502` it maps to ForbiddenException. (3) migration 0018 sets column DEFAULT to the same NULLIF expression + NOT NULL.
- **Test OAE-3 is genuine:** builds the REAL service against the live DB, runs `svc.create()` with NO `workspaceAls.run` wrapper (ALS store undefined → `getWorkspaceId()`=null), asserts it throws AND that the default-workspace row count is UNCHANGED (no silent placement). Verified.

### R1 — own-row re-home write-check — PASS (non-vacuous)
- OAM-5 (+ OAE-1): seeds firm-A's OWN row (visible under GUC=firm-A), then as `dealflow_app` `UPDATE outreach_activity SET workspace_id=firm-B WHERE id=<own>` → asserts SQLSTATE `42501`. This is the real derived-WITH-CHECK test, NOT the vacuous "UPDATE with firm-B id on invisible row."
- OAM-4/OAE-2: INSERT explicit firm-B id under GUC=firm-A → `42501`. Both run as `dealflow_app` via `SET ROLE`.

### R2/SF3 — FORCE positive control — PASS
- OAM-7 + OAE-14: `SELECT relrowsecurity, relforcerowsecurity FROM pg_class WHERE relname='outreach_activity'` → both asserted `true`. OAE-14 runs it as `dealflow_app`.

### R3/SF4 — all-4-FK tenancy + server-derived createdBy — PASS
- Service validates outreachId, matchCandidateId, pipelineId, mandateId each via tx-scoped RLS read (`findXByIdInTx` → firm-B row invisible → null → NotFoundException). One negative per FK: unit OA-R3-1..4 (per-FK repo-null mock → NotFoundException). OA-R3-5 asserts the INSERT receives `createdBy = APP_USER_ID` (ALS actor.id, not input). Contract `createOutreachActivitySchema` EXCLUDES workspaceId + createdBy and is `.strict()`; OA-R1-1/2 prove workspaceId is rejected.

### R4/SF5 — per-verb audit last-in-txn + rollback — PASS
- create / update / updateStatus / cancel each call `auditService.append(...)` as the LAST statement inside the same `runInTransaction`, with a distinct action string per verb. e2e OAE-9..12 assert exactly +1 audit entry, correct `action`, and `verifyChain().ok===true` per verb (real AuditService + AuditVerifier against live DB). OAE-13 injects a throwing audit mock and asserts the business row is ABSENT (rollback holds).

### RLS policy shape — PASS
- 0018: `CREATE POLICY "workspace_isolation" ON outreach_activity USING (workspace_id = NULLIF(current_setting('app.workspace_id', true),'')::uuid)` — FOR ALL (command-unspecified), USING-only, NO literal WITH CHECK, NO FOR SELECT. FORCE + `GRANT SELECT,INSERT,UPDATE,DELETE TO dealflow_app`. OAM-7b asserts `polcmd='*'` AND `polwithcheck IS NULL`. Enum names distinct (`outreach_activity_channel`, `outreach_activity_status`) — OAM-1b/1c/1d.

### Not-WORM + credential-free — PASS
- outreach_activity is mutable (no `audit_log_no_mutate` trigger); mutations still audit-logged. Channel values are pure labels — zero external send/dispatch/webhook/queue (documented + no SDK import). Additive migration (CREATE TABLE + 2 enums); GAP-4 OAM-2 + SF6 OAM-3 assert verifyChain ok post-migration.

### General — PASS
- typecheck/lint/build green; unit api 831 / web 811 / shared 509 pass (RLS + migration e2e among the 90 api-skipped → run in CI real-DB). /outreach/activity page.tsx is a Server Component (assertRole + redirect, SSR fetch, force-dynamic); `'use client'` confined to leaf components (List/Form/Panel). Controller RBAC-gated (SessionGuard + RolesGuard + fail-closed boot assertions). e2e run as `dealflow_app` via the REAL service/repository — not re-implemented SQL. No hollow tests.

---

## Phase-1 confirmation line
APPROVED — SF1-no-fallback + R1-own-row-re-home + R3-all-4-FK + R4-per-verb-audit + FOR-ALL-USING-only all landed with genuine real-DB / genuine-mock tests. One non-blocking advisory: stale OAE-4..8 header markers (coverage ships as unit OA-R3-1..5).

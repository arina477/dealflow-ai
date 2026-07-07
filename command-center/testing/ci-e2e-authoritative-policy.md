# CI E2E Authoritative Verification Policy — DealFlow AI Compliance & Isolation Invariants

**Status:** Canonical verification strategy for wave-21 (M9 process/DX hardening) and subsequent waves.

**Scope:** Compliance, isolation, RBAC, audit-logging, and separation-of-duties invariants that require proof under actual row-level security (RLS) enforcement.

---

## 1. Statement of Policy

For DealFlow AI's compliance and isolation invariants, the **authoritative verification** is the CI e2e test suite executed against a **real PostgreSQL database (postgres:18)** as the **non-superuser `dealflow_app` role** (migration 0016_dealflow_app_role.sql) **NOT** a live-authed in-app production check.

**Why this matters:** A superuser connection (e.g., `postgres` role) bypasses PostgreSQL's FORCE ROW LEVEL SECURITY, making all isolation tests vacuously true (assertions pass regardless of whether RLS actually works). The CI e2e suite run as `dealflow_app` (NOSUPERUSER NOBYPASSRLS) proves isolation and RBAC enforcement are real.

**Proof mechanism:** When tests connect via `SET ROLE dealflow_app`, PostgreSQL enforces the row filters and column masks defined in the RLS policies; any test that would pass under superuser but fail under `dealflow_app` detects that the policy is load-bearing.

---

## 2. Named Invariants → Authoritative Test Table

Each row names a compliance or isolation invariant, cites the specific CI e2e test file (and marker annotation where applicable) that proves it under dealflow_app, and confirms the test is falsifiable (a failing RLS policy, a missing guard, or an incorrect DEFAULT will cause the test to fail).

| Invariant | Category | Authoritative E2E Test | Proof Pattern |
|-----------|----------|----------------------|---------------|
| **Workspace-isolation READ negative-read** — firm-A row invisible to firm-B connection | Isolation | `apps/api/test/workspace-isolation.e2e-spec.ts` (ISO-1: cross-tenant negative read = 0) | Seed mandates in WS_A, query with app.workspace_id = WS_B_ID GUC, expect 0 rows. RLS deny-by-default confirmed. Falsa if: RLS policy missing, COALESCE fallback added to workspace_id predicate, or GUC unset (ISO-4 GUC-leak guard). |
| **Workspace-isolation WRITE-path own-row-re-home** — UPDATE to wrong workspace rejects 42501 | Isolation | `apps/api/test/outreach-activity-rls.e2e-spec.ts` (OAE-1: own-row re-home UPDATE write-check) | Seed firm-A outreach_activity, as dealflow_app with GUC=firm-A, UPDATE SET workspace_id=firm-B → SQLSTATE 42501 (permission denied). Falsa if: write-check RLS missing or DEFAULT_WORKSPACE_ID placed on workspace_id column. |
| **Workspace-isolation WRITE-path INSERT explicit-foreign** — INSERT with wrong workspace rejects 42501 | Isolation | `apps/api/test/outreach-activity-rls.e2e-spec.ts` (OAE-2: INSERT firm-B id rejection) | As dealflow_app, GUC=firm-A, INSERT with explicit firm-B workspace_id → SQLSTATE 42501. Falsa if: insert-check RLS missing or DEFAULT placement bypasses explicit value. |
| **Workspace-isolation default enforcement** — service.create() with empty ALS context rejects ForbiddenException | Isolation | `apps/api/test/outreach-activity-rls.e2e-spec.ts` (OAE-3: SF1 empty-ALS rejection) | OutreachActivityService.create() with dealflow_app and no ALS context (no GUC set) → ForbiddenException, row NOT in default workspace. Falsa if: SF filter removed or ALS guard removed from service. |
| **FORCE ROW LEVEL SECURITY confirmed** — relforcerowsecurity + relforcerowsecurity = true | Isolation | `apps/api/test/outreach-activity-rls.e2e-spec.ts` (OAE-14: FORCE confirmed) | Query pg_class for outreach_activity, assert relrowsecurity AND relforcerowsecurity are both true. Falsa if: RLS policy removed or FORCE keyword removed from CREATE POLICY. |
| **Workspace-isolation positive control** — workspace owner sees own rows | Isolation | `apps/api/test/workspace-isolation.e2e-spec.ts` (ISO-2: positive control) | Seed WS_A mandates, query with app.workspace_id = WS_A_ID GUC, expect seeded rows visible (> 0). Falsa if: RLS policy too restrictive or GUC mechanism broken. |
| **GUC leak guard** — RESET app.workspace_id returns 0 rows (fail-closed, no COALESCE-to-default) | Isolation | `apps/api/test/workspace-isolation.e2e-spec.ts` (ISO-4: GUC-leak guard) | After RESET app.workspace_id, query returns 0 rows. Confirms predicate evaluates workspace_id = current_setting('app.workspace_id', true)::uuid → workspace_id = NULL → no rows match. Falsa if: COALESCE added as fallback or predicate accepts NULL. |
| **Audit-logged mutation — last-in-txn + verifyChain ok** — create audit append + HMAC chain unbroken | Audit | `apps/api/test/outreach-activity-rls.e2e-spec.ts` (OAE-9: R4/SF5 create audit) | OutreachActivityService.create() appends exactly ONE 'outreach-activity-create' audit_log_entries row + verifyChain(entry) returns ok:true. Falsa if: audit not appended, verifyChain returns ok:false, or HMAC mutated. |
| **Audit-logged mutation — update audit append + verifyChain ok** | Audit | `apps/api/test/outreach-activity-rls.e2e-spec.ts` (OAE-10: R4/SF5 update audit) | OutreachActivityService.update() appends exactly ONE 'outreach-activity-update' entry + verifyChain ok:true. Falsa if: audit not appended or HMAC broken. |
| **Audit-logged mutation — status-transition audit append + verifyChain ok** | Audit | `apps/api/test/outreach-activity-rls.e2e-spec.ts` (OAE-11: R4/SF5 status-transition audit) | updateStatus() appends exactly ONE 'outreach-activity-status-transition' entry + verifyChain ok:true. Falsa if: audit not appended or HMAC broken. |
| **Audit-logged mutation — cancel audit append + verifyChain ok** | Audit | `apps/api/test/outreach-activity-rls.e2e-spec.ts` (OAE-12: R4/SF5 cancel audit) | cancel() appends exactly ONE 'outreach-activity-cancel' entry + verifyChain ok:true. Falsa if: audit not appended or HMAC broken. |
| **Audit rollback on append failure** — injected audit throw → business row NOT persisted | Audit | `apps/api/test/outreach-activity-rls.e2e-spec.ts` (OAE-13: R4/SF5 rollback) | Mock AuditService.append to throw mid-txn → business row (e.g., outreach_activity) NOT committed. Real db.transaction() ROLLBACK. Falsa if: transaction boundary missing or audit append not in business txn. |
| **Populated-DB migration WORM safety** — trigger-disable wrap prevents trigger-block on backfill UPDATE | Audit | `apps/api/test/audit-migration-populated-db.e2e-spec.ts` (AMP-2: trigger-disable wrap correct) | Replicate migration 0014 trigger-disable pattern against seeded audit rows → UPDATE workspace_id succeeds. Falsa if: trigger-disable removed or trigger still active post-ENABLE. |
| **Audit HMAC excludes non-hashable columns** — per-row recompute after workspace_id backfill | Audit | `apps/api/test/audit-migration-populated-db.e2e-spec.ts` (AMP-4: per-row HMAC recompute) | For each seeded audit row, computeEntryHash(HashableEntryFields, prevHash, key) == stored entry_hash after workspace_id UPDATE. Falsa if: workspace_id included in HashableEntryFields or HMAC mismatch. |
| **Populated-DB mutation guard re-enforces** — UPDATE on audit_log_entries without trigger-disable wrap raises P0001 | Audit | `apps/api/test/audit-migration-populated-db.e2e-spec.ts` (AMP-5: fault-killing) | Attempt UPDATE audit_log_entries WITHOUT trigger-disable → SQLSTATE P0001 (WORM trigger). Falsa if: trigger disabled and never re-enabled. |
| **RBAC 403 on non-allowed roles** — advisor + analyst roles return ForbiddenException | RBAC | `apps/api/src/modules/compliance/compliance.rbac.spec.ts` (advisor → DENY 403, analyst → DENY 403) | RolesGuard against ComplianceController.getSummary(@Roles() ['compliance', 'admin']) with advisor claim → ForbiddenException (403). Falsa if: @Roles() decorator removed, role check missing, or advisor in allowed list. |
| **RBAC 401 on unauthenticated** — anon request returns UnauthorizedException | RBAC | `apps/api/src/modules/compliance/compliance.rbac.spec.ts` (unauthenticated → 401) | Request without session → UnauthorizedException (401). Falsa if: guard skipped or session check removed. |
| **RBAC 403 on audit-log verify** — compliance + admin allowed, advisor + analyst denied | RBAC | `apps/api/src/modules/compliance/audit-log.rbac.spec.ts` (compliance → ALLOW, admin → ALLOW, advisor → DENY, analyst → DENY) | RolesGuard against AuditLogController.verify(@Roles() ['compliance', 'admin']). Falsa if: role guard missing or @Roles() metadata missing. |
| **RBAC DB-authoritative (not session claim)** — DB role DIFFERS from claim, DB role wins | RBAC | `apps/api/src/modules/compliance/compliance.rbac.spec.ts` (CRITICAL-1: DB-authoritative role) | Guard calls AuthRepository.resolveRoleRlsExempt (RLS-exempt path), NOT resolveRoleBySupertokensUserId (RLS-gated path). DB value decides. Falsa if: guard regresses to resolveRoleBySupertokensUserId or stale claim trusted. |
| **RBAC RLS-exempt path required pre-interceptor** — guard calls resolveRoleRlsExempt, never resolveRoleBySupertokensUserId | RBAC | `apps/api/src/modules/compliance/compliance.rbac.spec.ts` (CRITICAL-1b: fault-killing) | Guard must call RLS-exempt path because guard runs PRE-INTERCEPTOR (ALS empty, no GUC). Direct SELECT on users returns 0 under dealflow_app FORCE RLS. Test proves guard calls RLS-exempt by asserting failure if regressed. Falsa if: resolveRoleBySupertokensUserId called instead or mock not rejecting. |
| **Separation of Duties (SoD)** — where SoD invariant exists (cross-referential RBAC + audit trail) | SoD | Module-level *.rbac.spec.ts + audit e2e (OAE-* tests + pipeline-gate.e2e-spec.ts) | SoD is enforced by (1) RBAC guards blocking unauthorized state transitions, (2) audit trail immutability (WORM trigger), (3) verifyChain detecting tampering. Falsa if: any guard removed, audit not appended, or WORM trigger disabled. |
| **Analytics isolation via getDb ALS-path** — analytics counts firm-scoped (no all-tenant leak) | Isolation | `apps/api/test/analytics-isolation.e2e-spec.ts` (AMP-1: cross-firm negative read) | AnalyticsService.getSummary() via workspaceAls.run with GUC-bound Drizzle → counts firm-A only. Falsa if: getDb returns raw this.db instead of ALS-scoped handle, or RLS missing on analytics source tables. |
| **Analytics AMP-4 fault-killing** — no-ALS call yields DIFFERENT result (proves getDb is load-bearing) | Isolation | `apps/api/test/analytics-isolation.e2e-spec.ts` (AMP-4: fault-killing) | getSummary() WITHOUT workspaceAls.run (ALS empty, no GUC) → mandate total == 0 while ALS-scoped total > 0. If getDb regresses to raw this.db, both paths collide → assertion fails. Falsa if: both paths return same count or getDb path bypassed. |
| **Match-feedback isolation via getDb ALS-path** — calibration counts firm-scoped (no all-tenant leak) | Isolation | `apps/api/test/match-feedback-isolation.e2e-spec.ts` (MFC-1: cross-firm negative read) | MatchFeedbackService.getCalibration() via workspaceAls.run → totalDecided matches firm-A only. Falsa if: getDb returns raw this.db or RLS missing. |
| **Match-feedback MFC-4 fault-killing** — no-ALS call yields DIFFERENT totalDecided | Isolation | `apps/api/test/match-feedback-isolation.e2e-spec.ts` (MFC-4: fault-killing) | getCalibration() WITHOUT ALS (under superuser, no GUC) → totalDecided includes both firms. If getDb regresses, both paths collide. Falsa if: both paths return same count. |
| **Pipeline gate audit rollback (real txn)** — enroll audit throw → NO pipeline row committed | Audit | `apps/api/test/pipeline-gate.e2e-spec.ts` (test 1: enroll rollback) | PipelineService.enroll() with AuditService.append mock to throw inside real db.transaction() → NO pipeline row persisted. Real ROLLBACK. Falsa if: txn boundary missing or audit not inside txn. |
| **Pipeline gate audit rollback (event isolation)** — addNote audit throw → NO 'note' event row persisted | Audit | `apps/api/test/pipeline-gate.e2e-spec.ts` (test 2: addNote rollback) | addNote() with audit throw → NO pipeline_events 'note' row committed. Exactly-one-or-none invariant. Falsa if: event append not inside business txn. |

---

## 3. Live-Authed In-App Check Deferral Rationale

The **LIVE in-app authed check** (a real advisor/admin session hitting an endpoint with cross-firm data) is **DEFERRED** because two structural constraints prevent it:

### Constraint 1: Single-Tenant Production
DealFlow AI production is single-tenant (one firm per deployment). A live 2-workspace isolation test is **structurally impossible** — you cannot simultaneously log in as advisor in firm-A and firm-B to verify that firm-A's data is invisible to firm-B on the same live system. Cross-firm live testing requires a multi-tenant staging environment, which does not exist today.

### Constraint 2: No Committable Prod Credentials
Per CLAUDE.md rule 2 (rule: "Never commit `.env`, secrets, or credentials"):
- SuperTokens prod auth credentials **cannot** be committed to the repository.
- `project.yaml: test_users.local_dev[]` holds **labels + emails only**, not passwords or tokens.
- `command-center/testing/test-accounts.md` (the prod-fixture registry) is **gitignored** and holds no data until manually populated via a secret-free mechanism (which does not exist today).

**Result:** There are no committable prod/staging auth fixtures. A live-authed check against production requires real SuperTokens credentials that cannot be stored in the codebase, making it unsuitable as a continuous integration check.

### Deferred Until: Later-Trigger Conditions

When **EITHER** of these conditions becomes true, add live-authed checks:

1. **A 2nd prod/staging tenant exists** (multi-tenant deployment) + test account provisioning automation is in place.
2. **A committable non-destructive advisor + admin fixture** is available (e.g., test-accounts.md registry safely populated via a secret-free mechanism like a managed secret service or API key-scoped read-only role).

Until a trigger fires: **"Live-authed check deferred — CI-authoritative"** is the sanctioned V/T (Verification & Testing phase) disposition. Record it in the V/T review artifact with a reference to this policy section; **do NOT re-derive the rationale in every wave**.

---

## 4. Close of B/D/E (Build / Design / Execution) Spec-Authoring Guarantees

Per `command-center/principles/PRODUCT-PRINCIPLES.md` (§ Rule #1):

> A spec metric shown to users must have a real source column, not be noise by construction, and qualify low-n cases.

This document **does not** re-author or duplicate that rule. Instead:

**B/D/E compliance is ALREADY CAPTURED + ENFORCED by PRODUCT-PRINCIPLES #1.**

- **Real source column:** Every cited test proves its invariant against a real table column (e.g., workspace_id, role, audit_log_entries.entry_hash). No synthetic metrics.
- **Not noise by construction:** RLS policies, RBAC guards, and audit HMACs are user-facing (determine who sees what, whether mutations are logged, whether tampering is detected). Not noise.
- **Qualify low-n cases:** The invariant→test table above includes edge-case tests (ISO-4 GUC-leak guard, AMP-4/MFC-4 fault-killing, OAE-13 rollback) that catch regressions in corner cases, not just happy-path counts.

**Consequence:** Verification & Testing (V-block) does not re-check B/D/E on every wave. It relies on this policy's invariant→test mapping as the canonical falsifiability proof.

---

## 5. How V/T Uses This Policy

### At V-1 (Verification plan authoring)
Read this policy. Confirm the wave touched isolation / RBAC / audit. Map the new task to the invariant→test table (does it extend an existing invariant or add a new one?). If NEW invariant, ensure a new CI e2e test is **authored in B-2** before V gates the module.

### At V-2 (Verification against CI results)
Confirm the CI e2e suite passed against real Postgres as dealflow_app. Verify each invariant's test fired (grep the e2e output for test markers like OAE-1, ISO-4, AMP-4). Do NOT run a separate live-authed check in prod unless the later-trigger (§ 3) has fired.

### At V-3 (Prod gate hand-off)
If the wave touches isolation / RBAC / audit AND a later-trigger becomes true (§ 3), author the live-authed check as a NEW TASK in the next wave; do not block the current wave on it.

---

## 6. Enforcement & Versioning

This policy is effective as of **wave-21** (2026-07-07). It governs all subsequent waves touching compliance, isolation, RBAC, audit, or SoD.

**Modifications to this policy:**
- New invariants: append to the table in § 2 (include falsifiability proof).
- Deprecations: mark as "(deprecated)" and explain the later mechanism.
- Test refactors: keep the invariant row but update the cited test file path + marker.

**Append-only:** Do NOT edit or reorder existing invariant rows; append only. Existing V/T reviews cite invariant rows by position; reordering breaks those references.

---

## References

- Migration 0016: `/home/claudomat/project/apps/api/src/db/migrations/0016_dealflow_app_role.sql` (dealflow_app role creation + grants)
- CI e2e suite: `/home/claudomat/project/apps/api/test/*.e2e-spec.ts` (isolation, audit, rollback proofs)
- RBAC specs: `/home/claudomat/project/apps/api/src/modules/compliance/*.rbac.spec.ts` (role guards)
- PRODUCT-PRINCIPLES: `/home/claudomat/project/command-center/principles/PRODUCT-PRINCIPLES.md` § Rule #1 (spec metric honesty)
- Test-Writing Principles: `/home/claudomat/project/command-center/testing/test-writing-principles.md` § 14 (prod fixture registry)

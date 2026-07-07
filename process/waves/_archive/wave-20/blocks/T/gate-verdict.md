# Wave 20 — T-9 Verdict

**Reviewer:** head-tester (fresh spawn, T-9 Phase 1 gate)
**Reviewed against:** process/waves/wave-20/blocks/T/review-artifacts.md + findings-aggregate.md
**Attempt:** 1  (first gate)
**Wave:** M9 outreach-activity tracker — FIRST MUTABLE M9 WRITE SURFACE. Write-path isolation + audit-integrity are the hard invariants. LIVE @86ddc29.

## Verdict
APPROVED

## Rationale

The two load-bearing invariants for the first mutable M9 write surface — write-path tenant isolation and audit-chain integrity — are proven NON-HOLLOW, non-vacuous, and non-skipped by tests that ran against a real containerized Postgres AS `dealflow_app` (non-superuser) via the REAL service/repository, NOT re-implemented SQL. I independently confirmed CI run 28841757352 (`conclusion:success`, `event:push`, `headSha:86ddc29fa974…`) matches the deployed tip exactly, and inspected the raw `--log` output: `outreach-activity-rls.e2e-spec.ts (9 tests)` and `outreach-activity-migration.e2e-spec.ts (12 tests)` both executed with non-zero counts and green results — no `.skip`/`todo`, the only "skipped" log hits are pnpm lockfile-resolution and lint suggested-fixes. This clears the CI-Blindness and Silently-Skipped-E2E heuristics: I gated on what the suite provably executed, not on an `exit 0` badge. The write-path isolation is genuine on every sub-claim (R1-non-vacuous own-row-re-home→42501, SF1-no-DEFAULT_WORKSPACE_ID-leak via empty-ALS reject asserting unchanged default-workspace row count, R2-FORCE relforcerowsecurity positive control, R3 all-4-FK tenancy + server-derived createdBy). Audit-integrity is proven per-verb last-in-txn with a real rollback-on-audit-fail test and verifyChain ok. The C-1 fix-forward #2 was a GENUINE bug-catch — the write-surface e2e exercised the per-workspace first-audit path, surfacing a real multi-tenant defect (RLS-filtered readTail → empty tail → genesis seq=1 23505 collision) that would have fired in prod under `dealflow_app`; the fix (readTail → RLS-exempt global tail) is sound because the HMAC chain is global and first-per-workspace writes MUST see the global tail. Additive migration 0018 is populated-safe (OAM-2 GAP-4 + OAM-3 SF6 verifyChain-post). No coverage theater, no tautological assertions (assertions check 42501 SQLSTATE, thrown exceptions, row-count deltas, chain state — not merely that a mock was invoked), no hollow layout-only PASS, no untested compliance invariant. The two P2 findings are genuine data-hygiene/cosmetic debt with zero isolation/security/audit impact; the live authed create/list deferral is consistent with the wave-18/19 precedent and the CI e2e as `dealflow_app` is authoritative. APPROVED.

## Security-invariant test map — adjudication

### 1. Write-path isolation (the crux) — NON-HOLLOW ✅
- **R1 own-row-re-home (NON-vacuous):** OAE-1/OAM-5 seed firm-A's OWN visible row (GUC=firm-A), then as `dealflow_app` `UPDATE … SET workspace_id=firm-B` → asserts SQLSTATE `42501`. This is the real derived-WITH-CHECK test, not the vacuous "UPDATE firm-B id on an already-invisible row." OAE-2/OAM-4 cover explicit-firm-B INSERT under firm-A GUC → 42501 (SQL trace `OAE-2 INSERT explicit WS_B` visible in CI log).
- **SF1 no-DEFAULT_WORKSPACE_ID-leak:** OAE-3 runs the REAL `svc.create()` with NO `workspaceAls.run` wrapper (ALS undefined → `getWorkspaceId()`=null), asserts it throws AND the default-workspace row count is UNCHANGED — no silent placement. Three-layer fail-closed (service throw / repo NULLIF-GUC expression / column DEFAULT+NOT NULL).
- **R2 FORCE positive-control:** OAE-14 asserts `relrowsecurity` AND `relforcerowsecurity` = true (as `dealflow_app`).
- **Genuine, not re-implemented SQL:** executes the real service via `workspaceAls.run(dealflow_app)` on postgres:18; B-6 code read confirms the service/repository path, not test-local SQL. 9/9 RAN @86ddc29, non-skipped.
**→ Write-path isolation proven NON-HOLLOW.**

### 2. Audit-integrity (R4/SF5) — PROVEN ✅
OAE-9..12: each verb (create/update/updateStatus/cancel) appends to the M2 HMAC chain as the LAST statement in `runInTransaction`, asserts exactly +1 entry, correct per-verb `action`, and `verifyChain().ok===true` against the real AuditService/AuditVerifier. OAE-13 injects a throwing audit mock → asserts the business row is ABSENT (audit-failure-rolls-back-business-row holds). **→ Audit-logged-mutation invariant proven.**

### 3. C-1 fix-forward #2 (the real bug) — GENUINE catch, SOUND fix ✅
Defect: audit `readTail` was RLS-filtered under `dealflow_app` → the first audit write per workspace saw an empty tail → genesis seq=1 → 23505 dup-key collision. This is a REAL multi-tenant audit-chain defect that would have fired in prod. It was surfaced BY the write-surface e2e (the new mutable surface exercised the per-workspace first-audit path — exactly the value of testing a new write surface), then fixed to `read_audit_chain_rls_exempt` (RLS-exempt global tail). Fix is sound: the HMAC chain is a single global sequence, so first-per-workspace writes MUST read the global tail, not a workspace-filtered (empty) one. **Load-bearing for M11 multi-tenant — flagged for L-2 (already logged as finding #4 → L-2 observation candidate).**

### 4. Migration safety (GAP-4) — RAN non-skipped ✅
`outreach-activity-migration.e2e-spec.ts (12 tests)` green: OAM-2 populated-DB apply (no WORM collision), OAM-3 SF6 verifyChain-post-0018. C-2 confirms 0018 applied to prod as the pre-serve release step ([✓] migrations applied successfully!).

### 5. RBAC + credential-free — ADEQUATE ✅
advisor/admin 200 vs 403 (contract + unit RBAC) + anon 401 live (C-2: `/outreach-activity` → 401 fail-closed, mounted not 404/500; `/compliance/audit-log/verify` → 401 not 500 = chain intact). Channel = pure labels; zero external send/dispatch/webhook/queue, no ESP/LLM SDK import, secret-grep clean. Credential-free confirmed.

## Findings + deferral adjudication
- **2× P2 (B-6 accepted):** stale `completedAt` on completed→planned/cancelled (data hygiene, workspace-scoped, no cross-firm impact) + unknown `?status=` silently ignored not 400 (cosmetic, still workspace-scoped). Both are genuine debt with NO isolation/security/audit consequence — **acceptable as debt**, carried to V-2.
- **Live authed create/list DEFERRED (no prod advisor fixtures):** the CI outreach-activity-rls/migration e2e AS `dealflow_app` on real Postgres is the authoritative isolation+audit+RBAC proof. Consistent with wave-18/19 precedent. **Acceptable.**

## Heuristics applied (all clear)
- Coverage Theater — CLEAR: assertions check 42501 SQLSTATE, thrown exceptions, row-count deltas, verifyChain state.
- Tautological/Over-mocking — CLEAR: real service + real DB as dealflow_app; mocks limited to the audit-throw injection (OAE-13) which is a fault-injection control, not a business-logic mock.
- Hollow / Layout-only false-PASS — CLEAR: T-6 web tests assert form/list/transition/RBAC behavior; write-path proof is at the integration layer, not the DOM.
- Untested write-path / audit invariant — CLEAR: both crux invariants have real adversarial tests.
- Silently-skipped E2E / CI-Blindness — CLEAR: raw CI log audited; 9+12 crux tests executed with non-zero counts, no `.skip`; run SHA matches deployed tip.
- Shared-state contamination — CLEAR: OAE/OAM use unique workspace UUIDs (OAE_WS_A/B) per suite.

## Rework instructions
N/A — APPROVED.

## Escalation
N/A — APPROVED.

## Footer
- verdict_complete: true
- rework_attempt_cap_remaining: 3

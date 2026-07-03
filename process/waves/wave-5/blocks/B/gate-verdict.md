# Wave 5 — B-6 Verdict

**Reviewer:** head-builder (fresh spawn, agentId head-builder-w5-b6-p1)
**Reviewed against:** process/waves/wave-5/blocks/B/review-artifacts.md
**Attempt:** 1  (1 = first gate)

## Verdict
APPROVED

## Rationale

The wave-5 compliance-enforcement layer is sound in CODE, not merely claimed, on every load-bearing invariant, and it matches the frozen spec plus the P-4 SoD=compliance-only remediation addendum. I verified each invariant against the implementation and its tests rather than the deliverable prose:

**1. Non-bypassability — PASS.** `ComplianceGateService.evaluate(ctx, tx)` has a two-parameter signature with NO skip/dryRun/subset param (asserted by a test on `evaluate.length === 2`). The four evaluators are a `private readonly` constant array run unconditionally in a fixed `for` loop every call; they have no independent DI entry point (only invoked, all four, from `evaluate()`), making non-bypassability structural rather than conventional. The verdict is written via `AuditService.append(_, tx)` in the SAME caller tx BEFORE `return` — and the append-throws path is tested to reject with no verdict returned (tx rollback), on both `evaluate()` and `evaluateStandalone()`. "All evaluators ran" is verified non-hollowly by asserting repo read-counts (suppression 1, disclaimer 1, approval 2 — SoD + content-hash each read it), not just that a spy was called. The M6 send-path dependency is honestly tracked as out-of-scope ("callable enforced contract this wave; live non-bypass at the M6 send endpoint") and is NOT over-claimed as a live send path.

**2. SoD = compliance ONLY (CRITICAL) — PASS.** `sod.evaluator.ts` defines `SOD_APPROVER_ROLE = 'compliance'` (single literal, not a `{compliance,admin}` set) and blocks with `invalid-approver-role` unless `approval.approverRole === SOD_APPROVER_ROLE` exactly. Admin is genuinely excluded — the test matrix asserts `approver=admin → allowed:false / reason invalid-approver-role` ("no super-role shortcut"), plus advisor and analyst. Self-approval is blocked (`approverUserId === senderUserId → sender-is-approver`), no-row blocks (`no-approval`), and revoked blocks (`approval-revoked`). Critically, approver identity is read server-side from the STORED `compliance_approvals` row via `repo.loadApproval(tx, ...)` — never from `ctx` (ctx carries only sender identity). The mutable-config-vs-SoD distinction is preserved: CRUD `@Roles('compliance','admin')` lets admin MANAGE config, while admin may NOT APPROVE outreach — exactly the P-4 finding-1 resolution.

**3. Content-hash binding — PASS.** `computeContentHash` is a keyless SHA-256 over canonicalized content (CRLF/CR→LF, single trailing-newline strip, trim; interior whitespace preserved so meaningful edits cannot slip past). `content-hash.evaluator.ts` RECOMPUTES from `ctx.content` server-side and compares to the STORED `approval.contentHash` — it does NOT trust `ctx.contentHash`. Post-approval edit → mismatch → `content-hash-mismatch` block is tested; matching content passes. Correctly guarded to only bind against an `approved` row (SoD owns the no-approval/revoked cases), avoiding redundant/misleading mismatches.

**4. Suppression + Disclaimers — PASS.** Suppression is a HARD block (exact case-insensitive email OR dot-boundary domain-suffix; `xblocked.com` correctly does NOT match `blocked.com`), one BlockReason per matched recipient. Disclaimers are ENFORCED not advisory: missing required disclaimer yields both a `missing-disclaimer` block AND a `requiredDisclaimers[]` entry, so `allowed` stays false; the active-template resolution (highest active version) re-blocks stale-version content on template bump.

**5. CRUD audit-in-tx + versioning + RBAC — PASS.** Rules/suppression/disclaimers services wrap every mutation in `db.transaction` with `AuditService.append(_, tx)` inside; audit-append-fail → mutation rollback is tested for rules and disclaimers. Disclaimer edit is append-style (new version+1, deactivate priors in-tx, history preserved) — tested. Actor id/role are sourced from the server-verified SuperTokens session, never the client body. All controllers carry `@UseGuards(SessionGuard, RolesGuard)` + `@Roles(...ROLES)` from the shared `roleRoutes` single source; advisor/analyst → 403 (ForbiddenException) and anon → 401 are tested per resource.

**6. Mutable-config-vs-immutable-audit — PASS.** Migration 0003 creates the 4 config tables with NO immutability trigger, NO REVOKE/GRANT restriction, NO TRUNCATE guard (correctly distinct from `audit_log_entries`); the schema comment documents this deliberately. Additive-only — no existing table altered. Native constraints present: NOT NULL on all load-bearing columns, FKs to users with `ON DELETE SET NULL` (retains records when approver/creator deleted, role snapshot preserved), covering indexes on all three gate read paths.

**7. Honest scope — PASS.** The gate is presented as a callable enforced contract; the live send path (M6) is tracked as a dependency, not claimed live. B-5 honestly defers runtime/dev-smoke to C-2 (needs live postgres + migration 0003 applied + wave-4 audit) — migration-not-live-applied is stated, not hidden.

**8. Test discipline — PASS (not hollow).** The 567 tests carry semantic weight: the SoD matrix asserts allowed:false + specific machine-stable sub-reason codes; non-bypass asserts read-counts + audit action + same-tx handle; rollback asserts rejection with no verdict; content-hash asserts the mismatch case; CRUD asserts new-version rows + audit-in-tx + per-role 403. Shared Zod schemas use `.strict()` and `z.infer` for end-to-end parity. Not coverage theater.

**Phase-1-note (not blocking):** Commit `26f13a7` cites 3 task_ids and `f998822` cites 2 in a single commit each. This is a candidate Action-6 commit-discipline finding (single commit citing multiple task_ids), to be evaluated in Phase 2 / Action 6 per the B-6 stage file. It concerns commit hygiene, NOT the spec-contract or any compliance invariant, and does not invalidate this Phase-1 verdict. The orchestrator should resolve it at Action 6 (rebase-split or accept-with-rationale given the three block-2/3 evaluators were co-authored into one cohesive gate commit).

## Footer
- verdict_complete: true
- rework_attempt_cap_remaining: 3

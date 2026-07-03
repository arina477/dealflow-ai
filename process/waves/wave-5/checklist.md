## Wave 5 stage completion

**Wave:** 5
**Active milestone:** M2 — Compliance backbone: tamper-evident audit log + rules engine (`2f116b9b-0338-421d-a9ad-899a11403aff`, in_progress)
**Seed task:** 0595a835-db62-4685-b451-1cd6c06416bf — Build compliance rules engine schema + non-bypassable pre-send compliance gate service
**Bundled siblings:** 95adac6c-25cb-4c67-bd78-a401477143ad (suppression-list + approval-SoD checks inside the pre-send gate), 034463b1-7abb-4417-8e34-7f6184a0c8db (jurisdiction disclaimers + approval-version binding in the gate), 34cb1d18-9bff-4302-8f7e-c508ac5fef99 (wire compliance-settings screen to manage rules/suppression/disclaimers)
**claimed_task_ids (B-0 claims this list):** [0595a835-db62-4685-b451-1cd6c06416bf, 95adac6c-25cb-4c67-bd78-a401477143ad, 034463b1-7abb-4417-8e34-7f6184a0c8db, 34cb1d18-9bff-4302-8f7e-c508ac5fef99]
**Slice:** M2 second vertical slice — the compliance rules engine + the single non-bypassable callable pre-send compliance gate. DB: 4 rules-engine tables (`compliance_rules`, `suppression_list`, `disclaimer_templates` jurisdiction-keyed, `compliance_approvals`). Service: `ComplianceGateService.evaluate()` as the SOLE send-eligibility authority — it MUST write every pass/block verdict to the audit log via the shipped `AuditService.append` (a8b2b5a2) in-transaction; non-bypassability is an acceptance criterion (no send path may skip gate + log). Suppression re-check + SoD (sender≠approver, approver-is-compliance via M1 RolesGuard) + per-jurisdiction disclaimer enforcement + approval-version content-hash binding (post-approval edits re-block). Config UI: wire the existing compliance-settings screen shell (031d79fc) to CRUD rules/suppression/disclaimers, every change audited. Closes M2 success metric: "suppression/disclaimer/approval rules are configurable and enforced by a callable pre-send check used by outreach (M6)." Vertical slice (DB + service + UI). UI wave (compliance-settings CRUD) → D-block runs unless P-1 finds mockups exist. Anchored to architecture/security.md §"Outreach compliance controls" + §"Audit-log security" + §RBAC-SoD.
**Note (from N-1/N-3):** SECURITY-SCOPE — compliance-critical + non-bypassable gate (auth/RBAC/SoD + audit-log write path) → mandatory T-8 Security + **P-4 security-scope-tightened + SoD/RBAC gate**. The gate service is the choke point re-run at send time; acceptance criteria demand non-bypassability. Depends on the audit-log append service shipped LIVE wave 4 (cd06e8a) — no ghost dependency. 3 M1 non-core follow-ups remain claimable backlog under M2 (do NOT block this bundle): bfadcec1 (test-fixture typing, low), 6fe232e3 (auth-hardening, medium), d7f716b4 (AppShell placeholder pages, low). P-0 must walk the unassigned queue (depth 1). Wave-5 waves row is opened by P-0 Action 0a (INSERT).

PRODUCT:
- [x] P-0 Frame (discover + reframe) — PROCEED (problem-framer + ceo-reviewer PROCEED; carry: no-skippable-fast-path + M6 non-bypass dependency; mvp-thinner n/a)
- [x] P-1 Decompose — PROCEED, multi-spec (4 tasks, ~3500 LOC), design_gap false (compliance-settings.html → D skips)
- [x] P-2 Spec — multi-spec enforcement contract in seed 0595a835 (4 blocks); non-bypass+SoD+content-hash+audit invariants; security-scope flagged
- [x] P-3 Plan — 5 deltas, ~24 steps, no new SDK, additive 0003 (architect-reviewer)
- [x] P-4 Gate — PASSED (head-product APPROVED; karen+jenny APPROVE after SoD-approver=compliance-only remediation; Gemini 429; security-scope 2-iter)

DESIGN (skip block if non-UI wave):
- [ ] D-1 Brief
- [ ] D-2 Variants (with bounded iteration)
- [ ] D-3 Review & adopt

BUILD:
- [x] B-0 Branch & schema — branch wave-5-compliance-gate; no new deps; schema=YES(0003@B-2); 4 tasks claimed
- [x] B-1 Contracts — GateVerdict/BlockReason + rules Zod + roleRoutes CRUD/nav (f998822); 275 tests; SoD-distinction documented
- [x] B-2 Backend — migration 0003 + non-bypassable gate (SoD=compliance-only PROVEN) + audited CRUD (64f0b60,26f13a7,c390359); 158 tests
- [x] B-3 Frontend — compliance-settings CRUD UI at /compliance/settings (3 sections); 134 tests (c7924bc)
- [x] B-4 Wiring — repo typecheck+build PASS; /compliance/settings compiles
- [x] B-5 Verify — lint 0-err, 567 tests pass, build pass; SoD-compliance-only test present; runtime→C-2
- [x] B-6 Review — head-builder APPROVED; /review 3 CRIT fixed (SoD-null-approver + disclaimer-race + ctx-validation); commit-discipline PASS

CI/CD:
- [x] C-1 PR, CI & merge — a58b699 merged (CI 28683534918 5/5 green); then B-2 FK fix re-merged as **ce97423** (CI 5/5 green per re-run brief); SHA provenance CI==deployed==HEAD on ce97423, no SKIPPED
- [x] C-2 Deploy & verify — **PASS (re-run @ ce97423) → PROCEED_TO_T** (head-ci-cd APPROVED). ce97423 (actor-id-space FK fix) deployed both services SUCCESS, boots clean (ComplianceModule injects AuthRepository, no UnknownDependenciesException), /health version==ce97423 on deployment's own URL. LIVE verified via web-origin proxy + anti-csrf + one-off evaluateStandalone: (A) CRUD writes 201 not 500 (compliance+admin), 403 advisor/analyst, 401 unauth, createdBy=FK-safe users.id; (B) config mutation AUDITED in-tx (audit-log verify entriesChecked 9→11, chain ok:true); (C) disclaimer versioning 2-rows-1-active (v1→inactive, v2 active); (D) SoD wedge invariant LIVE — compliance-approver ALLOWED, **ADMIN-approver BLOCKED (invalid-approver-role)**, self-approval blocked, edited-content blocked (content-hash), suppressed blocked, each verdict audited (gate-evaluate 0→5); (E) settings UI create 201; (F) regression clean, wave-4 audit hash-chain intact (verify ok:true entriesChecked 19). Canary skipped (0 DAU). Rollback armed (a58b699) not triggered. Temp DB proxy deleted, 0 remain, no secrets logged. Prior a58b699 C-2 FAIL correctly caught the FK defect → B-2 fix → this re-run PASS. Early direct-to-api 401-on-POST was a CSRF harness gap (SuperTokens antiCsrf VIA_TOKEN), root-caused, not a defect.

TEST:
- [x] T-1 Static
- [x] T-2 Unit
- [x] T-3 Contract
- [x] T-4 Integration
- [x] T-5 E2E — real-browser create PASS after CSRF fix (33/33 waves 2-5); settings CRUD works in-browser; Chrome
- [x] T-6 Layout — settings 3-section visual §compliance-settings conformant (TopBar-title→polish task)
- [x] T-7 Perf
- [x] T-8 Security
- [x] T-9 Journey — head-tester APPROVED; journey regen (rules engine + pre-send gate LIVE)

VERIFY:
- [x] V-1 Independent reviews (Karen + jenny, parallel) — Karen + jenny both APPROVE (compliance gate LIVE, 0 drift/gap)
- [x] V-2 Triage — 0 blocking; 2 low deferred/tracked
- [x] V-3 Fast-fix loop (or close) — head-verifier APPROVED; fast-fix skipped (0 blocking)

LEARN:
- [ ] L-1 Docs
- [ ] L-2 Distill

NEXT:
- [ ] N-1 Survey & triggers
- [ ] N-2 Seed
- [ ] N-3 Handoff

# Wave 11 — B-6 Verdict

**Reviewer:** head-builder (fresh spawn, agentId head-builder-w11-b6-attempt1)
**Reviewed against:** process/waves/wave-11/blocks/B/review-artifacts.md
**Attempt:** 1  (1 = first gate, 2+ = post-rework)

## Verdict
APPROVED

## Rationale

The most compliance-critical wave since M2 clears every load-bearing invariant in code, not merely in prose. **(1) Non-bypassable gate — PROVEN, not asserted.** `OutreachService.composeAsActor` (outreach.service.ts:264) has exactly ONE assignment of `status='send_eligible'`, and it is derived solely from `verdict.allowed` where `verdict = await this.complianceGateService.evaluate(gateContext, tx)` (line 261). The reused M2 `ComplianceGateService.evaluate` is the genuine authority: no skip/dryRun param, `gateContextSchema.parse(ctx)` fail-closed as the first statement, all four evaluators run unconditionally over a private constant array, and a mandatory `audit.append` runs in-tx BEFORE returning (throws → tx rolls back, no verdict without audit). The pre-checks (version-binding, SoD, approver-null) short-circuit to a synthetic `blocked` verdict WITHOUT calling evaluate — this is the karen-note #3 "pre-checks around evaluate" pattern, explicitly viable, and it CANNOT reach `send_eligible` because that status is unreachable except through the evaluate() branch. The structural test suite (outreach.spec.ts tests 18–25) pins this: tests 18/19/20 assert `gate.evaluate` NOT called on each block path with `status==='blocked'`; test 21 asserts `toHaveBeenCalledOnce()` when pre-checks pass; test 24 explicitly proves "no bypass path: send_eligible cannot be set without a passing evaluate verdict." These are real assertions constructing real block conditions, not coverage theater. **(2) Version-binding** — `isUsableForSend` (template.service.ts:73) returns true IFF `approvalStatus==='approved' AND approvedContentHash!==null AND approvedContentHash===contentHash`; `draftNewVersion` always mints a new version (never mutates approved) with fresh `contentHash` and null `approvedContentHash`; `grantApproval` snapshots `approvedContentHash=version.contentHash`. Editing an approved template → new pending version NOT usable-for-send, and the gate calls `isUsableForSend`. **(3) SoD** — server-side, dual-enforced: `@Roles(OUTREACH_TEMPLATES_APPROVE_ROLES)` (compliance-only) on the controller plus a defensive `roleName!=='compliance' → 403` in ApprovalService; composer-≠-approver enforced in composeAsActor (block on `version.approvedBy===appUserId`), audited; fail-closed on null approver. Tested (403 advisor, same-user block). **(4) Required-compliance-block** — `requestApproval` validates the M2 `disclaimer_templates` FK → 400 if missing; reuses M2 store (no new disclaimer table). **(5) AC-STRIP** — grep of the shipped composer/templates .tsx returns the forbidden phrases only inside doc-comments ("NO Send Immediate…") and negative-assertion tests (`.not.toContain(...)`); no live Send/Schedule/AI-draft CTA. The compose CTA surfaces "Send-eligible record created" + "No email has been sent" — honest provenance per CODE-OF-CONDUCT. **(6) Boundary** — no Anthropic/LLM/BullMQ and no transactional-email SDK import or dependency (only `supertokens-node/recipe/session` matches the 'ses' grep). **(7) Integrity** — one-txn + audit-last-in-txn on every mutation, actor via `getUserWithRole` (app users.id), tx-scoped reads, migration 0010 additive-only with distinct enum `outreach_approval_status`, `.down.sql`, journal idx 10 `when:1783555200000` (>0009). **(8) Web** — 3 SSR-hydrated pages, mutations via non-page-colliding `/outreach-data` + `/outreach-templates-data` proxies (most-specific-first ordering). **(9) RBAC** — advisor/analyst draft, compliance-only approve, advisor compose + SoD; nav⊆RBAC holds. One accepted deviation is logged below (does not block the gate).

## Accepted deviations (non-blocking; for orchestrator Action 6 disposition)

- **Commit granularity (multi-spec):** the primary backend feat commit `89db2b7` cites all three task_ids together (`Refs: 102a2f00 e90a4a99 2601ba33`) rather than one commit per task_id; `c35fbf7` cites 102a2f00 only. Every claimed task_id has coverage (102a2f00×3, e90a4a99×2, 2601ba33×2), so the "task_id with no commit" REWORK trigger does NOT fire. The three specs form a single vertical compliance slice — the SoD `approved_by` check, the `isUsableForSend` version-binding pre-check, and the `evaluate()` gate call are inseparable within `composeAsActor` and cannot be cleanly file-split. Documented as accepted-debt rather than forced `git rebase -i` split; no compliance invariant is threatened. Orchestrator may record this in the deliverable's `deviations_logged`.

## Footer
- verdict_complete: true
- rework_attempt_cap_remaining: 2

---

# Wave 11 — B-6 Verdict (Phase 2 — /review code-reviewer)
**Reviewer:** code-reviewer (B-6 Phase 2, layered on head-builder Phase-1 APPROVED)
**Reviewed against:** git diff main..wave-11-outreach-foundation (41 files)
**Attempt:** 1
## Verdict
REWORK
Phase-1 (in-service structural) was correct but BLIND to cross-module integration contracts (unit tests mock the gate + response shapes). 3 CRITICAL integration defects:
- **C-1 (compliance-critical):** M2 ComplianceGateService.evaluate resolves approval EXCLUSIVELY from M2 compliance_approvals (loadApproval). Wave-11 approval writes ONLY to outreach_template_versions.{approval_status,approved_content_hash,approved_by} — NEVER inserts a compliance_approvals row → loadApproval null → sodEvaluator 'no-approval' → verdict.allowed=false → status ALWAYS 'blocked'. send_eligible UNREACHABLE in prod. Fix: ApprovalService.grantApproval/reject/draftNewVersion write/revoke a compliance_approvals row for ('outreach-template-version', versionId) in-tx (reviewer option a — preserves single-gate-authority) + un-mocked integration test (real gate → send_eligible).
- **C-2:** 3 pages parse GET /outreach-templates expecting embedded versions; listTemplates returns container rows w/o versions → safeParse fails-closed → empty compliance-queue/templates/composer-picker. Fix: embed versions server-side in listTemplates (makes web parse correct, no web edit).
- **C-3:** composer parses shortlist {candidates}; GET /matches/:id/shortlist returns {run,accepted} → zero recipients. Fix: parse {accepted:[...]}.
MEDIUM: M-1 (pass stored version.contentHash not recompute), M-2 (updateVersionApproval no state-guard → approve-after-reject race; WHERE approval_status='pending' + ConflictException), M-3 (composer loads firm-wide candidates ignoring mandate). LOW: L-1 (distinct version-binding block code vs 'no-approval'), L-3 (no tenant scoping on list reads — FOUNDER/architecture tenancy-model question, out of scope this wave).
Clean (verified): SQL/injection, in-service gate discipline (single send_eligible assignment gated on verdict.allowed), SoD/actor-id/fail-closed/audit-last-in-txn, tx-scoping, migration 0010, AC-STRIP/provenance, RBAC.
## Footer
```yaml
verdict_complete: true
verdict: REWORK
rework_attempt_cap_remaining: 2
criticals: [C-1-gate-reads-compliance_approvals-not-outreach-version, C-2-listTemplates-no-versions, C-3-shortlist-accepted-shape]
routed: [backend-developer (C-1+C-2+M-1+M-2+L-1+integration-test), nextjs-developer (C-3+M-3)]
```

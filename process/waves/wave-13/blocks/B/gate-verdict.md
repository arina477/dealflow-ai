# Wave 13 — B-6 Verdict

**Reviewer:** head-builder (fresh spawn, agentId head-builder-w13-b6)
**Reviewed against:** process/waves/wave-13/blocks/B/review-artifacts.md
**Attempt:** 1

## Verdict
APPROVED

## Rationale
All load-bearing compliance invariants of the M6 recordkeeping-export vertical hold in code and are covered by real (non-hollow) assertions. (1) READ-ONLY: `listAsActor` and `verifyChainAsActor` contain no `AuditService.append` call on any path; three explicit tests assert `append` is never called for compliance/admin/advisor reads and for verify. (2) MANDATE DERIVATION (the P-4 karen fix): `RecordkeepingRepository.buildConditions` resolves a mandate's rows via the full per-`resource_type` OR fragment — `mandate` direct, `outreach`/`pipeline`/`match_run`/`buyer_universe` via their `mandate_id` FK subselects, and `pipeline_event`/`match_candidate`/`buyer_universe_candidate` via two-hop joins — capturing ALL producers' rows, not a naive `resource_id=mandateId`; the service forwards `mandateId` to the repo (asserted). (3) EXPORT ATOMICITY: `exportAsActor` opens ONE tx, reads in-scope entries tx-scoped (BUILD rule 7), and appends EXACTLY ONE `export_generated` row LAST-IN-TXN via the M2 `AuditService.append`; rollback-on-audit-fail is tested (append throw → error propagates, no package), and the exactly-one-row assertion holds even for the zero-entry scope; actor is the `getUserWithRole` app `users.id`, not the raw ST id (asserted); `verifyChain` runs full-chain outside the write tx (stateless, deterministic modulo `generatedAt`/actor over an append-only immutable chain). (4) ADVISOR: export is double-gated — RolesGuard excludes advisor (`EXPORT_ROLES` from shared `roleRoutes` = compliance+admin) AND the service throws `ForbiddenException` (`EXPORT_ALLOWED_ROLES`); advisor read is server-scoped to own-outreach in `buildConditions`; the web `ExportPanel` returns null for advisor/analyst. Tested at guard + service level. (5) `verifyChainAsActor` delegates to the REAL injected `AuditVerifier` (no fork) and returns the real `{ok,entriesChecked,firstBreakAt?,reason?}`; `auditVerifyResponseSchema` is re-exported from `audit.ts` (not mirrored). (6) Immutable: no update/delete method anywhere in the module, no edit/delete/send/AI affordance in the `.tsx` (tests assert-absent); `export_generated` added additively to the shared `auditActionEnum` (B-0 correctly skipped — action col is text). (7) Boundary clean: no anthropic/nodemailer/resend/webhook/openai import; SSR-hydrate + non-page-colliding `/compliance/audit-log-data` proxy declared `afterFiles` with `/export` before the bare root; RBAC on every route with `nav⊆RBAC` preserved (NAV compliance+advisor ⊆ route compliance+admin+advisor). Verify-route-conflict adjudicated ACCEPTABLE (see below). Residual items are MEDIUM accepted-debt, none a compliance or correctness defect.

## Rework instructions  (only if REWORK)
n/a — APPROVED.

## Deviations / accepted-debt (MEDIUM — do NOT block; carry to T-block / future wave)
- **DEV-1 (verify-route-conflict — ADJUDICATED ACCEPTABLE):** `RecordkeepingController.verify` shadows the wave-4 `AuditLogController.verify` on `GET /compliance/audit-log/verify`. Both derive `@Roles` from the SAME `rolesForRoute('/compliance/audit-log/verify')` = `['compliance','admin']` and both call `AuditVerifier.verifyChain()` — IDENTICAL RBAC + IDENTICAL behavior. ComplianceModule registers before RecordkeepingModule (app.module.ts L20 vs L27) so the wave-4 handler wins in production; the wave-13 handler is inert (exercised only via class-prototype tests). Because RBAC and behavior are identical, the shadowing is behaviorally null and is NOT a defect. Recommendation (non-blocking): consolidate to a single verify handler in a future wave to remove the dead duplicate; keep for now (documented in code + page comments, self-contained module tests depend on it).
- **DEV-2 (mandate-derivation DB-level coverage — route to T-block):** the per-`resource_type` derivation SQL is verified only at unit level via a mocked repo (`findFiltered` receives `mandateId`). The claim that a mandate's outreach/pipeline/match/buyer-universe events ARE actually captured (and org-wide-only events excluded) is NOT proven against a real schema in the B-block. T-block integration tests MUST execute the derivation against the isolated DB schema and assert outreach + pipeline rows for a mandate are included. Structurally the fragment is correct (casts + joins present); the gap is coverage layer, not logic.
- **DEV-3 (advisor mandate filter dropped in repo):** in `buildConditions` the `advisorUserId` branch returns before the `mandateId` branch, so an advisor supplying a `mandateId` gets all own-outreach rows (mandate filter silently ignored). No security exposure — advisor never sees beyond own-outreach; only a minor within-scope over-inclusion. Acceptable per the repo's exclusive advisor-scope design; optionally tighten later.
- **DEV-4 (role-model reconciliation):** spec named fine SoD sub-roles (compliance-reviewer own-mandate-scope / compliance-officer / audit-lead); the codebase role model is coarse (advisor/analyst/compliance/admin). Implementation correctly maps export to compliance+admin. "compliance own-mandate-scope" is not enforced (compliance exports org-wide) — acceptable since the export action is itself audited and no finer role exists; no compliance invariant is weakened.

### Cascade
- **Stages that must re-run:** none (APPROVED).
- **Stages that stay untouched:** B-0..B-5.

## Escalation  (only if ESCALATE)
n/a

## Footer
- verdict_complete: true
- rework_attempt_cap_remaining: 2

---

# Wave 13 — B-6 Verdict (Phase 2 — /review code-reviewer)
**Attempt:** 1 (Phase 2)
## Verdict: REWORK (1 HIGH + 1 MEDIUM; clean at CRITICAL; mandate-derivation SQL structurally sound)
- **H1 (HIGH — compliance completeness):** a mandate-scoped export OMITS the `gate-evaluate` audit row (the tamper-evident allow/block decision) — the gate writes it with resourceType='outreach-template-version' (mandate-agnostic), and the derivation has no branch for it; the advisor scope omits it too. WORSE: the repository docstring FALSELY claims it captures gate-evaluate. FIX: (a) correct the docstring — do NOT overclaim; document that gate-evaluate rows are template-version-keyed, captured by the TIME-RANGE / full-chain export but NOT mandate-attributable via the current derivation (a known limitation). Do NOT add a template_version_id→outreach branch that would OVER-capture other mandates' gate decisions (worse than omission for a regulator package). (b) Orchestrator surfaces a NON-BLOCKING follow-on: producer-side gate mandate-attribution (the compliance-gate should record outreach/mandate context in its audit row) — a real M6/M10 compliance improvement.
- **M2 (MEDIUM):** read path has NO input validation + NO limit clamp → ?limit=huge unbounded scan; ?limit=abc → NaN→500; ?mandateId=not-a-uuid → 500 not 400. The shared listFilterSchema (max 200, uuid) is DEAD CODE (never imported). FIX: parse query through listFilterSchema in the controller (clamp limit ≤200, validate uuids → 400 on bad input).
- **L3 (LOW):** advisor scope ignores the mandateId filter (returns all own-outreach across mandates) → AND the mandate derivation into the advisor fragment OR document.
- **L4 (LOW):** prior export_generated (resourceType='audit-log-export', resource_id=mandateId) events not in mandate derivation → add a clean branch (resource_id=mandateId directly — no over-capture).
- **L5 (LOW):** verifyResult.entriesChecked non-deterministic across exports (each export appends a chain row) → tighten the "identical bytes" determinism wording (the scoped entries + manifest are deterministic; the full-chain verify count isn't).
## Clean (verified): derivation topology/casts/no-double-count/injection-safe; read-only-zero-audit; export exactly-one-last-in-txn + atomicity + actor-id; verify reuses real AuditVerifier; RBAC advisor-403-double-gate; additive enum; immutable no-edit-delete; web SSR+proxy+real-shapes+no-send/AI.
## Footer
```yaml
verdict_complete: true
phase1_head_builder: APPROVED
phase2_review: REWORK
criticals: 0
highs: [H1-gate-evaluate-omitted-from-mandate-scope + false-docstring]
routed: [backend-developer (H1 docstring-honesty + M2 validation + L3/L4/L5)]
followon_nonblocking: producer-side-gate-mandate-attribution (compliance-gate should record outreach/mandate context)
rework_attempt_cap_remaining: 2
```

---
# Wave 13 — B-6 Verdict (Phase 2 REWORK RE-VERIFY) → APPROVED
**Reviewer:** code-reviewer (re-review of b57e733). **Attempt:** 2.
## CONFIRMED-RESOLVED → B-6 APPROVED (overall)
- H1 RESOLVED — false "captures gate-evaluate" docstring GONE; accurate limitation documented (template-version-keyed, cross-mandate, time-range/full-chain-capturable, deliberately excluded from mandate-scope to avoid over-capture); NO lossy branch added.
- M2 RESOLVED — listFilterSchema.safeParse in controller → 400 on bad uuid/limit; limit clamped ≤200 (coerce.int.positive.max); genuine tests.
- L3 RESOLVED — advisor+mandate narrowing (created_by preserved). L4 RESOLVED — audit-log-export branch (direct mandateId match, no double-count, matches the writer). L5 RESOLVED — determinism wording tightened.
No regressions; clean invariants hold (read-only-zero-audit, export-one-last-in-txn, injection-safe, RBAC advisor-403). No new CRITICAL/HIGH. 65 recordkeeping tests + full repo 1686 green.
Non-blocking follow-on surfaced: producer-side gate mandate-attribution (process/session/updates/followon-gate-mandate-attribution.md).
## Footer
```yaml
verdict_complete: true
verdict: APPROVED
phase1_head_builder: APPROVED
phase2_review: REWORK→CONFIRMED-RESOLVED
gate: PASSED
```
---
## B-block exit
```yaml
build_block_status: complete
branch: wave-13-recordkeeping-export
review_verdict: APPROVE
ready_for_ci: true
```

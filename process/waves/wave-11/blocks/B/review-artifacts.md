# Wave 11 — B-block review artifacts
**Block:** B (Build) · **Wave topic:** Compliant-outreach foundation: versioned templates + non-bypassable pre-send gate + SoD (M6 first) · **Gate:** B-6 · **Status:** in-progress
| Stage | Deliverable | Status | Notes |
|---|---|---|---|
| B-0 | stages/B-0-branch-and-schema.md | done | branch + 3 tasks + migration 0010 (journal when>0009; distinct enum + down.sql) |
| B-1 | stages/B-1-contracts.md | done | shared outreach Zod + rbac + NAV + audit actions |
| B-2 | stages/B-2-backend.md | done | TemplateService version-binding + OutreachService non-bypassable-gate-reuses-M2 + SoD; full-repo-test green |
| B-3 | stages/B-3-frontend.md | pending | templates-library + outreach-composer + compliance-queue pages; STRIP send/AI-draft affordances (nextjs-developer) |
| B-4 | stages/B-4-wiring.md | pending | repo typecheck + build |
| B-5 | stages/B-5-verify.md | pending | lint+unit+build (gate-called structural test) |
| B-6 | stages/B-6-review.md | pending | head-builder gate (compliance invariants + AC-STRIP grep + gate-called) + /review |
## Block-specific context
- **Spec:** seed 102a2f00 (multi-spec, 3 blocks + P-4 karen/jenny notes: enum-name, gate-called, AC-STRIP). Branch wave-11-outreach-foundation.
- **claimed_task_ids:** [102a2f00 (template spine), e90a4a99 (composer+gate), 2601ba33 (SoD)]
- **Schema:** migration 0010 — outreach_templates + outreach_template_versions (version_number, content_hash, **outreach_approval_status enum [distinct — karen]**, approved_content_hash, approved_by, disclaimer_template_id FK→M2 disclaimer_templates) + outreach (template_version_id FK, gate_verdict, status compose|send_eligible|blocked). .down.sql; journal when > 1783555200000.
- **Deps/env:** none new (NO Anthropic/email SDK — deferred bundles).
- **Load-bearing (P-4 compliance moat):** version-binding (isUsableForSend: approved AND approved_content_hash==current); **non-bypassable pre-send gate = REUSE M2 ComplianceGateService.evaluate extended (isUsableForSend + outreach-SoD composer!=approved_by + M2 rules) → send_eligible|blocked, fail-closed, audited; OutreachService.compose ALWAYS CALLS evaluate (T/V proves no path to send_eligible without it)**; sender≠approver SoD (compliance approves); required-compliance-block FK→M2 disclaimer; one-txn + audit-last-in-txn + actor-id + tx-scoped-reads (rule 7) + DrizzleError-unwrap.
- **B-3 MANDATORY AC-STRIP:** strip the design Send-Immediate/Schedule-Send buttons + WORM-on-send copy + AI-Drafting modals → surface gate-verdict/send-eligible (NO false send/AI capability — CODE-OF-CONDUCT). B-6 greps.
- **HARD BOUNDARIES:** NO Anthropic/LLM/AI-drafting + NO email-SDK/send (later bundles) — produces send-eligible NOT send.
- **multi-spec commit-per-spec:** commits cite 102a2f00/e90a4a99/2601ba33.
## Gate verdict log
<appended by head-builder at B-6>

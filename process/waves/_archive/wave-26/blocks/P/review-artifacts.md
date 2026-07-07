# Wave 26 — P-block review artifacts
**Block:** P (Product) | **Wave topic:** M10 FINAL-hardening — document + AC the RLS connection-split (runtime dealflow_app non-superuser / owner-for-migrations) + coupled rollback, as EXPLICIT deploy ACs for any future role-privilege migration. Sourced from the real C-2 deploy contract. | **Block exit gate:** P-4
| Stage | Deliverable | Status |
|---|---|---|
| P-0 | stages/P-0-frame.md | done |
| P-1 | done |
| P-2 | done |
| P-3 | done |
## Block-specific context
- **claimed_task_ids:** [1a1c5855] (single-task; the EXPLICITLY-FINAL M10 hardening wave per the wave-25 BOARD 7/7. wave-27 = enforced founder-pause on M10 recordkeeping-scope.)
- **Seed (1a1c5855):** document the RLS privilege-split operational contract (emerged at deploy, not spec) in architecture/devops.md + make it EXPLICIT deploy ACs: (a) DATABASE_URL=dealflow_app runtime vs MIGRATE_DATABASE_URL=owner for preDeploy; (b) the preDeployCommand bare-env-prefix form (a bash -lc wrapper reset PATH → pnpm-not-found → failed deploy #1); (c) coupled rollback (revert BOTH the deployment AND runtime DATABASE_URL→owner — old code has no [RLS-GUARD]/dealflow_app expectations). GAP-3 (dedicated non-superuser CI DB role) — PAT-BLOCKED (needs ci.yml Workflows:write) → DEFER + note.
- **LOAD-BEARING:** the ACs must be CONCRETE + verifiable (a deploy checklist / standing AC a future role-privilege migration must satisfy) — NOT vague prose (the wave-21 process-theater guard + BUILD #11 fault-injection lesson). Document the REAL contract (the two DB URLs, the PATH-reset gotcha, the coupled-rollback) accurately from the C-2 deploy evidence.
- **design_gap_flag:** false (docs/devops hardening, no UI). D-skip.
- Autonomous mode: automatic. This is the FINAL M10 buildable candidate.
## Gate verdict log
**P-4 Phase 1 (Attempt 1) — head-product: APPROVED.** security_scope STANDARD (no tightened security-auditor pass; standard karen+jenny Phase-2 + karen watch-item that any [RLS-GUARD] change stays message/doc-level). Verified independently: [RLS-GUARD] fail-closed anchor is real (apps/api/src/db/index.ts:52-75); devops.md (252 lines) has zero contract coverage — anti-theater bar genuinely met. Accurate-contract + concrete-checkable-ACs (mechanized [RLS-GUARD] anchor + 2-URLs-distinct preflight; runbook halves honestly labeled) + coupled-rollback-hazard bound + GAP-3-deferred + no-recordkeeping-creep + wave-27-flag all confirmed. Proceed to P-4 Phase-2 cross-reviews. Detail: blocks/P/gate-verdict.md.

## P-4 Phase 2: karen APPROVE (4/4 VERIFIED — [RLS-GUARD] anchor real index.ts:51-92 wired main.ts:33; contract undocumented [+ a STALE devops.md §225-227 to correct]; 2-URL split real from C-2 evidence; preflight feasible) + jenny APPROVE (5/5 MATCH, 0 DRIFT — contract↔C-2 verbatim, mechanize↔BUILD#11, final-hardening↔BOARD(c), GAP-3-defer↔PAT, wave-27 flagged).
## MERGED P-4 VERDICT: APPROVED (Phase 1 + karen+jenny APPROVE; security_scope STANDARD; Gemini N/A). → B-block. design_gap false + D-skip.
## B-BLOCK NOTES: MG1 ([RLS-GUARD] doc/message-only, NOT logic — B-6 rejects predicate/throw changes) + MG2 (correct the stale devops.md §225-227 "same POSTGRES_URL" contradiction) + the standing-AC + mechanized-anchor + 2-URLs-distinct-preflight + GAP-3-defer + no-recordkeeping-creep.
**Status:** gate-passed

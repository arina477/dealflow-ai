## Wave 12 stage completion

Seed task: 07989285-7e64-4f26-a3de-1954ba89a5c7 (Build pipeline + pipeline_events spine + PipelineService — enroll + stage transitions)
Bundled siblings:
  - d1940142-e962-48cd-b1eb-26d0c79e98dd (Ship pipeline board API + RBAC + interactive pipeline page)
  - 45b259e1-d0d4-40b1-b09b-aeab25971700 (Ship per-deal pipeline event timeline — notes + transition history, audited)
Claimed task ids: [07989285-7e64-4f26-a3de-1954ba89a5c7, d1940142-e962-48cd-b1eb-26d0c79e98dd, 45b259e1-d0d4-40b1-b09b-aeab25971700]
Active milestone: a068dc3d-8f77-4d01-ba1d-bbc6ed9b16bc (M6 — Compliant outreach & pipeline, in_progress)

Pending ritual outcomes / carry-forwards affecting P-0:
  - Founder LLM-spend decision still DEFERRED / non-blocking (process/session/updates/founder-decision-llm-matching-spend.md). M5 (d72b4510) stays blocked awaiting it; LLM-rationale bundle pending. Re-surface at this wave's close if M6 fully ships before the founder answers (wave-12 does NOT fully ship M6 — send/tracking/queue-screen/export still deferred after pipeline).
  - M6 Class product-feature → P-0 runs mvp-thinner.
  - UI wave (interactive pipeline board + per-deal event timeline pages; design/pipeline.html approved, product-decisions #80) → D-block runs (verify design coverage at P-1; skip only if designs fully cover).
  - Pipeline design contract (product-decisions #137): FIXED stage enum shortlisted→contacted→engaged→diligence→offer→closed/withdrawn + separate append-only pipeline_events table feeding the M2 audit log. Advisor-configurable per-mandate stages are H2-deferred (do NOT build custom stages).
  - HARD BOUNDARIES (in every task description): vertical slice only; NO email SDK / NO email-provider key / NO webhook ingestion / NO send path / NO Anthropic-LLM call / NO new spend / NO new external SDK; all schema ADDITIVE (rollback = drop pipeline + pipeline_events + enum); every mutation audited via M2 AuditService.append last-in-txn; RBAC via M1 RolesGuard / getUserWithRole (app users.id actor-id).
  - Reads shipped-and-live surfaces only: outreach send_eligible (wave-11 @ af5b5d9), match_run/match_candidates (wave-10 @ 0075a20), mandates (wave-8), M2 audit-log (wave-4), M1 RBAC (wave-1). No ghost deps.
  - Carry-forward from L-2 (wave-11 observations.md): OBS-W11-1 (reused-authority store-binding) pre-authored as format-validated BUILD #8 candidate, flagged priority — a wave-12 recurrence promotes on sight. OBS-W11-3 (Ghost-Green uncollected-test sub-class) → future CI-guard, not a principle.

PRODUCT:
- [x] P-0 Frame (discover + reframe)
- [x] P-1 Decompose
- [x] P-2 Spec
- [x] P-3 Plan
- [x] P-4 — PASSED (head-product + karen + jenny APPROVE; Gemini 429-degraded) Gate

DESIGN (skip block if non-UI wave):
- [ ] D-1 Brief
- [ ] D-2 Variants (with bounded iteration)
- [ ] D-3 Review & adopt

BUILD:
- [x] B-0 — pipeline spine migration 0011 (efbcfad; journal-when fixed) Branch & schema
- [x] B-1 Contracts
- [x] B-2 Backend
- [x] B-3 Frontend
- [x] B-4 Wiring
- [x] B-5 Verify
- [ ] B-6 Review

CI/CD:
- [ ] C-1 PR, CI & merge
- [ ] C-2 Deploy & verify (canary armed when real users > 1000)

TEST:
- [ ] T-1 Static
- [ ] T-2 Unit
- [ ] T-3 Contract
- [ ] T-4 Integration
- [ ] T-5 E2E
- [ ] T-6 Layout
- [ ] T-7 Perf
- [ ] T-8 Security
- [ ] T-9 Journey

VERIFY:
- [ ] V-1 Independent reviews (Karen + jenny, parallel)
- [ ] V-2 Triage
- [ ] V-3 Fast-fix loop (or close)

LEARN:
- [ ] L-1 Docs
- [ ] L-2 Distill

NEXT:
- [ ] N-1 Survey & triggers
- [ ] N-2 Seed
- [ ] N-3 Handoff

# Wave 24 — P-block review artifacts
**Block:** P (Product) | **Wave topic:** M10 compliance-hardening — establish a STANDING acceptance criterion: any future migration touching audit_log_entries / a WORM/append-only table must ship a populated-DB migration test (seed real rows → migrate → assert applies + verifyChain ok). Operationalizes the wave-17 GAP-4 / C-2-HOLD lesson. | **Block exit gate:** P-4
| Stage | Deliverable | Status |
|---|---|---|
| P-0 | stages/P-0-frame.md | done |
| P-1 | done |
| P-2 | done |
| P-3 | done |
## Block-specific context
- **claimed_task_ids:** [fd8f2860] (single-task M10 compliance-hardening wave; head-next N-2 noted it's HARDENING, not recordkeeping-artifact progress)
- **Seed (fd8f2860):** make a populated-DB migration test a STANDING AC for WORM/audit-table migrations (the audit-migration-populated-db.e2e AMP-1..5 pattern is the reference template). Prevents the empty-CI-vs-populated-prod divergence class (wave-17 C-2 HOLD: migration 0014 audit backfill collided with the WORM trigger on 328 prod rows).
- **P-0 REFRAME CHECK:** is "populated-DB migration test for WORM/audit migrations" ALREADY a promoted principle (BUILD/CI/test-layer)? If yes → operationalize (add to the migration checklist/template + a reusable helper, don't re-author a principle — the wave-21 process-theater lesson). If not → this wave establishes the standing AC + the reusable test template.
- **design_gap_flag:** false (process/testing-infra hardening, no UI). D-skip likely.
- Autonomous mode: automatic.
## Gate verdict log
<appended by head-product at P-4>

## P-4 Phase 2: karen APPROVE (5/5 VERIFIED — AMP template real, verifyChain real, audit_log_no_mutate WORM trigger real [0002], current-tree tested, not-a-principle) + jenny APPROVE (6/6 MATCHES, 0 DRIFTS; spec-gap MG1 folded — correct the audit-DDL set {0002,0003,0012,0014,0016,0017}, drop 0018-exemplar, explicit trigger-enforced-WORM-vs-app-append-only allow-list). Gemini UNAVAILABLE.
## MERGED P-4 VERDICT: APPROVED. → B-block. design_gap false + D-skip.
## B-BLOCK OBLIGATIONS: MG1 (correct migration set + WORM allow-list criterion) + the standing-AC + reusable-copy-able-template + MECHANICAL-check-with-self-test (green on the ACTUAL audit-touching set).
**Status:** gate-passed

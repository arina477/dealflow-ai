# Wave 22 — P-block review artifacts

**Block:** P (Product)
**Wave topic:** M9 test-hygiene fix-forward — scope the ~12 unscoped shared-DB audit assertions in outreach-activity-rls.e2e-spec.ts per the promoted T-4 rule 2 (own-scoped-rows) + rule 3 (shared-HMAC-key). Single-task, backend-test-only.
**Block exit gate:** P-4

## Stage deliverables
| Stage | Deliverable | Status |
|---|---|---|
| P-0 | stages/P-0-frame.md | done |
| P-1 | done |
| P-2 | done |
| P-3 | done |
| P-4 | stages/P-4-gemini-review.md | pending |

## Block-specific context
- **Wave topic:** a tiny test-isolation fix — the OAE-3-class flake (wave-20 test, surfaced wave-21 C-1). outreach-activity-rls.e2e-spec.ts has ~8 unscoped `COUNT(*) FROM audit_log_entries` assertions + ~4 unscoped `... ORDER BY sequence_number DESC LIMIT 1` latest-action reads → polluted by concurrent audit-writing suites in shared CI Postgres → intermittent CI RED. VIOLATES the promoted T-4 rule 2.
- **The FIX (directly implements T-4 rule 2 + 3):** make each shared-DB audit assertion robust to concurrent pollution — COUNT assertions → assert a DELTA (before/after within the test) OR scope by workspace_id/action (not an absolute global count); latest-action reads → scope by workspace_id (this-workspace's latest, not the global latest). The reconciled count is ~12 sites (8 COUNT + 4 latest-action), NOT 4 or 8 — the whole class (the head-next P-2 flag).
- **claimed_task_ids:** [02f4e6a1] (single-task test-hygiene wave)
- **design_gap_flag:** false (test-only, no UI). D-block skip.
- **wave_type:** single-spec.
- Autonomous mode: automatic. This wave produces no product-feature change (test-reliability only).

## Gate verdict log
<appended by head-product at P-4>

## P-4 Phase 2: karen APPROVE (4/4 VERIFIED — workspace_id indexed+hash-excluded; 12 sites real; suite seeds OAE_WS_A; implements T-4 rule 2) + jenny APPROVE (5/5 MATCHES — enforces twice-confirmed T-4 rule 2; fault-killing preserved; one-suite; test-only). Gemini UNAVAILABLE.
## MERGED P-4 VERDICT: APPROVED. → B-block. design_gap false + D-skip.
## B-BLOCK NOTE (jenny): B-2 runs the suite against the API's Postgres as dealflow_app (not the brain DB — it has no audit_log_entries table).
**Status:** gate-passed

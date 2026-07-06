# Wave 17 — P-block review artifacts

**Block:** P (Product)
**Wave topic:** M8 pilot-partner workspace data-isolation — workspaces anchor + workspace_id scoping + deny-by-default RLS + request-scope propagation + cross-tenant negative-read proof
**Block exit gate:** P-4
**Status:** gate-passed

## Stage deliverables
| Stage | Deliverable file | Status | Notes |
|---|---|---|---|
| P-0 | stages/P-0-frame.md | done | seeded P-0 Action 0; discovery + reframe |
| P-1 | stages/P-1-decompose.md | done | |
| P-2 | stages/P-2-spec.md | done | |
| P-3 | stages/P-3-plan.md | done | |
| P-4 | stages/P-4-security-auditor.md | done (APPROVED after rework; UNAVAIL gemini) | |

## Block-specific context
- **Wave topic:** M8 data-isolation (4-task vertical RLS slice; BOARD-guardrailed at N-1)
- **Spec-contract short-circuit verdict:** no-prior-spec (milestone-decomposer prose rows) → full P-1..P-3
- **Roadmap milestone:** M8 — Pilot-partner workspace (in_progress; wave_db_id f20122c8, wave_number 17; Class product-feature; Tier T4; Success metric _TBD-by-founder → negative-read test is the testable proxy)
- **design_gap_flag:** false (backend/RLS/infra; no new UI)
- **claimed_task_ids:** [0db154ff, e45ba68c, 96026365, df2f3b2f] (4, multi-spec)
- **Autonomous mode active during P-block:** automatic
- **BOARD guardrails (from N-1):** DB-row-level RLS, deny-by-default, cross-tenant negative-read proof
- **SECURITY-SCOPE-TIGHTENED candidate:** YES by nature (multi-tenancy/RLS/auth/data-isolation) — P-4 to confirm

## Open escalations carried into gate
none

## Gate verdict log
- **P-4 Phase 1 — APPROVED** (head-product fresh spawn, attempt 1). All 8 load-bearing isolation invariants present + falsifiable + observable in the authoritative seed-task YAML (read direct from Postgres per rule 7): FORCE-RLS, owner-connection negative-read, deny-by-default fail-closed, audit_log workspace_id hash-excluded (verifyChain ok:true), audit+export reads in boundary, SET LOCAL tx-scoped GUC no-pool-leak, backfill-before-NOT-NULL, fault-killing negative-read (exact-0 cross + non-zero same). Scope = minimum-correct ONE-firm RLS primitive; atomic-vertical confirmed. _TBD metric = founder async poll, not a hard-stop. security_scope_tightened=true → **P-4 Phase 2 + security-auditor mandatory before block exit.** Verdict → `blocks/P/gate-verdict.md`.

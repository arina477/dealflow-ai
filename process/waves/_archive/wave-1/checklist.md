## Wave 1 stage completion

PRODUCT:
- [x] P-0 Frame (discover + reframe)
- [x] P-1 Decompose
- [x] P-2 Spec
- [x] P-3 Plan
- [x] P-4 Gate

DESIGN (skip block if non-UI wave):
- [ ] D-1 Brief
- [ ] D-2 Variants (with bounded iteration)
- [ ] D-3 Review & adopt

BUILD:
- [x] B-0 Branch & schema
- [x] B-1 Contracts
- [x] B-2 Backend
- [x] B-3 Frontend
- [x] B-4 Wiring
- [x] B-5 Verify
- [x] B-6 Review

CI/CD:
- [x] C-1 PR, CI & merge
- [x] C-2 Deploy & verify — PASS: repo now public; provisioned postgres+api+web from scratch on Railway. api https://dealflow-api-production-66d4.up.railway.app/health → 200 {status:ok,db:ok,version:4cad0179...}; web https://dealflow-web-production-a4f7.up.railway.app → 200. Migration applied (additive app_meta), all deployments @ merge commit 4cad0179, rollback armed, canary skipped (0 DAU). head_signoff APPROVED → PROCEED_TO_T-block

TEST:
- [x] T-1 Static — CI-verified (typecheck+lint green)
- [x] T-2 Unit — CI-verified (3 specs green)
- [x] T-3 Contract — CI-verified (HealthResponse Zod + e2e shape)
- [x] T-4 Integration — CI-verified (real-Postgres e2e)
- [x] T-5 E2E — live HTTP smoke PASS (Chrome absent; documented)
- [x] T-6 Layout — skipped (non-UI wave)
- [x] T-7 Perf — skipped (not heavy)
- [x] T-8 Security — skipped (no auth; audit gate in CI)
- [x] T-9 Journey — gate PASSED (head-tester APPROVED); journey regen substantively skipped (placeholder only)

VERIFY:
- [x] V-1 Independent reviews (Karen + jenny, parallel) — Karen + jenny both APPROVE
- [x] V-2 Triage — 0 blocking; 3 non-blocking tasks tracked; 3 noise suppressed
- [x] V-3 Fast-fix loop (or close) — head-verifier APPROVED; fast-fix skipped (0 blocking)

LEARN:
- [x] L-1 Docs
- [x] L-2 Distill

NEXT:
- [x] N-1 Survey & triggers — M1 promoted todo→in_progress (greenfield never-promoted artifact resolved); decomposition fired → auth vertical slice bundle authored (seed e15f71dd + siblings e1c0e81e, af6cbc59); M1 NOT closed (scope not shipped)
- [x] N-2 Seed — auth vertical slice bundle: seed e15f71dd (SuperTokens+data model) + siblings e1c0e81e (auth API) + af6cbc59 (auth screens). Validation PASS. head-next APPROVED. claimed_task_ids=[e15f71dd, e1c0e81e, af6cbc59]
- [x] N-3 Handoff — wave 2 opened for P-0; wave-1 archived; waves row c086d358 closed status=ok; loop_state=ready; head-next APPROVED

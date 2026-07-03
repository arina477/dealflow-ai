## Wave 3 stage completion

**Wave:** 3
**Active milestone:** M1 — Foundation: auth, roles, app shell, data model, CI (`2c79236a-ffc0-43e2-b406-a5aa56413882`, in_progress)
**Seed task:** 1931b452-c7d5-43a0-9657-7e7cd1728203 — Build shared AppShell chrome + role-aware dashboard shell
**Bundled siblings:** 2ecc4a7b-2972-4a95-a36b-44e7112dd54b (per-route RBAC across API + web), 2dc00409-7c01-43fc-8fc1-4438330de7fb (role-aware AppShell nav for the 4 roles)
**claimed_task_ids (B-0 claims this list):** [1931b452-c7d5-43a0-9657-7e7cd1728203, 2ecc4a7b-2972-4a95-a36b-44e7112dd54b, 2dc00409-7c01-43fc-8fc1-4438330de7fb]
**Slice:** M1 shell + RBAC vertical (UI shell + API guard + web route protection + role-gated nav) — closes M1's "land on a role-aware dashboard shell" + per-route RBAC success-metric gap. UI wave (AppShell chrome per DESIGN-SYSTEM.md §10) → D-block runs unless P-1 finds mockups exist.
**Note (from N-1):** authored by milestone-decomposer as the M1 main-thrust slice. Two open M1 follow-ups remain in queue for later waves: bfadcec1 (test-fixture typing, low), 6fe232e3 (auth-hardening: rate-limit/input-validation/anti-CSRF, medium). Wave-2 C-2 deploy note: verify AppShell/dashboard routes render on the redeployed web (login/dashboard/accept-invite/reset were 404 on stale build pre-wave-2-final-deploy).

PRODUCT:
- [x] P-0 Frame (discover + reframe) — PROCEED (problem-framer + ceo-reviewer PROCEED; mvp-thinner n/a)
- [x] P-1 Decompose — PROCEED, multi-spec (3 tasks), design_gap_flag false (AppShell §10 + dashboard.html exist → D skips)
- [x] P-2 Spec — multi-spec contract in seed 1931b452 (3 blocks); allowlist-RBAC + security-scope flagged
- [x] P-3 Plan
- [x] P-4 Gate — PASSED (head-product APPROVED; karen+jenny APPROVE after route/matrix remediation; Gemini 429; security-scope 2-iter)

DESIGN (skip block if non-UI wave):
- [ ] D-1 Brief
- [ ] D-2 Variants (with bounded iteration)
- [ ] D-3 Review & adopt

BUILD:
- [x] B-0 Branch & schema — branch wave-3-appshell-rbac; lucide-react; NO schema; 3 tasks claimed
- [x] B-1 Contracts — shared rbac.ts single source of truth (75711f8); nav⊆RBAC by construction; 92 tests
- [x] B-2 Backend — RBAC enforcement + /compliance/summary exemplar (@Roles from rbac.ts); per-role 403/200 tested (1cf4fba)
- [x] B-3 Frontend — AppShell(§10) once + dashboard at / + role-aware nav (navItemsForRole); 62 tests (144642f)
- [x] B-4 Wiring — repo typecheck+build PASS; no drift (rbac.ts biome→B-5)
- [x] B-5 Verify — lint 0-err (2 warn), 197 tests pass, build pass; auth/RBAC dev-smoke→C-2
- [x] B-6 Review — head-builder APPROVED; /review 2 CRIT RBAC fixed (5635c35); commit-discipline PASS

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

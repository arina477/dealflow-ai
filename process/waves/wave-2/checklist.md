## Wave 2 stage completion

**Wave:** 2
**Active milestone:** M1 — Foundation: auth, roles, app shell, data model, CI (`2c79236a-ffc0-43e2-b406-a5aa56413882`, in_progress)
**Seed task:** e15f71dd-8f61-441c-904a-bdfa108bd6e1 — Integrate SuperTokens auth + user/role data model
**Bundled siblings:** e1c0e81e-41b8-4b49-9d6c-8b1ed5c33e38 (auth API), af6cbc59-ffcb-43ca-810d-4860d6e6bf64 (auth screens)
**claimed_task_ids (B-0 claims this list):** [e15f71dd-8f61-441c-904a-bdfa108bd6e1, e1c0e81e-41b8-4b49-9d6c-8b1ed5c33e38, af6cbc59-ffcb-43ca-810d-4860d6e6bf64]
**Slice:** auth vertical (DB+API+UI) — invite → password → sign-in → role-aware landing. This is a UI wave (auth screens) → D-block runs unless P-1 decides otherwise.
**Note:** AppShell chrome + role-aware dashboard shell + full per-route RBAC enforcement deferred by decomposition to a follow-up M1 bundle.

PRODUCT:
- [x] P-0 Frame (discover + reframe) — PROCEED (problem-framer + ceo-reviewer both PROCEED; mvp-thinner n/a)
- [x] P-1 Decompose — PROCEED, multi-spec (3 tasks), design_gap_flag false (auth mockups exist → D skips)
- [x] P-2 Spec — multi-spec contract stored in seed task (3 blocks); security-scope flagged for P-4/T-8
- [x] P-3 Plan — approach (5 arch deltas, users/roles/invites additive migration + down, 6 /auth contracts, supertokens-node@24.0.2) + plan (B1-B5, 7 specialists, parallelization, sweep clean); SuperTokens SDK doc written
- [x] P-4 Gate — PASSED (head-product APPROVED; karen+jenny APPROVE; Gemini 429-degraded)

DESIGN (skip block if non-UI wave):
- [ ] D-1 Brief
- [ ] D-2 Variants (with bounded iteration)
- [ ] D-3 Review & adopt

BUILD:
- [x] B-0 Branch & schema — branch wave-2-auth-backbone; supertokens-node@24.0.2; additive users/roles/invites migration (f3681f8)
- [x] B-1 Contracts — @dealflow/shared auth Zod contracts (49e290a); no-user-enumeration in reset contract
- [x] B-2 Backend — auth module (SuperTokens+invite-only+role-claim+guard primitive); 6 invariants enforced; 20 tests pass (f24a56d)
- [x] B-3 Frontend — login/accept-invite/reset + dashboard placeholder; SSO+SOC2 removed; 41 RTL tests (cb6a6d3)
- [x] B-4 Wiring — repo typecheck + build PASS; routes+env wired; no drift
- [x] B-5 Verify — lint 0 errors, 61 tests pass, build pass; auth dev-smoke deferred to C-2 (needs Core)
- [x] B-6 Review — head-builder APPROVED; /review 1 CRIT+4 info fixed (5726917); commit-discipline PASS

CI/CD:
- [x] C-1 PR, CI & merge — PR #2 MERGED (squash), merge commit bbae29b; 5/5 required checks green on 98eade8; 1 fix-up cycle (nodemailer >=9.0.1 override, GHSA-p6gq-j5cr-w38f HIGH)
- [~] C-2 Deploy & verify — FAIL / ESCALATE (re-run #2, in-progress). DI fix (4e09807, PR #3) CONFIRMED working (AuthModule DI now resolves), but redeploy (deployment 9772b283 on 4e09807) crash-looped on a NEW NestJS lifecycle-ordering bug: main.ts calls supertokens.getAllCORSHeaders() before onModuleInit fires SuperTokens.init() (NestFactory.create doesn't run lifecycle hooks). "Initialisation not done" fatal. Auth smoke NOT RUN (api never booted). No outage — healthcheck kept old deploy 077009a2/4cad0179 live. Routed to B-block (tag: debugging, domain: backend, file: apps/api/src/main.ts) → re-run C-1 on fix → re-run C-2 (#3: deploy api + deploy web). SECONDARY: web live on stale 4cad0179; /login /dashboard /accept-invite /reset-password all 404 (predates B-3 auth screens) — must redeploy web too. Canary skipped (0 DAU). Rollback target cached: 077009a2.

TEST:
- [x] T-1 Static — CI-verified (typecheck+lint green); 1 low test-fixture bypass
- [x] T-2 Unit — CI-verified; auth service/di-boot/bootstrap/env + web RTL green
- [x] T-3 Contract — CI-verified; @dealflow/shared auth Zod + live /auth/me shape
- [x] T-4 Integration — CI-verified; real-Postgres CI + live DB round-trip
- [x] T-5 E2E — real-browser 6/6 PASS (caught+fixed 2 CRITICAL browser bugs: CORS/middleware + cross-origin session)
- [x] T-6 Layout — real visual baseline 4/4 per DESIGN-SYSTEM, 0 defects, SSO/SOC2 absent
- [x] T-7 Perf — skipped (not heavy)
- [x] T-8 Security — auth smoke+cookies(HttpOnly/Secure/SameSite=Lax)+CSRF+secret-grep PASS; rate-limit gap (medium->V-2)
- [x] T-9 Journey — head-tester APPROVED (attempt 2); journey regen (auth routes live, /accept-invite reconciled)

VERIFY:
- [x] V-1 Independent reviews (Karen + jenny, parallel) — Karen + jenny both APPROVE (auth live + spec-conformant)
- [x] V-2 Triage — 0 blocking; 1 auth-hardening task (6fe232e3); 2 noise
- [x] V-3 Fast-fix loop (or close) — head-verifier APPROVED; fast-fix skipped (0 blocking)

LEARN:
- [x] L-1 Docs — CHANGELOG 0.2.0 + README auth note (1bc8af9); M1 stays in_progress (open_count=2), backlog-stockout flagged for N-1
- [x] L-2 Distill — 3 tasks confirmed done; 5 observations synthesized; 1 promotion (T-5 rule 1, real-browser E2E for auth/session waves; karen APPROVE + linter OK; 5c0eb6b); OBS-1/BUILD deferred (confirmed-ready)

NEXT:
- [ ] N-1 Survey & triggers
- [ ] N-2 Seed
- [ ] N-3 Handoff

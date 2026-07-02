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

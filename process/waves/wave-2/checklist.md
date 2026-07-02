## Wave 2 stage completion

**Wave:** 2
**Active milestone:** M1 — Foundation: auth, roles, app shell, data model, CI (`2c79236a-ffc0-43e2-b406-a5aa56413882`, in_progress)
**Seed task:** e15f71dd-8f61-441c-904a-bdfa108bd6e1 — Integrate SuperTokens auth + user/role data model
**Bundled siblings:** e1c0e81e-41b8-4b49-9d6c-8b1ed5c33e38 (auth API), af6cbc59-ffcb-43ca-810d-4860d6e6bf64 (auth screens)
**claimed_task_ids (B-0 claims this list):** [e15f71dd-8f61-441c-904a-bdfa108bd6e1, e1c0e81e-41b8-4b49-9d6c-8b1ed5c33e38, af6cbc59-ffcb-43ca-810d-4860d6e6bf64]
**Slice:** auth vertical (DB+API+UI) — invite → password → sign-in → role-aware landing. This is a UI wave (auth screens) → D-block runs unless P-1 decides otherwise.
**Note:** AppShell chrome + role-aware dashboard shell + full per-route RBAC enforcement deferred by decomposition to a follow-up M1 bundle.

PRODUCT:
- [ ] P-0 Frame (discover + reframe)
- [ ] P-1 Decompose
- [ ] P-2 Spec
- [ ] P-3 Plan
- [ ] P-4 Gate

DESIGN (skip block if non-UI wave):
- [ ] D-1 Brief
- [ ] D-2 Variants (with bounded iteration)
- [ ] D-3 Review & adopt

BUILD:
- [ ] B-0 Branch & schema
- [ ] B-1 Contracts
- [ ] B-2 Backend
- [ ] B-3 Frontend
- [ ] B-4 Wiring
- [ ] B-5 Verify
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

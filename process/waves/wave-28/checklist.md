## Wave 28 stage completion

Seed: d3cc1337-c7a4-4a89-9857-02ba99e1292d — Add workspace retention-policy table + additive migration (config, RLS, WORM-preserving)
Bundled siblings:
  - b7786c5b-4126-482c-8db7-01a8d5ba77f6 — shared-Zod retention-policy contracts
  - ed4945e0-e239-44d8-a14e-03e1eddc78fa — retention-policy service + RBAC-scoped API (RLS, audit-logged, WORM-preserving)
  - ce75c6c6-f723-48c7-8c7c-8260dfcd952a — retention-policy settings + cutoff surfacing UI
Claimed batch (B-0 claims / L-2 closes): [d3cc1337, b7786c5b, ed4945e0, ce75c6c6]
Active milestone: 033f97e0-bc25-48dd-bb5a-b2f2be5b056a (M10 — Advanced compliance & recordkeeping, in_progress)
Slice: RETENTION policy (M10 ## Scope vertical 2; light posture). WORM audit-chain immutability + HMAC chain preserved — retention = window-policy config + surfacing, NOT WORM-row deletion.
Note: UI wave (compliance-surface settings + cutoff surfacing) — D-block expected to run.

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

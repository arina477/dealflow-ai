# Wave 26 checklist — M10 FINAL hardening: RLS connection-split doc + coupled rollback

Seed task: 1a1c5855-b8f8-4d86-93ea-7948e6881c10 — "Document + AC the RLS connection-split (runtime dealflow_app / migrate owner) + coupled rollback"
Bundled siblings: [] (single-task bundle)
Claimed task ids: [1a1c5855-b8f8-4d86-93ea-7948e6881c10]
Active milestone: 033f97e0-bc25-48dd-bb5a-b2f2be5b056a (M10 — Advanced compliance & recordkeeping, in_progress)

> **⚑ BOARD-BOUND CONTEXT (N-1-M10-recordkeeping-integrity-wave-25, 7/7 APPROVE disposition c):**
> This is the **EXPLICITLY-FINAL** M10 hardening/debt-closure wave. No 4th hardening wave may be
> seeded under the same rationale. M10's real SOX/FINRA recordkeeping verticals remain blocked on
> the founder-reserved `_TBD` success metric + compliance-classification-raise decision (surfaced
> non-blocking to the 2026-07-07 digest). **wave-27 N-1 will PAUSE the loop structurally** (the
> decomposition ritual refuses M10's `_TBD` metric → incomplete-scope → `.loop-paused.yaml`) UNLESS
> the founder has scoped recordkeeping by then. This is a framework-enforced circuit-breaker.
> Likely a backend/devops-doc wave — D-block may skip (no UI gap).

## Wave 26 stage completion

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

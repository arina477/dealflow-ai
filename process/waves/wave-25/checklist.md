# Wave 25 checklist — M10 compliance-hardening (auth hardening: rate-limiting, input validation, logout anti-CSRF)

> Seed: `6fe232e3-c639-4f6c-ad66-2889df8d9717` (single-task bundle; bundled_siblings []).
> Active milestone: M10 `033f97e0` (in_progress). claimed_task_ids: [6fe232e3].
> Downstream flags: touches auth/CSRF/rate-limits → **T-8 Security stage + P-4 security-scope-tightened gate mandatory**; static-test-spec-first + rollback for any rate-limit-storage migration.
> Carried founder-digest surfacings: M10 _TBD_ metric poll (batch w/ M9 _TBD_ poll open since wave-18); founder-gated pile-up (M5 LLM-spend, M6/M7 #141 DKIM, M9 CRM 345dfbc6).
> INTEGRITY TRIPWIRE (binding at wave-26 N-1): after this wave seeds 6fe232e3, exactly ONE buildable M10 candidate remains (1a1c5855 RLS-doc). If wave-26 finds only debt/hardening candidates AND M10 recordkeeping-decomposition still unfired → FLIP to Option B: BOARD-escalate the integrity question + REFUSE a third consecutive hardening seed.

## Wave 25 stage completion

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

## Wave 22 stage completion

**Seed:** 02f4e6a1-4b67-4bb1-80e8-ac1d3be3f762 — Fix-forward: scope OAE-class unscoped audit-count assertions in outreach-activity-rls e2e (T-4 rule 2)
**Bundled siblings:** (none — single-task bundle)
**claimed_task_ids:** [02f4e6a1-4b67-4bb1-80e8-ac1d3be3f762]
**Active milestone:** 099cee10-562d-4e56-9a57-0dade2914760 — M9 — Integrations & insight (H2/T4) — in_progress
**Bundle theme:** Test-hygiene fix-forward (test-only, non-blocking, CI-reliability). Scope the ~4 UNSCOPED `COUNT(*) FROM audit_log_entries` assertions in `outreach-activity-rls.e2e-spec.ts` (approx lines 408/453/516/583) by `workspace_id` and/or `action`, OR assert a scoped DELTA on the suite's own seeded rows (wave-17 AMP-4 per-row-recompute pattern), per the promoted **T-4 rule 2** (a real-DB parallel suite must assert only its OWN scoped rows of a shared append-only chain). Source: wave-21 C-1 surfaced this pre-existing wave-20 test-isolation flake (shared CI Postgres pollution → intermittent CI RED, e.g. expected 34 got 33, passed on re-run). Whole-class fix (all offending sites). Non-vertical single-task wave (legitimate exception — test-only, no feature surface; like the wave-21 docs wave).

**Carry-forward notes for P-0:**
- **Milestone disposition (wave-21 N-1):** M9 STAYS in_progress. open_count=2, done_count=12. NOT closure-eligible — `## Scope` still has the founder-gated CRM thread (`blocked`) + the buildable seller-intent thread (unauthored). No M10 promotion (M9 not scope-exhausted; slot occupied). head-next APPROVED this disposition.
- **SELLER-INTENT = WAVE-23 SEED:** the remaining buildable credential-free M9 thread is **seller intent signals** (derived scoring over EXISTING internal data — outreach_activity from wave-20, wave-19 accept/reject calibration, mandate/stage velocity; NO external intent vendor, NO LLM, NO SDK, NO spend, NO credential). It could NOT be decomposed this wave because a seed candidate (`02f4e6a1`) already existed (decomposer Step-1 gate requires seed-candidate count = 0). Once THIS wave's seed `02f4e6a1` is claimed at B-0 (its wave_id set), M9's seed-candidate count reaches 0 and wave-23 N-1 will legitimately fire milestone-decomposer (`next-bundle`) for the seller-intent vertical slice (DB signals table + compute service + RBAC/SoD API + /insights UI panel, additive migration, RLS-honoring, audit-logged, shared-Zod, tests-first).
- **P-2 SITE-COUNT RECONCILE (head-next non-blocking flag):** the seed description cites ~4 assertion sites (lines 408/453/516/583) while wave-21 L-1 OBS-W21-2 says 8 unscoped `COUNT(*)` sites. Reconcile the exact count against the ACTUAL file at P-2 — the seed mandates the WHOLE CLASS regardless, so the executor scopes every offending assertion, but the spec's AC should name the true site count.
- **345dfbc6 (CRM DataSourceAdapter) is `status='blocked'`** — external hold: founder vendor-selection spend + account-issued API key. Do NOT depend on it (ghost-dep guard).
- **FOUNDER-GATED PILE-UP (non-blocking, surfaced to `process/session/updates/digest-2026-07-07-M9-metric-and-gated-pileup.md`):** (1) deal-source VENDOR + API key → M9 345dfbc6 / CRM adapters (blocked); (2) LLM-spend → M5 + AI-rationale/drafting; (3) email-provider/DKIM #141 → M6 send + M7 sending-domain. All await founder decisions; loop continues on buildable work.
- **M9 `_TBD` success metric** — product/taste founder poll (rule 17). Surfaced to the same digest. Must be set before M9 can ever close; NOT blocking now. Carried w18→w21.
- **Tech-debt holds carried from wave-20 L-2:** OBS-W20-2 readTail-RLS-exempt (STRONG HOLD, load-bearing for M11); OBS-W17-1 hardcoded-HMAC-key-in-e2e (was wave-21 promotion turn — carry if not applied). GAP-2 write-path fail-closed (2867d087) remains a BLOCKING M11 pre-req. GAP-4/GAP-5 re-homed to M10.
- **P-block:** this is a TEST-ONLY fix-forward wave. NO new UI design gap → D-block skips. mvp-thinner does NOT spawn (not a product-feature AC). Watch scope creep — keep it to scoping the offending audit-count assertions; do NOT touch app code or re-author unrelated tests.
- **Unassigned queue depth 1** at wave-21 close → P-0 walks it.

### Stage ledger (fill as wave 22 progresses)

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

## Wave 21 stage completion

**Seed:** 1d95cac0-b396-40b7-8904-be0fa42aa3ab — Spec-authoring + test-fixture process hardening (analytics-wave lessons)
**Bundled siblings:** (none — single-task bundle)
**claimed_task_ids:** [1d95cac0-b396-40b7-8904-be0fa42aa3ab]
**Active milestone:** 099cee10-562d-4e56-9a57-0dade2914760 — M9 — Integrations & insight (H2/T4) — in_progress
**Bundle theme:** Process / DX hardening (V-1 jenny GAP-B/C/D/E across waves 18-19). Non-vertical-slice single-task wave (legitimate exception, like a doc/infra-only wave). Scope: (B) verify a metric/AC is computable over real columns BEFORE authoring it (grep the schema); (C) provision workspace-scoped non-destructive advisor+admin authed test-account fixtures for real live checks (or declare CI-e2e-authoritative up front); (D) pre-classify each score dimension predictive-vs-noise before authoring a lift/calibration metric (a hash/tie-break dimension is uncorrelated by construction — do not author it); (E) specify a low-n confidence treatment (small-sample caveat: show n / mute when decidedCount<threshold) as an EXPLICIT AC. Metric-honesty (CODE-OF-CONDUCT) spec-authoring rules. Non-blocking, no code defect — pure process improvement that de-risks every subsequent wave's spec/test quality.

**Carry-forward notes for P-0:**
- **Milestone disposition (wave-20 N-1):** M9 STAYS in_progress. Three insight/tracker verticals SHIPPED (wave-18 analytics /insights; wave-19 match-calibration @3cc58de; wave-20 internal outreach-activity tracker @86ddc29). NOT closed — `## Scope` still has the founder-gated CRM thread (now `blocked`) + the buildable seller-intent thread. No M10 promotion (M9 not scope-exhausted; slot occupied — legal parked-in_progress).
- **SELLER-INTENT = WAVE-22 SEED:** the remaining buildable credential-free M9 thread is **seller intent signals** (derived scoring over EXISTING internal data — outreach_activity from wave-20, wave-19 accept/reject calibration, mandate/stage velocity; NO external intent vendor, NO LLM, NO SDK, NO spend, NO credential). It could NOT be decomposed this wave because the milestone-decomposition ritual's Step-1 gate requires seed-candidate count = 0 and two candidates existed. Once THIS wave's seed `1d95cac0` is claimed at B-0 (its wave_id set), M9's seed-candidate count reaches 0 and wave-22 N-1 will legitimately fire milestone-decomposer (`next-bundle`) for the seller-intent vertical slice (DB signals table + compute service + RBAC/SoD API + /insights UI panel, additive migration, RLS-honoring, audit-logged, shared-Zod, tests-first).
- **345dfbc6 (CRM DataSourceAdapter) is now `status='blocked'`** — external hold: founder vendor-selection spend (Salesforce/DealCloud/Affinity) + account-issued API key. Re-opens to `todo` only when the founder resolves the vendor + credential. Do NOT depend on it (ghost-dep guard).
- **FOUNDER-GATED PILE-UP (non-blocking, surfaced to `process/session/updates/digest-2026-07-07-M9-metric-and-gated-pileup.md`):** (1) deal-source VENDOR + API key → M9 345dfbc6 / CRM adapters (now blocked); (2) LLM-spend → M5 + AI-rationale/drafting; (3) email-provider/DKIM #141 → M6 send + M7 sending-domain. All await founder decisions; loop continues on buildable work.
- **M9 `_TBD` success metric** — product/taste founder poll (rule 17). Surfaced to the same digest. Must be set before M9 can ever close; NOT blocking now. ceo-reviewer + jenny flagged it across waves 18-20.
- **Tech-debt holds carried from wave-20 L-2:** OBS-W20-2 readTail-RLS-exempt (STRONG HOLD, load-bearing for M11 — a global-view read under per-tenant RLS must use an RLS-exempt path); OBS-W17-1 hardcoded-HMAC-key-in-e2e (3rd sighting, **wave-21 promotion turn** — apply this wave's spec-hardening lens). GAP-2 write-path fail-closed (2867d087) remains a BLOCKING M11 pre-req (workspaceId fallback). GAP-4/GAP-5 re-homed to M10 (populated-DB migration-proof AC + RLS connection-split doc).
- **P-block:** this is a process/testing/docs wave (spec-authoring rules → likely PRODUCT/BUILD-PRINCIPLES + test-writing-principles + test-accounts fixtures). Likely NO new UI design gap → D-block skips. mvp-thinner spawns only if P-0 reads M9 Class `product-feature` scope for THIS bundle — but this seed is process-hardening, not a product-feature AC; P-0 judges. Watch for scope creep — keep it to the spec/test-process improvements + fixture provisioning; do NOT let it balloon into re-authoring shipped specs.
- **Unassigned queue depth 1** at wave-20 close → P-0 walks it.

### Stage ledger (fill as wave 21 progresses)

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
- [x] C-2 Deploy & verify (canary armed when real users > 1000)

TEST:
- [x] T-1 Static
- [x] T-2 Unit
- [x] T-3 Contract
- [x] T-4 Integration
- [x] T-5 E2E
- [x] T-6 Layout
- [x] T-7 Perf
- [x] T-8 Security
- [x] T-9 Journey

VERIFY:
- [x] V-1 Independent reviews (Karen + jenny, parallel)
- [x] V-2 Triage
- [x] V-3 Fast-fix loop (or close)

LEARN:
- [x] L-1 Docs
- [x] L-2 Distill

NEXT:
- [ ] N-1 Survey & triggers
- [ ] N-2 Seed
- [ ] N-3 Handoff

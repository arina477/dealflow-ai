## Wave 7 stage completion

Seed: dfa5bd56-0c7e-46ed-830f-9c35e5bfd471 — Build sourcing-workspace page to search sources and trigger ingestion
Bundled siblings:
  - 345dfbc6-1c96-4f6a-98aa-12ac7d61794b — Implement first real DataSourceAdapter against a selected deal-source provider
Active milestone: b372bbf7-09f3-4eb0-87df-28b5ec52bfc2 — M3 — Deal sourcing & company/contact data
Pending ritual outcomes affecting P-0: M3 is `## Class product-feature` → P-0 runs mvp-thinner. UI wave (sourcing-workspace page, journey row 12) → D-block runs. Real-adapter sibling introduces an external deal-source SDK → P-3 external-sdk-integration-rules research + a SPEND-GATE (vendor selection routes to BOARD under automatic) + a SDK doc before adapter code + likely a MONITOR: task for provider tier/key activation. If the spend-gate defers the real adapter, the seed (sourcing-workspace over the existing fixture adapter) still stands alone. Backlog under M3: 3 re-parented M1 follow-ups (bfadcec1, 6fe232e3, d7f716b4) available for P-0 unassigned/queue triage, NOT part of this bundle. Unassigned queue depth at handoff: 1.

PRODUCT:
- [x] P-0 Frame (discover + reframe) — RESCOPE-AUTO-SPLIT+THIN (all 3 align): page on fixture ships; real-adapter DEFERRED (founder vendor+key); dedupe-modal split
- [x] P-1 Decompose — PROCEED, single-spec (dfa5bd56 page ~1800 LOC), design_gap false (sourcing-workspace.html → D skips); real-adapter+modal deferred
- [x] P-2 Spec — single-spec workspace-page contract in seed dfa5bd56 (search canonical universe + trigger-sync, reuse wave-6)
- [x] P-3 Plan — 4 deltas (page + canonical-search + trigger-sync reuse + ≥2-source-view); reuse-heavy, no schema/SDK/secret
- [x] P-4 Gate — PASSED (head-product APPROVED; karen+jenny APPROVE after connection-seeding remediation; Gemini 429)

DESIGN (skip block if non-UI wave):
- [ ] D-1 Brief
- [ ] D-2 Variants (with bounded iteration)
- [ ] D-3 Review & adopt

BUILD:
- [x] B-0 Branch & schema — branch wave-7-sourcing-workspace; no new deps/schema/secret; 1 task claimed
- [x] B-1 Contracts — connection create/list (audited, actor-id) + shared contract (f4098f1)
- [x] B-2 Backend — connection create/list (audited, actor-id) + shared contract (f4098f1)
- [x] B-3 Frontend — sourcing-workspace page at /sourcing (search+≥2-source facet+trigger-sync+connection-create); 214 tests (f8073e1)
- [x] B-4 Wiring — repo typecheck+build PASS; /sourcing workspace compiles
- [x] B-5 Verify — lint 0-err, 920 tests pass, build pass; ≥2-source facet test; runtime→C-2
- [x] B-6 Review — head-builder APPROVED; /review 2 CRIT fixed (badges+providerKey-400+dup-409, 57d79bc)

CI/CD:
- [x] C-1 PR, CI & merge — main @ 23e5372, CI green (all 5); merged
- [ ] C-2 Deploy & verify — FAIL (head-ci-cd REJECTED, re-verify @ 2384c54): 0005-fix VERIFIED APPLIED (6 migration rows + UNIQUE(display_name) constraint present via DB probe — Ghost Green RESOLVED). Deploy 2384c54 SUCCESS both services (api 399792d5 / web f5bb7781, neither SKIPPED), /health==2384c54 on own domain, boots clean, bad-key→400 intact. BUT dup-displayName → **500 not 409**: distinct newly-surfaced defect — DrizzleQueryError wraps the 23505, repository catch checks err.code (undefined) not err.cause.code, so ConflictException(409) branch never fires (data integrity still OK — DB blocked the 2nd row). Returns to Build/fast-fix for err.cause unwrap in sourcing.repository.ts + audit sibling conflict catches + harden unit-test mock (it stubbed a bare {code:'23505'} → masked the prod 500). Canary skipped (0 DAU). Prior FAIL (23e5372, migration 0005 journal `when` defect) is now fixed.

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

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
- [~] C-2 Deploy & verify — **V-3 render-fix re-verify @ 3e2042f: REJECTED (head-ci-cd)**. The V-1 CRITICAL (workspace /sourcing renders empty) is FIXED & PROVEN: SSR HTML contains company data (Acme/Delta/Horizon/Epsilon + source badges, no empty-state), real headless-chromium renders company rows, and in-memory search filters the SSR-loaded list with ZERO network fetch (nonStaticNetRequests=[]). Seeded 4 canonical companies with PG-wire created_at (2026-07-04 04:42:20.996353+00, DB probe). Deploy 3e2042f SUCCESS both services (web e520f0a1 / api 599542b3 via serviceInstanceDeployV2, neither SKIPPED), /health==3e2042f on api's own domain, boots clean. Armed rollback captured (api 27761064 / web 98948a92, unused). Regression: create 201 / dup 409 / bad-key 400 / /health ok all PASS. **BUT deep-screen /sourcing/companies FAILS**: renders "No companies yet" with 4 companies in DB — same bug class, un-fixed on the sibling route because the fix loosened only the workspace's LOCAL _lib/workspace-types.ts override, not the shared companySchema (packages/shared/src/sourcing.ts:88 still z.string().datetime()) the deep-screen imports+safeParse-drops. Task regression req #3 not met live. Canary skipped (0 DAU). Cleanup: 0 connections/companies, temp proxy 30e292f deleted, creds scrubbed. → REWORK_B-block (loosen shared companySchema createdAt/updatedAt .datetime()→.string(); add deep-screen SSR PG-wire test), then re-run C-2. [Prior 0fe63de dup-409 re-verify PASSED; superseded by this render-fix re-verify.]

TEST:
- [x] T-1 Static
- [x] T-2 Unit
- [x] T-3 Contract
- [x] T-4 Integration
- [x] T-5 E2E — 4/5 real-browser scenarios PASS (workspace renders, RBAC deny, regression); S2 = test-data collision [409≠401 = auth worked], create LIVE-verified C-2; Chrome
- [x] T-6 Layout — workspace §10-conformant (TopBar-title→polish, recurring 5 screens)
- [x] T-7 Perf
- [x] T-8 Security
- [x] T-9 Journey — head-tester APPROVED; journey regen (workspace LIVE)

VERIFY:
- [x] V-1 Independent reviews (Karen + jenny, parallel) — Karen APPROVE, jenny REJECT (2 CRITICAL: SSR-timestamp + client-search-API → workspace empty)
- [x] V-2 Triage — 2 blocking→fast-fix (timestamp-parse + client-search-API)
- [ ] V-3 Fast-fix loop (or close)

LEARN:
- [ ] L-1 Docs
- [ ] L-2 Distill

NEXT:
- [ ] N-1 Survey & triggers
- [ ] N-2 Seed
- [ ] N-3 Handoff

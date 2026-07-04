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
- [~] C-2 Deploy & verify — **V-3 detail-fnprop re-verify @ 798fae1: REJECTED (head-ci-cd) — FINAL**. The Server→Client function-prop fix (798fae1) **DID land**: both services live on 798fae1 (api dcdb4ab4 dep 2d114947 / web 06b07f19 dep c786da28 via GIT_SHA variableUpsert + explicit serviceInstanceDeploy, meta.commitHash==798fae1, neither SKIPPED); /health==798fae1 on api own-domain, db ok. Armed rollback (api d0bec3d9 / web 2298ce0a = prior 2ae3e06 SUCCESS, unused). **The DETAIL route no longer 500s** — `[id]/page.tsx` now passes only serializable props (onCandidateResolved dropped + made optional); document returns HTTP 200. **3 of 4 surfaces render data in live headless-chromium-1208 DOM:** workspace /sourcing (4 rows, emptyState:false, in-memory filter fires 0 fetches); deep-list /sourcing/companies (all 4 names, zero empty markers); /compliance/settings (Rules UI + RBAC 307-gate). Regression: create 201 / dup 409 / bad-key 400 / login 200 / /health ok / API-direct GET /sourcing/companies/:id → 200 valid JSON — all PASS. **BUT core-proof#2 FAILS: /sourcing/companies/:id DETAIL renders "Network error — please try again" (data present, detail NOT rendered)** — 5th masked sibling, uncovered by the 500 fix. Root-caused w/ certainty against deployed state: NO /sourcing/companies/:id rewrite in next.config.ts afterFiles → client apiFetch('/sourcing/companies/:id') is served the Next [id] page HTML, not API JSON (proven empirically: curl → `content-type: text/html`, `#__next_error__`, never application/json); res.json parse throws → error branch. Web-only (API-direct → 200 valid JSON, healthy), NOT a harness artifact. Iron Law: DETAIL renders empty/broken with data → FAIL + RETURN. Canary skipped (0 DAU < 1000). Cleanup: temp fixture connections retained (no DELETE endpoint); test users retained (audit-log immutability); cookie jars/creds shredded. → REWORK_B-block (make CompanyDetail detail fetch reach the API JSON — fetch API origin directly OR add non-colliding /api/... path w/ afterFiles rewrite OR hydrate detail from the server component; add a POST-HYDRATION route-render test for /sourcing/companies/:id asserting heading+tabs render; DO NOT touch the 798fae1 function-prop fix or companySchema — both proven), then re-run C-2. [Chain: e3dd9b7 timestamp → 2ae3e06 connectionIds strict-key → 798fae1 detail-500-fnprop (all fixed & proven); now the detail same-origin-rewrite-collision surfaces underneath. 5 masked siblings; head-ci-cd holds the gate closed.]

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

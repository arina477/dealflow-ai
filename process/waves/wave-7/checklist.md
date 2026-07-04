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
- [x] C-2 Deploy & verify — **V-3 detail-SSR-hydrate re-verify @ e4debc6: PASS (head-ci-cd APPROVED) — FINAL, chain closed**. Page-route-collision fix (e4debc6) CORRECT & PROVEN: detail page SSR-fetches full detail → serializable `initialDetail` prop → `CompanyDetail` useEffect early-returns (client fetch skipped, "Network error" branch unreachable); workspace drawer uses non-colliding `/sourcing/company-detail/:id` proxy (new next.config afterFiles rewrite). Both services live on e4debc6 via GIT_SHA variableUpsert + **explicit serviceInstanceDeploy** (api dcdb4ab4 dep `67a39336` / web 06b07f19 dep `bfcca5a0`, meta.commitHash==e4debc6, neither SKIPPED, latest-head confirmed); /health==e4debc6 own-domain, db ok. Armed rollback (api d97c26e7 / web 47f266f5, unused). **ALL 4 surfaces render real data in live headless-chromium-1208 POST-HYDRATION DOM:** `/sourcing` workspace (4 rows, emptyState:false; in-memory search filters Delta out with **0 network fetches**); `/sourcing/companies` deep-list (all 4 names, zero empty markers); **`/sourcing/companies/:id` DETAIL — THE fix proof — renders heading "Acme Technologies Inc." + Contacts/Provenance/Dedupe-Review tabs + real contacts, `networkError:false`, `emptyOrError:false`, 0 console errors** (reverses 798fae1's "Network error"); `/compliance/settings` (Rules Engine UI, errorState:false). Regression: create 201 / dup 409 / bad-key 400 / sync {ingested:5} / login 200 / /health ok / API-direct detail 200-JSON — all PASS; connection-create audited (audit-log verify ok:true, 57 entries, HMAC-SHA256 chain intact). No fabricated green — POST-HYDRATION DOM asserted (not HTML-substring), every verdict traces to a live artifact. Canary skipped (0 DAU < 1000). Cleanup: no temp proxy created; seeded demo fixtures + test users retained (no DELETE endpoint / audit-log immutability — by design); cred/cookie/token temp files shredded. → **PROCEED_TO_V3-GATE** (return to head-verifier to close the V-block). [Chain closed: e3dd9b7 timestamp → 2ae3e06 connectionIds strict-key → 798fae1 detail-500-fnprop → e4debc6 detail same-origin-rewrite-collision — all 5 siblings fixed & proven.]

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
- [x] V-3 Fast-fix loop (or close) — 5-sibling render chain RESOLVED + all 4 surfaces LIVE (e4debc6); head-ci-cd APPROVED

LEARN:
- [ ] L-1 Docs
- [ ] L-2 Distill

NEXT:
- [ ] N-1 Survey & triggers
- [ ] N-2 Seed
- [ ] N-3 Handoff

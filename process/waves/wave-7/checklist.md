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
- [~] C-2 Deploy & verify — **V-3 companySchema-connectionIds re-verify @ 2ae3e06: REJECTED (head-ci-cd)**. The connectionIds fix (2ae3e06) is CORRECT & PROVEN: 2ae3e06 live on both services (api dcdb4ab4 dep d0bec3d9 / web 06b07f19 dep 2298ce0a via GIT_SHA variableUpsert auto-redeploy, meta.commitHash==2ae3e06, neither SKIPPED); /health==2ae3e06 on api's own domain, db ok. Armed rollback captured (api 83012c67 / web 13a28a77 = prior e3dd9b7 SUCCESS, unused). **ALL 3 fix-proof surfaces now render data in live headless-chromium DOM:** workspace /sourcing (4 rows Acme/Delta Systems/Bright Horizon/Epsilon, emptyState:false); **deep-screen /sourcing/companies renders all 4 company names, zero "No companies yet" markers — directly reverses the prior connectionIds REJECT**; /compliance/settings renders + /compliance/rules API 200 (compliance user; analyst correctly gated 307→/). connectionIds strict-key defect is DEAD. Regression: create 201 / dup 409 / bad-key 400 / login 200 / /health ok — all PASS. **BUT regression#3 FAILS: /sourcing/companies/:id detail → HTTP 500** (`__next_error__`, digest 3186490548, reproduced 3×). Root-caused from the web deployment's own runtime stack trace: NEW masked sibling defect (NOT connectionIds, NOT the api — api /sourcing/companies/:id → 401 healthy, RBAC resolves analyst w/o throw). Mechanism: Server Component `[id]/page.tsx` passes a function/event-handler prop (`onCandidateResolved`) to the Client Component `CompanyDetail` — illegal Next.js App Router Server→Client boundary crossing → RSC serializer throws. Iron Law: approving a green fix-proof while a required surface 500s = fabricated green → hard-stop. Canary skipped. Cleanup: temp fixture connection(s); test users left (audit-log immutability); creds scrubbed. → REWORK_B-block (fix `[id]/page.tsx` function-prop violation — make onCandidateResolved optional+omit OR wrap in a client shell; add SSR route-render test for /sourcing/companies/:id; DO NOT touch companySchema — that fix is proven), then re-run C-2. [Prior e3dd9b7 re-verify REJECTED for the connectionIds strict-key defect; this re-verify cleared connectionIds but surfaced the detail-route Server→Client function-prop 500 underneath.]

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

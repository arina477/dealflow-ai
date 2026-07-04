## Wave 6 stage completion

Seed: ff378a95-b86c-4d26-89e3-6e6072381d44 — Stand up data-source-connections store + pluggable DataSourceAdapter interface
Bundled siblings:
  - 0241222b-dda3-4606-bbc8-d15f5103a278 — Build ingestion/ETL service + on-demand SourceSyncJob into raw_companies staging
  - db274731-bba9-4276-b092-a32538027bf6 — Build dedupe engine promoting raw_companies to canonical companies+contacts with provenance
  - f5771d13-e3cf-4878-96fe-5d9056fa5944 — Build companies-contacts screen to view, filter, and clean deduped records
Active milestone: b372bbf7-09f3-4eb0-87df-28b5ec52bfc2 — M3 — Deal sourcing & company/contact data
Pending ritual outcomes affecting P-0: M3 is `## Class product-feature` → P-0 runs mvp-thinner. UI wave → D-block runs. Deal-source provider SDKs → P-3 SDK-research likely (external-sdk-integration-rules.md). Backlog under M3: 3 re-parented M1 follow-ups (bfadcec1, 6fe232e3, d7f716b4) available for P-0 unassigned/queue triage, NOT part of this bundle.

PRODUCT:
- [x] P-0 Frame (discover + reframe) — PROCEED (problem-framer + ceo-reviewer + mvp-thinner all PROCEED; carry: fixtures need cross-source dups; fixture adapter=no new SDK)
- [x] P-1 Decompose — PROCEED, multi-spec (4 tasks, ~4500 LOC), design_gap false (companies-contacts.html → D skips)
- [x] P-2 Spec — multi-spec data-spine contract in seed ff378a95 (4 blocks); cross-source-dedup + provenance + env-secrets carried
- [x] P-3 Plan — approach (6 arch deltas w/ alternatives) + file-level plan (24 steps, B-1..B-5); NO new external SDK (fixture adapter, JSON fixture zero-dep); schema additive+down; self-consistency CLEAN; gate flag: data-engineer catalog gap (→ backend-developer+postgres-pro)
- [x] P-4 Gate — PASSED (head-product APPROVED; karen+jenny APPROVE after databases.md-reconcile + contact_provenance remediation; Gemini 429)

DESIGN (skip block if non-UI wave):
- [ ] D-1 Brief
- [ ] D-2 Variants (with bounded iteration)
- [ ] D-3 Review & adopt

BUILD:
- [x] B-0 Branch & schema — branch wave-6-deal-sourcing; no new deps (fixture JSON); schema=YES(0004,7 tables@B-2); 4 tasks claimed
- [x] B-1 Contracts — sourcing types + DataSourceAdapter + roleRoutes /sourcing (e44a5fd); 390 tests; rbac.test updated
- [x] B-2 Backend — 7-table schema + dedupe engine (cross-source+provenance+idempotent PROVEN) + fixture ETL + audited resolve (f6071e7,299e7c1,43fe212); 247 tests
- [x] B-3 Frontend — companies-contacts screen at /sourcing/companies (view/filter/dedupe-review, no manual-create); 179 tests (952207d)
- [x] B-4 Wiring — repo typecheck+build PASS; /sourcing routes compile; 0004 journal-registered
- [x] B-5 Verify — lint 0-err, 816 tests pass, build pass; cross-source-dedup test present; runtime→C-2
- [x] B-6 Review — head-builder APPROVED (attempt-2, candidate-idempotency); /review 4 dedupe CRIT fixed (dbee1d0); commit-discipline mapped

CI/CD:
- [x] C-1 PR, CI & merge — CI green on exact HEAD 5f33c7c (typecheck/lint/build/audit/test all success, head_sha matches); pnpm audit gate passed; landed on main == origin/wave-6-deal-sourcing tip (squash). No formal C-1 deliverable file (bookkeeping gap → L-block), but substantive exit criteria independently verified.
- [ ] C-2 Deploy & verify — **RE-RUN #2 @ 96179b0: FAIL (build-asset defect, routed to B-block)**. DI boot crash FIXED — dealflow-api now boots clean (SourcingModule initialized, no UnknownDependenciesException); api+web deployed SUCCESS @ 96179b0 (exact-SHA serviceInstanceDeployV2); migration 0004 APPLIED + verified live (7 tables + 2 partial-unique indexes via temp DB proxy); /health version=96179b0 (deployed-hash verified, GIT_SHA bound). BUT new defect: `POST /sourcing/connections/:id/sync` → HTTP 500 — `FixtureDataSourceAdapter ENOENT dist/modules/sourcing/fixtures/companies.fixture.json`. Root cause: nest-cli.json lacks a `compilerOptions.assets` directive, so the fixture JSON isn't emitted to the compiled dist/ (green-CI/broken-runtime). LIVE dedupe payoff NOT run (sync is the entry point; clean abort, 0 rows, no partial data). Classified `build`, routed to devops-engineer; fix authored+locally-verified (assets glob → dist asset lands), NOT committed. head-ci-cd verdict REJECTED → REWORK_B_BLOCK; STATUS: BLOCKED (trigger d hard-stop). Fix path: B-block commits nest-cli.json assets fix (+regression assertion) → fresh PR → C-1 green → merge → re-run C-2. Temp TCP proxy + seeded connection cleaned up.

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

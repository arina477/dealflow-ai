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

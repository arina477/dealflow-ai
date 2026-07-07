## Wave 18 stage completion

**Seed:** a5ba8068-2e1b-48ea-83d9-6da739a41e2b — Build advisor-insights analytics aggregation service (workspace-scoped, RLS-honoring)
**Bundled siblings:**
- 9e05828b-38dd-475c-9f82-cd5ac4565fff — Expose shared-Zod-typed analytics API endpoint(s) with RBAC-scoped read
- 4b014689-8e12-4560-95c9-5b0ae4d2f4fc — Build the /insights advisor analytics dashboard page (Next.js 15)
**claimed_task_ids:** [a5ba8068-2e1b-48ea-83d9-6da739a41e2b, 9e05828b-38dd-475c-9f82-cd5ac4565fff, 4b014689-8e12-4560-95c9-5b0ae4d2f4fc]
**Active milestone:** 099cee10-562d-4e56-9a57-0dade2914760 — M9 — Integrations & insight (H2/T4) — in_progress
**Bundle theme:** M9 FIRST vertical — advisor insights & analytics. An analytics aggregation service (mandate throughput, outreach response rates, advisor productivity, match accept/reject-disposition rates) computed over ALREADY-SHIPPED live tables (M2 audit READ-ONLY, M3 companies/contacts, M4 mandates+buyer_universe, M5 match_candidates.disposition, wave-11 outreach, wave-12 pipeline/pipeline_events) → a shared-Zod-typed RBAC-scoped GET analytics endpoint → an /insights Next.js dashboard page. Additive-only (rollback = drop optional summary cache + remove route/schema/page). Zero credential/vendor/spend/LLM/SDK.

**Carry-forward notes for P-0:**
- **Milestone disposition this wave (wave-17 close):** M8 "Pilot-partner workspace (data isolation)" CLOSED in_progress→done — pilot scope shipped & live-verified as the non-superuser dealflow_app role (deny-by-default workspace-scoped FORCE RLS @591b3f8). BOARD 7/7 APPROVE-A, 0 HARD-STOP (strict Tier-3 bar cleared), decision-slug N-1-milestone-disposition-M8-wave-17 (full record: process/waves/_archive/wave-17/escalations/). M9 "Integrations & insight" promoted todo→in_progress.
- **FOUNDER-CREDENTIAL / SPEND GUARD (why this seed, not the oldest):** M9 also holds task 345dfbc6 "Implement first real DataSourceAdapter" — DEFERRED, founder-blocked on a deal-source VENDOR selection (= spend hard-stop → founder, NOT BOARD) + an account-issued API key (rule-6 exception). It was NOT seeded (would deadlock the wave on a founder decision). It stays queued under M9 for a future wave once the founder chooses a vendor + supplies the key. This wave's seed is the buildable credential-free analytics vertical instead.
- **BLOCKING H3/M11 hardening carry (surfaced to founder digest):** GAP-2 write-path fail-closed (2867d087) was re-homed M8→M11 as a BLOCKING M11 pre-req. It is a REAL fail-closed-on-write gap (`workspaceId ?? DEFAULT_WORKSPACE_ID` INSERT fallback, repo-wide 14+ files) — INERT for the single pilot firm (only the default workspace exists; reads RLS-protected regardless; architect-reviewer verified exactly ONE `INSERT INTO workspaces` in the repo = the migration seed, no app path creates a 2nd) but MUST land before any 2nd firm / multi-tenant provisioning. Do NOT build on it; do NOT let a 2nd-workspace path ship before it. BOARD-recommended (non-blocking, plan into M11): a runtime assertion refusing workspace-count > 1 until the fail-closed sweep lands.
- **M8 process debt re-homed to M10:** GAP-4 (fd8f2860, standing populated-DB migration-proof AC for WORM/audit tables) + GAP-5 (1a1c5855, RLS runtime/migrate connection-split doc + coupled rollback) — both under M10 Advanced compliance & recordkeeping, claimable when M10 activates.
- **Build guardrails for this analytics wave:** every read MUST honor the M8 workspace RLS + per-request GUC (no superuser/BYPASSRLS/GUC-bypass path — that would re-open cross-firm visibility). Any read touching the audit log stays READ-ONLY over the HMAC-SHA256 chain (never write/mutate). RBAC-scope the endpoint (advisor/compliance role read). Additive-only schema; any perf cache is a materialized-summary table (rollback = drop it). Shared-Zod contract on the API boundary (project convention).
- **Founder-pending (non-blocking, re-surfaced at wave close — carried in .last-wave-completed pending_founder_decisions):** (1) deal-source VENDOR selection + API key (blocks M9 345dfbc6 real-adapter slice + CRM adapters); (2) email-provider/DKIM credential #141 (blocks M6 compliant send + M7 sending-domain leg); (3) LLM-spend (blocks M5 + AI-rationale/drafting slices); (4) M8 ## Success metric quantitative target was `_TBD by founder_` (pilot met on the qualitative target + negative-read proof; tightening optional for roadmap-planning).
- **Unassigned queue depth 1** at wave-17 close (b1a0b2ac — /health spec wording for future observability waves) → P-0 walks it.
- **P-block note:** M9 Class product-feature → P-0 runs mvp-thinner. This bundle IS a UI wave (/insights dashboard page) → D-block runs (design gap: new analytics/insights surface). Analytics reads over compliance-adjacent data → confirm whether the security-scope-tightened gate applies at P-4 (workspace-RLS-honoring reads; audit-log reads must stay read-only).

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
- [ ] L-2 Distill

NEXT:
- [ ] N-1 Survey & triggers
- [ ] N-2 Seed
- [ ] N-3 Handoff

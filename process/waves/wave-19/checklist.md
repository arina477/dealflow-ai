## Wave 19 stage completion

**Seed:** 5568ad44-3702-46d5-809a-40c1de0a2035 — Build match-calibration feedback aggregation service (workspace-scoped, RLS)
**Bundled siblings:**
- 69387b56-2366-4343-809d-3a6e75129753 — Add shared-Zod match-feedback contracts to packages/shared
- e206a56a-b98a-4533-b31e-ba91fae6327e — Expose RBAC-scoped match-feedback API endpoint (advisor+admin read)
- 077974a2-9be9-4a29-a13e-6ac1d7b78e35 — Add score-calibration feedback section to the /insights dashboard
**claimed_task_ids:** [5568ad44-3702-46d5-809a-40c1de0a2035, 69387b56-2366-4343-809d-3a6e75129753, e206a56a-b98a-4533-b31e-ba91fae6327e, 077974a2-9be9-4a29-a13e-6ac1d7b78e35]
**Active milestone:** 099cee10-562d-4e56-9a57-0dade2914760 — M9 — Integrations & insight (H2/T4) — in_progress
**Bundle theme:** M9 matching-feedback-loop vertical — learn from accept/reject. A score-calibration feedback aggregation service correlating match_candidates.disposition (accepted/rejected/flagged) × fit_score × score_breakdown over ALREADY-SHIPPED live tables (M5 match_run/match_candidates, wave-17 workspace RLS) → a shared-Zod-typed RBAC-scoped GET feedback endpoint (advisor+admin read) → a score-calibration section on the existing /insights Next.js dashboard. Additive-only (rollback = drop optional summary cache + remove route/schema/dashboard section). Zero credential/vendor/spend/LLM/SDK. Distinct from the shipped analytics getMatchDisposition (raw counts) — this correlates disposition × score for calibration insight.

**Carry-forward notes for P-0:**
- **Milestone disposition this wave (wave-18 close):** M9 "Integrations & insight" STAYS in_progress. The analytics half shipped this wave (3 done: /insights dashboard + analytics API + workspace-scoped aggregation service, LIVE @5c86cf5, V-block APPROVED). M9 NOT closed — open_count=2 and substantial ## Scope remains (founder-gated CRM adapters + multi-channel outreach + seller intent + this feedback-loop thread). No promotion (slot occupied).
- **FOUNDER-CREDENTIAL / SPEND GUARD (why this seed, not the oldest):** M9 holds task 345dfbc6 "Implement first real DataSourceAdapter" — DEFERRED, founder-blocked on a deal-source VENDOR selection (= spend hard-stop → founder, NOT BOARD) + an account-issued API key (rule-6 exception). It is the STRICT oldest seed candidate but was NOT seeded (would deadlock the wave on a founder decision). It stays queued under M9 for a future wave once the founder chooses a vendor + supplies the key. This wave's seed is the buildable credential-free matching-feedback vertical instead (N-2 Action 1 scope-needs re-order).
- **FOUNDER-GATED PILE-UP (non-blocking, surfaced to founder digest):** (1) deal-source VENDOR selection + API key → blocks M9 345dfbc6 real-adapter + CRM adapters; (2) email-provider/DKIM credential #141 → blocks M6 compliant send + M7 sending-domain leg; (3) LLM-spend → blocks M5 + AI-rationale/drafting slices. All await founder decisions; loop continues on buildable work.
- **BLOCKING H3/M11 hardening carry (still open):** GAP-2 write-path fail-closed (2867d087) re-homed M8→M11 as a BLOCKING M11 pre-req (workspaceId ?? DEFAULT_WORKSPACE_ID INSERT fallback, repo-wide). INERT for the single pilot firm but MUST land before any 2nd firm / multi-tenant provisioning. Do NOT build on it; do NOT let a 2nd-workspace path ship before it.
- **M8 process debt re-homed to M10:** GAP-4 (fd8f2860, populated-DB migration-proof AC for WORM/audit tables) + GAP-5 (1a1c5855, RLS runtime/migrate connection-split doc + coupled rollback) — under M10, claimable when M10 activates.
- **Build guardrails for this feedback-loop wave:** every read MUST honor the wave-17 workspace RLS + per-request GUC (no superuser/BYPASSRLS/GUC-bypass — that re-opens cross-firm visibility). RBAC-scope the endpoint (advisor + admin read). Additive-only schema; any perf cache is a materialized-summary table (rollback = drop it). Shared-Zod contract on the API boundary (project convention). Mirror the shipped analytics vertical (analytics.repository.ts / analytics.controller.ts / packages/shared/src/analytics.ts / apps/web/app/(app)/insights/page.tsx).
- **Unassigned queue depth 1** at wave-18 close → P-0 walks it.
- **P-block note:** M9 Class product-feature → P-0 runs mvp-thinner. This bundle IS a UI wave (new /insights section) → D-block runs if it introduces a new design surface (or reuses the shipped analytics design — D-block may skip if no new design gap). Reads over compliance-adjacent match data → confirm whether the security-scope-tightened gate applies at P-4 (workspace-RLS-honoring reads).

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
- [ ] V-2 Triage
- [ ] V-3 Fast-fix loop (or close)

LEARN:
- [ ] L-1 Docs
- [ ] L-2 Distill

NEXT:
- [ ] N-1 Survey & triggers
- [ ] N-2 Seed
- [ ] N-3 Handoff

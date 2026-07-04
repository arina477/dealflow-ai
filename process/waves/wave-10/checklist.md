## Wave 10 stage completion

Seed: 47ed7ddd-f384-490c-9529-6143dd4701da — Build deterministic match spine + rule-based pre-score service
Bundled siblings:
  - fb82d339-27dd-4c5d-9819-9bf72e3baa9b — Build /matches-shortlist ranked-list page with fit-scores and disposition
  - f74dce45-a644-4ffc-a931-44383fcebe24 — Persist accept/reject/flag shortlist with ready-for-outreach handoff marker
Claimed task IDs (B-0 claims this batch): 47ed7ddd, fb82d339, f74dce45
Active milestone: d72b4510-0ddb-4cf6-b494-ccbaa64aa633 — M5 — AI buyer-seller matching (ranked + rationale) (in_progress; promoted at wave-9 N-block. This is M5's FIRST bundle = the deterministic match spine + pre-score, the load-bearing container the later LLM-rationale bundle reads.)

Pending ritual outcomes / P-0 flags affecting wave-10:
  - M5 is `## Class product-feature` → P-0 runs mvp-thinner.
  - UI wave (/matches-shortlist page + mandate-detail "Ranked Candidates" D6 anchor wiring) → D-block runs (unless designs already exist for matches-shortlist → verify at P-1 design_gap_flag; matches-shortlist.html was designed + approved per product-decisions.md 20-screen set → D-block likely SKIPS on design_gap_flag FALSE).
  - Reuse-heavy vertical slice: read the SHIPPED wave-9 buyer_universe (submitted/ready-to-rank) + its included candidates + attached M3 contacts + the mandate_buyer_criteria; M1 RolesGuard (advisor-primary RBAC per M5 metric — advisor accepts/rejects to build shortlist; admin too); M2 AuditService.append (last-in-txn on every match mutation, HMAC hash-chain); getUserWithRole actor-id; web read-schema passthrough + SSR-hydrate.
  - Vertical slice = match data spine + deterministic scoring service (additive match_run FK→mandate/buyer_universe + match_candidates FK→buyer_universe_candidates, integer fit_score 0-100 deterministic + disposition; MatchingService rule-based pre-score + shared-Zod API) [seed 47ed7ddd] + /matches-shortlist page (ranked list + fit-score + deterministic breakdown + accept/reject/flag, SSR-hydrate) [sibling fb82d339] + accept/reject/flag→shortlist persistence + ready-for-outreach handoff marker [sibling f74dce45]. Delivers rank→view/explain→shortlist→mark-ready end-to-end on DETERMINISTIC scores.
  - HARD BOUNDARY (deterministic-only this bundle): NO Anthropic/Claude/LLM call, NO BullMQ async job, NO rationale-text generation. fit_score is a deterministic integer 0-100 from rule-based fit vs mandate criteria. The LLM-assisted ranking + explainable rationale is a LATER M5 bundle.
  - HARD BOUNDARY (M5/M6): shortlist→outreach is a ready-for-outreach status flip / persisted shortlist rows M6 consumes ONLY. NO outreach send, NO email, NO pre-send compliance gate (that's M6).
  - Schema additive only (no destructive ORM/migration; include rollback note); NO new external SDK this bundle; no founder-blocked dependency. Buildable end-to-end against shipped wave-9 buyer_universe (main @ 937ae18).

WAVE-10 CARRY-FORWARDS from wave-9 BOARD (7/7 APPROVE) — enforce at the RELEVANT stage:
  - These bind the LATER LLM-rationale M5 bundle, NOT this first deterministic bundle. Recorded so P-0/P-3/P-4 of the LLM wave apply them: (a) Anthropic/Claude SDK → external-sdk-integration-rules at P-3; (b) provider-agnostic LLM gateway (Claude behind a NestJS interface) MUST land in the SAME wave as the SDK (vendor-lock-in guard); (c) zero-retention enterprise DPA endpoint only (no CIM/seller-financial payloads to consumer LLM; no proprietary graph/criteria into training); (d) explainable rationale over RBAC-scoped single-mandate context only + logged as audit read event (verify at that wave's P-4); (e) load-test + explainability evidence at P-4; (f) LLM API SPEND = founder Tier-3 (money) at P-0/P-4 (likely cost-ceiling, not vendor pick — Claude is established engine).
  - Since THIS first bundle is deterministic-only, NONE of (a)-(f) gate wave-10; they surface when the LLM bundle is decomposed.

Unassigned queue at handoff: 1 (b1a0b2ac — /health spec wording; P-0 walk candidate).
Backlog re-homed at wave-9 close (clean future seeds, not this wave): 6fe232e3 auth-hardening→M10 (SECURITY-DEBT FLAG: pull forward before any public/pilot auth surface goes live); d7f716b4 AppShell-polish→M7 (resolve before first real pilot login); bfadcec1 test-fixture-typing→M7.
Deferred (founder-blocked): 345dfbc6 — first real DataSourceAdapter vendor selection + spend gate → M9 (surfaced, non-blocking).

PRODUCT:
- [x] P-0 Frame (discover + reframe) — PROCEED (all 3 aligned; deterministic-vs-LLM + M5/M6 boundaries held); no-prior-spec; wave 10 opened
- [x] P-1 Decompose — PROCEED, multi-spec (3 tasks: spine+page+accept/reject); ~2.8-4.2k LOC; design_gap_flag FALSE (design exists → D skips)
- [x] P-2 Spec — multi-spec (3 blocks: spine+page+accept/reject) in seed 47ed7ddd
- [x] P-3 Plan — new matching module (2 tables 0009 + deterministic MatchingService + page); reuse M4/M3/M1/M2; no new dep/SDK/secret; deterministic-vs-LLM + M5/M6 boundaries
- [x] P-4 Gate — PASSED (head-product APPROVED; karen+jenny APPROVE; B-3 strip-AI-framing mandatory; Gemini 429)

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

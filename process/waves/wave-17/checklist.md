## Wave 17 stage completion

**Seed:** 0db154ff-31f1-45c4-85cd-71d34d65c437 — Add workspaces anchor + workspace_id scoping column across tenant tables
**Bundled siblings:**
- e45ba68c-80f3-475e-a240-54c23ea9ccb2 — Enforce deny-by-default Postgres row-level security scoped by workspace_id
- 96026365-77b2-4763-bf57-705fbf340ba8 — Propagate authenticated user workspace into every request-scoped DB session
- df2f3b2f-6e7d-4f39-a6ab-7ca49020e967 — Prove cross-tenant isolation with a negative-read integration test
**claimed_task_ids:** [0db154ff-31f1-45c4-85cd-71d34d65c437, e45ba68c-80f3-475e-a240-54c23ea9ccb2, 96026365-77b2-4763-bf57-705fbf340ba8, df2f3b2f-6e7d-4f39-a6ab-7ca49020e967]
**Active milestone:** 9ed98c3c-8cb8-4736-8337-22dc0dae48d4 — M8 — Pilot-partner workspace (data isolation) (H2/T4) — in_progress
**Bundle theme:** M8 FIRST vertical — data isolation for ONE external design-partner advisory firm. workspace_id scoping + deny-by-default Postgres row-level security over EXISTING tables, request-scoped workspace propagation into the DB session, and an adversarial cross-tenant negative-read test. Additive-only schema (rollback = drop column/table + DISABLE RLS). NOT full multi-tenant SaaS (that is H3/M11).

**Carry-forward notes for P-0:**
- **Milestone disposition this wave:** M8 was promoted todo→in_progress at wave-16 close (BOARD 7/7 forward-motion, decision-slug N-1-milestone-disposition-M7-wave-16). M7 "Admin & settings" went in_progress→BLOCKED — its 2 substantive success-metric legs (data-source connect, invite+roles) are shipped & LIVE; the 3rd (sending-domain DKIM/SPF/DMARC verify) is founder-gated on email-provider credential #141 (same gate as M6), held blocked per the M5/M6 honest-external-hold precedent (Hallucinated-Milestone-Completion avoided).
- **BOARD build-time guardrails (MANDATORY — encoded in the bundle):** RLS must be enforced at the DB row level (NOT app-layer only), deny-by-default, and every tenant-scoped table must be covered — a table missed by the retrofit = cross-firm M&A deal-data leak (catastrophic confidentiality breach). The negative-read sibling (df2f3b2f) is the proof gate: firm A must NOT be able to read firm B's rows. counter-thinker asked for a deny-by-default enumeration test that fails CI on any unlisted tenant-scoped table — P-3/B-block should honor this.
- **Isolation contract reference:** command-center/dev/architecture/security.md (RBAC / object-level-authz / audit contract — the isolation predicate the build siblings implement against). Builds only on shipped-and-live M1 Auth&RBAC, M2 immutable audit log, and M7 admin-workspace-settings.
- **Migration discipline (risk-officer):** workspace_id rollout follows expand-contract — nullable column, backfill, CONCURRENTLY indexes, lock_timeout; mandatory tenant-ID scoping on every Drizzle query. Additive-only; no destructive ORM.
- **Security/compliance gate:** tenant-isolation + RLS + auth-context → P-block MUST run the security-scope-tightened + SoD/RBAC gate. T-8 Security MUST carry the cross-tenant negative-read invariant.
- **Likely NOT a UI-heavy wave:** primarily DB + API middleware + test. D-block may skip if no new user-facing surface (P-1 sets design_gap_flag).
- **Founder-pending (non-blocking, re-surface at wave close):** (1) M8 ## Success metric QUANTITATIVE target is `_TBD by founder_` — build proceeds against the qualitative "no cross-firm data visibility" target + negative-read test; founder may tighten. (2) email-provider/DKIM credential #141 — now blocks BOTH M6 send AND M7 sending-domain leg; wave-count watchdog fires. (3) LLM-spend (M5). See process/session/updates/digest-2026-07-06-M7-disposition.md.
- **Standalone M7 backlog (blocked milestone, tracked, reversible):** 3 V-2 wave-16 Low hardening gaps (be2d9717 fieldMapping constrain — risk-officer flags prioritize early; a65cf75e advisory-lock key width; 8f24c4c7 opaque cursor) + bfadcec1 test-fixture-typing carryover. Stay parented to M7; surface when M7 reopens (on #141) or via a future P-0 walk if re-homed.
- **Unassigned queue depth 1** at wave-16 close → P-0 walks it.

PRODUCT:
- [ ] P-0 Frame (discover + reframe)
- [ ] P-1 Decompose
- [ ] P-2 Spec
- [ ] P-3 Plan
- [ ] P-4 Gate

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
- [ ] C-1 PR/CI/merge
- [ ] C-2 Deploy & verify

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

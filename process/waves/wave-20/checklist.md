## Wave 20 stage completion

**Seed:** d45c73b5-39bc-4a8a-a5c3-65d12b0cb5eb — Add outreach_activity table + additive migration (workspace-scoped, RLS, WORM-free)
**Bundled siblings:**
- 5c12ac3a-87f6-43d0-9674-5c39a7b029ee — Build outreach-activity service with RLS + audit-logged mutations (workspace-scoped)
- c3776cac-8f37-47fb-81f4-ea9ef72b6f29 — Add shared-Zod outreach-activity contracts to packages/shared
- b2acf4ce-bc2a-48b9-9e28-87c26b34d37c — Expose RBAC-scoped outreach-activity API + build the outreach-touches UI panel
**claimed_task_ids:** [d45c73b5-39bc-4a8a-a5c3-65d12b0cb5eb, 5c12ac3a-87f6-43d0-9674-5c39a7b029ee, c3776cac-8f37-47fb-81f4-ea9ef72b6f29, b2acf4ce-bc2a-48b9-9e28-87c26b34d37c]
**Active milestone:** 099cee10-562d-4e56-9a57-0dade2914760 — M9 — Integrations & insight (H2/T4) — in_progress
**Bundle theme:** M9 thread 4 (multi-channel outreach) — INTERNAL outreach-activity/task tracker vertical. Log call/email/LinkedIn touches as internal records (channel + status + due date + optional deal-target link; NO external send). New `outreach_activity` table (additive) → workspace-scoped RLS + audit-logged service → shared-Zod contract → RBAC-scoped API (advisor+admin write, analyst/compliance 403) + a /outreach UI panel. First MUTABLE write surface of the milestone (prior 2 M9 bundles were read-only), so it genuinely exercises the M2 HMAC-SHA256 audit chain.

**Carry-forward notes for P-0:**
- **Milestone disposition (wave-19 close):** M9 STAYS in_progress. Two insight halves SHIPPED (wave-18 analytics /insights; wave-19 match-calibration feedback, LIVE @3cc58de, V-block APPROVED). M9 NOT closed — open_count=2, and ## Scope still has the founder-gated CRM thread + this outreach thread + seller-intent thread. No promotion (slot occupied — legal parked-in_progress state).
- **FOUNDER-CREDENTIAL / SPEND GUARD (why this seed, not the oldest):** M9 holds `345dfbc6` "Implement first real DataSourceAdapter" — DEFERRED, founder-blocked on a deal-source VENDOR selection (spend hard-stop → founder) + account-issued API key. It is the strict-oldest seed candidate but was NOT seeded (would deadlock the wave). Stays queued under M9 for a future wave once the founder decides. This wave's seed is the buildable credential-free outreach-activity vertical (N-2 Action 1 scope-needs re-order).
- **CREDENTIAL-FREE guard for THIS wave:** actual LinkedIn/phone/email SENDING is founder-gated and OUT OF SCOPE — build internal activity RECORDS only (no ESP, no LinkedIn API, no webhook, no LLM, no new SDK, no spend). If the build tempts external send, stop and surface — do not wire a credentialed provider.
- **FOUNDER-GATED PILE-UP (non-blocking, surfaced to founder digest `digest-2026-07-07-M9-metric-and-gated-pileup.md`):** (1) deal-source VENDOR + API key → M9 345dfbc6 / CRM adapters; (2) email-provider/DKIM #141 → M6 send + M7 sending-domain; (3) LLM-spend → M5 + AI-rationale/drafting. All await founder decisions; loop continues on buildable work.
- **M9 `_TBD` success metric:** surfaced to the same digest for a founder poll. Must be set before M9 can ever close; NOT blocking now.
- **BLOCKING H3/M11 hardening carry (still open):** GAP-2 write-path fail-closed (2867d087) re-homed M8→M11 as a BLOCKING M11 pre-req (workspaceId ?? DEFAULT_WORKSPACE_ID INSERT fallback). INERT for the single pilot firm but MUST land before any 2nd firm / multi-tenant provisioning. NEW outreach_activity INSERTs this wave MUST set workspace_id explicitly (do NOT lean on the DEFAULT fallback) and honor the RLS GUC — do not re-open cross-firm visibility.
- **M8 process debt re-homed to M10:** GAP-4 (populated-DB migration-proof AC for WORM/audit tables) + GAP-5 (RLS runtime/migrate connection-split doc + coupled rollback) — under M10, claimable when M10 activates. GAP-4 lesson applies HERE: prove the additive migration on a POPULATED DB (empty + populated) — but note outreach_activity is a plain mutable table, NOT under the WORM regime, so no trigger-disable-wrap collision (unlike wave-17 audit_log backfill).
- **M9 open follow-up `1d95cac0`** (spec/test-fixture process hardening, wave-18 V-2) is still todo with wave_id=wave-18 set — a leftover, NOT a valid seed. Leave it; a future planning/checkpoint pass should re-home or claim it.
- **Unassigned queue depth 1** at wave-19 close → P-0 walks it.
- **P-block:** M9 Class product-feature → P-0 runs mvp-thinner. UI wave (new /outreach panel) → D-block runs if a new design surface is introduced (or reuse the shipped app-shell/table design — D-block may skip if no new design gap). Mutating writes over compliance-adjacent data → the security-scope-tightened gate likely applies at P-4 (RBAC/SoD + RLS + audit-chain acceptance criteria).

### Stage ledger (fill as wave 20 progresses)
- [x] P-0 Frame
- [x] P-1 Decompose
- [x] P-2 Spec
- [x] P-3 Plan
- [x] P-4 Gate
- [ ] D-block (if UI design gap)
- [x] B-0..B-6
- [x] C-1 (CI green @86ddc29; 5/5 jobs; outreach-activity-rls+migration e2e ran+passed; 5 fix-up cycles) / [x] C-2 (both services SUCCESS @86ddc29; migration 0018 applied+populated-safe; /health db:ok; anon /outreach-activity 401; audit intact; canary skipped 0 DAU; rollback armed)
- [ ] T-1..T-9
- [ ] V-1..V-3
- [ ] L-1 / L-2
- [ ] N-1 / N-2 / N-3

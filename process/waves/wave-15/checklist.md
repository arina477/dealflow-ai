## Wave 15 stage completion

**Seed:** 82ec8724-3f9e-45bd-8e81-e4e3fab8872d — Build user-management admin vertical: invite, assign-role, deactivate (last-admin guard, SoD)
**Bundled siblings:**
- 648a86a6-024b-4fce-9212-1e637ee16765 — Build workspace + firm-profile settings with default compliance profile cascade
- 41c017f7-0665-4fca-b95f-82fbf8962178 — Add data-source connection admin management UI + encrypted-at-rest credential form
- d7f716b4-d451-4095-8b43-9fbe4e85fcf8 — AppShell polish: placeholder pages for role-nav items + TopBar per-route title (re-parented carry-forward)
**claimed_task_ids:** [82ec8724-3f9e-45bd-8e81-e4e3fab8872d, 648a86a6-024b-4fce-9212-1e637ee16765, 41c017f7-0665-4fca-b95f-82fbf8962178, d7f716b4-d451-4095-8b43-9fbe4e85fcf8]
**Active milestone:** 08d3053a-48fb-4562-a25b-6d99d40b0f62 — M7 — Admin & settings (H1/T3) — in_progress
**Bundle theme:** M7's first buildable-without-credential admin vertical — user management + workspace/firm-profile settings + data-source connection UI + AppShell shell polish. ~3,500–4,500 net LOC, ≤~50 files, additive-only schema (rollback = drop added table/column/index).

**Carry-forward notes for P-0 (BOARD 7/7-approved dissent — N-1-milestone-disposition-wave-14):**
- **CREDENTIAL GUARD (realist + counter-thinker):** M7's DKIM/SPF/DMARC sending-domain-verification is credential-seamed (DNS-record generation typically needs the ESP API — the SAME #141 email-provider credential that blocks M6). This bundle is scoped buildable-without-credential: user-mgmt, workspace/firm-profile settings, and the data-source credential-MANAGEMENT form (paste-key, encrypted-at-rest storage) — NOT DKIM/DMARC record generation, NOT live domain-verify, NOT live data-source connection-TEST. Do NOT expand P-1 scope into the credential-seamed paths — they defer with #141.
- **Security/compliance gate (risk-officer + industry-expert):** M7 touches admin/RBAC/user-management/sending-identity → P-block MUST run the security-scope-tightened + SoD/RBAC gate. Audit/compliance tables append-only (WORM). Every admin mutation (role assign, deactivate, settings change) audited last-in-txn via M2 AuditService.append. Server-side last-admin guard (race-safe).
- **UX honesty (user-advocate):** any sending-settings / verify UI must honestly surface the not-yet-sendable state in plain language ("connect an email account to enable sending") — no dead/dangling Verify/Send affordance that can't function without the deferred credential.
- **M6 remains BLOCKED** on founder email-provider credential #141 + LLM-spend (surfaced non-blocking at process/session/updates/founder-decision-m6-send-credential.md + founder-decision-llm-matching-spend.md). Wave-count watchdog re-surfaces at each wave close until answered. If the founder supplies the credential, M6 flips blocked→in_progress and its send bundle decomposes.
- **Unassigned queue (P-0 walk):** b1a0b2ac "Tighten /health spec wording" (low-salience observability nicety; assign or defer). bfadcec1 "Tighten test-fixture typing" is an unparented M7-linked testing-infra debt seed (intentionally NOT in this bundle; candidate for a future testing-infra wave).
- **UI wave:** seed + siblings ship admin pages (admin-users, admin-workspace-settings, admin-integrations) → D-block likely fires (design_gap_flag at P-1). d7f716b4 replaces the "Team"/"Settings" nav 404 placeholders.

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

## Wave 16 stage completion

**Seed:** 904a3c25-ab46-4050-8122-d998e5a6f2a1 — Wire firm default-compliance-profile cascade into mandate creation
**Bundled siblings:**
- 6f1a96da-d96f-4bdc-b572-5255b493653c — Add admin nav entry / in-app link to /admin/integrations (+ confirm /admin/users, /admin/settings nav-reachable)
- c54db02d-c531-4292-a246-6ba984166ce9 — Invite duplicate/existing-user handling (409 or idempotent)
- 042cf4e6-5d3f-42ad-8c06-3c67404ab8e1 — Reactivate/undo for soft-deactivated users (+ V-1 prod-fixture/sentinel cleanup)
- 2560fecc-bb12-483d-8f63-a801db6c71b1 — Guard config JSONB blob against holding raw secrets
**claimed_task_ids:** [904a3c25-ab46-4050-8122-d998e5a6f2a1, 6f1a96da-d96f-4bdc-b572-5255b493653c, c54db02d-c531-4292-a246-6ba984166ce9, 042cf4e6-5d3f-42ad-8c06-3c67404ab8e1, 2560fecc-bb12-483d-8f63-a801db6c71b1]
**Active milestone:** 08d3053a-48fb-4562-a25b-6d99d40b0f62 — M7 — Admin & settings (H1/T3) — in_progress
**Bundle theme:** M7 admin-hardening vertical — closes the wave-15 V-2 follow-up gaps: consume firm compliance defaults into mandate-create (the real feature gap), admin nav reachability, invite dedup conformance, user reactivate path, and config-JSONB secret guard. Additive-only where schema is touched (rollback = drop added column/index/endpoint).

**Carry-forward notes for P-0:**
- **Seed provenance:** these 5 rows are wave-15 V-2 (V-1-jenny) follow-ups (F-1/F-3/F-4/F-5/F-6). N-2 nulled their wave_id + re-parented 4 under the F-1 seed to form this bundle. All read shipped-and-live wave-15 M7 surfaces (workspace_settings, /admin/integrations, users, data_source_connections) — no ghost deps, no open-PR dependency.
- **F-1 (seed) is the M7↔M4 boundary:** at mandate-create, fall back to workspace_settings for unset compliance fields (default_jurisdiction/default_disclaimer/default_suppression). NO retroactive mutation of existing mandates. Add the mandate-inherits-firm-default test the wave-15 T-block lacked.
- **F-5 carries an app-DB cleanup obligation (separate from brain DB):** advisor1@example.com left deactivated_at non-null in prod by wave-15 V-1 live testing → restore. Karen minted 3 throwaway prod records during V-1 (KAREN-V1-SENTINEL cred on an integrations row + throwaway admin users) → purge/neutralize WORM-safe (audit-referenced users get deactivated+renamed, not hard-deleted).
- **Security/compliance gate:** touches admin/RBAC/user-management → P-block MUST run the security-scope-tightened + SoD/RBAC gate. Every admin mutation (reactivate, config write) audited last-in-txn via M2 AuditService.append. Reactivate + invite-dedup must hold SoD/RBAC (admin-only). F-6 config-secret guard: validate/deny secret-shaped values, do NOT log config on error.
- **Likely UI wave:** admin nav + reactivate UI → D-block may fire (design_gap_flag at P-1). Non-destructive config guard is backend-forward.
- **Standalone future seed (NOT in this bundle):** bfadcec1 "Tighten test-fixture typing in wave-1 health tests" — unparented M7-linked testing-infra debt; candidate for a future testing-infra wave.
- **M6 remains BLOCKED** on founder email-provider credential #141 + LLM-spend (non-blocking, re-surfaces at wave close). M7 sending-domain DKIM/DMARC verify still credential-seamed (#141) — do NOT expand P-1 scope into it.
- **Unassigned queue depth 1** at wave-15 close → P-0 walks it.

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

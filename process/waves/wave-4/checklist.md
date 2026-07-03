## Wave 4 stage completion

**Wave:** 4
**Active milestone:** M2 — Compliance backbone: tamper-evident audit log + rules engine (`2f116b9b-0338-421d-a9ad-899a11403aff`, in_progress)
**Seed task:** ec1f279d-ea8a-44db-977b-cb6891972c1f — Stand up tamper-evident audit_log_entries table with INSERT-only enforcement
**Bundled siblings:** a8b2b5a2-18c5-46a3-a430-bb36e492500f (HMAC-SHA256 hash-chained AuditLog append service), e6a4cbfe-121b-4fdc-8ae4-85db7e434378 (chain-integrity verifier + verification endpoint), 031d79fc-7513-4571-b0c9-8f43590fc9bf (compliance-settings screen with audit-log integrity view)
**claimed_task_ids (B-0 claims this list):** [ec1f279d-ea8a-44db-977b-cb6891972c1f, a8b2b5a2-18c5-46a3-a430-bb36e492500f, e6a4cbfe-121b-4fdc-8ae4-85db7e434378, 031d79fc-7513-4571-b0c9-8f43590fc9bf]
**Slice:** M2 first vertical slice — the tamper-evident audit-log service (DB migration: `audit_log_entries` sequence_number PK + INSERT-only grant + BEFORE UPDATE/DELETE trigger, content_hash vs payload_hash distinct → HMAC-SHA256 hash-chain append service with Railway-secret key + chain_version → chain-integrity verifier + RBAC-guarded endpoint → compliance-settings screen with integrity view). Load-bearing dependency for M2's rules engine + callable pre-send compliance check (deferred to a later M2 bundle). Vertical slice (DB + service + API + UI). UI wave (compliance-settings screen) → D-block runs unless P-1 finds mockups exist.
**Note (from N-1/N-3):** M1 closed done in wave-3 (shipped + live-verified 935b847). 3 M1 non-core follow-ups re-parented to M2, still claimable as future-wave candidate seeds (do NOT block this bundle): bfadcec1 (test-fixture typing, low), 6fe232e3 (auth-hardening: rate-limit/input-validation/logout-CSRF, medium), d7f716b4 (AppShell placeholder pages for unbuilt nav routes, low). SECURITY-SCOPE: audit-log integrity + immutability → mandatory T-8 Security + P-4 security-scope-tightened gate. P-0 must walk the unassigned queue (depth 1).

PRODUCT:
- [ ] P-0 Frame (discover + reframe)
- [ ] P-1 Decompose
- [ ] P-2 Spec
- [ ] P-3 Plan
- [x] P-4 Gate — PASSED (head-product APPROVED; karen+jenny APPROVE after 4b route/design remediation; Gemini 429; security-scope 3-iter)

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

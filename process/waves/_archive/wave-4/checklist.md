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
- [x] B-0 Branch & schema — branch wave-4-audit-log; no new deps (node:crypto); schema=YES(0002@B-2); 4 tasks claimed
- [x] B-1 Contracts — shared audit types + AuditVerifyResponse + roleRoutes audit-log nav/endpoint (b0eed89); 164 tests
- [x] B-2 Backend — migration 0002 (immutability PROVEN) + HMAC service+verifier+endpoint (3602994,54ff1b8); 88 tests
- [x] B-3 Frontend — audit-log integrity view at /compliance/audit-log (broken=persistent non-dismissible); 95 tests (2d6bfda)
- [x] B-4 Wiring — repo typecheck+build PASS; /compliance/audit-log compiles; AUDIT_LOG_HMAC_KEY→C-2
- [x] B-5 Verify — lint 0-err, 347 tests pass, build pass; golden-vector present; audit runtime→C-2
- [x] B-6 Review — head-builder APPROVED; /review 2 CRIT fixed (chain-verifies-live + verify-now-proxy); commit-discipline PASS

CI/CD:
- [x] C-1 PR, CI & merge — cd06e8a merged to main; CI (all checks) conclusion=success on cd06e8a (deliverable file back-fill pending; substance verified)
- [x] C-2 Deploy & verify — cd06e8a live on Railway (api+web SUCCESS); /health version=cd06e8a; AUDIT_LOG_HMAC_KEY set; migration 0002 applied (audit_log_entries live); LIVE chain verify ok:true entriesChecked:3 (created_at-fix proven); immutability UPDATE/DELETE/TRUNCATE rejected; tamper-detection ok:false@seq2→restored; RBAC 200/403/401; login regression intact; canary skipped (0 DAU); head_signoff APPROVED

TEST:
- [x] T-1 Static
- [x] T-2 Unit
- [x] T-3 Contract
- [x] T-4 Integration
- [x] T-5 E2E — 7/7 real-browser PASS (verify-now works in-browser = B-6-fix proof; RBAC nav); Chrome
- [x] T-6 Layout — integrity view visual §Integrity-Validation conformant (emerald pill, entries=3, intact)
- [x] T-7 Perf
- [x] T-8 Security
- [x] T-9 Journey — head-tester APPROVED; journey regen (audit-log backbone LIVE)

VERIFY:
- [x] V-1 Independent reviews (Karen + jenny, parallel) — Karen + jenny both APPROVE (audit-log tamper-evident+verifiable LIVE, 0 drift)
- [x] V-2 Triage — 0 blocking; TopBar-title→polish task; tail-truncation accepted boundary
- [x] V-3 Fast-fix loop (or close) — head-verifier APPROVED; fast-fix skipped (0 blocking)

LEARN:
- [x] L-1 Docs — CHANGELOG 0.4.0 (audit log); README audit-log note; M2 stays in_progress (open_count=3)
- [x] L-2 Distill — 5 observations; 1 promotion (VERIFY rule 1: real-boundary serialization test); 4 tasks done

NEXT:
- [x] N-1 Survey & triggers — M2 stays in_progress (rules-engine + pre-send-gate half unshipped); decomposition fired → milestone-decomposer authored M2 next bundle (seed 0595a835 + 3 siblings); head-next APPROVED
- [x] N-2 Seed — bundle = compliance rules engine + non-bypassable pre-send gate (vertical DB→service→UI); claimed_task_ids [0595a835, 95adac6c, 034463b1, 34cb1d18]; validation PASS; head-next APPROVED
- [x] N-3 Handoff — next_wave=5; wave-4 closed (waves.status=ok); archived → _archive/wave-4; .last-wave-completed.yaml written; loop_state ready

## Wave 14 stage completion

**Seed:** 07bd1e1a-d71b-4e31-bc75-95de5a48aeef — Add mandate-derivation real-DB e2e for the recordkeeping scoped-export
**Bundled siblings:**
- 487b0f0c-bc4b-49f3-980f-07fd4f3503bc — Record mandate/outreach context on the compliance gate audit row
- f5074df8-bd4e-4e39-864c-94574fecd9be — Build the compliance approval-queue page (/compliance/queue)
**claimed_task_ids:** [07bd1e1a-d71b-4e31-bc75-95de5a48aeef, 487b0f0c-bc4b-49f3-980f-07fd4f3503bc, f5074df8-bd4e-4e39-864c-94574fecd9be]
**Active milestone:** a068dc3d-8f77-4d01-ba1d-bbc6ed9b16bc — M6 — Compliant outreach & pipeline (one live mandate, end-to-end) — in_progress
**Bundle theme:** M6 buildable-without-credential compliance hardening (Option A). ~2,800 LOC, additive-only schema.

**Carry-forward notes for P-0:**
- FOUNDER-CREDENTIAL GUARD still binds M6: compliant email SEND + webhook tracking (email-provider key + EMAIL_WEBHOOK_SECRET, product-decision #141), reply/open pipeline auto-advance (depends on webhook layer), and AI-assisted drafting (LLM-spend Tier-3, `founder-decision-llm-matching-spend.md` unanswered) remain the founder-gated M6 remainder — NOT in this wave.
- Seed 07bd1e1a is HARD-GATED (wave-13 V-2 DEV-2): the mandate-scoped recordkeeping export must NOT back a live regulator request until this real-DB e2e lands. Treat as compliance-load-bearing at P-4/T-8.
- Sibling 487b0f0c is additive audit-metadata only — must NOT break the M2 HMAC-SHA256 hash-chain format; existing full-chain integrity + non-bypassable gate behavior are regression-protected.
- Sibling f5074df8 (/compliance/queue) is a UI wave → D-block likely fires (design_gap_flag at P-1); role-scoped + sender!=approver SoD held + each action audited.
- Unassigned queue (P-0 walk): b1a0b2ac "Tighten /health spec wording" (low-salience observability nicety; not M6-scope) remains for assignment/deferral.

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

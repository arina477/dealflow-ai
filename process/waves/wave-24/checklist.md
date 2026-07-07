# Wave 24 checklist — M10 compliance-hardening (genesis)

> **Active milestone:** M10 — Advanced compliance & recordkeeping (SOX/FINRA artifacts) (033f97e0-bc25-48dd-bb5a-b2f2be5b056a)
> **Seed (single-task bundle):** fd8f2860-51d7-446d-b0b0-dfbf9e54f3dd — "Standing AC: populated-DB migration proof for any WORM/audit-table migration"
> **claimed_task_ids:** [fd8f2860-51d7-446d-b0b0-dfbf9e54f3dd]
> **Bundled siblings:** none
> **SCOPE NOTE:** compliance-HARDENING wave (audit-backbone migration-proof standing AC) — NOT M10 recordkeeping-artifact progress (scope-drift guard, per N-2 head-next ruling).
> **CARRIED FLAGS (P-0 must honor):**
>  - Founder digest: M10 ## Success metric _TBD (route to founder) + founder-gated pile-up M5/M6/M7/M9-CRM + M9 _TBD metric (DUE).
>  - Milestone-integrity: M10 lacks a purpose-authored recordkeeping vertical — flag to next roadmap-planning; do NOT let this wave be recorded as recordkeeping progress.
>  - Any M10 work touching the M2 audit chain: fenced ADDITIVE-READ-ONLY (no HMAC-preimage change, no audit_log_entries schema mutation) per BOARD risk caveat.

## Wave 24 stage completion

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

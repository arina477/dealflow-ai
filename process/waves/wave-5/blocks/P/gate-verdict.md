# Wave 5 — P-4 Verdict

**Reviewer:** head-product (fresh spawn)
**Reviewed against:** process/waves/wave-5/blocks/P/review-artifacts.md
**Attempt:** 1  (1 = first gate)
**Phase:** 1 (head-product)

## Verdict
APPROVED

## Rationale
This wave builds the load-bearing enforcement half of the compliance wedge — the rules-engine tables plus a single, non-bypassable pre-send compliance check — and its acceptance criteria are falsifiable, observable, and deliver genuine enforcement rather than aspirational prose. The gate is one server-side choke point with no skippable fast path: a single `evaluate()` method with no skip/dry-run flag, all four checks (suppression, separation-of-duties, disclaimers, approval content-hash binding) run on every call, and the verdict is written to the wave-4 tamper-evident audit log in the same transaction before the method returns — so no compliance decision can exist without its record, and a failed audit write rolls the whole thing back. Separation of duties is real and server-side: a send is blocked unless a stored approval row exists whose approver is a different person than the sender and holds a compliance/admin role, with the approver identity read only from the persisted row and never from any client-supplied field — self-approval is blocked. The approval is bound to a content hash the gate recomputes, so editing content after approval re-blocks the send (an approval cannot be reused for different content). Suppression and disclaimers are hard blocks, not advisories. The team is honest about scope: this wave delivers the gate as an enforced callable contract, does NOT claim a live send path exists, and the requirement that the future outreach send-path must call this gate is tracked as an explicit M6 dependency so "non-bypassable" is not silently downgraded to "callable but uncalled" at verification. The mutable-config-versus-immutable-audit distinction is handled correctly (the four rules tables are mutable but every change is audited into the immutable log; only the audit log itself is trigger-protected and insert-only), role-based access on the settings screen and CRUD endpoints is compliance/admin with navigation constrained to the same permission set, and the thin slice is right — gating and rules management now, the composer that calls the gate later. No compliance antipattern is present. One non-blocking carry for later stages: the content-hash algorithm and its canonicalization must be byte-identical between the gate's recompute path and the (future, M6-side) approval-creation path that stores the hash — the plan already mandates a shared canonicalizer, so this is an execution-fidelity check for Build/Verify, not a spec defect.

## Footer
- verdict_complete: true
- rework_attempt_cap_remaining: 2

---
## Phase 2 — Karen + jenny + Gemini (security-scope tightened + SoD = 2 iterations)
**Karen (load-bearing claims):** APPROVE — 7 claims verified against live source: AuditService.append(input,tx) in-tx reuse real (audit.service.ts:75 + rollback-on-audit-fail precedent :141-148), no-skip-path+mandatory-audit buildable (db.transaction real), SoD server-side from stored approval, content-hash node:crypto SHA-256 (no new dep), mutable-config-vs-immutable-audit distinction sound, specialists exist, additive schema (0003 follows 0002). Karen FLAGGED the SoD-admin nuance (Low→escalated by jenny to Critical).
**jenny (spec-vs-architecture drift):** iter-1 BLOCK — 1 CRITICAL: SoD approver `∈{compliance,admin}` DRIFTS from security.md §RBAC-SoD (64-65,87,125: approver = `compliance` ONLY, admin excluded, "no super-role shortcut around separation of duties"). Items 2/3/5/6/7 MATCH; item 4 (databases.md staleness) LOW.
**Remediation (SoD-strictness, no scope change):** SoD approver corrected to `compliance` ONLY across spec (seed addendum + inline AC) + plan (Δ3, step 2.6, failure-domain, column comment, remediation §). Settings-CRUD @Roles LEFT `compliance,admin` (admin manages config — distinct authority, correctly not over-corrected). databases.md reconciliation → L-1/L-2.
**jenny iter-2:** APPROVE — Item 1 RESOLVED (every SoD-approver reference = compliance only, admin excluded; CRUD @Roles correctly unchanged; inline block-2 AC also rewritten so nothing relies on supersession).
**Gemini:** UNAVAILABLE (HTTP 429 — degraded, non-blocking).

## Phase 2 Verdict: PASS (Karen APPROVE + jenny APPROVE iter-2 + Gemini UNAVAILABLE-degraded; 2 Phase-2 iterations satisfy the security-scope tightened + SoD gate).

**P-block gate: PASSED.** design_gap_flag=false → next block B.

### B-block execution notes carried from P-4:
1. **SoD approver = `compliance` ONLY** (admin excluded; self-approval blocked; approver from stored row server-side). CRUD @Roles = compliance,admin (config management).
2. Single non-bypassable gate: evaluate() runs ALL evaluators (no skip param) + writes verdict to AuditService.append IN-TX before return (no verdict without audit; tx rollback on audit fail — mirror the wave-4 self-check-rollback precedent).
3. 4 mutable config tables (NO immutability trigger — distinct from audit_log; audited-on-change). additive migration 0003.
4. content-hash binding = keyless SHA-256 (node:crypto, canonicalized) — post-approval edit re-blocks.
5. M6 send-path must call evaluate() (dependency tracked — do NOT claim a live non-bypass send path this wave).
6. B-6/T assert: (a) all evaluators run every call (no reachable skip); (b) audit-fail→throw→rollback→no verdict; (c) evaluator restricts approver to compliance-only.
7. L-1/L-2: reconcile databases.md compliance-tables sketch to as-built shapes.
